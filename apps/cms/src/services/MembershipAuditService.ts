/**
 * @file apps/cms/src/services/MembershipAuditService.ts
 * @description Thin writer to the membership-audit-log collection.
 * Never throws: audit failures are console.warn only so billing flows
 * are never broken by observability writes.
 */

import type { Payload } from 'payload'

export type MembershipAuditAction =
  | 'grant'
  | 'deny'
  | 'upgrade'
  | 'downgrade'
  | 'renew'
  | 'cancel'
  | 'grace'
  | 'override'
  | 'entitlement_check'
  | 'sync'
  | 'vendor_registered'
  | 'admin_approve'
  | 'admin_waive'
  | 'webhook_paid'
  | 'webhook_failed'

export interface MembershipAuditEntry {
  vendor: string | number
  subscription?: string | number | null
  invoice?: string | number | null
  action: MembershipAuditAction | string
  plan_version?: number | null
  reason?: string | null
  actor?: string | number | null
  metadata?: Record<string, unknown> | null
  eventId?: string | null
}

function clean<T>(value: T): T | undefined {
  return value === undefined || value === null || value === '' ? undefined : value
}

/** Append an audit row with overrideAccess. Returns the doc or null. */
export async function log(payload: any, entry: MembershipAuditEntry): Promise<any | null> {
  try {
    return await (payload as Payload).create({
      collection: 'membership-audit-log',
      data: {
        vendor: entry.vendor,
        subscription: clean(entry.subscription),
        invoice: clean(entry.invoice),
        action: entry.action,
        plan_version: entry.plan_version ?? undefined,
        reason: entry.reason ?? undefined,
        actor: clean(entry.actor),
        metadata: entry.metadata ?? undefined,
        eventId: entry.eventId ?? undefined,
      },
      overrideAccess: true,
    } as any)
  } catch (e) {
    console.warn('[membership-audit] log failed:', e)
    return null
  }
}

export const MembershipAuditService = { log }
