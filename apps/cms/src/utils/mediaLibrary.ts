/**
 * @file apps/cms/src/utils/mediaLibrary.ts
 * @description Shared helpers for the media library BFF endpoint.
 * The BFF endpoint is the safe access boundary: it verifies the admin JWT,
 * then uses overrideAccess: true internally to aggregate data across collections.
 */

import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import type { Payload } from 'payload'

/**
 * Collections and fields that reference Media documents.
 * Used to aggregate "where is this media used" across the system.
 */
export const MEDIA_REFERENCE_SPECS: Array<{
  collection: string
  field: string
  label: string
}> = [
  { collection: 'users', field: 'profilePicture', label: 'Users' },
  { collection: 'vendors', field: 'businessLicense', label: 'Vendors' },
  { collection: 'vendors', field: 'taxCertificate', label: 'Vendors' },
  { collection: 'vendors', field: 'logo', label: 'Vendors' },
  { collection: 'merchants', field: 'media.thumbnail', label: 'Merchants' },
  { collection: 'merchants', field: 'media.storeFrontImage', label: 'Merchants' },
  { collection: 'merchant-categories', field: 'icon', label: 'Merchant Categories' },
  { collection: 'product-categories', field: 'media.icon', label: 'Product Categories' },
  { collection: 'product-categories', field: 'media.bannerImage', label: 'Product Categories' },
  { collection: 'product-categories', field: 'media.thumbnailImage', label: 'Product Categories' },
  { collection: 'products', field: 'primaryImage', label: 'Products' },
  { collection: 'products', field: 'images.image', label: 'Products' },
  { collection: 'prod-variations', field: 'image', label: 'Product Variations' },
  { collection: 'drivers', field: 'driving_license_image', label: 'Drivers' },
  { collection: 'drivers', field: 'vehicle_registration_image', label: 'Drivers' },
]

/**
 * Extract the JWT from the Authorization header or payload cookie.
 * Mirrors Payload's own extractJWT (JWT / Bearer / cookie strategies).
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('JWT ')) {
    return authHeader.replace('JWT ', '')
  }
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '')
  }
  const cookie = request.cookies.get('payload-token')
  return cookie?.value ?? null
}

/**
 * Authenticate an admin user from the incoming request.
 * Returns the admin user document or null when unauthenticated / not admin.
 */
export async function authenticateAdmin(
  payload: Payload,
  request: NextRequest
): Promise<Record<string, any> | null> {
  const token = extractToken(request)
  if (!token) return null

  const secretKey = new TextEncoder().encode(payload.secret)
  let decoded: { id?: unknown; collection?: unknown }
  try {
    const result = await jwtVerify(token, secretKey)
    decoded = result.payload as { id?: unknown; collection?: unknown }
  } catch {
    return null
  }

  if (decoded.collection !== 'users' || decoded.id == null) {
    return null
  }

  try {
    const user = await payload.findByID({
      collection: 'users',
      id: decoded.id as number,
      depth: 0,
      overrideAccess: true,
    })
    if (!user || user.role !== 'admin') {
      return null
    }
    return user as Record<string, any>
  } catch {
    return null
  }
}

/**
 * Authenticate a vendor user from the incoming request.
 * Returns the vendor user document or null when unauthenticated / not vendor.
 * Mirrors authenticateAdmin but checks role === 'vendor'.
 */
export async function authenticateVendor(
  payload: Payload,
  request: NextRequest
): Promise<Record<string, any> | null> {
  const token = extractToken(request)
  if (!token) return null

  const secretKey = new TextEncoder().encode(payload.secret)
  let decoded: { id?: unknown; collection?: unknown }
  try {
    const result = await jwtVerify(token, secretKey)
    decoded = result.payload as { id?: unknown; collection?: unknown }
  } catch {
    return null
  }

  if (decoded.collection !== 'users' || decoded.id == null) {
    return null
  }

  try {
    const user = await payload.findByID({
      collection: 'users',
      id: decoded.id as number,
      depth: 0,
      overrideAccess: true,
    })
    if (!user || user.role !== 'vendor') {
      return null
    }
    if (user.isActive === false) return null
    return user as Record<string, any>
  } catch {
    return null
  }
}

