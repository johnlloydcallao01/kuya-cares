'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

export default function MobileCheckoutReturnBridgePage() {
  const params = useParams<{ merchantId: string }>()
  const searchParams = useSearchParams()
  const merchantId = params?.merchantId || ''
  const [showFallback, setShowFallback] = useState(false)

  const deepLink = useMemo(() => {
    const appRedirect = searchParams.get('app_redirect')
    if (appRedirect && isAllowedAppRedirect(appRedirect)) {
      return appRedirect
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('app_redirect')
    if (merchantId && !nextParams.has('merchantId')) {
      nextParams.set('merchantId', merchantId)
    }

    const query = nextParams.toString()
    return `tap2go-customer://checkout/return${query ? `?${query}` : ''}`
  }, [merchantId, searchParams])

  useEffect(() => {
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
  }, [deepLink])

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

function isAllowedAppRedirect(url: string): boolean {
  return /^(exp|exps|tap2go-customer):\/\//i.test(url)
}
