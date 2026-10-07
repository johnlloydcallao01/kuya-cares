/**
 * PUT /api/customer/account/profile { ...whitelisted fields }
 * Self-serve profile update. Only safe fields are accepted — role,
 * isActive, email and verification timestamps can never change here
 * (email moves through the verify flow; role/isActive are admin-only).
 * Auth: customer JWT (self only).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomerOrMember } from '@/utils/mediaLibrary'
import { sanitizeAccountUser } from '../_shared'

const ALLOWED = [
  'firstName',
  'lastName',
  'middleName',
  'nameExtension',
  'phone',
  'username',
  'gender',
  'civilStatus',
  'nationality',
  'birthDate',
  'placeOfBirth',
  'preferredLanguage',
  'timezone',
  'currency',
] as const

const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say']
const CIVIL = ['single', 'married', 'divorced', 'widowed', 'separated']
const LANGS = ['en', 'fil']

export async function PUT(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateCustomerOrMember(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const data: Record<string, any> = {}
    for (const key of ALLOWED) {
      if (body[key] !== undefined) data[key] = body[key]
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    }
    if (data.firstName !== undefined && !String(data.firstName).trim()) {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 })
    }
    if (data.lastName !== undefined && !String(data.lastName).trim()) {
      return NextResponse.json({ error: 'Last name is required' }, { status: 400 })
    }
    if (data.gender !== undefined && data.gender !== null && !GENDERS.includes(data.gender)) {
      return NextResponse.json({ error: 'Invalid gender' }, { status: 400 })
    }
    if (data.civilStatus !== undefined && data.civilStatus !== null && !CIVIL.includes(data.civilStatus)) {
      return NextResponse.json({ error: 'Invalid civil status' }, { status: 400 })
    }
    if (data.preferredLanguage !== undefined && !LANGS.includes(data.preferredLanguage)) {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
    }
    if (data.username !== undefined && data.username !== null && !String(data.username).trim()) {
      return NextResponse.json({ error: 'Username cannot be empty' }, { status: 400 })
    }

    // Perf (raw power): drop unchanged values vs the already-loaded authUser.
    // A gender-only edit then becomes a single-column UPDATE with no username
    // unique check and a 1-field audit diff. No-op saves skip the DB entirely.
    const norm = (v: unknown) => (v === undefined ? undefined : (v as string | null))
    for (const key of Object.keys(data)) {
      const incoming = norm(data[key])
      const current = norm((authUser as Record<string, any>)[key])
      if (incoming === current) delete data[key]
      // Avoid a unique-constraint SELECT when the username did not change
      // (compare case-sensitively — DB unique is case-sensitive here).
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ data: { user: sanitizeAccountUser(authUser) } })
    }

    // Perf: depth 0 — the response merges already-known fields, no populate.
    let updated: Record<string, any>
    try {
      await payload.update({
        collection: 'users',
        id: Number(authUser.id),
        data,
        depth: 0,
        overrideAccess: true,
      })
      updated = { ...authUser, ...data }
    } catch (e: any) {
      const msg = String(e?.message || '')
      if (/unique|duplicate|already/i.test(msg)) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
      }
      return NextResponse.json({ error: msg || 'Failed to update profile' }, { status: 500 })
    }

    // Users.afterChange writes PROFILE_UPDATED automatically.
    return NextResponse.json({ data: { user: sanitizeAccountUser(updated) } })
  } catch (err: any) {
    console.error('[customer/account/profile] PUT error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
