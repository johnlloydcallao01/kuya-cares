import type { PayloadRequest } from 'payload'
import type { SupportTicketMessage } from '../payload-types'

const STAFF_ROLES = ['admin', 'service']

const isStaff = (role: unknown): boolean => typeof role === 'string' && STAFF_ROLES.includes(role)

const CATEGORIES = [
  'order_issue',
  'delivery',
  'payment_refund',
  'product',
  'account',
  'technical',
  'general',
] as const

type TicketCategory = (typeof CATEGORIES)[number]

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

type TicketPriority = (typeof PRIORITIES)[number]

const STATUSES = ['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'] as const

type TicketStatus = (typeof STATUSES)[number]

const resolveId = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as Record<string, unknown>).id
    return id == null ? null : String(id)
  }
  return null
}

function createLexicalMessage(message: string): SupportTicketMessage['message'] {
  return {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text: message,
              type: 'text',
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'paragraph',
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}

function unauthenticated() {
  return Response.json(
    {
      success: false,
      error: 'Authentication required. Please provide a valid API key.',
      code: 'UNAUTHENTICATED',
    },
    { status: 401 },
  )
}

function extractLexicalText(node: unknown): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractLexicalText).join('')
  if (typeof node === 'object') {
    const record = node as Record<string, unknown>
    if (typeof record.text === 'string') return record.text
    if (record.root) return extractLexicalText(record.root)
    if (record.children) return extractLexicalText(record.children)
  }
  return ''
}

function describeSender(sender: unknown, isMine: boolean): { senderName: string; senderRole?: string; senderId?: string } {
  const record = (sender ?? {}) as Record<string, unknown>
  const role = typeof record.role === 'string' ? record.role : undefined
  const senderId = resolveId(record.id) ?? undefined
  if (isMine) {
    return { senderName: 'You', senderRole: role, senderId }
  }
  const firstName = typeof record.firstName === 'string' ? record.firstName : ''
  const lastName = typeof record.lastName === 'string' ? record.lastName : ''
  const fullName = `${firstName} ${lastName}`.trim()
  const email = typeof record.email === 'string' ? record.email : ''
  return {
    senderName: fullName || email || (role === 'admin' || role === 'service' ? 'Support Agent' : 'User'),
    senderRole: role,
    senderId,
  }
}

