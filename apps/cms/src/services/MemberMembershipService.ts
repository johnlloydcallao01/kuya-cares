import type { Payload } from 'payload'
import crypto from 'crypto'
import { broadcastUserNotification } from '../utils/supabaseNotifications'

type MembershipCheckoutResult = {
  paymentId: string | number
  amount: number
  currency: 'PHP'
  paymentIntentId: string
  clientKey: string
  publicKey: string
  paymentReference: string
  status: 'pending'
  term: 'lifetime'
}

function relationshipId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number') return id
  }
  return null
}

function getPayMongoKeys() {
  const isSandbox = process.env.PAYMONGO_SANDBOX === 'true'
  const secretKey = (
    isSandbox
      ? process.env.PAYMONGO_SANDBOX_API_KEY
      : process.env.PAYMONGO_SECRET_KEY_LIVE
  )?.trim()
  const publicKey = (
    isSandbox
      ? process.env.PAYMONGO_PUBLIC_KEY_SANDBOX
      : process.env.PAYMONGO_PUBLIC_KEY_LIVE
  )?.trim()
  const webhookSecret = (
    isSandbox
      ? process.env.PAYMONGO_SANDBOX_WEBHOOK_SECRET
      : process.env.PAYMONGO_MEMBERSHIP_WEBHOOK_SECRET || process.env.PAYMONGO_WEBHOOK_SECRET
  )?.trim()

  if (!secretKey) throw new Error('MEMBERSHIP_PAYMONGO_SECRET_NOT_CONFIGURED')
  if (!publicKey) throw new Error('MEMBERSHIP_PAYMONGO_PUBLIC_NOT_CONFIGURED')
  if (!webhookSecret) throw new Error('MEMBERSHIP_WEBHOOK_NOT_CONFIGURED')

  return { secretKey, publicKey }
}

export async function createMemberMembershipPaymentIntent(
  payload: Payload,
  userId: number,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<MembershipCheckoutResult> {
  const user = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  })
  if (!user || user.role !== 'member') {
    throw new Error('MEMBER_ACCOUNT_REQUIRED')
  }
  if (user.memberMembershipStatus === 'active') {
    throw new Error('MEMBERSHIP_ALREADY_ACTIVE')
  }

  const settings = await payload.findGlobal({ slug: 'system-settings' })
  const configuredAmount = Number(
    (settings as Record<string, any>)?.membership?.memberMembershipFeePhp,
  )
  if (!Number.isFinite(configuredAmount) || configuredAmount <= 0) {
    throw new Error('MEMBERSHIP_FEE_NOT_CONFIGURED')
  }
  const amountCentavos = Math.round(configuredAmount * 100)
  if (!Number.isSafeInteger(amountCentavos) || amountCentavos < 100) {
    throw new Error('MEMBERSHIP_FEE_BELOW_PAYMONGO_MINIMUM')
  }
  const amount = amountCentavos / 100
  const { secretKey, publicKey } = getPayMongoKeys()

  const existing = await payload.find({
    collection: 'member-membership-payments',
    where: { memberMembershipIdempotencyKey: { equals: idempotencyKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const prior = existing.docs[0] as Record<string, any> | undefined
  if (prior) {
    if (relationshipId(prior.user) !== userId) {
      throw new Error('IDEMPOTENCY_KEY_IN_USE')
    }
    if (prior.status === 'pending' && prior.providerReference && prior.providerClientKey) {
      return {
        paymentId: prior.id,
        amount: Number(prior.amount),
        currency: 'PHP',
        paymentIntentId: String(prior.providerReference),
        clientKey: String(prior.providerClientKey),
        publicKey,
        paymentReference: String(prior.paymentReference),
        status: 'pending',
        term: 'lifetime',
      }
    }
    throw new Error('MEMBERSHIP_PAYMENT_ALREADY_PROCESSED')
  }

  const pendingPayments = await payload.find({
    collection: 'member-membership-payments',
    where: {
      and: [
        { user: { equals: userId } },
        { status: { equals: 'pending' } },
      ],
    },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const pendingPayment = pendingPayments.docs[0] as Record<string, any> | undefined
  if (
    pendingPayment?.providerReference &&
    pendingPayment?.providerClientKey &&
    relationshipId(pendingPayment.user) === userId
  ) {
    return {
      paymentId: pendingPayment.id,
      amount: Number(pendingPayment.amount),
      currency: 'PHP',
      paymentIntentId: String(pendingPayment.providerReference),
      clientKey: String(pendingPayment.providerClientKey),
      publicKey,
      paymentReference: String(pendingPayment.paymentReference),
      status: 'pending',
      term: 'lifetime',
    }
  }

  const paymentReference = `MEM-${String(userId)}-${crypto.randomUUID()}`
  const response = await fetch('https://api.paymongo.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      'Idempotency-Key': idempotencyKey,
    },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      data: {
        attributes: {
          amount: amountCentavos,
          currency: 'PHP',
          description: 'Kuya Cares one-time lifetime member fee',
          metadata: { reference: paymentReference, member_user_id: String(userId) },
          payment_method_allowed: [
            'gcash',
            'grab_pay',
            'paymaya',
            'billease',
            'dob',
            'brankas',
            'qrph',
          ],
        },
      },
    }),
  })
  const intentData = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = intentData?.errors?.[0]?.detail
    throw new Error(
      typeof detail === 'string'
        ? `PAYMONGO_INTENT_FAILED:${detail}`
        : `PAYMONGO_INTENT_FAILED:${response.status}`,
    )
  }

  const intent = intentData?.data
  const paymentIntentId = intent?.id
  const clientKey = intent?.attributes?.client_key
  if (typeof paymentIntentId !== 'string' || typeof clientKey !== 'string') {
    throw new Error('PAYMONGO_INTENT_RESPONSE_INVALID')
  }

  const payment = await payload.create({
    collection: 'member-membership-payments',
    data: {
      user: userId,
      amount,
      currency: 'PHP',
      status: 'pending',
      paymentProvider: 'paymongo',
      paymentReference,
      providerReference: paymentIntentId,
      providerClientKey: clientKey,
      memberMembershipIdempotencyKey: idempotencyKey,
    },
    overrideAccess: true,
  })

  return {
    paymentId: payment.id,
    amount,
    currency: 'PHP',
    paymentIntentId,
    clientKey,
    publicKey,
    paymentReference,
    status: 'pending',
    term: 'lifetime',
  }
}

