'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from '@/components/ui/ImageWrapper'
import { useAuth } from '@/hooks/useAuth'
import { API_BASE_URL, getStoredToken } from '@/lib/auth'

const PAYMENT_METHODS = [
  { id: 'gcash', name: 'GCash', detail: 'Pay using your GCash wallet' },
  { id: 'grab_pay', name: 'GrabPay', detail: 'Pay using your GrabPay wallet' },
  { id: 'paymaya', name: 'Maya', detail: 'Pay using your Maya wallet' },
  { id: 'billease', name: 'BillEase', detail: 'Buy now, pay later' },
  { id: 'dob', name: 'BPI / UnionBank', detail: 'Online banking' },
  { id: 'brankas', name: 'BDO / Metrobank / LandBank', detail: 'Online banking' },
  { id: 'qrph', name: 'QR Ph', detail: 'Scan with a participating bank or e-wallet' },
] as const

type PaymentMethod = (typeof PAYMENT_METHODS)[number]['id']

type MembershipPayment = {
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'failed' | string
  createdAt: string
}

function getPayMongoQrImage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)) return value
  return getPayMongoRedirect(value)
}

type MembershipStatus = {
  membershipStatus: 'pending_payment' | 'active' | string
  paidAt: string | null
  membershipFeeAmount: number | null
  payment: MembershipPayment | null
}

type MembershipIntent = {
  paymentId: string | number
  amount: number
  currency: 'PHP'
  paymentIntentId: string
  clientKey: string
  publicKey: string
  paymentReference: string
}

type PayMongoPaymentMethodResponse = {
  data?: { id?: string }
  errors?: Array<{ detail?: string }>
}

type PayMongoAttachResponse = {
  data?: {
    attributes?: {
      status?: string
      next_action?: {
        redirect?: { url?: string }
        code?: { image_url?: string }
      }
    }
  }
  errors?: Array<{ detail?: string }>
}

function getPayMongoRedirect(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency || 'PHP',
  }).format(Number(amount))
}

