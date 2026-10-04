'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '@/contexts/CartContext'
import {
  clearPendingCheckoutSession,
  finalizePaidOrder,
  waitForPaidTransaction,
} from '@/lib/client-services/checkout-service'
import { LocationBasedMerchantService } from '@encreasl/client-services'

/**
 * PayMongo return landing. Two modes (mobile parity + web flow):
 *
 * 1. app_redirect present → the legacy mobile deep-link bridge: forward to
 *    the Tap2Go/Expo app untouched (this page's original job).
 * 2. otherwise (web-originated payment) → confirm the payment like mobile's
 *    CheckoutReturnScreen: waitForPaidTransaction → finalizePaidOrder
 *    (accept + ordered + Lalamove book) → clear session → reload cart →
 *    replace to /order-success. Failures land on /orders with a message.
 */
export default function CheckoutReturnPage() {
  return (
    <Suspense fallback={<ReturnShell />}>
      <ReturnContent />
    </Suspense>
  )
}

function ReturnShell() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        padding: '24px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '420px',
          borderRadius: '20px',
          background: '#ffffff',
          padding: '28px',
          border: '1px solid #e5e7eb',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>
          Confirming your payment
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
          Please wait while we verify your payment and finalize your order.
        </p>
      </section>
    </main>
  )
}

const handledReturnFlowTimestamps = new Map<string, number>();

function ReturnContent() {
  const params = useParams<{ merchantId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { reload } = useCart()
  const merchantId = params?.merchantId || ''
  const [showFallback, setShowFallback] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const appRedirect = searchParams.get('app_redirect')
  const isBridge = !!appRedirect && isAllowedAppRedirect(appRedirect)

  const deepLink = useMemo(() => {
    if (isBridge) {
      return appRedirect as string
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('app_redirect')
    if (merchantId && !nextParams.has('merchantId')) {
      nextParams.set('merchantId', merchantId)
    }

    const query = nextParams.toString()
    return `tap2go-customer://checkout/return${query ? `?${query}` : ''}`
  }, [merchantId, searchParams, isBridge, appRedirect])

  // Bridge mode: hand back to the mobile app (original behavior).
  useEffect(() => {
    if (!isBridge) return;
    const openDeepLink = () => {
      window.location.href = deepLink
    }

    // Try immediately for browsers that allow the app switch after the payment redirect.
    openDeepLink()

    // Retry shortly after in case the first handoff is dropped.
    const retryTimer = window.setTimeout(() => {
      openDeepLink()
    }, 400)

    // Only reveal fallback UI if the page is still visible after the auto-open attempts.
    const fallbackTimer = window.setTimeout(() => {
      if (!document.hidden) {
        setShowFallback(true)
      }
    }, 1400)

    return () => {
      window.clearTimeout(retryTimer)
      window.clearTimeout(fallbackTimer)
    }
  }, [deepLink, isBridge])

  // Web mode: confirm + finalize like mobile CheckoutReturnScreen.
  const handledRef = useRef(false);
  useEffect(() => {
    if (isBridge || handledRef.current) return;
    handledRef.current = true;

    const paymentIntentId = searchParams.get('payment_intent_id') || ''
    const orderId = searchParams.get('order_id') || ''

    // 15s dedup window per intent (mobile parity).
    const now = Date.now()
    if (paymentIntentId) {
      const last = handledReturnFlowTimestamps.get(paymentIntentId) || 0
      if (now - last < 15000) {
        router.replace('/orders' as any);
        return;
      }
      handledReturnFlowTimestamps.set(paymentIntentId, now)
    }

    if (!paymentIntentId) {
      setConfirmError('Missing payment confirmation reference.');
      return;
    }

    ;(async () => {
      try {
        const { transaction, orderId: resolvedOrderId } = await waitForPaidTransaction(
          paymentIntentId,
          orderId || undefined,
        );
        await finalizePaidOrder(resolvedOrderId, (transaction as any)?.paid_at || null);
        try {
          const customerId = await LocationBasedMerchantService.getCurrentCustomerId().catch(() => null);
          if (customerId) {
            await clearPendingCheckoutSession(String(customerId), String(merchantId || ''));
          }
        } catch {
          /* session cleanup best-effort */
        }
        await reload().catch(() => undefined);
        router.replace(
          `/order-success?orderId=${encodeURIComponent(resolvedOrderId)}&merchantId=${encodeURIComponent(String(merchantId || ''))}` as any,
        );
      } catch (e: any) {
        setConfirmError(e?.message || 'Payment confirmation is still processing. Please check your Orders shortly.');
      }
    })()
  }, [isBridge, searchParams, merchantId, router, reload])

  if (isBridge) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9fafb',
          padding: '24px',
        }}
      >
        <section
          style={{
            width: '100%',
            maxWidth: '420px',
            borderRadius: '20px',
            background: '#ffffff',
            padding: '28px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
            Returning to Tap2Go
          </h1>
          <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#6b7280', marginBottom: '20px' }}>
            Your payment result is being handed back to the mobile app so we can confirm the order properly.
          </p>
          {!showFallback ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '48px',
                padding: '0 20px',
                borderRadius: '999px',
                background: '#fef3c7',
                color: '#92400e',
                fontWeight: 700,
              }}
            >
              Opening Tap2Go...
            </div>
          ) : (
            <>
              <a
                href={deepLink}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '48px',
                  padding: '0 20px',
                  borderRadius: '999px',
                  background: '#f59e0b',
                  color: '#fff',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Open Tap2Go
              </a>
              <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#6b7280', marginTop: '14px' }}>
                If the app did not open automatically, tap the button once to continue in Tap2Go.
              </p>
            </>
          )}
        </section>
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        padding: '24px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '420px',
          borderRadius: '20px',
          background: '#ffffff',
          padding: '28px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
          textAlign: 'center',
        }}
      >
        {!confirmError ? (
          <>
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 16px',
                borderRadius: '999px',
                background: '#ecfdf5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
              }}
            >
              🛡️
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
              Confirming your payment
            </h1>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#6b7280' }}>
              Please wait while we verify your PayMongo payment and finalize your order.
            </p>
          </>
        ) : (
          <>
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 16px',
                borderRadius: '999px',
                background: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
              }}
            >
              ⚠️
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
              Payment processing
            </h1>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#6b7280', marginBottom: '20px' }}>
              {confirmError}
            </p>
            <button
              type="button"
              onClick={() => router.replace('/orders' as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '48px',
                padding: '0 20px',
                borderRadius: '999px',
                background: '#239459',
                color: '#fff',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Go to Orders
            </button>
          </>
        )}
      </section>
    </main>
  )
}

function isAllowedAppRedirect(url: string): boolean {
  return /^(exp|exps|tap2go-customer):\/\//i.test(url)
}
