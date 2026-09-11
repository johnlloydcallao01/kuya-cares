import type { CollectionConfig } from 'payload'
import { createAdminNotificationFanout, createMerchantNotificationFanout, createNotificationFanout, getOrderStatusLabel } from '../utils/notificationFanout'

function resolveId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value !== null && 'id' in (value as any)) {
    return String((value as any).id)
  }
  return null
}

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['id', 'status', 'total', 'placed_at'],
    group: 'Ordering System',
    description: 'Central entity for all transactions',
  },
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (!data || typeof data !== 'object') return data
        const d = data as Record<string, any>
        // Guard the totals invariant on full writes (create, or updates that set every leg).
        // Partial PATCH updates (e.g. delivery book/cancel re-totals) skip this check.
        if (
          operation === 'create' &&
          d.total !== undefined &&
          d.subtotal !== undefined
        ) {
          const subtotal = Number(d.subtotal) || 0
          const deliveryFee = Number(d.delivery_fee ?? 0) || 0
          const platformFee = Number(d.platform_fee ?? 0) || 0
          const priorityFee = Number(d.priority_fee ?? 0) || 0
          const discountTotal = Number(d.discount_total ?? 0) || 0
          const expected = subtotal + deliveryFee + platformFee + priorityFee - discountTotal
          if (Math.abs(Number(d.total) - expected) > 0.01) {
            throw new Error(
              `Order total mismatch: expected ${expected.toFixed(2)} (subtotal + fees - discounts) but got ${Number(d.total).toFixed(2)}`,
            )
          }
        }
        return d
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        try {
          const orderId = resolveId(doc?.id) || String(doc?.id ?? '')
          const merchantId = resolveId(doc?.merchant)
          const status = doc?.status ?? null
          const previousStatus = previousDoc?.status ?? null

          if (operation === 'create') {
            await createAdminNotificationFanout(req.payload, {
              typeKey: 'order.created',
              domain: 'order',
              priority: 'info',
              title: 'New order received',
              body: `Order #${orderId} has been placed by a customer.`,
              sourceEntityType: 'order',
              sourceEntityId: orderId,
              metadata: {
                orderId,
                status,
                merchantId,
                customerId: resolveId(doc?.customer),
              },
            })
            await createMerchantNotificationFanout(req.payload, merchantId, {
              typeKey: 'order.created',
              domain: 'order',
              priority: 'info',
              title: 'New order received',
              body: `Order #${orderId} has been placed at your outlet.`,
              sourceEntityType: 'order',
              sourceEntityId: orderId,
              metadata: { orderId, status, merchantId, customerId: resolveId(doc?.customer) },
            })
          } else if (operation === 'update' && previousStatus && status && previousStatus !== status) {
            const label = getOrderStatusLabel(status, doc?.delivery_status)
            await createAdminNotificationFanout(req.payload, {
              typeKey: 'order.status_changed',
              domain: 'order',
              priority: status === 'cancelled' ? 'warning' : 'info',
              title: `Order ${label}`,
              body: `Order #${orderId} is now ${label.toLowerCase()}.`,
              sourceEntityType: 'order',
              sourceEntityId: orderId,
              metadata: {
                orderId,
                status,
                previousStatus,
                merchantId,
                customerId: resolveId(doc?.customer),
              },
            })
            await createMerchantNotificationFanout(req.payload, merchantId, {
              typeKey: 'order.status_changed',
              domain: 'order',
              priority: status === 'cancelled' ? 'warning' : 'info',
              title: `Order ${label}`,
              body: `Order #${orderId} is now ${label.toLowerCase()}.`,
              sourceEntityType: 'order',
              sourceEntityId: orderId,
              metadata: { orderId, status, previousStatus, merchantId, customerId: resolveId(doc?.customer) },
            })
          }

          const customerId = resolveId(doc?.customer)
          if (!customerId) return doc

          const customer = await req.payload.findByID({
            collection: 'customers',
            id: customerId,
            depth: 0,
            overrideAccess: true,
          })
          const userId = resolveId(customer?.user)
          if (!userId) return doc

          if (operation === 'create') {
            await createNotificationFanout({
              payload: req.payload,
              userId,
              typeKey: 'order.created',
              domain: 'order',
              priority: 'info',
              title: 'New order placed',
              body: `Your order #${orderId} has been placed. We'll let you know as soon as it's confirmed.`,
              sourceEntityType: 'order',
              sourceEntityId: orderId,
              metadata: {
                orderId,
                status,
                merchantId,
              },
            })
          } else if (operation === 'update') {
            if (previousStatus && status && previousStatus !== status) {
              const label = getOrderStatusLabel(status, doc?.delivery_status)
              await createNotificationFanout({
                payload: req.payload,
                userId,
                typeKey: 'order.status_changed',
                domain: 'order',
                priority: status === 'cancelled' ? 'warning' : 'info',
                title: `Order ${getOrderStatusLabel(status, doc?.delivery_status)}`,
                body: `Your order #${orderId} is now ${label.toLowerCase()}.`,
                sourceEntityType: 'order',
                sourceEntityId: orderId,
                metadata: {
                  orderId,
                  status,
                  previousStatus,
                  merchantId,
                },
              })
            }
          }
        } catch (error) {
          console.error('[orders] afterChange notification error:', error)
        }
        return doc
      },
    ],
  },
  access: {
    read: ({ req: { user } }) => {
      if (user) {
        if (user.role === 'service' || user.role === 'admin') {
          return true
        }
      }
      return false
    },
    create: ({ req: { user } }) => {
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    update: ({ req: { user } }) => {
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    delete: ({ req: { user } }) => {
      return user?.role === 'service' || user?.role === 'admin' || false
    },
  },
  fields: [
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      admin: {
        description: 'The customer placing the order',
      },
    },
    {
      name: 'merchant',
      type: 'relationship',
      relationTo: 'merchants',
      required: true,
      admin: {
        description: 'The merchant fulfilling the order',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Preparing', value: 'preparing' },
        { label: 'Ready for Pickup', value: 'ready_for_pickup' },
        { label: 'On Delivery', value: 'on_delivery' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'pending',
    },
    {
      name: 'fulfillment_type',
      type: 'select',
      required: true,
      options: [
        { label: 'Delivery', value: 'delivery' },
        { label: 'Pickup', value: 'pickup' },
      ],
      admin: {
        description: 'Critical for logistics logic',
      },
    },
    {
      name: 'total',
      type: 'number',
      required: true,
      admin: {
        description: 'Grand total (Subtotal + Fees - Discounts)',
      },
    },
    {
      name: 'subtotal',
      type: 'number',
      required: true,
      admin: {
        description: 'Sum of item prices',
      },
    },
    {
      name: 'delivery_fee',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        description: 'Calculated delivery fee (0 for Pickup)',
      },
    },
    {
      name: 'platform_fee',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        description: 'Service charge/App fee',
      },
    },
    {
      name: 'priority_fee',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        description: 'Lalamove priority fee to speed up rider matching (set at delivery booking)',
      },
    },
    {
      name: 'discount_total',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        description: 'Total coupon discount applied (food + delivery legs)',
      },
    },
    {
      name: 'coupon_code',
      type: 'text',
      admin: {
        description: 'Coupon code applied to this order (denormalized for ops search)',
      },
    },
    {
      name: 'free_delivery_applied',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'A free-delivery coupon zeroed the delivery leg',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Special instructions for the merchant',
      },
    },
    {
      name: 'placed_at',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        description: 'Timestamp when order was confirmed',
      },
    },

    // ─── Lalamove delivery fields ─────────────────────────────────────────────
    {
      name: 'lalamove_order_id',
      type: 'text',
      admin: {
        description: 'Lalamove delivery order ID (denormalized for quick lookups)',
        position: 'sidebar',
      },
    },
    {
      name: 'delivery_service_type',
      type: 'text',
      defaultValue: 'MOTORCYCLE',
      admin: {
        description: 'Lalamove vehicle type for this delivery',
        position: 'sidebar',
      },
    },
    {
      name: 'delivery_status',
      type: 'select',
      options: [
        { label: 'No Delivery', value: 'none' },
        { label: 'Pending', value: 'pending' },
        { label: 'Assigning Driver', value: 'assigning_driver' },
        { label: 'Driver Assigned', value: 'driver_assigned' },
        { label: 'Picked Up', value: 'picked_up' },
        { label: 'Delivered', value: 'completed' },
        { label: 'Canceled', value: 'canceled' },
        { label: 'Expired', value: 'expired' },
      ],
      defaultValue: 'none',
      admin: {
        description: 'Denormalized delivery status from Lalamove',
        position: 'sidebar',
      },
    },
    {
      name: 'delivery_tracking_link',
      type: 'text',
      admin: {
        description: 'Lalamove public share link for tracking',
        position: 'sidebar',
      },
    },
  ],
}
