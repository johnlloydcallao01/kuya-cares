'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { API_BASE_URL, getStoredToken } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

type MembershipGateState = 'checking' | 'active' | 'pending' | 'error' | 'not-member'
type MembershipGateSnapshot = {
  userId: number | null
  state: MembershipGateState
}

const PAYMENT_PATH = '/membership/payment'
const AUTH_PATHS = new Set(['/signin', '/register'])

function getSeededGateState(status: 'pending_payment' | 'active' | null | undefined): MembershipGateState {
  if (status === 'active') return 'active'
  if (status === 'pending_payment') return 'pending'
  return 'checking'
}

export function MemberMembershipGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, isInitialized, isLoading } = useAuth()
  const userId = user?.id ?? null
  const [gateSnapshot, setGateSnapshot] = useState<MembershipGateSnapshot>(() => ({
    userId,
    state: getSeededGateState(user?.memberMembershipStatus),
  }))
  const resolvedGateState = gateSnapshot.userId === userId
    ? gateSnapshot.state
    : getSeededGateState(user?.memberMembershipStatus)

  const loadMembership = useCallback(async () => {
    if (!user || user.role !== 'member' || !isAuthenticated) {
      setGateSnapshot({ userId, state: 'not-member' })
      return
    }
    const token = getStoredToken()
    if (!token) {
      setGateSnapshot({ userId, state: 'error' })
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/member-membership`, {
        headers: { Authorization: `JWT ${token}` },
        cache: 'no-store',
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result || typeof result.membershipStatus !== 'string') {
        throw new Error(result?.error || 'Could not verify member status')
      }
      setGateSnapshot({
        userId,
        state: result.membershipStatus === 'active' ? 'active' : 'pending',
      })
    } catch (error) {
      console.error('[membership-gate] Failed to verify membership:', error)
      setGateSnapshot((current) => ({
        userId,
        state: current.userId === userId && current.state === 'active' ? 'active' : 'error',
      }))
    }
  }, [isAuthenticated, user, userId])

  useEffect(() => {
    if (!isInitialized || isLoading) return
    if (!isAuthenticated || !user) {
      setGateSnapshot({ userId, state: 'not-member' })
      return
    }
    if (user.role !== 'member') {
      setGateSnapshot({ userId, state: 'not-member' })
      return
    }
    void loadMembership()
  }, [isAuthenticated, isInitialized, isLoading, loadMembership, userId, user?.role])

  useEffect(() => {
    if (!isAuthenticated || !user || user.role !== 'member') return
    if (resolvedGateState !== 'pending' && resolvedGateState !== 'error') return
    const timer = window.setInterval(() => {
      void loadMembership()
    }, 15000)
    return () => window.clearInterval(timer)
  }, [resolvedGateState, isAuthenticated, loadMembership, user, user?.role])

  useEffect(() => {
    if (!isInitialized || isLoading || !isAuthenticated || user?.role !== 'member') return
    if (pathname === PAYMENT_PATH || AUTH_PATHS.has(pathname)) return

    if (resolvedGateState === 'pending') {
      router.replace(PAYMENT_PATH)
    }
  }, [
    isAuthenticated,
    isInitialized,
    isLoading,
    pathname,
    resolvedGateState,
    router,
    user?.role,
  ])

  const isProtectedPath = pathname !== PAYMENT_PATH && !AUTH_PATHS.has(pathname)
  const mustBlock = isAuthenticated &&
    user?.role === 'member' &&
    isProtectedPath &&
    (resolvedGateState === 'checking' || resolvedGateState === 'pending' || resolvedGateState === 'error')

  if (!mustBlock) return <>{children}</>

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 text-gray-900 dark:bg-[#0a0a0a] dark:text-gray-100">
      <section className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-[#111111]">
        {resolvedGateState === 'checking' ? (
          <>
            <div className="mx-auto mb-5 h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-700 dark:border-emerald-950 dark:border-t-emerald-400" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Verifying your membership</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              Please wait while we confirm your member access.
            </p>
          </>
        ) : resolvedGateState === 'error' ? (
          <>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">We couldn’t verify your membership</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              Marketplace access stays locked until we can verify your membership status.
            </p>
            <button
              type="button"
              onClick={() => {
                void loadMembership()
              }}
              className="mt-6 min-h-11 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              Try again
            </button>
            <a href={PAYMENT_PATH} className="mt-4 block text-sm font-semibold text-emerald-800 underline dark:text-emerald-400">
              Go to membership payment
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Activate your membership</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              Complete the one-time payment to unlock marketplace access.
            </p>
            <button
              type="button"
              onClick={() => router.replace(PAYMENT_PATH)}
              className="mt-6 min-h-11 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              Continue to payment
            </button>
          </>
        )}
      </section>
    </main>
  )
}
