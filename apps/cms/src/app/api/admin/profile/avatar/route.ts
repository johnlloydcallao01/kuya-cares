/**
 * @file apps/cms/src/app/api/admin/profile/avatar/route.ts
 * @description BFF for avatar upload/remove. Backend owns media creation and user linking.
 * POST   /api/admin/profile/avatar?userId=123  (multipart form-data, field "file")
 * DELETE /api/admin/profile/avatar?userId=123  (removes profilePicture)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin, generateUniqueFilename } from '@/utils/mediaLibrary'

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

function sanitizeProfilePicture(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  const id = Number(src.id)
  const url = (src.cloudinaryURL as string) || (src.url as string)
  if (!url || Number.isNaN(id)) return null
  return { id, filename: (src.filename as string) || '', url, alt: (src.alt as string) || null }
}

function sanitizeUser(raw: Record<string, any>): Record<string, any> {
  const pp = sanitizeProfilePicture(raw.profilePicture)
  return {
    id: raw.id,
    email: raw.email || '',
    firstName: raw.firstName || '',
    lastName: raw.lastName || '',
    middleName: raw.middleName || null,
    nameExtension: raw.nameExtension || null,
    username: raw.username || null,
    role: raw.role || null,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : null,
    gender: raw.gender || null,
    civilStatus: raw.civilStatus || null,
    nationality: raw.nationality || null,
    birthDate: raw.birthDate || null,
    placeOfBirth: raw.placeOfBirth || null,
    completeAddress: raw.completeAddress || null,
    phone: raw.phone || null,
    lastLogin: raw.lastLogin || null,
    profilePicture: pp,
    createdAt: raw.createdAt || '',
    updatedAt: raw.updatedAt || '',
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateAdmin(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const rawUserId = searchParams.get('userId') || String(authUser.id)
    const userIdNum = Number(rawUserId)
    if (Number.isNaN(userIdNum)) return NextResponse.json({ error: 'userId must be numeric' }, { status: 400 })

    // Only self unless system admin
    let isSystemAdmin = false
    try {
      const r = await payload.find({ collection: 'admins', where: { user: { equals: authUser.id } }, limit: 1, depth: 0, overrideAccess: true })
      isSystemAdmin = (r.docs[0] as any)?.adminLevel === 'system'
    } catch {}
    if (String(authUser.id) !== String(userIdNum) && !isSystemAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided (field "file" required)' }, { status: 400 })
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Only JPG, PNG, WebP, GIF or AVIF allowed' }, { status: 400 })
    if (file.size > MAX_UPLOAD_SIZE) return NextResponse.json({ error: 'File too large. Max 5 MB.' }, { status: 413 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const sanitizedName = generateUniqueFilename(file.name)

    // Create media with overrideAccess (BFF is safe boundary)
    let media: Record<string, any>
    try {
      media = await payload.create({
        collection: 'media',
        data: { alt: `Avatar ${userIdNum} ${Date.now()}` },
        file: { data: buffer, mimetype: file.type, name: sanitizedName, filename: sanitizedName, size: file.size } as any,
        overrideAccess: true,
      }) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to upload image' }, { status: 500 })
    }

    // Link to user
    let updated: Record<string, any>
    try {
      updated = await payload.update({
        collection: 'users',
        id: userIdNum,
        data: { profilePicture: media.id },
        depth: 2,
        overrideAccess: true,
      }) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Image uploaded but failed to link to profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Profile picture updated', user: sanitizeUser(updated), mediaId: media.id })
  } catch (err: any) {
    console.error('[admin/profile/avatar] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateAdmin(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const rawUserId = searchParams.get('userId') || String(authUser.id)
    const userIdNum = Number(rawUserId)
    if (Number.isNaN(userIdNum)) return NextResponse.json({ error: 'userId must be numeric' }, { status: 400 })

    let isSystemAdmin = false
    try {
      const r = await payload.find({ collection: 'admins', where: { user: { equals: authUser.id } }, limit: 1, depth: 0, overrideAccess: true })
      isSystemAdmin = (r.docs[0] as any)?.adminLevel === 'system'
    } catch {}
    if (String(authUser.id) !== String(userIdNum) && !isSystemAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let updated: Record<string, any>
    try {
      updated = await payload.update({
        collection: 'users',
        id: userIdNum,
        data: { profilePicture: null },
        depth: 2,
        overrideAccess: true,
      }) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to remove picture' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Profile picture removed', user: sanitizeUser(updated) })
  } catch (err: any) {
    console.error('[admin/profile/avatar] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