export const listSupportTicketsHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) return unauthenticated()
    const { status: statusParam, limit: limitParam, page: pageParam } = req.query as {
      status?: string
      limit?: string
      page?: string
    }
    const limit = Math.min(Math.max(Number(limitParam) || 10, 1), 100)
    const page = Math.max(Number(pageParam) || 1, 1)
    const where: Record<string, unknown> = {}
    if (!isStaff(req.user.role)) {
      where.user = { equals: req.user.id }
    }
    if (statusParam && statusParam !== 'all') {
      if (!(STATUSES as readonly string[]).includes(statusParam)) {
        return Response.json(
          { success: false, error: `Invalid status. Allowed: all, ${STATUSES.join(', ')}`, code: 'INVALID_STATUS' },
          { status: 400 },
        )
      }
      where.status = { equals: statusParam }
    }
    const result = await req.payload.find({
      collection: 'support-tickets',
      where: where as never,
      sort: '-lastMessageAt',
      limit,
      page,
      depth: 1,
      overrideAccess: true,
    })
    return Response.json({ success: true, data: result })
  } catch (error) {
    console.error('Error listing support tickets:', error)
    return Response.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

async function parseJsonBody(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    const text = await (req as unknown as Request).text()
    if (!text) return {}
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function loadTicket(req: PayloadRequest, ticketId: string): Promise<Record<string, unknown> | null> {
  try {
    const ticket = await req.payload.findByID({
      collection: 'support-tickets',
      id: ticketId,
      depth: 1,
      overrideAccess: true,
    })
    return ticket as unknown as Record<string, unknown>
  } catch {
    return null
  }
}

function canAccessTicket(req: PayloadRequest, ticket: Record<string, unknown>): boolean {
  if (!req.user) return false
  if (isStaff(req.user.role)) return true
  return String(resolveId(ticket.user) ?? '') === String(req.user.id)
}

async function verifyAttachmentIds(req: PayloadRequest, ids: unknown): Promise<number[] | null> {
  if (ids == null) return []
  if (!Array.isArray(ids)) return null
  const out: number[] = []
  for (const raw of ids) {
    const id = Number(raw)
    if (!Number.isFinite(id)) return null
    try {
      await req.payload.findByID({ collection: 'media', id, depth: 0 })
    } catch {
      return null
    }
    out.push(id)
  }
  return out
}

export const createSupportTicketHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) return unauthenticated()
    const body = await parseJsonBody(req)
    const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
    const category = typeof body.category === 'string' ? body.category : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const priority = typeof body.priority === 'string' ? body.priority : 'medium'
    if (!subject || !category || !message) {
      return Response.json(
        { success: false, error: 'Missing required fields: subject, category, message', code: 'MISSING_REQUIRED_PARAMS' },
        { status: 400 },
      )
    }
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      return Response.json(
        { success: false, error: `Invalid category. Allowed: ${CATEGORIES.join(', ')}`, code: 'INVALID_CATEGORY' },
        { status: 400 },
      )
    }
    if (!(PRIORITIES as readonly string[]).includes(priority)) {
      return Response.json(
        { success: false, error: `Invalid priority. Allowed: ${PRIORITIES.join(', ')}`, code: 'INVALID_PRIORITY' },
        { status: 400 },
      )
    }

    let orderId: number | null = null
    let merchantId: number | null = null
    let productId: number | null = null
    if (body.orderId != null && body.orderId !== '') {
      const parsed = Number(body.orderId)
      if (!Number.isFinite(parsed)) {
        return Response.json(
          { success: false, error: 'Invalid orderId', code: 'INVALID_ORDER' },
          { status: 400 },
        )
      }
      let order: Record<string, unknown>
      try {
        order = (await req.payload.findByID({ collection: 'orders', id: parsed, depth: 2 })) as unknown as Record<string, unknown>
      } catch {
        return Response.json(
          { success: false, error: 'Order not found', code: 'ORDER_NOT_FOUND' },
          { status: 404 },
        )
      }
      if (!isStaff(req.user.role)) {
        const customerUserId = resolveId(
          (order.customer as Record<string, unknown> | null)?.user ?? (order as Record<string, unknown>).customer,
        )
        let allowed = customerUserId != null && String(customerUserId) === String(req.user.id)
        if (!allowed) {
          const merchant = order.merchant as Record<string, unknown> | null
          const vendorUserId = resolveId(
            (merchant as Record<string, unknown> | null)?.vendor
              ? ((merchant as Record<string, unknown>).vendor as Record<string, unknown>).user
              : null,
          )
          allowed = vendorUserId != null && String(vendorUserId) === String(req.user.id)
        }
        if (!allowed) {
          return Response.json(
            { success: false, error: 'You do not have access to this order', code: 'FORBIDDEN' },
            { status: 403 },
          )
        }
      }
      orderId = parsed
      const linkedMerchant = resolveId((order as Record<string, unknown>).merchant)
      if (linkedMerchant) merchantId = Number(linkedMerchant)
    }
    if (body.merchantId != null && body.merchantId !== '') {
      const parsed = Number(body.merchantId)
      if (!Number.isFinite(parsed)) {
        return Response.json(
          { success: false, error: 'Invalid merchantId', code: 'INVALID_MERCHANT' },
          { status: 400 },
        )
      }
      try {
        await req.payload.findByID({ collection: 'merchants', id: parsed, depth: 0 })
      } catch {
        return Response.json(
          { success: false, error: 'Merchant not found', code: 'MERCHANT_NOT_FOUND' },
          { status: 404 },
        )
      }
      merchantId = parsed
    }
    if (body.productId != null && body.productId !== '') {
      const parsed = Number(body.productId)
      if (!Number.isFinite(parsed)) {
        return Response.json(
          { success: false, error: 'Invalid productId', code: 'INVALID_PRODUCT' },
          { status: 400 },
        )
      }
      try {
        await req.payload.findByID({ collection: 'products', id: parsed, depth: 0 })
      } catch {
        return Response.json(
          { success: false, error: 'Product not found', code: 'PRODUCT_NOT_FOUND' },
          { status: 404 },
        )
      }
      productId = parsed
    }
    const attachmentIds = await verifyAttachmentIds(req, body.attachmentIds)
    if (attachmentIds == null) {
      return Response.json(
        { success: false, error: 'Invalid attachmentIds. Upload files to /api/media first.', code: 'INVALID_ATTACHMENTS' },
        { status: 400 },
      )
    }

    const ticket = await req.payload.create({
      collection: 'support-tickets',
      data: {
        subject,
        category: category as TicketCategory,
        priority: priority as TicketPriority,
        status: 'open',
        user: req.user.id,
        ...(orderId != null ? { order: orderId } : {}),
        ...(merchantId != null ? { merchant: merchantId } : {}),
        ...(productId != null ? { product: productId } : {}),
      },
      req,
    })
    const firstMessage = await req.payload.create({
      collection: 'support-ticket-messages',
      data: {
        ticket: (ticket as unknown as Record<string, unknown>).id as number,
        sender: req.user.id,
        message: createLexicalMessage(message),
        isInternal: false,
      },
      req,
    })
    return Response.json({ success: true, data: { ticket, message: firstMessage } }, { status: 201 })
  } catch (error) {
    console.error('Error creating support ticket:', error)
    return Response.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export const getSupportTicketThreadHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) return unauthenticated()
    const { ticketId: ticketIdParam } = req.query as { ticketId?: string }
    if (!ticketIdParam) {
      return Response.json(
        { success: false, error: 'Missing required parameter: ticketId', code: 'MISSING_REQUIRED_PARAMS' },
        { status: 400 },
      )
    }
    const ticket = await loadTicket(req, ticketIdParam)
    if (!ticket) {
      return Response.json(
        { success: false, error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 },
      )
    }
    if (!canAccessTicket(req, ticket)) {
      return Response.json(
        { success: false, error: 'You do not have access to this ticket', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }
    const messages = await req.payload.find({
      collection: 'support-ticket-messages',
      where: { ticket: { equals: ticketIdParam } },
      sort: 'createdAt',
      limit: 200,
      depth: 1,
      overrideAccess: true,
    })
    const staff = isStaff(req.user.role)
    const visible = staff
      ? messages.docs
      : messages.docs.filter((m: unknown) => !(m as Record<string, unknown>).isInternal)
    const shaped = (visible as unknown[]).map((raw) => {
      const record = raw as Record<string, unknown>
      const senderId = resolveId(record.sender)
      const isMine = senderId != null && String(senderId) === String(req.user?.id)
      const { senderName, senderRole, senderId: shapedSenderId } = describeSender(record.sender, isMine)
      return {
        id: record.id,
        plainText: extractLexicalText(record.message),
        senderName,
        senderRole,
        senderId: shapedSenderId,
        isMine,
        createdAt: record.createdAt,
      }
    })
    return Response.json({ success: true, data: { ticket, messages: shaped } })
  } catch (error) {
    console.error('Error fetching support ticket thread:', error)
    return Response.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export const replySupportTicketHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) return unauthenticated()
    const body = await parseJsonBody(req)
    const ticketId = body.ticketId != null && body.ticketId !== '' ? String(body.ticketId) : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!ticketId || !message) {
      return Response.json(
        { success: false, error: 'Missing required fields: ticketId, message', code: 'MISSING_REQUIRED_PARAMS' },
        { status: 400 },
      )
    }
    const ticket = await loadTicket(req, ticketId)
    if (!ticket) {
      return Response.json(
        { success: false, error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 },
      )
    }
    if (!canAccessTicket(req, ticket)) {
      return Response.json(
        { success: false, error: 'You do not have access to this ticket', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }
    if (ticket.status === 'closed' || ticket.status === 'resolved') {
      return Response.json(
        { success: false, error: 'Ticket is already resolved or closed', code: 'TICKET_CLOSED' },
        { status: 409 },
      )
    }
    const attachmentIds = await verifyAttachmentIds(req, body.attachmentIds)
    if (attachmentIds == null) {
      return Response.json(
        { success: false, error: 'Invalid attachmentIds. Upload files to /api/media first.', code: 'INVALID_ATTACHMENTS' },
        { status: 400 },
      )
    }
    const reply = await req.payload.create({
      collection: 'support-ticket-messages',
      data: {
        ticket: ticket.id as number,
        sender: req.user.id,
        message: createLexicalMessage(message),
        isInternal: false,
        ...(attachmentIds.length > 0 ? { attachments: attachmentIds } : {}),
      },
      req,
    })
    return Response.json({ success: true, data: { message: reply } }, { status: 201 })
  } catch (error) {
    console.error('Error replying to support ticket:', error)
    return Response.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export const updateSupportTicketStatusHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) return unauthenticated()
    const body = await parseJsonBody(req)
    const ticketId = body.ticketId != null && body.ticketId !== '' ? String(body.ticketId) : ''
    const status = typeof body.status === 'string' ? body.status : ''
    if (!ticketId || !status) {
      return Response.json(
        { success: false, error: 'Missing required fields: ticketId, status', code: 'MISSING_REQUIRED_PARAMS' },
        { status: 400 },
      )
    }
    if (!(STATUSES as readonly string[]).includes(status)) {
      return Response.json(
        { success: false, error: `Invalid status. Allowed: ${STATUSES.join(', ')}`, code: 'INVALID_STATUS' },
        { status: 400 },
      )
    }
    const ticket = await loadTicket(req, ticketId)
    if (!ticket) {
      return Response.json(
        { success: false, error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 },
      )
    }
    if (!canAccessTicket(req, ticket)) {
      return Response.json(
        { success: false, error: 'You do not have access to this ticket', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }
    if (!isStaff(req.user.role) && status !== 'open' && status !== 'closed') {
      return Response.json(
        { success: false, error: 'You can only reopen or close your own tickets', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }
    const updated = await req.payload.update({
      collection: 'support-tickets',
      id: ticketId,
      data: { status: status as TicketStatus },
      req,
    })
    return Response.json({ success: true, data: { ticket: updated } })
  } catch (error) {
    console.error('Error updating support ticket status:', error)
    return Response.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
