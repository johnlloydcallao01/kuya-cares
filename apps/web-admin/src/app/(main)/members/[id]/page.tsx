'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Building,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Mail,
  Package,
  Pencil,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  User,
  Users,
  X,
} from '@/components/ui/IconWrapper'

type Member = {
  id: number
  email: string
  firstName: string
  lastName: string
  middleName: string | null
  username: string | null
  phone: string | null
  isActive: boolean
  membershipStatus: string
  membershipPaidAt: string | null
  createdAt: string
  lastLogin: string | null
}

type Payment = {
  id: number
  amount: number
  currency: string
  status: string
  paymentProvider: string
  paymentReference: string
  paidAt: string | null
  createdAt: string
}

type Invite = {
  id: number
  code: string
  email: string | null
  status: string
  expiresAt: string | null
  createdAt: string
}

type MemberDetails = {
  member: Member
  vendors: { id: number; businessName: string }[]
  membershipFeePhp: number | null
  payments: { docs: Payment[]; totalDocs: number }
  invites: { docs: Invite[]; totalDocs: number }
  orders: {
    docs: {
      id: number
      listing: { id: number; title: string; status: string } | null
      buyer: { id: number; firstName: string; lastName: string; email: string } | null
      seller: { id: number; firstName: string; lastName: string; email: string } | null
      price: number
      currency: string
      status: string
      createdAt: string
      completedAt: string | null
    }[]
    totalDocs: number
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  let data: Record<string, unknown>
  try {
    data = text ? JSON.parse(text) as Record<string, unknown> : {}
  } catch {
    throw new Error(text || 'The server returned an invalid response')
  }
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${response.status})`)
  }
  return data as T
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
}

function formatMoney(value: number, currency = 'PHP') {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value || 0)
}

function displayName(user?: { firstName?: string; lastName?: string; email?: string } | null) {
  const name = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
  return name || user?.email || '—'
}

function StatusBadge({ value }: { value: string }) {
  const label = value === 'pending_payment' ? 'Payment pending' : value.replace(/_/g, ' ')
  const style = value === 'active' || value === 'paid' || value === 'claimed'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
    : value === 'pending' || value === 'pending_payment'
      ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
      : value === 'failed' || value === 'revoked' || value === 'expired' || value === 'inactive'
        ? 'bg-gray-100 text-gray-600 dark:bg-[#262626] dark:text-[#a1a1aa]'
        : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${style}`}>{label}</span>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-[#262626] dark:bg-[#171717]"><h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-[#262626] dark:text-white">{title}</h2><div className="divide-y divide-gray-100 dark:divide-[#262626]">{children}</div></section>
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3 px-4 py-3 text-sm"><span className="text-gray-500 dark:text-[#a1a1aa]">{label}</span><span className="text-right font-medium text-gray-900 dark:text-white">{value}</span></div>
}

function DetailStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#262626] dark:bg-[#171717]"><div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#a1a1aa]">{icon}{label}</div><p className="mt-2 font-semibold capitalize text-gray-900 dark:text-white">{value}</p></div>
}

function MemberViewSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-[#262626]" />
      <div className="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-[#171717]" />
    </div>
  )
}

function MemberViewContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [details, setDetails] = useState<MemberDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [offlinePaymentReason, setOfflinePaymentReason] = useState('')
  const [showOfflinePayment, setShowOfflinePayment] = useState(false)
  const [savingOfflinePayment, setSavingOfflinePayment] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const result = await readJson<MemberDetails>(await fetch(`/api/members/${encodeURIComponent(id)}`, { cache: 'no-store', signal }))
      if (!signal?.aborted) setDetails(result)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Failed to load member')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const recordOfflinePayment = async () => {
    if (!details || offlinePaymentReason.trim().length < 5) return
    setSavingOfflinePayment(true)
    setError('')
    setSuccess('')
    try {
      const result = await readJson<{ doc: Payment }>(await fetch(`/api/members/${details.member.id}/manual-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: offlinePaymentReason.trim() }),
      }))
      setShowOfflinePayment(false)
      setOfflinePaymentReason('')
      setSuccess(`Offline lifetime membership payment of ${formatMoney(result.doc.amount, result.doc.currency)} recorded and audited.`)
      await load()
      await queryClient.invalidateQueries({ queryKey: ['adminMembers', 'members'] })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record offline payment')
    } finally {
      setSavingOfflinePayment(false)
    }
  }

  const goBack = () => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/members'))

  if (loading) return <MemberViewSkeleton />
  if (error || !details) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <button onClick={goBack} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-[#a1a1aa]"><ArrowLeft className="h-4 w-4" />Back</button>
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 dark:border-[#262626] dark:bg-[#171717]">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h1 className="font-semibold text-gray-900 dark:text-white">Failed to load member</h1>
          <p className="mt-1 text-sm text-gray-500">{error || 'Member not found'}</p>
          <Link href="/members" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#239459] px-4 py-2 text-sm font-medium text-white"><ArrowLeft className="h-4 w-4" />Back to members</Link>
        </div>
      </div>
    )
  }

  const { member } = details
  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={goBack} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-[#a1a1aa] dark:hover:text-white"><ArrowLeft className="h-4 w-4" />Back</button>

      {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><AlertCircle className="h-4 w-4 shrink-0" />{error}<button onClick={() => setError('')} aria-label="Dismiss error" className="ml-auto"><X className="h-4 w-4" /></button></div>}
      {success && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"><Check className="h-4 w-4" />{success}<button onClick={() => setSuccess('')} aria-label="Dismiss message" className="ml-auto"><X className="h-4 w-4" /></button></div>}

      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#239459] to-[#215035] text-lg font-bold text-white">{member.firstName?.[0]?.toUpperCase() || member.email[0]?.toUpperCase() || 'M'}</div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-[#239459]">Member profile · #{member.id}</p><h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">{displayName(member)}</h1><p className="text-sm text-gray-500 dark:text-[#a1a1aa]">{member.email}</p></div>
        </div>
        <div className="flex items-center gap-2">
          {member.membershipStatus !== 'active' && <button disabled={!details.membershipFeePhp || details.membershipFeePhp <= 0} onClick={() => setShowOfflinePayment(true)} className="rounded-xl bg-[#239459] px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50">Record offline payment</button>}
          <Link href={`/users/${member.id}/edit`} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-[#262626] dark:bg-[#171717] dark:text-[#a1a1aa]"><Pencil className="h-4 w-4" />Edit account</Link>
          <Link href="/members" className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-[#262626] dark:bg-[#171717] dark:text-[#a1a1aa]">Close</Link>
        </div>
      </header>

      <nav aria-label="Member navigation" className="rounded-xl border border-gray-200 bg-white p-5 dark:border-[#262626] dark:bg-[#171717]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Member workspace</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">Quick access to products across this member’s vendor outlets.</p>
          </div>
          {details.vendors.length > 0 && <span className="text-xs text-gray-500 dark:text-[#a1a1aa]">{details.vendors.length} vendor{details.vendors.length === 1 ? '' : 's'}</span>}
        </div>
        {details.vendors.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {details.vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-[#333] dark:bg-[#0a0a0a]/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[#239459] dark:bg-emerald-900/30">
                    <Building className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{vendor.businessName || `Vendor #${vendor.id}`}</span>
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-[#a1a1aa]">Vendor #{vendor.id}</span>
                  </span>
                </div>
                <div className="flex gap-2 border-t border-gray-200 pt-3 dark:border-[#333]">
                  <Link href={`/products?view=vendor&vendor=${vendor.id}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#239459] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#215035]">
                    <Package className="h-3.5 w-3.5" />Products
                  </Link>
                  <Link href={`/vendors/${vendor.id}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-[#239459] hover:text-[#239459] dark:border-[#444] dark:bg-[#171717] dark:text-gray-200">
                    Vendor record<ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500 dark:text-[#a1a1aa]">No vendor profile is linked to this member.</p>
        )}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <DetailStat label="Membership" value={member.membershipStatus === 'active' ? 'Lifetime active' : 'Payment pending'} icon={<BadgeCheck className="h-4 w-4" />} />
        <DetailStat label="Account" value={member.isActive ? 'Active' : 'Inactive'} icon={<User className="h-4 w-4" />} />
        <DetailStat label="Marketplace orders" value={String(details.orders.totalDocs)} icon={<CreditCard className="h-4 w-4" />} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Section title="Account and membership">
          <DetailRow label="Email" value={member.email} />
          <DetailRow label="Phone" value={member.phone || '—'} />
          <DetailRow label="Username" value={member.username || '—'} />
          <DetailRow label="Joined" value={formatDate(member.createdAt)} />
          <DetailRow label="Last login" value={formatDate(member.lastLogin)} />
          <DetailRow label="Membership paid" value={formatDate(member.membershipPaidAt)} />
          <DetailRow label="Configured lifetime fee" value={details.membershipFeePhp == null ? 'Not configured' : formatMoney(details.membershipFeePhp)} />
        </Section>
        <div className="space-y-5">
          <Section title={`Lifetime membership payments (${details.payments.totalDocs})`}>
            {details.payments.docs.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><div><p className="font-medium text-gray-900 dark:text-white">{formatMoney(payment.amount, payment.currency)}</p><p className="text-xs text-gray-500">{payment.paymentReference} · {formatDate(payment.paidAt ?? payment.createdAt)}</p></div><StatusBadge value={payment.status} /></div>)}
            {!details.payments.docs.length && <p className="px-4 py-4 text-sm text-gray-500">No payment attempts recorded.</p>}
          </Section>
          <Section title={`Invitations issued or claimed (${details.invites.totalDocs})`}>
            {details.invites.docs.map((invite) => <div key={invite.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><div><p className="font-mono font-medium text-gray-900 dark:text-white">{invite.code}</p><p className="text-xs text-gray-500">{invite.email || 'Any email'} · Expires {formatDate(invite.expiresAt)}</p></div><StatusBadge value={invite.status} /></div>)}
            {!details.invites.docs.length && <p className="px-4 py-4 text-sm text-gray-500">No invitations linked to this member.</p>}
          </Section>
          <nav aria-label="Member order navigation" className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#262626] dark:bg-[#171717]">
            <Link
              href={`/orders?member=${member.id}`}
              className="group flex items-center gap-3 rounded-lg transition"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[#239459] dark:bg-emerald-900/30">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900 group-hover:text-[#239459] dark:text-white">Orders</span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-[#a1a1aa]">View orders placed by this member</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-[#239459]" />
            </Link>
          </nav>
        </div>
      </div>

      <Section title={`Marketplace orders (${details.orders.totalDocs})`}>
        {details.orders.docs.map((order) => <div key={order.id} className="grid gap-1 border-b border-gray-100 px-4 py-3 text-sm last:border-0 dark:border-[#262626] sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="font-medium text-gray-900 dark:text-white">{order.listing?.title || `Order #${order.id}`}</p><p className="text-xs text-gray-500">Buyer: {displayName(order.buyer)} · Seller: {displayName(order.seller)} · {formatDate(order.createdAt)}</p></div><span>{formatMoney(order.price, order.currency)}</span><StatusBadge value={order.status} /></div>)}
        {!details.orders.docs.length && <p className="px-4 py-4 text-sm text-gray-500">No marketplace orders.</p>}
      </Section>

      {showOfflinePayment && <OfflinePaymentDialog member={member} fee={details.membershipFeePhp} reason={offlinePaymentReason} saving={savingOfflinePayment} onReasonChange={setOfflinePaymentReason} onClose={() => setShowOfflinePayment(false)} onConfirm={() => void recordOfflinePayment()} />}
    </div>
  )
}

export default function MemberViewPage() {
  return <ClientOnly fallback={<MemberViewSkeleton />}><MemberViewContent /></ClientOnly>
}

function OfflinePaymentDialog({ member, fee, reason, saving, onReasonChange, onClose, onConfirm }: { member: Member; fee: number | null; reason: string; saving: boolean; onReasonChange: (reason: string) => void; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="offline-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-[#171717]">
        <div className="flex items-start justify-between"><div><h2 id="offline-title" className="font-semibold text-gray-900 dark:text-white">Record offline membership payment</h2><p className="mt-1 text-sm text-gray-500">{displayName(member)} · {formatMoney(fee ?? 0)}</p></div><button disabled={saving} onClick={onClose} aria-label="Close" className="text-gray-500 disabled:opacity-50"><X className="h-5 w-5" /></button></div>
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Use only after verifying the exact configured lifetime fee was received outside PayMongo. This records a paid manual transaction, activates lifetime membership, and writes an audit entry. It cannot be undone here.</p>
        <label className="mt-4 block text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Payment evidence / reason (required)<textarea value={reason} onChange={(event) => onReasonChange(event.target.value)} minLength={5} maxLength={500} rows={3} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#239459] dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white" placeholder="For example: cash received by staff on receipt #…" /></label>
        <div className="mt-4 flex justify-end gap-2"><button disabled={saving} onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-[#333]">Cancel</button><button disabled={reason.trim().length < 5 || saving || !fee || fee <= 0} onClick={onConfirm} className="rounded-lg bg-[#239459] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Recording…' : 'Confirm payment'}</button></div>
      </section>
    </div>
  )
}
