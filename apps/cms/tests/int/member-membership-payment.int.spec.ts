import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createMemberMembershipPaymentIntent,
  handleMemberMembershipPaymentEvent,
  refreshMemberMembershipPayment,
} from '../../src/services/MemberMembershipService'
import { hasActiveMemberMembership } from '../../src/access/roles'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('one-time member membership payments', () => {
  it('creates a fixed-fee lifetime Payment Intent for a pending member', async () => {
    vi.stubEnv('PAYMONGO_SANDBOX', 'true')
    vi.stubEnv('PAYMONGO_SANDBOX_API_KEY', 'sk_test_membership')
    vi.stubEnv('PAYMONGO_PUBLIC_KEY_SANDBOX', 'pk_test_membership')
    vi.stubEnv('PAYMONGO_SANDBOX_WEBHOOK_SECRET', 'whsec_test_membership')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'pi_123',
            attributes: { client_key: 'pi_123_client_key' },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    let createdPayment: Record<string, unknown> | null = null
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        id: 7,
        role: 'member',
        memberMembershipStatus: 'pending_payment',
        email: 'member@example.test',
      }),
      findGlobal: vi.fn().mockResolvedValue({
        membership: { memberMembershipFeePhp: 250 },
      }),
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        createdPayment = data
        return { id: 40 }
      }),
    } as any

    const result = await createMemberMembershipPaymentIntent(payload, 7, 'signup-attempt-1')

    expect(fetchMock).toHaveBeenCalledOnce()
    const requestOptions = fetchMock.mock.calls[0]?.[1] as RequestInit
    const requestBody = JSON.parse(String(requestOptions.body))
    expect(new Headers(requestOptions.headers).get('Idempotency-Key')).toBe('signup-attempt-1')
    expect(requestBody.data.attributes.amount).toBe(25000)
    expect(requestBody.data.attributes.payment_method_allowed).toContain('gcash')
    expect(createdPayment).toMatchObject({
      user: 7,
      amount: 250,
      currency: 'PHP',
      status: 'pending',
      providerReference: 'pi_123',
      providerClientKey: 'pi_123_client_key',
      memberMembershipIdempotencyKey: 'signup-attempt-1',
    })
    expect(String(createdPayment?.paymentReference)).toMatch(/^MEM-7-/)
    expect(result).toMatchObject({
      paymentId: 40,
      amount: 250,
      currency: 'PHP',
      paymentIntentId: 'pi_123',
      clientKey: 'pi_123_client_key',
      publicKey: 'pk_test_membership',
      status: 'pending',
      term: 'lifetime',
    })
    expect(result).not.toHaveProperty('checkoutUrl')
  })

  it('does not activate the member until a paid event arrives', async () => {
    const payment = { id: 40, user: 7, status: 'pending', paidAt: null }
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [payment] }),
      update: vi.fn().mockResolvedValue({}),
    } as any

    const handled = await handleMemberMembershipPaymentEvent(payload, {
      paymentReference: 'pi_123',
      eventId: 'evt-paid-1',
      paid: false,
    })

    expect(handled).toBe(true)
    expect(payload.update).toHaveBeenCalledOnce()
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'member-membership-payments',
        data: expect.objectContaining({ status: 'failed' }),
      }),
    )
  })

  it('activates the member after payment confirmation and handles repeated paid events', async () => {
    const payment = {
      id: 40,
      user: 7,
      amount: 250,
      currency: 'PHP',
      status: 'pending',
      paidAt: null as string | null,
    }
    const notificationEvents: Record<string, unknown>[] = []
    const userNotifications: Record<string, unknown>[] = []
    const payload = {
      find: vi.fn(async ({ collection }: { collection: string }) => ({
        docs: collection === 'member-membership-payments'
          ? [payment]
          : collection === 'notification-events'
            ? notificationEvents
            : userNotifications,
      })),
      create: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
        const created = { id: collection === 'notification-events' ? 50 : 51, ...data }
        if (collection === 'notification-events') notificationEvents.push(created)
        if (collection === 'user-notifications') userNotifications.push(created)
        return created
      }),
      update: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
        if (collection === 'member-membership-payments') {
          payment.status = String(data.status)
          payment.paidAt = String(data.paidAt)
        }
        return {}
      }),
    } as any

    const firstHandled = await handleMemberMembershipPaymentEvent(payload, {
      paymentReference: 'pi_123',
      eventId: 'evt-paid-1',
      paid: true,
      amountCentavos: 25000,
      currency: 'PHP',
    })
    const repeatedHandled = await handleMemberMembershipPaymentEvent(payload, {
      paymentReference: 'pi_123',
      eventId: 'evt-paid-1',
      paid: true,
      amountCentavos: 25000,
      currency: 'PHP',
    })

    expect(firstHandled).toBe(true)
    expect(repeatedHandled).toBe(true)
    expect(payload.update).toHaveBeenCalledTimes(3)
    expect(payload.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'member-membership-payments',
        data: expect.objectContaining({ status: 'paid' }),
      }),
    )
    expect(payload.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'users',
        id: 7,
        data: expect.objectContaining({ memberMembershipStatus: 'active' }),
      }),
    )
    expect(notificationEvents).toHaveLength(1)
    expect(userNotifications).toHaveLength(1)
    expect(notificationEvents[0]).toMatchObject({
      typeKey: 'membership.payment.paid',
      sourceEntityType: 'member-membership-payment',
      sourceEntityId: '40',
    })
    expect(userNotifications[0]).toMatchObject({
      user: 7,
      notificationEvent: 50,
      channel: 'in_app',
      status: 'unread',
    })
  })

  it('does not activate membership when the confirmed amount or currency differs', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 40, user: 7, amount: 250, currency: 'PHP', status: 'pending' }],
      }),
      update: vi.fn(),
      create: vi.fn(),
    } as any

    await expect(handleMemberMembershipPaymentEvent(payload, {
      paymentReference: 'pi_123',
      eventId: 'evt-paid-mismatch',
      paid: true,
      amountCentavos: 100,
      currency: 'PHP',
    })).rejects.toThrow('MEMBERSHIP_PAYMENT_AMOUNT_MISMATCH')

    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('reconciles a successful PayMongo Payment Intent after returning to the app', async () => {
    vi.stubEnv('PAYMONGO_SANDBOX', 'true')
    vi.stubEnv('PAYMONGO_SANDBOX_API_KEY', 'sk_test_membership')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              id: 'pi_123',
              attributes: { status: 'succeeded', amount: 25000, currency: 'PHP' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    const payment = {
      id: 40,
      user: 7,
      amount: 250,
      currency: 'PHP',
      status: 'pending',
      providerReference: 'pi_123',
      providerClientKey: 'pi_123_client_key',
      paidAt: null,
    }
    const payload = {
      find: vi.fn(async ({ collection }: { collection: string }) => ({
        docs: collection === 'member-membership-payments' ? [payment] : [],
      })),
      create: vi.fn().mockResolvedValue({ id: 51 }),
      update: vi.fn().mockResolvedValue({}),
    } as any

    await refreshMemberMembershipPayment(payload, payment)

    expect(fetch).toHaveBeenCalledWith(
      'https://api.paymongo.com/v1/payment_intents/pi_123',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 7,
        data: expect.objectContaining({ memberMembershipStatus: 'active' }),
      }),
    )
  })

  it('only grants private marketplace access to active members', async () => {
    const payload = {
      findByID: vi.fn()
        .mockResolvedValueOnce({ role: 'member', memberMembershipStatus: 'pending_payment' })
        .mockResolvedValueOnce({ role: 'member', memberMembershipStatus: 'active' }),
    } as any

    await expect(hasActiveMemberMembership(payload, 7)).resolves.toBe(false)
    await expect(hasActiveMemberMembership(payload, 7)).resolves.toBe(true)
  })
})