export default function MemberPaymentPage() {
  const router = useRouter()
  const { user, isAuthenticated, isInitialized, isLoading: authLoading } = useAuth()
  const [membership, setMembership] = useState<MembershipStatus | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('gcash')
  const [trackedIntentId, setTrackedIntentId] = useState<string | null>(null)
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentCheckMessage, setPaymentCheckMessage] = useState<string | null>(null)
  const startingPaymentRef = useRef(false)
  const paymentIdempotencyKeyRef = useRef<string | null>(null)

  const token = useCallback(() => getStoredToken(), [])

  const loadMembership = useCallback(async (paymentIntentId?: string | null): Promise<MembershipStatus | null> => {
    const accessToken = token()
    if (!accessToken) {
      setError('Your sign-in session could not be verified. Please sign in again.')
      return null
    }

    setIsRefreshing(true)
    try {
      const query = paymentIntentId
        ? `?paymentIntentId=${encodeURIComponent(paymentIntentId)}`
        : ''
      const response = await fetch(`${API_BASE_URL}/member-membership${query}`, {
        headers: { Authorization: `JWT ${accessToken}` },
        cache: 'no-store',
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to load your membership status.')
      }
      const status = result as MembershipStatus
      setMembership(status)
      setError(null)
      return status
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'Unable to load your membership status. Please try again.')
      return null
    } finally {
      setIsRefreshing(false)
    }
  }, [token])

  const checkPaymentStatus = async () => {
    setPaymentCheckMessage(null)
    const status = await loadMembership(trackedIntentId)
    if (!status) return
    if (status.membershipStatus === 'active' || status.payment?.status === 'paid') {
      setPaymentCheckMessage('Payment confirmed. Your membership is active.')
      return
    }
    if (status.payment?.status === 'failed') {
      setPaymentCheckMessage('This payment was not completed. Please start a new payment attempt.')
      return
    }
    if (status.payment?.status === 'pending') {
      setPaymentCheckMessage('Payment is still pending. If you have completed payment, PayMongo may need a little more time to confirm it.')
      return
    }
    setPaymentCheckMessage('No membership payment attempt was found yet. Start a payment to continue.')
  }

  useEffect(() => {
    if (!isInitialized || authLoading) return
    if (!isAuthenticated || !user) {
      router.replace(`/signin?redirect=${encodeURIComponent('/membership/payment')}`)
      return
    }
    if (user.role !== 'member') {
      setError('This payment page is only available to marketplace members.')
      return
    }

    const paymentIntentId = new URLSearchParams(window.location.search).get('payment_intent_id')
    if (paymentIntentId) setTrackedIntentId(paymentIntentId)
    void loadMembership(paymentIntentId)
  }, [authLoading, isAuthenticated, isInitialized, loadMembership, router, user])

  useEffect(() => {
    if (!trackedIntentId || membership?.membershipStatus === 'active') return
    const timer = window.setInterval(() => {
      void loadMembership(trackedIntentId)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [loadMembership, membership?.membershipStatus, trackedIntentId])

  useEffect(() => {
    if (membership?.payment?.status === 'failed') {
      paymentIdempotencyKeyRef.current = null
    }
  }, [membership?.payment?.status])

  const selectedMethodLabel = useMemo(
    () => PAYMENT_METHODS.find(({ id }) => id === selectedMethod)?.name ?? 'payment method',
    [selectedMethod],
  )

  const startPayment = async () => {
    if (startingPaymentRef.current) return
    const accessToken = token()
    if (!accessToken || !user) {
      router.push(`/signin?redirect=${encodeURIComponent('/membership/payment')}`)
      return
    }

    startingPaymentRef.current = true
    setIsPaying(true)
    setError(null)
    setPaymentCheckMessage(null)
    setQrImageUrl(null)
    try {
      const idempotencyKey = paymentIdempotencyKeyRef.current ?? window.crypto.randomUUID()
      paymentIdempotencyKeyRef.current = idempotencyKey
      const intentResponse = await fetch(`${API_BASE_URL}/member-membership/checkout`, {
        method: 'POST',
        headers: {
          Authorization: `JWT ${accessToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({}),
      })
      const intentResult = await intentResponse.json().catch(() => null)
      if (!intentResponse.ok) {
        if (intentResponse.status === 409 && intentResult?.code === 'MEMBERSHIP_ALREADY_ACTIVE') {
          await loadMembership()
          return
        }
        throw new Error(intentResult?.error || 'Could not prepare membership payment.')
      }

      const intent = intentResult as MembershipIntent
      if (!intent.paymentIntentId || !intent.clientKey || !intent.publicKey) {
        throw new Error('The payment service returned incomplete payment details. Please try again.')
      }
      setTrackedIntentId(intent.paymentIntentId)

      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Kuya Cares Member'
      const paymentMethodResponse = await fetch('https://api.paymongo.com/v1/payment_methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${window.btoa(`${intent.publicKey}:`)}`,
        },
        body: JSON.stringify({
          data: {
            attributes: {
              type: selectedMethod,
              billing: {
                name,
                email: user.email,
                phone: '',
                address: {
                  line1: '',
                  line2: '',
                  city: '',
                  state: '',
                  postal_code: '',
                  country: 'PH',
                },
              },
            },
          },
        }),
      })
      const paymentMethod = await paymentMethodResponse.json() as PayMongoPaymentMethodResponse
      const paymentMethodId = paymentMethod?.data?.id
      if (!paymentMethodResponse.ok || !paymentMethodId) {
        throw new Error(
          paymentMethod?.errors?.[0]?.detail || 'Could not prepare the selected payment method.',
        )
      }

      const returnUrl = new URL('/membership/payment', window.location.origin)
      returnUrl.searchParams.set('payment_intent_id', intent.paymentIntentId)
      const attachResponse = await fetch(
        `https://api.paymongo.com/v1/payment_intents/${encodeURIComponent(intent.paymentIntentId)}/attach`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${window.btoa(`${intent.publicKey}:`)}`,
          },
          body: JSON.stringify({
            data: {
              attributes: {
                client_key: intent.clientKey,
                payment_method: paymentMethodId,
                return_url: returnUrl.toString(),
              },
            },
          }),
        },
      )
      const attached = await attachResponse.json() as PayMongoAttachResponse
      if (!attachResponse.ok) {
        throw new Error(attached?.errors?.[0]?.detail || 'Could not authorize this payment method.')
      }

      const attributes = attached?.data?.attributes
      const redirectUrl = getPayMongoRedirect(attributes?.next_action?.redirect?.url)
      if (attributes?.status === 'awaiting_next_action' && redirectUrl) {
        window.location.assign(redirectUrl)
        return
      }

      const imageUrl = getPayMongoQrImage(attributes?.next_action?.code?.image_url)
      if (attributes?.status === 'awaiting_next_action' && imageUrl) {
        setQrImageUrl(imageUrl)
        await loadMembership(intent.paymentIntentId)
        return
      }

      if (attributes?.status === 'succeeded') {
        await loadMembership(intent.paymentIntentId)
        return
      }

      if (attributes?.status === 'processing') {
        await loadMembership(intent.paymentIntentId)
        return
      }
      throw new Error(`Payment could not continue (status: ${attributes?.status || 'unknown'}). Please try again.`)
    } catch (requestError) {
      console.error('[member-payment] PayMongo payment failed:', requestError)
      setError(requestError instanceof Error
        ? requestError.message
        : 'Payment could not be started. Please try again.')
    } finally {
      startingPaymentRef.current = false
      setIsPaying(false)
    }
  }

  const isAuthResolving = !isInitialized || authLoading || !isAuthenticated || !user
  const isNotMember = !isAuthResolving && user.role !== 'member'
  const isLoadingMembership = !isAuthResolving && !isNotMember && isRefreshing && !membership
  const isActive = membership?.membershipStatus === 'active'
  const paymentAmount = membership?.payment?.amount ?? membership?.membershipFeeAmount
  const hasValidFee = typeof paymentAmount === 'number' &&
    Number.isFinite(paymentAmount) && paymentAmount >= 1
  const paymentCurrency = membership?.payment?.currency || 'PHP'
  const paymentPending = membership?.payment?.status === 'pending'
  const paymentFailed = membership?.payment?.status === 'failed'

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900 dark:bg-[#0a0a0a] dark:text-gray-100 sm:py-12">
      <section className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/" aria-label="Kuya Cares home" className="inline-flex items-center gap-3">
            <Image
              src="/kuya-cares.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg object-contain"
              priority
            />
            <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
              Kuya Cares
            </span>
          </Link>
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-[#111111] dark:text-gray-300">
            Secure membership checkout
          </span>
        </header>

        {isAuthResolving || isLoadingMembership ? (
          <div className="rounded-3xl bg-white p-12 text-center shadow-sm dark:bg-[#111111]" role="status">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-700 dark:border-emerald-950 dark:border-t-emerald-400" />
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {isAuthResolving ? 'Checking your sign-in…' : 'Loading your membership status…'}
            </p>
          </div>
        ) : isNotMember ? (
          <div className="rounded-3xl border border-rose-200 bg-white p-8 shadow-sm dark:border-rose-900 dark:bg-[#111111]" role="alert">
            <h1 className="text-xl font-bold text-rose-950 dark:text-rose-300">Member account required</h1>
            <p className="mt-2 text-sm leading-6 text-rose-900 dark:text-rose-200">
              This payment page is only available to unified marketplace members.
            </p>
            <Link href="/" className="mt-5 inline-flex font-semibold text-rose-900 underline dark:text-rose-300">
              Return to Kuya Cares
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
                {error}
              </div>
            )}

            {isActive ? (
              <div className="rounded-3xl border border-emerald-200 bg-white p-8 shadow-sm dark:border-emerald-900 dark:bg-[#111111] sm:p-12">
                <div className="mx-auto max-w-xl text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" aria-hidden="true">
                    ✓
                  </div>
                  <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-400">
                    Payment confirmed
                  </p>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                    You’re an official member
                  </h1>
                  <p className="mt-3 leading-7 text-gray-600 dark:text-gray-300">
                    Your one-time membership payment is confirmed. You can now buy and sell in the Kuya Cares marketplace.
                  </p>
                  {membership?.paidAt && (
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                      Confirmed {new Date(membership.paidAt).toLocaleString()}
                    </p>
                  )}
                  <Link
                    href="/"
                    className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
                  >
                    Continue to marketplace
                  </Link>
                </div>
              </div>
            ) : qrImageUrl ? (
              <div className="rounded-3xl bg-white p-6 shadow-sm dark:bg-[#111111] sm:p-10">
                <div className="mx-auto max-w-lg text-center">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-400">
                    Complete your payment
                  </p>
                  <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Scan this QR Ph code</h1>
                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    Open your bank or e-wallet app, scan the code, and confirm the payment there.
                  </p>
                  <img
                    src={qrImageUrl}
                    alt="QR Ph payment code"
                    className="mx-auto mt-6 aspect-square w-full max-w-xs rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700"
                  />
                  <p className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
                    {formatAmount(Number(paymentAmount ?? 0), paymentCurrency)}
                  </p>
                  <p className="mt-4 text-sm text-gray-600 dark:text-gray-300" role="status">
                    After you pay, we’ll confirm it automatically.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <section className="rounded-3xl bg-white p-6 shadow-sm dark:bg-[#111111] sm:p-8">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-400">
                      Member activation
                    </p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                      One payment. Official membership.
                    </h1>
                    <p className="mt-3 max-w-2xl leading-7 text-gray-600 dark:text-gray-300">
                      Choose a payment method below. Your account becomes an official member after PayMongo confirms your payment.
                    </p>
                  </div>

                  <div className="mt-8">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white">Choose a payment method</h2>
                      {paymentPending && (
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Previous attempt pending</span>
                      )}
                      {paymentFailed && (
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Previous attempt did not complete</span>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {PAYMENT_METHODS.map((method) => {
                        const selected = selectedMethod === method.id
                        return (
                          <button
                            key={method.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setSelectedMethod(method.id)}
                            className={`flex min-h-[76px] items-center gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                              selected
                                ? 'border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/50 dark:ring-emerald-500'
                                : 'border-gray-200 bg-white hover:border-gray-400 dark:border-gray-700 dark:bg-[#111111] dark:hover:border-gray-500'
                            }`}
                          >
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              selected ? 'border-emerald-700 dark:border-emerald-400' : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {selected && <span className="h-2.5 w-2.5 rounded-full bg-emerald-700" />}
                            </span>
                            <span>
                              <span className="block text-sm font-semibold text-gray-900 dark:text-white">{method.name}</span>
                              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{method.detail}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="mt-7 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#171717]">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Secure payment processing</p>
                    <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-300">
                      Your payment is securely processed by PayMongo. Kuya Cares does not store your wallet or banking credentials.
                    </p>
                  </div>
                </section>

                <aside className="h-fit rounded-3xl bg-white p-6 shadow-sm dark:bg-[#111111] lg:sticky lg:top-6">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Payment summary</h2>
                  <div className="mt-5 flex items-start justify-between gap-4 border-b border-gray-100 pb-5 dark:border-gray-800">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Official member access</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">One-time payment</p>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {hasValidFee ? formatAmount(paymentAmount, paymentCurrency) : 'Unavailable'}
                    </p>
                  </div>
                  <div className="mt-5 flex items-baseline justify-between">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Total</span>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                      {hasValidFee ? formatAmount(paymentAmount, paymentCurrency) : 'Unavailable'}
                    </span>
                  </div>
                  {!hasValidFee && (
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      Membership payment is not available yet. Please contact Kuya Cares support.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void startPayment()}
                    disabled={isPaying || isRefreshing || !hasValidFee}
                    className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
                  >
                    {isPaying
                      ? 'Preparing secure payment…'
                      : `Pay with ${selectedMethodLabel}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => void checkPaymentStatus()}
                    disabled={isRefreshing || isPaying}
                    className="mt-3 min-h-11 w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {isRefreshing ? 'Checking payment status…' : 'I have paid — check status'}
                  </button>
                  {paymentCheckMessage && (
                    <p className="mt-3 text-center text-sm text-gray-600 dark:text-gray-300" role="status">
                      {paymentCheckMessage}
                    </p>
                  )}
                  <p className="mt-4 text-center text-xs leading-5 text-gray-500 dark:text-gray-400">
                    By continuing, you authorize this one-time membership payment using {selectedMethodLabel}.
                  </p>
                </aside>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}
