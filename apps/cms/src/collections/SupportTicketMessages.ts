import type { Access, AccessArgs, CollectionConfig, Validate } from 'payload'
import {
  createAdminNotificationFanout,
  createMerchantNotificationFanout,
  createNotificationFanout,
} from '../utils/notificationFanout'

const STAFF_ROLES = ['admin', 'service']

const isStaff = (role: unknown): boolean => typeof role === 'string' && STAFF_ROLES.includes(role)

const resolveId = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as Record<string, unknown>).id
    return id == null ? null : String(id)
  }
  return null
}

export const SupportTicketMessages: CollectionConfig = {
  slug: 'support-ticket-messages',
  dbName: 'support_ticket_messages',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['ticket', 'sender', 'createdAt'],
    group: 'Support',
    description: 'Messages exchanged in support tickets',
  },
  access: {
    read: (({ req: { user } }: AccessArgs) => {
      if (!user) return false
      if (isStaff(user.role)) return true
      return {
        or: [
          {
            sender: {
              equals: user.id,
            },
          },
          {
            'ticket.user': {
              equals: user.id,
            },
          },
        ] as Record<string, unknown>[],
      }
    }) as Access,
    create: ({ req: { user } }) => {
      return !!user
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'admin'
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'admin'
    },
  },
  fields: [
    {
      name: 'ticket',
      type: 'relationship',
      relationTo: 'support-tickets',
      required: true,
      index: true,
      validate: (async (value, { req }) => {
        if (!value) return 'Ticket is required'
        try {
          const ticketId = resolveId(value)
          const ticket = await req.payload.findByID({
            collection: 'support-tickets',
            id: ticketId as string,
            overrideAccess: true,
          })
          if (!ticket) {
            return 'Ticket not found'
          }
          const user = req.user
          if (!user) return 'You must be logged in'
          if (isStaff(user.role)) {
            return true
          }
          const ticketOwnerId = resolveId((ticket as unknown as Record<string, unknown>).user)
          if (ticketOwnerId != null && String(ticketOwnerId) === String(user.id)) {
            return true
          }
          return 'You do not have permission to reply to this ticket'
        } catch (err) {
          console.error('Error validating ticket:', err)
          return 'Error validating ticket'
        }
      }) as Validate,
    },
    {
      name: 'sender',
      type: 'relationship',
      relationTo: 'users',
      required: true,
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
      name: 'message',
      type: 'richText',
      required: true,
    },
    {
      name: 'attachments',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
    },
    {
      name: 'isInternal',
      type: 'checkbox',
      defaultValue: false,
      label: 'Internal Note (Admin only)',
      access: {
        read: ({ req: { user } }) => {
          if (!user) return false
          return isStaff(user.role)
        },
        create: ({ req: { user } }) => {
          if (!user) return false
          return isStaff(user.role)
        },
        update: ({ req: { user } }) => {
          if (!user) return false
          return isStaff(user.role)
        },
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, req, operation }) => {
        if (operation !== 'create' || !doc.ticket) {
          return doc
        }
        try {
          const ticketId = resolveId(doc.ticket)
          if (!ticketId) return doc
          const staffReply = isStaff(req.user?.role)
          const ticket = (await req.payload.findByID({
            collection: 'support-tickets',
            id: ticketId,
            depth: 0,
          })) as unknown as Record<string, unknown>
          const ownerId = resolveId(ticket?.user)
          const subject = String(ticket?.subject ?? 'Support ticket')
          const status = ticket?.status
          let nextStatus: 'open' | 'waiting_for_user' | null = null
          if (staffReply && (status === 'open' || status === 'in_progress')) {
            nextStatus = 'waiting_for_user'
          } else if (!staffReply && status === 'waiting_for_user') {
            nextStatus = 'open'
          }
          // Bypass the reporter field guard: this is a system timestamp /
          // status flip, not a user edit.
          ;(req.context as Record<string, unknown>).skipSupportTicketGuard = true
          await req.payload.update({
            collection: 'support-tickets',
            id: ticketId,
            data: {
              lastMessageAt: new Date().toISOString(),
              ...(nextStatus ? { status: nextStatus } : {}),
            },
            req,
            depth: 0,
          })
          if (staffReply) {
            if (ownerId) {
              await createNotificationFanout({
                payload: req.payload,
                userId: ownerId,
                typeKey: 'support.ticket_reply',
                domain: 'custom',
                priority: 'info',
                title: 'New reply on your ticket',
                body: `Support replied on "${subject}".`,
                sourceEntityType: 'support-ticket',
                sourceEntityId: ticketId,
                metadata: { ticketId },
              })
            }
            const merchantId = resolveId(ticket?.merchant)
            if (merchantId) {
              await createMerchantNotificationFanout(req.payload, merchantId, {
                typeKey: 'support.ticket_reply',
                domain: 'custom',
                priority: 'info',
                title: 'New reply on a ticket for your store',
                body: `Support replied on "${subject}".`,
                sourceEntityType: 'support-ticket',
                sourceEntityId: ticketId,
                metadata: { ticketId, merchantId },
              })
            }
          } else {
            await createAdminNotificationFanout(req.payload, {
              typeKey: 'support.ticket_reply',
              domain: 'custom',
              priority: 'info',
              title: 'New ticket reply',
              body: `A customer replied on "${subject}".`,
              sourceEntityType: 'support-ticket',
              sourceEntityId: ticketId,
              metadata: { ticketId },
            })
          }
        } catch (error) {
          console.error('Error in support-ticket-messages afterChange:', error)
        }
        return doc
      },
    ],
  },
}
