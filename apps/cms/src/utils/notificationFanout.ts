import type { Payload } from 'payload'
import { broadcastUserNotification } from './supabaseNotifications'

// ============================================================================
// Notification Fanout for the ordering system
//
// Creates the durable notification records (notification-events +
// user-notifications) and then pushes the realtime broadcast so the customer's
// bell updates instantly.
// ============================================================================

type NotificationFanoutArgs = {
  payload: Payload
  /** Payload `users` collection id of the recipient. */
  userId: string | number
  typeKey: string
  domain: 'order' | 'account' | 'system' | 'marketing' | 'custom'
  title: string
  body: string
  sourceEntityType?: string
  sourceEntityId?: string | number
  metadata?: Record<string, unknown>
  priority?: 'info' | 'warning' | 'critical'
}

type NotificationFanoutInput = Omit<NotificationFanoutArgs, 'payload' | 'userId'>

// In-memory template cache (perf): avoids one find per fanout.
// TTL 60s; templates change rarely and lookup is fail-open anyway.
const TEMPLATE_TTL_MS = 60 * 1000
const templateCache = new Map<string, { at: number; doc: any | null }>()

async function findTemplateCached(payload: Payload, typeKey: string): Promise<any | null> {
  const hit = templateCache.get(typeKey)
  if (hit && Date.now() - hit.at < TEMPLATE_TTL_MS) return hit.doc
  try {
    const result = await payload.find({
      collection: 'notification-templates',
      where: { typeKey: { equals: typeKey } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = result.docs[0] ?? null
    templateCache.set(typeKey, { at: Date.now(), doc })
    return doc
  } catch {
    return hit?.doc ?? null
  }
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for pickup',
  on_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const LALAMOVE_STATUS_LABELS: Record<string, string> = {
  assigning_driver: 'Assigning Driver',
  driver_assigned: 'On Going',
  picked_up: 'Picked Up',
  completed: 'Completed',
  canceled: 'Cancelled',
  rejected: 'Rejected',
  expired: 'Expired',
}

export const WALLET_TYPE_LABELS: Record<string, string> = {
  topup: 'Top-up',
  payment: 'Wallet payment',
  refund: 'Refund',
  cashback: 'Cashback',
  withdrawal: 'Withdrawal',
  adjustment: 'Adjustment',
  expiry: 'Expired',
}

export function getWalletTypeLabel(type?: string | null): string {
  if (!type) return 'updated'
  return WALLET_TYPE_LABELS[type] || type
}

export function getOrderStatusLabel(
  status?: string | null,
  deliveryStatus?: string | null,
): string {
  // Prefer Lalamove delivery status label when available
  if (deliveryStatus && LALAMOVE_STATUS_LABELS[deliveryStatus]) {
    return LALAMOVE_STATUS_LABELS[deliveryStatus]
  }
  if (!status) return 'updated'
  return ORDER_STATUS_LABELS[status] || status
}

export async function createNotificationFanout({
  payload,
  userId,
  typeKey,
  domain,
  title,
  body,
  sourceEntityType,
  sourceEntityId,
  metadata,
  priority = 'info',
}: NotificationFanoutArgs) {
  if (!userId) return null

  const deliveredAt = new Date().toISOString()
  const numericUserId = typeof userId === 'number' ? userId : Number(userId)
  if (!Number.isFinite(numericUserId)) return null

  // Preference gate: marketing requires explicit opt-in; an inactive
  // template suppresses the fanout entirely. Fail-open (deliver) on lookup
  // errors to preserve existing behavior for order/account/system.
  try {
    if (domain === 'marketing') {
      const { docs } = await payload.find({
        collection: 'notification-preferences',
        where: { user: { equals: numericUserId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const prefs = docs[0] as any
      const optedIn = prefs ? !!prefs.marketingOptIn : true
      if (!optedIn) return { skipped: 'opted-out' as const }
    }
  } catch {
    // Fail-open: deliver when preferences cannot be read.
  }

  // Template lookup is cached in-memory (perf: one fewer find per fanout).
  let template: number | undefined
  try {
    const templateDoc = (await findTemplateCached(payload, typeKey)) as any
    if (templateDoc && templateDoc.isActive === false) {
      return { skipped: 'template-inactive' as const }
    }
    const templateId = templateDoc?.id
    if (typeof templateId === 'number') {
      template = templateId
    } else if (typeof templateId === 'string' && /^\d+$/.test(templateId)) {
      template = Number(templateId)
    }
  } catch {
    // Templates are optional - never fail the fanout over a template lookup.
  }

  const notificationEvent = await payload.create({
    collection: 'notification-events',
    data: {
      ...(template ? { template } : {}),
      typeKey,
      domain,
      title,
      body,
      metadata,
      origin: 'automatic',
      priority,
      ...(sourceEntityType ? { sourceEntityType } : {}),
      ...(sourceEntityId != null ? { sourceEntityId: String(sourceEntityId) } : {}),
    },
    depth: 0,
    overrideAccess: true,
  })

  const userNotification = await payload.create({
    collection: 'user-notifications',
    data: {
      user: numericUserId,
      notificationEvent: notificationEvent.id,
      channel: 'in_app',
      status: 'unread',
      deliveredAt,
    },
    depth: 0,
    overrideAccess: true,
  })

  // Realtime bell is best-effort — never gate the response on it (perf).
  void broadcastUserNotification(userId, {
    id: userNotification.id,
    title,
    body,
    domain,
    typeKey,
    status: 'unread',
    channel: 'in_app',
    priority,
    deliveredAt,
    metadata,
  }).catch(() => {})

  return { notificationEvent, userNotification }
}

export async function createMerchantNotificationFanout(
  payload: Payload,
  merchantId: string | number | null | undefined,
  args: NotificationFanoutInput,
) {
  if (merchantId == null) return null

  const merchant = await payload.findByID({
    collection: 'merchants',
    id: merchantId,
    depth: 0,
    overrideAccess: true,
  })
  const vendorId = typeof merchant.vendor === 'object' && merchant.vendor !== null
    ? merchant.vendor.id
    : merchant.vendor
  if (vendorId == null) return null

  const vendor = await payload.findByID({
    collection: 'vendors',
    id: vendorId,
    depth: 0,
    overrideAccess: true,
  })
  const userId = typeof vendor.user === 'object' && vendor.user !== null ? vendor.user.id : vendor.user
  if (userId == null) return null

  return createNotificationFanout({ payload, userId, ...args })
}

export async function createAdminNotificationFanout(
  payload: Payload,
  args: NotificationFanoutInput,
) {
  const admins = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })

  await Promise.all(admins.docs.map((admin) => createNotificationFanout({
    userId: admin.id,
    ...args,
    payload,
  })))
}