/**
 * Shared helpers for customer self-service account BFF routes.
 * Not a route (underscore prefix). All routes authenticate the customer
 * JWT and operate strictly on the token owner's own records (no userId
 * params — IDOR impossible by construction).
 */

import type { Payload } from 'payload'
import { sql } from 'drizzle-orm'

export function sanitizeAccountUser(raw: Record<string, any>): Record<string, any> {
  const pic = raw.profilePicture
  const pp =
    pic && typeof pic === 'object'
      ? {
          id: pic.id,
          url: (pic.cloudinaryURL as string) || (pic.url as string) || null,
        }
      : null
  return {
    id: raw.id,
    email: raw.email || '',
    emailVerifiedAt: raw.emailVerifiedAt || null,
    phoneVerifiedAt: raw.phoneVerifiedAt || null,
    firstName: raw.firstName || '',
    lastName: raw.lastName || '',
    middleName: raw.middleName || null,
    nameExtension: raw.nameExtension || null,
    username: raw.username || null,
    phone: raw.phone || null,
    gender: raw.gender || null,
    civilStatus: raw.civilStatus || null,
    nationality: raw.nationality || null,
    birthDate: raw.birthDate || null,
    placeOfBirth: raw.placeOfBirth || null,
    preferredLanguage: raw.preferredLanguage || 'en',
    timezone: raw.timezone || 'Asia/Manila',
    currency: raw.currency || 'PHP',
    marketingOptIn: !!raw.marketingOptIn,
    dataConsentAt: raw.dataConsentAt || null,
    isActive: raw.isActive !== false,
    lastLogin: raw.lastLogin || null,
    profilePicture: pp,
    createdAt: raw.createdAt || '',
    updatedAt: raw.updatedAt || '',
  }
}

export function passwordPolicyError(pw: string): string | null {
  if (pw.length < 8 || pw.length > 40) {
    return 'Password must be 8-40 characters and include uppercase, number and special character.'
  }
  if (!/[A-Z]/.test(pw) || !/[0-9]/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) {
    return 'Password must be 8-40 characters and include uppercase, number and special character.'
  }
  return null
}

export async function verifyCurrentPassword(
  payload: Payload,
  userId: number,
  email: string,
  currentPassword: string,
): Promise<boolean> {
  try {
    await payload.login({
      collection: 'users',
      data: { email, password: currentPassword },
      overrideAccess: true,
    })
    return true
  } catch {
    return false
  }
}

/** Delete all JWT sessions for a user (sign out everywhere). Fail-open. */
export async function revokeUserSessions(payload: Payload, userId: number): Promise<boolean> {
  try {
    const db = (payload as any).db
    if (db && typeof db.execute === 'function') {
      await db.execute(sql`DELETE FROM "users_sessions" WHERE "_parent_id" = ${userId}`)
      return true
    }
    return false
  } catch (e) {
    console.error('[account] revokeUserSessions error:', e)
    return false
  }
}

export async function logAccountEvent(
  payload: Payload,
  userId: number | string,
  eventType: string,
  eventData: Record<string, unknown>,
  triggeredBy?: number | string | null,
): Promise<void> {
  try {
    await (payload as any).create({
      collection: 'user-events',
      data: {
        user: Number(userId) || userId,
        eventType,
        eventData,
        triggeredBy: triggeredBy ?? undefined,
        timestamp: new Date().toISOString(),
      },
      overrideAccess: true,
    })
  } catch (e) {
    console.error('[account] logAccountEvent error:', e)
  }
}

export async function sendAccountEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'support@kuyacares.com'
  const fromName = process.env.EMAIL_FROM_NAME || 'Kuya Cares'
  if (!apiKey) throw new Error('Email service not configured')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to, subject, html }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Email send failed: ${err.slice(0, 200)}`)
  }
}