export async function refreshMemberMembershipPayment(
  payload: Payload,
  payment: Record<string, any>,
): Promise<Record<string, any>> {
  if (
    payment.status !== 'pending' ||
    typeof payment.providerReference !== 'string' ||
    typeof payment.providerClientKey !== 'string'
  ) {
    return payment
  }

  const isSandbox = process.env.PAYMONGO_SANDBOX === 'true'
  const secretKey = (
    isSandbox ? process.env.PAYMONGO_SANDBOX_API_KEY : process.env.PAYMONGO_SECRET_KEY_LIVE
  )?.trim()
  if (!secretKey) throw new Error('MEMBERSHIP_PAYMONGO_SECRET_NOT_CONFIGURED')

  const response = await fetch(
    `https://api.paymongo.com/v1/payment_intents/${encodeURIComponent(payment.providerReference)}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      },
      signal: AbortSignal.timeout(15000),
    },
  )
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`PAYMONGO_INTENT_STATUS_FAILED:${response.status}`)
  }

  const intent = result?.data
  const attributes = intent?.attributes
  if (intent?.id !== payment.providerReference) {
    throw new Error('PAYMONGO_INTENT_STATUS_ID_MISMATCH')
  }

  const status = attributes?.status
  if (status === 'succeeded') {
    const expectedAmount = Math.round(Number(payment.amount) * 100)
    if (
      !Number.isSafeInteger(expectedAmount) ||
      Number(attributes?.amount) !== expectedAmount ||
      String(attributes?.currency || '').toUpperCase() !== String(payment.currency || 'PHP').toUpperCase()
    ) {
      throw new Error('PAYMONGO_INTENT_STATUS_AMOUNT_MISMATCH')
    }
    await handleMemberMembershipPaymentEvent(payload, {
      paymentReference: payment.providerReference,
      eventId: `status-sync:${payment.providerReference}`,
      paid: true,
      amountCentavos: expectedAmount,
      currency: String(attributes.currency),
    })
  } else if (status === 'canceled') {
    await handleMemberMembershipPaymentEvent(payload, {
      paymentReference: payment.providerReference,
      eventId: `status-sync:${payment.providerReference}`,
      paid: false,
    })
  }

  return payment
}

export async function findMemberMembershipPayment(
  payload: Payload,
  paymentReference: string,
): Promise<Record<string, any> | null> {
  for (const field of ['paymentReference', 'providerReference', 'paymentLinkId', 'checkoutUrl']) {
    const result = await payload.find({
      collection: 'member-membership-payments',
      where: { [field]: { equals: paymentReference } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const payment = result.docs[0] as Record<string, any> | undefined
    if (payment) return payment
  }
  return null
}

export async function handleMemberMembershipPaymentEvent(
  payload: Payload,
  args: {
    paymentReference: string
    eventId: string
    paid: boolean
    amountCentavos?: number
    currency?: string
  },
): Promise<boolean> {
  const payment = await findMemberMembershipPayment(payload, args.paymentReference)
  if (!payment) return false

  const userId = relationshipId(payment.user)
  if (userId == null) throw new Error('MEMBERSHIP_PAYMENT_USER_MISSING')

  if (args.paid) {
    const expectedAmount = Math.round(Number(payment.amount) * 100)
    if (
      !Number.isSafeInteger(expectedAmount) ||
      args.amountCentavos !== expectedAmount ||
      String(args.currency || '').toUpperCase() !== String(payment.currency || 'PHP').toUpperCase()
    ) {
      throw new Error('MEMBERSHIP_PAYMENT_AMOUNT_MISMATCH')
    }
    const paidAt = payment.paidAt ?? new Date().toISOString()
    if (payment.status !== 'paid') {
      await payload.update({
        collection: 'member-membership-payments',
        id: payment.id,
        data: { status: 'paid', paidAt, failureReason: null },
        overrideAccess: true,
      })
    }
    await payload.update({
      collection: 'users',
      id: userId,
      data: {
        memberMembershipStatus: 'active',
        memberMembershipPaidAt: paidAt,
      } as never,
      overrideAccess: true,
    })
    await createMemberPaymentNotification(payload, payment, userId, paidAt)
    return true
  }

  if (payment.status === 'pending') {
    await payload.update({
      collection: 'member-membership-payments',
      id: payment.id,
      data: { status: 'failed', failureReason: 'PayMongo reported a failed payment' },
      overrideAccess: true,
    })
  }
  return true
}

async function createMemberPaymentNotification(
  payload: Payload,
  payment: Record<string, any>,
  userId: number,
  paidAt: string,
): Promise<void> {
  const sourceEntityType = 'member-membership-payment'
  const sourceEntityId = String(payment.id)
  const existingEvents = await payload.find({
    collection: 'notification-events',
    where: {
      and: [
        { sourceEntityType: { equals: sourceEntityType } },
        { sourceEntityId: { equals: sourceEntityId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const title = 'Membership payment confirmed'
  const body = 'Your payment has been confirmed. Your Kuya Cares member access is now active.'
  const metadata = {
    paymentId: sourceEntityId,
    amount: Number(payment.amount),
    currency: payment.currency || 'PHP',
    paidAt,
  }
  const existingEvent = existingEvents.docs[0] as Record<string, any> | undefined
  const notificationEvent = existingEvent ?? await payload.create({
    collection: 'notification-events',
    data: {
      typeKey: 'membership.payment.paid',
      domain: 'account',
      sourceEntityType,
      sourceEntityId,
      title,
      body,
      metadata,
      origin: 'automatic',
      priority: 'info',
    },
    depth: 0,
    overrideAccess: true,
  })
  const existingNotifications = await payload.find({
    collection: 'user-notifications',
    where: {
      and: [
        { user: { equals: userId } },
        { notificationEvent: { equals: notificationEvent.id } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const deliveredAt = new Date().toISOString()
  const notification = existingNotifications.docs[0] as Record<string, any> | undefined
    ?? await payload.create({
      collection: 'user-notifications',
      data: {
        user: userId,
        notificationEvent: notificationEvent.id,
        channel: 'in_app',
        status: 'unread',
        deliveredAt,
      },
      depth: 0,
      overrideAccess: true,
    })

  void broadcastUserNotification(userId, {
    id: notification.id,
    title,
    body,
    domain: 'account',
    typeKey: 'membership.payment.paid',
    status: notification.status || 'unread',
    channel: notification.channel || 'in_app',
    priority: 'info',
    deliveredAt: notification.deliveredAt || deliveredAt,
    metadata,
  })
}
