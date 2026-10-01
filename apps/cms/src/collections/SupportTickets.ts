import type { CollectionConfig } from 'payload'
import { Forbidden } from 'payload'
import { createAdminNotificationFanout, createNotificationFanout } from '../utils/notificationFanout'

const STAFF_ROLES = ['admin', 'service']

const isStaff = (role: unknown): boolean => typeof role === 'string' && STAFF_ROLES.includes(role)

const resolveId = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as Record<string, unknown>).id
    return id == null ? null : String(id)
  }
  return null
}

export const SupportTickets: CollectionConfig = {
  slug: 'support-tickets',
  dbName: 'support_tickets',
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'status', 'priority', 'category', 'lastMessageAt'],
    group: 'Support',
    description: 'Support tickets submitted by customers, vendors, and drivers',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (isStaff(user.role)) return true
      return {
        user: {
          equals: user.id,
        },
      }
    },
    create: ({ req: { user } }) => {
      return !!user
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (isStaff(user.role)) return true
      // Non-staff can only touch their own tickets (close/reopen enforced in hooks)
      return {
        user: {
          equals: user.id,
        },
      }
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'admin'
    },
  },
  fields: [
    {
      name: 'subject',
      type: 'text',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Waiting for User', value: 'waiting_for_user' },
        { label: 'Resolved', value: 'resolved' },
        { label: 'Closed', value: 'closed' },
      ],
      defaultValue: 'open',
      required: true,
    },
    {
      name: 'priority',
      type: 'select',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
        { label: 'Critical', value: 'critical' },
      ],
      defaultValue: 'medium',
      required: true,
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Order Issue', value: 'order_issue' },
        { label: 'Delivery', value: 'delivery' },
        { label: 'Payment & Refund', value: 'payment_refund' },
        { label: 'Product', value: 'product' },
        { label: 'Account', value: 'account' },
        { label: 'Technical Issue', value: 'technical' },
        { label: 'General Inquiry', value: 'general' },
      ],
      required: true,
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'The user who created the ticket (customer, vendor, or driver)',
      },
      hooks: {
        beforeChange: [
          ({ req, value, operation }) => {
            if (operation === 'create' && !value && req.user) {
              return req.user.id
            }
            return value
          },
        ],
      },
    },
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      admin: {
        description: 'Related order, when the ticket is about a specific order',
      },
    },
    {
      name: 'merchant',
      type: 'relationship',
      relationTo: 'merchants',
      admin: {
        description: 'Related merchant outlet, when the ticket concerns a store',
      },
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      admin: {
        description: 'Related product, when the ticket concerns a catalog item',
      },
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Support staff assigned to this ticket',
      },
      filterOptions: {
        role: { in: ['admin', 'service'] },
      },
    },
    {
      name: 'attachments',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
    },
    {
      name: 'lastMessageAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
  ],
  indexes: [
    { fields: ['user'] },
    { fields: ['assignedTo'] },
    { fields: ['status'] },
    { fields: ['updatedAt'] },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation, req }) => {
        if (operation === 'create') {
          return {
            ...data,
            lastMessageAt: new Date().toISOString(),
          }
        }
        if (operation === 'update' && !isStaff(req.user?.role)) {
          // Reporters may only close or reopen their own tickets. Payload
          // hands hooks the merged document, so compare against the original
          // to find real changes (returning a stripped object would break
          // required-field validation). Internal hook-driven updates bypass
          // via req.context.skipSupportTicketGuard.
          const context = req.context as Record<string, unknown> | undefined
          if (context?.skipSupportTicketGuard === true) {
            return data
          }
          const incoming = (data ?? {}) as Record<string, unknown>
          const original = (originalDoc ?? {}) as unknown as Record<string, unknown>
          const norm = (value: unknown): string => {
            if (value == null) return ''
            if (typeof value === 'object') {
              if ('id' in value) return String((value as Record<string, unknown>).id)
              try {
                return JSON.stringify(value)
              } catch {
                return String(value)
              }
            }
            return String(value)
          }
          const changed = Object.keys(incoming).filter(
            (key) => !['id', 'createdAt', 'updatedAt'].includes(key) && norm(incoming[key]) !== norm(original[key]),
          )
          const flippedTo = norm(incoming.status)
          const onlyStatusFlip = changed.length > 0 && changed.every((key) => key === 'status')
          if (!onlyStatusFlip || (flippedTo !== 'open' && flippedTo !== 'closed')) {
            throw new Forbidden()
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        try {
          const ticketId = resolveId((doc as Record<string, unknown> | null)?.id) || ''
          const subject = String((doc as Record<string, unknown>)?.subject ?? 'Untitled ticket')
          const category = String((doc as Record<string, unknown>)?.category ?? 'general')
          if (operation === 'create') {
            await createAdminNotificationFanout(req.payload, {
              typeKey: 'support.ticket_created',
              domain: 'custom',
              priority: 'info',
              title: 'New support ticket',
              body: `${subject} (${category})`,
              sourceEntityType: 'support-ticket',
              sourceEntityId: ticketId,
              metadata: {
                ticketId,
                category,
                priority: (doc as Record<string, unknown>)?.priority ?? null,
              },
            })
          } else if (operation === 'update') {
            const previousStatus = (previousDoc as Record<string, unknown> | undefined)?.status
            const nextStatus = (doc as Record<string, unknown>)?.status
            if (previousStatus !== nextStatus && (nextStatus === 'resolved' || nextStatus === 'closed')) {
              const ownerId = resolveId((doc as Record<string, unknown>)?.user)
              if (ownerId) {
                await createNotificationFanout({
                  payload: req.payload,
                  userId: ownerId,
                  typeKey: 'support.ticket_resolved',
                  domain: 'custom',
                  priority: 'info',
                  title: `Ticket ${nextStatus}`,
                  body: `Your ticket "${subject}" is now ${nextStatus}.`,
                  sourceEntityType: 'support-ticket',
                  sourceEntityId: ticketId,
                  metadata: { ticketId, status: nextStatus },
                })
              }
            }
          }
        } catch (error) {
          console.error('Error in support-tickets afterChange:', error)
        }
        return doc
      },
    ],
  },
}
