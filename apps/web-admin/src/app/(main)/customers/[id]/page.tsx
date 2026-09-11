'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Users, ArrowLeft, Pencil, MapPin, ShoppingBag, ShieldCheck,
  Mail, Phone, CalendarDays, AlertCircle, Ticket, Award, GraduationCap
} from '@/components/ui/IconWrapper'

type CustomerDoc = {
  id: number
  email: string
  srn: string | null
  couponCode: string | null
  enrollmentDate: string | null
  currentLevel: string
  activeAddress: any
  user: any
  isActive: boolean
  orderCount: number
  addressCount: number
  recentOrders?: any[]
  createdAt: string
  updatedAt: string
}

function levelBadge(level: string) {
  const s = (level || 'beginner').toLowerCase()
  if (s === 'advanced') return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800'
  if (s === 'intermediate') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
}
function fmtDate(iso: string | null) { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(iso).slice(0,10) } }
function initials(first: string, last: string) { const a=(first?.[0]||'').toUpperCase(); const b=(last?.[0]||'').toUpperCase(); return `${a}${b}`.trim()||'C' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4><div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden bg-white dark:bg-[#171717]">{children}</div></div>
}
function Row({ label, value, mono, icon }: { label: string; value: React.ReactNode; mono?: boolean; icon?: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm"><span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0 flex items-center gap-1">{icon}{label}</span><span className={`text-gray-900 dark:text-white text-right max-w-[60%] break-words ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value as any}</span></div>
}

function CustomerViewSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function CustomerViewContent() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [doc, setDoc] = useState<CustomerDoc | null>(null)
  const [related, setRelated] = useState<any>(null)
  const [recentEvents, setRecentEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/customers/${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load customer')
        if (!cancelled) { setDoc(j.doc); setRelated(j.related || null); setRecentEvents(j.recentEvents || []) }
      } catch (e: any) { if (!cancelled) setError(e.message || 'Failed to load') }
      finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
        <div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
      </div>
    )
  }
  if (error || !doc) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/customers'))} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load customer</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/customers" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><ArrowLeft className="w-4 h-4" /> Back</Link>
        </div>
      </div>
    )
  }

  const user = doc.user

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/customers'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
            {user?.profilePicture?.url ? <img src={user.profilePicture.url} alt={`${user.firstName} ${user.lastName}`} className="h-12 w-12 rounded-xl object-cover" /> : user ? initials(user.firstName, user.lastName) : 'C'}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{user ? `${user.firstName} ${user.lastName}` : `Customer #${doc.id}`}</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">{doc.email} • {doc.srn || 'no SRN'} • <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${levelBadge(doc.currentLevel)}`}>{doc.currentLevel}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/customers/${doc.id}/edit`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Pencil className="w-4 h-4" /> Edit</Link>
          <Link href="/customers" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626]">Close</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Learning Level</p><p className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${levelBadge(doc.currentLevel)}`}><GraduationCap className="w-3 h-3 mr-1" />{doc.currentLevel}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Status</p><p className={`mt-2 font-semibold text-sm ${doc.isActive ? 'text-emerald-600' : 'text-zinc-500'}`}>{doc.isActive ? 'Active account' : 'Inactive'}</p><p className="text-xs text-gray-500 mt-1">Enrolled {fmtDate(doc.enrollmentDate)}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Orders</p><p className="mt-2 font-bold flex items-center gap-1 text-lg"><ShoppingBag className="w-5 h-5 text-[#eba236]" /> {doc.orderCount}</p><p className="text-xs text-gray-500">{related?.wishlistCount ?? 0} wishlist items</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Addresses</p><p className="mt-2 font-bold flex items-center gap-1 text-lg"><MapPin className="w-5 h-5 text-blue-500" /> {doc.addressCount}</p><p className="text-xs text-gray-500">{doc.activeAddress ? 'has active address' : 'no active address'}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Section title="Customer Information">
            <Row label="SRN" value={doc.srn || '—'} mono />
            <Row label="Coupon" value={doc.couponCode || '—'} icon={<Ticket className="w-3 h-3" />} />
            <Row label="Level" value={doc.currentLevel} />
            <Row label="Enrollment" value={fmtDate(doc.enrollmentDate)} icon={<CalendarDays className="w-3 h-3" />} />
            <Row label="Customer ID" value={`#${doc.id}`} mono />
          </Section>
          <Section title="Linked User Account">
            <Row label="Name" value={user ? `${user.firstName} ${user.lastName}${user.middleName ? ` ${user.middleName}` : ''}` : '—'} />
            <Row label="Email" value={user?.email || doc.email || '—'} icon={<Mail className="w-3 h-3" />} />
            <Row label="Phone" value={user?.phone || '—'} icon={<Phone className="w-3 h-3" />} />
            <Row label="Username" value={user?.username ? `@${user.username}` : '—'} />
            <Row label="Status" value={user ? (user.isActive ? 'Active' : 'Inactive') : '—'} />
            <Row label="User ID" value={user ? `#${user.id}` : '—'} mono />
          </Section>
          {doc.activeAddress && (
            <Section title="Active Address">
              <div className="p-4 text-sm">
                <p className="font-medium text-gray-900 dark:text-white">{doc.activeAddress.formatted_address}</p>
                <p className="text-xs text-gray-500 mt-1">{[doc.activeAddress.locality, doc.activeAddress.administrative_area_level_1, doc.activeAddress.postal_code].filter(Boolean).join(' • ')} • {doc.activeAddress.address_type || 'home'} {doc.activeAddress.is_verified ? '• verified' : ''}</p>
                <p className="text-xs font-mono text-gray-400 mt-1">Address ID #{doc.activeAddress.id}</p>
              </div>
            </Section>
          )}
        </div>
        <div className="space-y-5">
          <Section title={`Recent Orders (${doc.orderCount})`}>
            {doc.recentOrders && doc.recentOrders.length ? (
              <div className="divide-y divide-gray-100 dark:divide-[#262626]">
                {doc.recentOrders.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between p-4">
                    <div><div className="font-medium text-sm text-gray-900 dark:text-white">Order #{o.id} • {o.status}</div><div className="text-xs text-gray-500">{o.fulfillment_type} • ₱{Number(o.total).toFixed(2)} • {fmtDate(o.placed_at)}</div></div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#333]">#{o.id}</span>
                  </div>
                ))}
              </div>
            ) : <div className="p-6 text-sm text-gray-500 text-center">No orders yet — customer hasn&apos;t placed an order.</div>}
          </Section>
          {recentEvents.length > 0 && (
            <Section title="Recent Activity">
              <div className="divide-y divide-gray-100 dark:divide-[#262626]">
                {recentEvents.map((e: any) => (
                  <div key={e.id} className="px-4 py-2.5 text-sm">
                    <div className="font-medium text-gray-900 dark:text-white text-xs">{e.eventType}</div>
                    <div className="text-xs text-gray-500">{fmtDate(e.timestamp)}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}
          <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#eba236]" /> Timeline</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(doc.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Updated</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(doc.updatedAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Enrolled</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(doc.enrollmentDate)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CustomerViewPage(){
  return (
    <ClientOnly fallback={<CustomerViewSkeleton />}>
      <CustomerViewContent />
    </ClientOnly>
  )
}
