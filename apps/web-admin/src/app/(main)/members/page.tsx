'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SHARED_QUERY_DEFAULTS } from '@encreasl/client-services'
import { ClientOnly } from '@/components/ClientOnly'
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  User,
  Users,
  X,
} from '@/components/ui/IconWrapper'

type Member = {
  id: number
  email: string
  firstName: string
  lastName: string
  username: string | null
  phone: string | null
  isActive: boolean
  membershipStatus: 'active' | 'pending_payment' | string
  membershipPaidAt: string | null
  createdAt: string
  lastLogin: string | null
  latestPayment?: Payment | null
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
  member?: { id: number; email: string; firstName: string; lastName: string } | null
}
type Invite = {
  id: number
  code: string
  email: string | null
  status: 'pending' | 'claimed' | 'revoked' | 'expired' | string
  invitedBy: { id: number; email: string; firstName: string; lastName: string } | null
  claimedBy: { id: number; email: string; firstName: string; lastName: string } | null
  expiresAt: string | null
  claimedAt: string | null
  notes: string | null
  createdAt: string
}
type Pagination = {
  page: number
  limit: number
  totalDocs: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}
type Tab = 'members' | 'invites' | 'payments'

const PAGE_SIZE = 20
const inputClass = 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#239459] dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white'

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  let data: Record<string, unknown>
  try {
    data = text ? JSON.parse(text) as Record<string, unknown> : {}
  } catch {
    throw new Error(text || 'The server returned an invalid response')
  }
  if (!response.ok) {
    const errors = data.errors
    const message = Array.isArray(errors) && errors[0] && typeof errors[0] === 'object'
      ? (errors[0] as { message?: string }).message
      : data.error
    throw new Error(typeof message === 'string' ? message : `Request failed (${response.status})`)
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

function Kpi({ label, value, detail, icon }: { label: string; value: number; detail: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#262626] dark:bg-[#171717]">
      <div><p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa]">{label}</p><p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</p><p className="mt-1 text-xs text-gray-500 dark:text-[#a1a1aa]">{detail}</p></div>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#239459]/10 text-[#239459]">{icon}</span>
    </div>
  )
}

function Pager({ pagination, onPage }: { pagination: Pagination | null; onPage: (page: number) => void }) {
  if (!pagination || pagination.totalDocs === 0) return null
  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm dark:border-[#262626]">
      <span className="text-xs text-gray-500 dark:text-[#a1a1aa]">{pagination.totalDocs.toLocaleString()} records · Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
      <div className="flex gap-2">
        <button disabled={!pagination.hasPrevPage} onClick={() => onPage(pagination.page - 1)} className="rounded-lg border border-gray-200 p-2 text-gray-600 disabled:opacity-40 dark:border-[#333] dark:text-gray-300" aria-label="Previous page"><ChevronRight className="h-4 w-4 rotate-180" /></button>
        <button disabled={!pagination.hasNextPage} onClick={() => onPage(pagination.page + 1)} className="rounded-lg border border-gray-200 p-2 text-gray-600 disabled:opacity-40 dark:border-[#333] dark:text-gray-300" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  )
}

function MembersSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
      <div className="p-4 space-y-3 animate-pulse">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div>
    </div>
  )
}

