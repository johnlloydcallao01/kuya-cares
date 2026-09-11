/**
 * @file apps/cms/src/app/api/admin/emergency-contacts/[id]/route.ts
 * @description BFF for single emergency-contact (detail, update, delete) - admin-only safe boundary.
 * Mirrors apps/cms/src/app/api/admin/customers/[id]/route.ts but for emergency-contacts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'

function optionalString(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() || null : null
}
function str(v: unknown, fb = ''): string {
  return typeof v === 'string' ? v : fb
}
function sanitizeUserBrief(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object') return null
  const u = value as Record<string, any>
  const id = Number(u.id)
  if (Number.isNaN(id)) return null
  return {
    id,
    email: str(u.email, ''),
    firstName: str(u.firstName, ''),
    lastName: str(u.lastName, ''),
    middleName: optionalString(u.middleName),
    phone: optionalString(u.phone),
    username: optionalString(u.username),
    role: str(u.role, 'customer'),
    isActive: typeof u.isActive === 'boolean' ? u.isActive : true,
    createdAt: String(u.createdAt ?? ''),
    updatedAt: String(u.updatedAt ?? ''),
  }
}
function sanitizeEmergencyContactDoc(raw: Record<string, any>): Record<string, any> {
  const userBrief = sanitizeUserBrief(raw.user)
  return {
    id: raw.id,
    user: userBrief,
    userId: userBrief ? userBrief.id : (typeof raw.user === 'number' ? raw.user : Number(raw.user) || null),
    firstName: str(raw.firstName, ''),
    middleName: optionalString(raw.middleName),
    lastName: str(raw.lastName, ''),
    contactNumber: str(raw.contactNumber, ''),
    relationship: str(raw.relationship, 'other'),
    completeAddress: str(raw.completeAddress, ''),
    isPrimary: !!raw.isPrimary,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

const RELATIONSHIPS = new Set(['parent', 'spouse', 'sibling', 'child', 'guardian', 'friend', 'relative', 'other'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id
    let doc: Record<string, any>
    try {
      doc = (await payload.findByID({ collection: 'emergency-contacts', id: docId as number, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Emergency contact not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'Emergency contact not found' }, { status: 404 })
    const sanitized = sanitizeEmergencyContactDoc(doc)
    return NextResponse.json({ doc: sanitized })
  } catch (err: any) {
    console.error('[admin/emergency-contacts/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load emergency contact' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id

    // fetch existing to know current user id (for primary toggle logic)
    let existing: Record<string, any> | null = null
    try {
      existing = (await payload.findByID({ collection: 'emergency-contacts', id: docId as number, depth: 1, overrideAccess: true })) as unknown as Record<string, any>
    } catch {
      return NextResponse.json({ error: 'Emergency contact not found' }, { status: 404 })
    }
    if (!existing) return NextResponse.json({ error: 'Emergency contact not found' }, { status: 404 })

    const patch: Record<string, any> = {}

    if (body.firstName !== undefined) {
      if (typeof body.firstName === 'string') {
        const v = body.firstName.trim()
        if (!v || v.length < 2) return NextResponse.json({ error: 'firstName must be at least 2 characters' }, { status: 400 })
        patch.firstName = v
      }
    }
    if (body.middleName !== undefined) {
      if (body.middleName === null || body.middleName === '') patch.middleName = null
      else if (typeof body.middleName === 'string') patch.middleName = body.middleName.trim() || null
    }
    if (body.lastName !== undefined) {
      if (typeof body.lastName === 'string') {
        const v = body.lastName.trim()
        if (!v || v.length < 2) return NextResponse.json({ error: 'lastName must be at least 2 characters' }, { status: 400 })
        patch.lastName = v
      }
    }
    if (body.contactNumber !== undefined) {
      if (typeof body.contactNumber === 'string') {
        const v = body.contactNumber.trim()
        if (!v) return NextResponse.json({ error: 'contactNumber is required' }, { status: 400 })
        patch.contactNumber = v
      }
    }
    if (body.relationship !== undefined) {
      if (typeof body.relationship === 'string') {
        const v = body.relationship.trim().toLowerCase()
        if (!RELATIONSHIPS.has(v)) return NextResponse.json({ error: `relationship must be one of ${Array.from(RELATIONSHIPS).join(', ')}` }, { status: 400 })
        patch.relationship = v
      }
    }
    if (body.completeAddress !== undefined) {
      if (typeof body.completeAddress === 'string') {
        const v = body.completeAddress.trim()
        if (!v) return NextResponse.json({ error: 'completeAddress is required' }, { status: 400 })
        patch.completeAddress = v
      }
    }
    if (body.isPrimary !== undefined) {
      if (typeof body.isPrimary === 'boolean') patch.isPrimary = body.isPrimary
      else {
        const v = String(body.isPrimary).toLowerCase()
        if (v === 'true') patch.isPrimary = true
        else if (v === 'false') patch.isPrimary = false
      }
    }
    // user reassignment
    if (body.user !== undefined || body.userId !== undefined) {
      const raw = body.user ?? body.userId
      if (raw !== null && raw !== '') {
        const uid = Number(raw)
        if (Number.isNaN(uid)) return NextResponse.json({ error: 'user must be numeric user id' }, { status: 400 })
        try {
          const u: any = await payload.findByID({ collection: 'users', id: uid, depth: 0, overrideAccess: true })
          if (!u) return NextResponse.json({ error: 'user not found' }, { status: 400 })
          patch.user = uid
        } catch (e: any) {
          return NextResponse.json({ error: e?.message || 'user not found' }, { status: 400 })
        }
      }
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    // if setting isPrimary true, unset other primaries for target user (use patch user if provided else existing user)
    const targetUserId =
      patch.user != null
        ? Number(patch.user)
        : (() => {
            const u = (existing as any).user
            if (!u) return null
            if (typeof u === 'object' && u.id != null) return Number(u.id)
            return Number(u)
          })()

    if (patch.isPrimary === true && targetUserId != null && Number.isFinite(targetUserId)) {
      try {
        const others: any = await payload.find({
          collection: 'emergency-contacts',
          where: { user: { equals: targetUserId }, isPrimary: { equals: true } },
          limit: 100,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        } as any)
        for (const doc of others.docs || []) {
          if (String(doc.id) === String(docId)) continue
          try {
            await payload.update({ collection: 'emergency-contacts', id: doc.id, data: { isPrimary: false } as any, overrideAccess: true, depth: 0 })
          } catch {}
        }
      } catch {}
    }

    let updated: Record<string, any>
    try {
      updated = (await payload.update({ collection: 'emergency-contacts', id: docId as number, data: patch as any, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to update emergency contact'
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeEmergencyContactDoc(updated)
    return NextResponse.json({ success: true, message: 'Emergency contact updated successfully', doc: sanitized })
  } catch (err: any) {
    console.error('[admin/emergency-contacts/[id]] PATCH error:', err)
    return NextResponse.json({ error: err?.message || 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const numericId = Number(id)
    const docId: number | string = Number.isFinite(numericId) ? numericId : id

    let deleted: any
    try {
      deleted = await payload.delete({ collection: 'emergency-contacts', id: docId as number, overrideAccess: true })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to delete emergency contact' }, { status: 400 })
    }
    if (!deleted) return NextResponse.json({ error: 'Emergency contact not found' }, { status: 404 })
    return NextResponse.json({ success: true, id: deleted.id, message: 'Emergency contact deleted successfully' })
  } catch (err: any) {
    console.error('[admin/emergency-contacts/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