/**
 * Traverse a document by a dotted field path and collect referenced media ids.
 * Handles single relationships, groups (media.thumbnail) and arrays (images.image).
 */
export function extractReferencedMediaIds(doc: Record<string, any>, path: string): Array<number | string> {
  const parts = path.split('.')
  let value: any = doc
  for (const part of parts) {
    if (value == null) return []
    value = value[part]
  }

  const ids: Array<number | string> = []
  const collect = (item: any) => {
    if (item == null) return
    if (Array.isArray(item)) {
      item.forEach(collect)
    } else if (typeof item === 'object') {
      // Payload relationship object shape: { relationTo, value }
      if ('value' in item) {
        collect(item.value)
      } else {
        // Array element object (e.g. images: [{ image: <id> }])
        const first = Object.values(item).find((v) => typeof v === 'number' || typeof v === 'string')
        if (first != null) ids.push(first as number | string)
      }
    } else {
      ids.push(item)
    }
  }
  collect(value)
  return ids
}

export interface MediaUsageEntry {
  collection: string
  label: string
  count: number
}

/**
 * Aggregate usage counts across all referencing collections for a set of media ids.
 * Runs one bounded query per referencing spec in parallel and tallies per media id.
 */
export async function aggregateMediaUsage(
  payload: Payload,
  mediaIds: Array<number | string>
): Promise<Map<number | string, MediaUsageEntry[]>> {
  const usageMap = new Map<number | string, MediaUsageEntry[]>()
  if (mediaIds.length === 0) return usageMap

  const results = await Promise.all(
    MEDIA_REFERENCE_SPECS.map(async (spec) => {
      try {
        const res = await payload.find({
          // @ts-expect-error - referencing specs span multiple dynamic collections
          collection: spec.collection,
          where: { [spec.field]: { in: mediaIds } },
          pagination: false,
          limit: 1000,
          depth: 0,
          overrideAccess: true,
        })
        return { spec, docs: res.docs }
      } catch {
        return { spec, docs: [] }
      }
    })
  )

  for (const { spec, docs } of results) {
    for (const doc of docs) {
      const refs = extractReferencedMediaIds(doc, spec.field)
      for (const ref of refs) {
        const entry = usageMap.get(ref)
        if (entry) {
          const existing = entry.find((e) => e.collection === spec.collection)
          if (existing) {
            existing.count += 1
          } else {
            entry.push({ collection: spec.collection, label: spec.label, count: 1 })
          }
        }
      }
    }
  }

  return usageMap
}

/**
 * Generate a URL-safe, unique filename to prevent uniqueness collisions in Payload/DB.
 */
export function generateUniqueFilename(originalName?: string | null): string {
  const rawName = originalName || `upload-${Date.now()}`
  const lastDot = rawName.lastIndexOf('.')
  let stem = rawName
  let ext = ''
  if (lastDot > 0) {
    stem = rawName.substring(0, lastDot)
    ext = rawName.substring(lastDot).toLowerCase()
  }
  const sanitizedStem = stem.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-_]/g, '') || 'upload'
  const sanitizedExt = ext.replace(/[^a-zA-Z0-9.]/g, '')
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 7)
  return `${sanitizedStem}-${timestamp}-${random}${sanitizedExt}`
}

/**
 * Map a raw Media document to a frontend-ready shape.
 */
export function mapMediaDoc(doc: Record<string, any>, usage: MediaUsageEntry[] = []): Record<string, any> {
  const mimeType: string = doc.mimeType || ''
  const isImage = mimeType.startsWith('image/')
  return {
    id: doc.id,
    filename: doc.filename || '',
    alt: doc.alt || '',
    url: doc.cloudinaryURL || doc.url || null,
    cloudinaryPublicId: doc.cloudinaryPublicId || null,
    mimeType,
    type: isImage ? 'image' : mimeType.startsWith('video/') ? 'video' : 'other',
    filesize: doc.filesize || 0,
    width: doc.width || null,
    height: doc.height || null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
    usage: {
      total: usage.reduce((sum, e) => sum + e.count, 0),
      references: usage,
    },
  }
}