function MembersPageContent() {
  const [tab, setTab] = useState<Tab>('members')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [membershipStatus, setMembershipStatus] = useState('')
  const [accountStatus, setAccountStatus] = useState('')
  const [recordStatus, setRecordStatus] = useState('')
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteExpiry, setInviteExpiry] = useState('')
  const [inviteNotes, setInviteNotes] = useState('')
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [createdInvite, setCreatedInvite] = useState<Invite | null>(null)
  const [copied, setCopied] = useState(false)
  const [selectedInvite, setSelectedInvite] = useState<Invite | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revoking, setRevoking] = useState(false)
  const [updatingMembershipId, setUpdatingMembershipId] = useState<number | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => { setPage(1) }, [tab, debouncedSearch, membershipStatus, accountStatus, recordStatus])

  const params = useMemo(() => {
    const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (debouncedSearch) query.set('search', debouncedSearch)
    if (tab === 'members') {
      if (membershipStatus) query.set('membershipStatus', membershipStatus)
      if (accountStatus) query.set('accountStatus', accountStatus)
    } else if (recordStatus) {
      query.set('status', recordStatus)
    }
    return query.toString()
  }, [page, debouncedSearch, tab, membershipStatus, accountStatus, recordStatus])
  const queryClient = useQueryClient()
  const queryKey = ['adminMembers', tab, params]
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const endpoint = tab === 'members'
        ? `/api/members?${params}`
        : tab === 'payments'
          ? `/api/members/payments?${params}`
          : `/api/members/invites?${params}`
      return readJson<Record<string, any>>(await fetch(endpoint, { cache: 'no-store', signal }))
    },
    placeholderData: (previousData, previousQuery) => previousQuery?.queryKey[1] === tab ? previousData : undefined,
    ...SHARED_QUERY_DEFAULTS,
  })
  const members: Member[] = tab === 'members' ? data?.docs ?? [] : []
  const payments: Payment[] = tab === 'payments' ? data?.docs ?? [] : []
  const invites: Invite[] = tab === 'invites' ? data?.docs ?? [] : []
  const pagination: Pagination | null = data?.pagination ?? null
  const stats = data?.stats
  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = actionError || (isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load member data') : '')

  const refresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    setActionError('')
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey, exact: true })
        await refetch({ cancelRefetch: true })
      } finally {
        setHardRefreshing(false)
      }
    })()
  }

  const createInvite = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreatingInvite(true)
    setActionError('')
    setSuccess('')
    try {
      const data = await readJson<{ doc: Invite }>(await fetch('/api/members/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim() || undefined,
          expiresAt: inviteExpiry ? new Date(`${inviteExpiry}T23:59:59`).toISOString() : undefined,
          notes: inviteNotes.trim() || undefined,
        }),
      }))
      setCreatedInvite(data.doc)
      setInviteEmail('')
      setInviteExpiry('')
      setInviteNotes('')
      await refetch()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to create invitation')
    } finally {
      setCreatingInvite(false)
    }
  }

  const copyInviteCode = async () => {
    if (!createdInvite) return
    try {
      await navigator.clipboard.writeText(createdInvite.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setActionError('Could not copy the invite code. Select and copy it manually.')
    }
  }

  const revokeInvite = async () => {
    if (!selectedInvite || !revokeReason.trim()) return
    setRevoking(true)
    setActionError('')
    try {
      await readJson(await fetch(`/api/members/invites/${selectedInvite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'revoked', reason: revokeReason.trim() }),
      }))
      setSelectedInvite(null)
      setRevokeReason('')
      setSuccess(`Invitation ${selectedInvite.code} was revoked.`)
      await refetch()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to revoke invitation')
    } finally {
      setRevoking(false)
    }
  }

  const toggleMembershipStatus = async (member: Member) => {
    if (updatingMembershipId !== null) return
    const nextStatus = member.membershipStatus === 'active' ? 'pending_payment' : 'active'
    setUpdatingMembershipId(member.id)
    setActionError('')
    setSuccess('')
    try {
      await readJson(await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipStatus: nextStatus }),
      }))
      setSuccess(`${displayName(member)} membership status set to ${nextStatus === 'active' ? 'active' : 'payment pending'}.`)
      await queryClient.invalidateQueries({ queryKey: ['adminMembers', 'members'] })
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to update membership status')
    } finally {
      setUpdatingMembershipId(null)
    }
  }

  const visibleRange = useMemo(() => {
    if (!pagination || pagination.totalDocs === 0) return 'No records'
    const start = (pagination.page - 1) * pagination.limit + 1
    return `${start}–${Math.min(start + pagination.limit - 1, pagination.totalDocs)} of ${pagination.totalDocs}`
  }, [pagination])

  return (
    <div className="space-y-6 px-2.5 py-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#239459] text-white"><Users className="h-4 w-4" /></span>Members</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-[#a1a1aa]">Manage private-marketplace member accounts, lifetime membership payment records, and invitation access. Payment status comes from recorded server-confirmed payment data.</p>
        </div>
        <button onClick={refresh} disabled={loading} className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-[#262626] dark:bg-[#171717] dark:text-gray-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span><button onClick={() => setActionError('')} className="ml-auto" aria-label="Dismiss error"><X className="h-4 w-4" /></button></div>}
      {success && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"><Check className="h-4 w-4" />{success}<button onClick={() => setSuccess('')} className="ml-auto" aria-label="Dismiss message"><X className="h-4 w-4" /></button></div>}

      {tab === 'members' && (stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi label="Member accounts" value={stats.totalMembers} detail="Unified buy-and-sell accounts" icon={<Users className="h-5 w-5" />} />
          <Kpi label="Lifetime active" value={stats.activeMemberships} detail="Payment confirmed or admin-approved" icon={<ShieldCheck className="h-5 w-5" />} />
          <Kpi label="Payment pending" value={stats.pendingMemberships} detail="Not yet eligible to trade" icon={<Clock className="h-5 w-5" />} />
          <Kpi label="Inactive accounts" value={stats.inactiveAccounts} detail="Login disabled by account status" icon={<User className="h-5 w-5" />} />
          <Kpi label="Pending invitations" value={stats.pendingInvites} detail="Includes codes not yet claimed" icon={<Mail className="h-5 w-5" />} />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 animate-pulse">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
        </div>
      ) : null)}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-[#262626] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1 dark:bg-[#0a0a0a]">
            {([['members', 'Members'], ['invites', 'Invitations'], ['payments', 'Membership payments']] as const).map(([key, label]) => (
              <button key={key} onClick={() => { setTab(key); setRecordStatus(''); setPage(1) }} className={`rounded-md px-3 py-2 text-sm font-medium ${tab === key ? 'bg-white text-gray-900 shadow-sm dark:bg-[#262626] dark:text-white' : 'text-gray-600 dark:text-[#a1a1aa]'}`}>{label}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'members' ? 'Search name, email, phone…' : tab === 'invites' ? 'Search code or email…' : 'Search payment reference…'} className={`${inputClass} min-w-64 pl-9`} /></label>
            {tab === 'members' ? (
              <>
                <select aria-label="Membership status" value={membershipStatus} onChange={(event) => setMembershipStatus(event.target.value)} className={inputClass}><option value="">All membership statuses</option><option value="active">Lifetime active</option><option value="pending_payment">Payment pending</option></select>
                <select aria-label="Account status" value={accountStatus} onChange={(event) => setAccountStatus(event.target.value)} className={inputClass}><option value="">All account statuses</option><option value="active">Account active</option><option value="inactive">Account inactive</option></select>
              </>
            ) : (
              <select aria-label="Record status" value={recordStatus} onChange={(event) => setRecordStatus(event.target.value)} className={inputClass}>
                <option value="">All {tab}</option>
                {tab === 'invites' ? <><option value="pending">Pending</option><option value="claimed">Claimed</option><option value="expired">Expired</option><option value="revoked">Revoked</option></> : <><option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option></>}
              </select>
            )}
            {tab === 'invites' && <button onClick={() => { setShowInviteForm((shown) => !shown); setCreatedInvite(null) }} className="inline-flex items-center gap-2 rounded-lg bg-[#239459] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1d7748]"><Plus className="h-4 w-4" />Create invitation</button>}
          </div>
        </div>

        {tab === 'invites' && showInviteForm && (
          <form onSubmit={createInvite} className="m-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
            <div><h2 className="font-semibold text-gray-900 dark:text-white">Create private-marketplace invitation</h2><p className="mt-1 text-xs text-gray-600 dark:text-[#a1a1aa]">Creates a one-time invite code; it does not send email. Member registration currently allows signup without a code, so this invitation is optional. Share the code with the intended invitee. Default expiry is 30 days.</p></div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs font-medium text-gray-700 dark:text-[#a1a1aa]">Invitee email (optional)<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className={`${inputClass} mt-1 w-full`} maxLength={254} /></label>
              <label className="text-xs font-medium text-gray-700 dark:text-[#a1a1aa]">Expiry date (optional)<input type="date" value={inviteExpiry} onChange={(event) => setInviteExpiry(event.target.value)} className={`${inputClass} mt-1 w-full`} min={new Date().toISOString().slice(0, 10)} /></label>
              <label className="text-xs font-medium text-gray-700 dark:text-[#a1a1aa]">Internal notes<input value={inviteNotes} onChange={(event) => setInviteNotes(event.target.value)} className={`${inputClass} mt-1 w-full`} maxLength={1000} /></label>
            </div>
            {createdInvite && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-white p-3 dark:border-emerald-900 dark:bg-[#171717]"><div><p className="text-xs text-gray-500">Invitation code</p><code className="text-lg font-bold tracking-widest text-emerald-700 dark:text-emerald-300">{createdInvite.code}</code><p className="text-xs text-gray-500">Expires {formatDate(createdInvite.expiresAt)}</p></div><button type="button" onClick={copyInviteCode} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-[#333]">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy code'}</button></div>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowInviteForm(false)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-[#333]">Close</button><button disabled={creatingInvite} className="inline-flex items-center gap-2 rounded-lg bg-[#239459] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{creatingInvite ? 'Creating…' : 'Generate code'}</button></div>
          </form>
        )}

        {isInitialLoading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              {tab === 'members' ? (
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-[#0a0a0a] dark:text-[#a1a1aa]"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Membership</th><th className="px-4 py-3">Latest payment</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                    {members.map((member) => <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/60">
                      <td className="px-4 py-3"><Link href={`/members/${member.id}`} className="text-left"><span className="block font-semibold text-gray-900 hover:text-[#239459] dark:text-white">{displayName(member)}</span><span className="text-xs text-gray-500">{member.email}{member.phone ? ` · ${member.phone}` : ''}</span></Link></td>
                      <td className="px-4 py-3">
                        <StatusBadge value={member.membershipStatus} />
                        {member.membershipPaidAt && <div className="mt-1 text-xs text-gray-500">Paid {formatDate(member.membershipPaidAt)}</div>}
                      </td>
                      <td className="px-4 py-3">{member.latestPayment ? <><StatusBadge value={member.latestPayment.status} /><div className="mt-1 text-xs text-gray-500">{formatMoney(member.latestPayment.amount, member.latestPayment.currency)} · {formatDate(member.latestPayment.createdAt)}</div></> : <span className="text-gray-400">No payment record</span>}</td>
                      <td className="px-4 py-3"><StatusBadge value={member.isActive ? 'active' : 'inactive'} /></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(member.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void toggleMembershipStatus(member)}
                            disabled={updatingMembershipId !== null}
                            aria-label={`Set ${displayName(member)} membership to ${member.membershipStatus === 'active' ? 'payment pending' : 'active'}`}
                            title={`Set membership to ${member.membershipStatus === 'active' ? 'payment pending' : 'active'}`}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:cursor-wait disabled:opacity-50 ${
                              member.membershipStatus === 'active'
                                ? 'border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60'
                                : 'border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60'
                            }`}
                          >
                            {updatingMembershipId === member.id
                              ? <RefreshCw className="h-4 w-4 animate-spin" />
                              : member.membershipStatus === 'active'
                                ? <ToggleRight className="h-5 w-5" />
                                : <ToggleLeft className="h-5 w-5" />}
                          </button>
                          <Link href={`/members/${member.id}`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-[#239459] hover:text-[#239459] dark:border-[#333] dark:text-gray-200">View record</Link>
                        </div>
                      </td>
                    </tr>)}
                    {!error && !members.length && <tr><td colSpan={6} className="p-12 text-center text-sm text-gray-500">No member accounts match these filters.</td></tr>}
                  </tbody>
                </table>
              ) : tab === 'payments' ? (
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-[#0a0a0a] dark:text-[#a1a1aa]"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Paid / created</th></tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                    {payments.map((payment) => <tr key={payment.id}><td className="px-4 py-3"><span className="font-medium text-gray-900 dark:text-white">{displayName(payment.member)}</span><div className="text-xs text-gray-500">{payment.member?.email ?? 'Member account unavailable'}</div></td><td className="px-4 py-3 font-mono text-xs">{payment.paymentReference}</td><td className="px-4 py-3 font-semibold">{formatMoney(payment.amount, payment.currency)}</td><td className="px-4 py-3 capitalize">{payment.paymentProvider || '—'}</td><td className="px-4 py-3"><StatusBadge value={payment.status} /></td><td className="px-4 py-3 text-xs text-gray-500">{formatDate(payment.paidAt ?? payment.createdAt)}</td></tr>)}
                    {!payments.length && <tr><td colSpan={6} className="p-12 text-center text-sm text-gray-500">No membership payment records match these filters.</td></tr>}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-[#0a0a0a] dark:text-[#a1a1aa]"><tr><th className="px-4 py-3">Invitation</th><th className="px-4 py-3">Invitee</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Issued by</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                    {invites.map((invite) => <tr key={invite.id}><td className="px-4 py-3"><code className="font-semibold tracking-wider">{invite.code}</code><div className="text-xs text-gray-500">Created {formatDate(invite.createdAt)}</div></td><td className="px-4 py-3">{invite.email || 'Any email'}{invite.claimedBy && <div className="text-xs text-gray-500">Claimed by {displayName(invite.claimedBy)}</div>}</td><td className="px-4 py-3"><StatusBadge value={invite.status} /></td><td className="px-4 py-3 text-xs">{displayName(invite.invitedBy)}</td><td className="px-4 py-3 text-xs text-gray-500">{formatDate(invite.expiresAt)}</td><td className="px-4 py-3 text-right">{invite.status === 'pending' && <button onClick={() => { setSelectedInvite(invite); setRevokeReason('') }} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300">Revoke</button>}</td></tr>)}
                    {!invites.length && <tr><td colSpan={6} className="p-12 text-center text-sm text-gray-500">No invitations match these filters.</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
            <Pager pagination={pagination} onPage={setPage} />
          </>
        )}
        {!loading && <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400 dark:border-[#262626]">{visibleRange}</div>}
      </section>

      {selectedInvite && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedInvite(null) }}><section role="dialog" aria-modal="true" aria-labelledby="revoke-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-[#171717]"><div className="flex items-start justify-between"><div><h2 id="revoke-title" className="font-semibold text-gray-900 dark:text-white">Revoke invitation</h2><p className="mt-1 text-sm text-gray-500">Code <code className="font-semibold">{selectedInvite.code}</code> will no longer be redeemable.</p></div><button onClick={() => setSelectedInvite(null)} aria-label="Close" className="text-gray-500"><X className="h-5 w-5" /></button></div><label className="mt-4 block text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Reason (required)<textarea value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} maxLength={500} rows={3} className={`${inputClass} mt-1 w-full`} /></label><div className="mt-4 flex justify-end gap-2"><button onClick={() => setSelectedInvite(null)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-[#333]">Cancel</button><button disabled={!revokeReason.trim() || revoking} onClick={() => void revokeInvite()} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{revoking ? 'Revoking…' : 'Revoke code'}</button></div></section></div>}
    </div>
  )
}

export default function MembersPage() {
  return (
    <ClientOnly fallback={<MembersSkeleton />}>
      <MembersPageContent />
    </ClientOnly>
  )
}
