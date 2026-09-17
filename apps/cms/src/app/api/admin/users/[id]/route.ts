/**
 * @file apps/cms/src/app/api/admin/users/[id]/route.ts
 * @description BFF for single user (detail, update, delete) - admin-only safe boundary.
 * Mirrors apps/cms/src/app/api/admin/vendors/[id]/route.ts but for users collection.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { countLinkedRecords } from '../_lib/countLinked'
import { deleteCachedByPrefix } from '@encreasl/cache'

function optionalString(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() || null : null
}
function str(v: unknown, fb = ''): string {
  return typeof v === 'string' ? v : fb
}
function num(v: unknown, fb = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : fb
  }
  return fb
}
function sanitizeMediaRef(value: unknown): { id: number; url: string | null; filename: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  const id = Number(src.id)
  if (Number.isNaN(id)) return null
  const url =
    typeof src.cloudinaryURL === 'string' ? src.cloudinaryURL : typeof src.url === 'string' ? src.url : null
  return { id, url, filename: typeof src.filename === 'string' ? src.filename : null }
}
function sanitizeUserDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    email: str(raw.email, ''),
    firstName: str(raw.firstName, ''),
    lastName: str(raw.lastName, ''),
    middleName: optionalString(raw.middleName),
    nameExtension: optionalString(raw.nameExtension),
    phone: optionalString(raw.phone),
    username: optionalString(raw.username),
    gender: optionalString(raw.gender),
    civilStatus: optionalString(raw.civilStatus),
    nationality: optionalString(raw.nationality),
    birthDate: raw.birthDate ? String(raw.birthDate) : null,
    placeOfBirth: optionalString(raw.placeOfBirth),
    completeAddress: optionalString(raw.completeAddress),
    role: str(raw.role, 'customer'),
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    lastLogin: raw.lastLogin ? String(raw.lastLogin) : null,
    profilePicture: sanitizeMediaRef(raw.profilePicture),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

const ROLES = new Set(['admin', 'customer', 'service', 'vendor', 'driver'])
const GENDERS = new Set(['male', 'female', 'other', 'prefer_not_to_say'])
const CIVIL_STATUSES = new Set(['single', 'married', 'divorced', 'widowed', 'separated'])

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
      doc = (await payload.findByID({ collection: 'users', id: docId as number, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'User not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // fetch related counts for enrichment (optional enterprise context)
    const [customersRes, adminsRes, vendorsRes, driversRes, addressesRes] = await Promise.all([
      payload.find({ collection: 'customers', where: { user: { equals: doc.id } }, limit: 1, depth: 0, overrideAccess: true }).catch(() => ({ totalDocs: 0, docs: [] } as any)),
      payload.find({ collection: 'admins', where: { user: { equals: doc.id } }, limit: 1, depth: 0, overrideAccess: true }).catch(() => ({ totalDocs: 0, docs: [] } as any)),
      payload.find({ collection: 'vendors', where: { user: { equals: doc.id } }, limit: 5, depth: 0, overrideAccess: true }).catch(() => ({ totalDocs: 0, docs: [] } as any)),
      payload.find({ collection: 'drivers', where: { user: { equals: doc.id } }, limit: 1, depth: 0, overrideAccess: true }).catch(() => ({ totalDocs: 0, docs: [] } as any)),
      payload.find({ collection: 'addresses', where: { user: { equals: doc.id } }, limit: 50, depth: 0, overrideAccess: true }).catch(() => ({ totalDocs: 0, docs: [] } as any)),
    ])

    const sanitized = sanitizeUserDoc(doc)
    // enrich with related preview counts
    const related = {
      customerExists: ((customersRes as any).totalDocs ?? (customersRes as any).docs?.length ?? 0) > 0,
      adminExists: ((adminsRes as any).totalDocs ?? (adminsRes as any).docs?.length ?? 0) > 0,
      vendorCount: (vendorsRes as any).totalDocs ?? (vendorsRes as any).docs?.length ?? 0,
      vendorPreview: ((vendorsRes as any).docs as any[])?.map((v) => ({ id: v.id, businessName: String(v.businessName ?? '') })) ?? [],
      driverExists: ((driversRes as any).totalDocs ?? (driversRes as any).docs?.length ?? 0) > 0,
      addressCount: (addressesRes as any).totalDocs ?? (addressesRes as any).docs?.length ?? 0,
    }

    // user events timeline (last 8)
    let recentEvents: any[] = []
    try {
      const ev = await payload.find({
        collection: 'user-events',
        where: { user: { equals: doc.id } },
        sort: '-timestamp',
        limit: 8,
        depth: 0,
        overrideAccess: true,
      })
      recentEvents = (ev.docs as any[]).map((e) => ({
        id: e.id,
        eventType: String(e.eventType ?? ''),
        timestamp: String(e.timestamp ?? e.createdAt ?? ''),
        eventData: e.eventData ?? null,
      }))
    } catch {}

    return NextResponse.json({ doc: sanitized, related, recentEvents })
  } catch (err: any) {
    console.error('[admin/users/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load user' }, { status: 500 })
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

    // Whitelist updatable fields enterprise-grade (mirrors POST + vendors/[id] PATCH)
    const patch: Record<string, any> = {}

    if (typeof body.firstName === 'string') {
      const v = body.firstName.trim()
      if (!v || v.length < 2) return NextResponse.json({ error: 'firstName must be at least 2 characters' }, { status: 400 })
      patch.firstName = v
    }
    if (typeof body.lastName === 'string') {
      const v = body.lastName.trim()
      if (!v || v.length < 2) return NextResponse.json({ error: 'lastName must be at least 2 characters' }, { status: 400 })
      patch.lastName = v
    }
    if (typeof body.email === 'string') {
      const v = body.email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return NextResponse.json({ error: 'email must be valid' }, { status: 400 })
      patch.email = v
    }
    if (body.middleName !== undefined) patch.middleName = typeof body.middleName === 'string' ? body.middleName.trim() || null : null
    if (body.nameExtension !== undefined) patch.nameExtension = typeof body.nameExtension === 'string' ? body.nameExtension.trim() || null : null
    if (body.phone !== undefined) patch.phone = typeof body.phone === 'string' ? body.phone.trim() || null : null

    if (body.username !== undefined) {
      if (body.username === null || body.username === '') patch.username = null
      else if (typeof body.username === 'string') {
        const v = body.username.trim()
        if (v && !/^[a-zA-Z0-9._-]+$/.test(v)) return NextResponse.json({ error: 'username may only contain letters, numbers, dot, underscore, hyphen' }, { status: 400 })
        patch.username = v || null
      }
    }
    if (body.gender !== undefined) {
      if (body.gender === null || body.gender === '') patch.gender = null
      else if (typeof body.gender === 'string') {
        const v = body.gender.trim().toLowerCase()
        if (!GENDERS.has(v)) return NextResponse.json({ error: `gender must be one of ${Array.from(GENDERS).join(', ')}` }, { status: 400 })
        patch.gender = v
      }
    }
    if (body.civilStatus !== undefined) {
      if (body.civilStatus === null || body.civilStatus === '') patch.civilStatus = null
      else if (typeof body.civilStatus === 'string') {
        const v = body.civilStatus.trim().toLowerCase()
        if (!CIVIL_STATUSES.has(v)) return NextResponse.json({ error: `civilStatus must be one of ${Array.from(CIVIL_STATUSES).join(', ')}` }, { status: 400 })
        patch.civilStatus = v
      }
    }
    if (body.nationality !== undefined) patch.nationality = typeof body.nationality === 'string' ? body.nationality.trim() || null : null
    if (body.placeOfBirth !== undefined) patch.placeOfBirth = typeof body.placeOfBirth === 'string' ? body.placeOfBirth.trim() || null : null
    if (body.completeAddress !== undefined) patch.completeAddress = typeof body.completeAddress === 'string' ? body.completeAddress.trim() || null : null
    if (body.role !== undefined) {
      if (typeof body.role === 'string') {
        const v = body.role.trim().toLowerCase()
        if (!ROLES.has(v)) return NextResponse.json({ error: `role must be one of ${Array.from(ROLES).join(', ')}` }, { status: 400 })
        patch.role = v
      }
    }
    if (typeof body.isActive === 'boolean') patch.isActive = body.isActive
    else if (body.isActive !== undefined) {
      const v = String(body.isActive).toLowerCase()
      if (v === 'true') patch.isActive = true
      else if (v === 'false') patch.isActive = false
    }
    if (body.birthDate !== undefined) {
      if (body.birthDate === null || body.birthDate === '') patch.birthDate = null
      else {
        const d = new Date(String(body.birthDate))
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'birthDate must be a valid date' }, { status: 400 })
        patch.birthDate = d.toISOString()
      }
    }
    if (body.profilePicture !== undefined) {
      if (body.profilePicture === null || body.profilePicture === '') patch.profilePicture = null
      else {
        const n = Number(body.profilePicture)
        if (Number.isNaN(n)) return NextResponse.json({ error: 'profilePicture must be numeric media id' }, { status: 400 })
        patch.profilePicture = n
      }
    }

    // password update via patch (if provided, must be >=8)
    if (body.password !== undefined) {
      if (body.password === null || body.password === '') {
        // ignore empty password
      } else if (typeof body.password === 'string') {
        if (body.password.length < 8) return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 })
        patch.password = body.password
      }
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    let updated: Record<string, any>
    try {
      updated = (await payload.update({ collection: 'users', id: docId as number, data: patch as any, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to update user'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate value violates unique constraint', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeUserDoc(updated)
    return NextResponse.json({ success: true, message: 'User updated successfully', doc: sanitized })
  } catch (err: any) {
    console.error('[admin/users/[id]] PATCH error:', err)
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
    const docId: number = Number.isFinite(numericId) ? numericId : Number(id)

    // Prevent self-delete
    if (admin && String(admin.id) === String(docId)) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const qsReassign = searchParams.get('reassignTo') || searchParams.get('reassign') || searchParams.get('reassign_to')
    let bodyReassign: unknown = null
    if (!qsReassign) {
      try {
        const cloneText = await request.clone().text()
        if (cloneText) {
          const j = JSON.parse(cloneText)
          bodyReassign = j?.reassignTo ?? j?.reassign ?? j?.reassign_to ?? null
        }
      } catch {}
    }
    const reassignToRaw = qsReassign ?? (bodyReassign != null ? String(bodyReassign) : null)
    const reassignToId = reassignToRaw != null && String(reassignToRaw).trim() !== '' ? Number(String(reassignToRaw).trim()) : null
    const hasReassign = reassignToId != null && Number.isFinite(reassignToId)

    // If no reassignment is provided, the user must have zero linked records to be deleted directly.
    // Uses the same shared counter as the dependencies endpoint. Fail-CLOSED: if any
    // count query fails, refuse to decide instead of treating the failure as zero.
    if (!hasReassign) {
      const linked = await countLinkedRecords(payload, docId)
      if (linked.failed.length > 0) {
        return NextResponse.json(
          { error: 'Unable to verify linked records. Please try again.', code: 'VERIFY_FAILED', failed: linked.failed },
          { status: 500 }
        )
      }
      if (linked.totalLinked > 0) {
        return NextResponse.json(
          {
            error: 'This user still owns content. Choose a user to attribute their content to before deleting.',
            code: 'REASSIGN_REQUIRED',
            details: 'Select a user to attribute all content to before deleting this user.',
            counts: { ...linked.counts, merchants: linked.merchants, orders: linked.orders },
            totalLinked: linked.totalLinked,
          },
          { status: 409 }
        )
      }
    }

    // Validate reassignment target
    let targetUser: Record<string, any> | null = null
    if (hasReassign) {
      if (String(reassignToId) === String(docId)) {
        return NextResponse.json({ error: 'Cannot reassign content to the same user you are deleting.' }, { status: 400 })
      }
      try {
        targetUser = (await payload.findByID({ collection: 'users', id: reassignToId as number, depth: 0, overrideAccess: true })) as unknown as Record<string, any>
      } catch {
        return NextResponse.json({ error: 'Reassignment target user not found.' }, { status: 404 })
      }
      if (!targetUser) return NextResponse.json({ error: 'Reassignment target user not found.' }, { status: 404 })
    }

    // REASSIGNMENT MODE — transfer content to the target user via Payload API
    // (same proven path the CMS admin panel uses; no raw SQL, no content deletion)
    const reassigned: Record<string, number> = {}
    if (hasReassign && targetUser) {
      const targetId = targetUser.id as number
      const bulkReassign = async (collection: string, field: string) => {
        try {
          const res: any = await payload.find({
            collection: collection as any,
            where: { [field]: { equals: docId } },
            limit: 1000,
            depth: 0,
            overrideAccess: true,
            pagination: false,
          } as any)
          const docs: any[] = res.docs || []
          let ok = 0
          for (const d of docs) {
            try {
              await payload.update({
                collection: collection as any,
                id: d.id,
                data: { [field]: targetId } as any,
                overrideAccess: true,
                depth: 0,
              })
              ok++
            } catch (e: any) {
              console.warn(`[admin/users/[id]] reassign ${collection}.${field} id=${d.id} failed:`, e?.message)
            }
          }
          if (ok > 0) reassigned[`${collection}.${field}`] = ok
        } catch (e: any) {
          console.warn(`[admin/users/[id]] bulkReassign ${collection}.${field} failed:`, e?.message)
        }
      }
      await bulkReassign('vendors', 'user')
      await bulkReassign('customers', 'user')
      await bulkReassign('admins', 'user')
      await bulkReassign('drivers', 'user')
      await bulkReassign('addresses', 'user')
      await bulkReassign('wishlists', 'user')
      await bulkReassign('recent-searches', 'user')
      await bulkReassign('recent-views', 'user')
      await bulkReassign('user-events', 'user')
      await bulkReassign('user-notifications', 'user')
      await bulkReassign('emergency-contacts', 'user')
      await bulkReassign('posts', 'author')
      await bulkReassign('user-events', 'triggeredBy')
      await bulkReassign('notification-events', 'triggeredBy')
      await bulkReassign('notification-templates', 'createdBy')
      await bulkReassign('notification-templates', 'updatedBy')
      await bulkReassign('order-tracking', 'actor')
    }

    // Plain record delete — vendor parity: exactly what the CMS admin panel does.
    // Relies on the schema's declared cascade/set-null FK actions for sessions,
    // preferences, locks and audit pointers instead of hand-rolled SQL.
    let deleted: any
    try {
      deleted = await payload.delete({ collection: 'users', id: docId, overrideAccess: true })
    } catch (e: any) {
      if (String(e?.message || '').toLowerCase().includes('not found')) {
        // Already gone — treat as successful deletion (idempotent)
        deleted = { id: docId }
      } else {
        // Walk the full cause chain: Drizzle wraps the Postgres error, so the
        // real blocker (constraint name, table, detail, SQLSTATE code) lives in `cause`.
        const parts: string[] = []
        const seen = new Set<unknown>()
        let cur: any = e
        while (cur && !seen.has(cur)) {
          seen.add(cur)
          if (cur?.message) parts.push(String(cur.message))
          if (cur?.detail) parts.push(`detail: ${cur.detail}`)
          if (cur?.constraint) parts.push(`constraint: ${cur.constraint}`)
          if (cur?.table) parts.push(`table: ${cur.table}`)
          if (cur?.code) parts.push(`code: ${cur.code}`)
          cur = cur?.cause
        }
        const full = parts.join(' | ') || 'Failed to delete user'
        console.error(`[admin/users/[id]] payload.delete failed for user ${docId}:`, full)
        return NextResponse.json({ error: full, code: 'DELETE_FAILED' }, { status: 400 })
      }
    }
    if (!deleted) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Bust list + dependency caches so the deletion reflects immediately (vendor parity)
    await deleteCachedByPrefix('admin:users:')
    await deleteCachedByPrefix('admin:user-dependencies:')

    return NextResponse.json({
      success: true,
      id: deleted.id ?? docId,
      message: hasReassign ? `User deleted and all content attributed to user #${(targetUser as any)?.id}.` : 'User deleted successfully',
      reassigned,
      reassignTo: hasReassign ? (targetUser as any)?.id : null,
    })
  } catch (err: any) {
    console.error('[admin/users/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
