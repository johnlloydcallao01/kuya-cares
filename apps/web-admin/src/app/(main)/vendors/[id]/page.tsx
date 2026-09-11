'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Building, ArrowLeft, Pencil, Trash2, Store, Star, ShieldCheck, ShieldAlert, Clock,
  Mail, Phone, Globe, CalendarDays, AlertCircle, RefreshCw, X, FileText
} from '@/components/ui/IconWrapper'

type VendorDoc = {
  id: number
  businessName: string
  legalName: string
  businessRegistrationNumber: string
  taxIdentificationNumber: string | null
  primaryContactEmail: string
  primaryContactPhone: string
  websiteUrl: string | null
  businessType: string
  cuisineTypes: unknown
  isActive: boolean
  verificationStatus: string
  onboardingDate: string | null
  averageRating: number
  totalReviews: number
  totalOrders: number
  totalMerchants: number
  description: string | null
  operatingHours: any
  socialMediaLinks: any
  logo: any
  businessLicense: any
  taxCertificate: any
  owner: any
  createdAt: string
  updatedAt: string
  merchantsPreview?: any[]
}

const BUSINESS_OPTS: Record<string, string> = {
  restaurant: 'Restaurant', fast_food: 'Fast Food', grocery: 'Grocery Store', pharmacy: 'Pharmacy',
  convenience: 'Convenience', bakery: 'Bakery', coffee_shop: 'Coffee Shop', other: 'Other'
}
function businessLabel(v: string) { return BUSINESS_OPTS[v] || v.replace(/_/g, ' ') }
function verificationBadge(status: string) {
  const s = status.toLowerCase()
  if (s === 'verified') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (s === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (s === 'rejected') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
  if (s === 'suspended') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}
function fmtDate(iso: string | null) { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(iso).slice(0,10) } }
function initials(name: string) { return name.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('')||'V' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4><div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden bg-white dark:bg-[#171717]">{children}</div></div>
}
function Row({ label, value, mono, icon }: { label: string; value: React.ReactNode; mono?: boolean; icon?: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm"><span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0 flex items-center gap-1">{icon}{label}</span><span className={`text-gray-900 dark:text-white text-right max-w-[60%] break-words ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value as any}</span></div>
}

function VendorViewSkeleton(){
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
    </div>
  )
}

function VendorViewContent() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [doc, setDoc] = useState<VendorDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/vendors/${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load vendor')
        if (!cancelled) setDoc(j.doc)
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
        <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/vendors'))} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load vendor</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/vendors" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><ArrowLeft className="w-4 h-4" /> Back</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/vendors'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center font-bold text-lg shrink-0">{initials(doc.businessName)}</div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{doc.businessName}</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">{doc.legalName} • {businessLabel(doc.businessType)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/vendors/${doc.id}/edit`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Pencil className="w-4 h-4" /> Edit</Link>
          <Link href="/vendors" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626]">Close</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Verification</p><p className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${verificationBadge(doc.verificationStatus)}`}>{doc.verificationStatus}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Status</p><p className={`mt-2 font-semibold text-sm ${doc.isActive ? 'text-emerald-600' : 'text-zinc-500'}`}>{doc.isActive ? 'Active partner' : 'Inactive'}</p><p className="text-xs text-gray-500 mt-1">Onboarded {fmtDate(doc.onboardingDate || doc.createdAt)}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Outlets</p><p className="mt-2 font-bold flex items-center gap-1 text-lg"><Store className="w-5 h-5 text-[#eba236]" /> {doc.totalMerchants}</p><p className="text-xs text-gray-500">merchant stores</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Rating</p><p className="mt-2 font-bold flex items-center gap-1 text-lg"><Star className="w-5 h-5 text-amber-400" /> {doc.averageRating ? doc.averageRating.toFixed(1) : '—'} <span className="text-sm font-normal text-gray-500">({doc.totalReviews})</span></p><p className="text-xs text-gray-500">{doc.totalOrders} total orders</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Section title="Business Information">
            <Row label="Business name" value={doc.businessName} />
            <Row label="Legal name" value={doc.legalName} />
            <Row label="Registration No." value={doc.businessRegistrationNumber} mono />
            <Row label="TIN" value={doc.taxIdentificationNumber || '—'} mono />
            <Row label="Website" value={doc.websiteUrl ? <a href={doc.websiteUrl} target="_blank" className="text-blue-600 hover:underline inline-flex items-center gap-1"><Globe className="w-3 h-3" /> {doc.websiteUrl}</a> as any : '—'} />
            <Row label="Description" value={doc.description || '—'} />
          </Section>
          <Section title="Contact">
            <Row label="Email" value={doc.primaryContactEmail} icon={<Mail className="w-3 h-3" />} />
            <Row label="Phone" value={doc.primaryContactPhone} icon={<Phone className="w-3 h-3" />} />
            <Row label="Owner account" value={doc.owner ? `${doc.owner.firstName} ${doc.owner.lastName} — ${doc.owner.email}` : '—'} />
          </Section>
          {doc.socialMediaLinks && (doc.socialMediaLinks.facebook || doc.socialMediaLinks.instagram || doc.socialMediaLinks.twitter || doc.socialMediaLinks.website) && (
            <Section title="Social & Web">
              <div className="p-4 grid grid-cols-2 gap-2 text-sm">
                {doc.socialMediaLinks.facebook && <div>Facebook: <span className="text-gray-600 dark:text-white">{doc.socialMediaLinks.facebook}</span></div>}
                {doc.socialMediaLinks.instagram && <div>Instagram: <span className="text-gray-600 dark:text-white">{doc.socialMediaLinks.instagram}</span></div>}
                {doc.socialMediaLinks.twitter && <div>Twitter: <span className="text-gray-600 dark:text-white">{doc.socialMediaLinks.twitter}</span></div>}
                {doc.socialMediaLinks.website && <div>Website: <span className="text-gray-600 dark:text-white">{doc.socialMediaLinks.website}</span></div>}
              </div>
            </Section>
          )}
          {(doc.logo || doc.businessLicense || doc.taxCertificate) && (
            <Section title="Business Documents">
              <div className="p-4 grid grid-cols-3 gap-3 text-center">
                {doc.logo?.url ? (
                  <a href={doc.logo.url} target="_blank" rel="noreferrer" className="group flex flex-col items-center gap-2 rounded-lg border border-gray-200 dark:border-[#262626] p-3 hover:border-[#eba236]">
                    <img src={doc.logo.url} alt="Logo" className="h-12 w-12 rounded-lg object-cover" />
                    <span className="text-xs text-gray-600 dark:text-[#a1a1aa] group-hover:text-[#eba236]">Logo</span>
                  </a>
                ) : null}
                {doc.businessLicense?.url ? (
                  <a href={doc.businessLicense.url} target="_blank" rel="noreferrer" className="group flex flex-col items-center gap-2 rounded-lg border border-gray-200 dark:border-[#262626] p-3 hover:border-[#eba236]">
                    <FileText className="w-8 h-8 text-gray-400 group-hover:text-[#eba236]" />
                    <span className="text-xs text-gray-600 dark:text-[#a1a1aa] group-hover:text-[#eba236]">License</span>
                  </a>
                ) : null}
                {doc.taxCertificate?.url ? (
                  <a href={doc.taxCertificate.url} target="_blank" rel="noreferrer" className="group flex flex-col items-center gap-2 rounded-lg border border-gray-200 dark:border-[#262626] p-3 hover:border-[#eba236]">
                    <FileText className="w-8 h-8 text-gray-400 group-hover:text-[#eba236]" />
                    <span className="text-xs text-gray-600 dark:text-[#a1a1aa] group-hover:text-[#eba236]">Tax Cert</span>
                  </a>
                ) : null}
              </div>
            </Section>
          )}
        </div>
        <div className="space-y-5">
          <Section title={`Merchant Outlets (${doc.totalMerchants})`}>
            {doc.merchantsPreview && doc.merchantsPreview.length ? (
              <div className="divide-y divide-gray-100 dark:divide-[#262626]">
                {doc.merchantsPreview.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-4">
                    <div><div className="font-medium text-sm text-gray-900 dark:text-white">{m.outletName}</div><div className="text-xs text-gray-500 font-mono">{m.outletCode} • {m.operationalStatus}</div></div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${m.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'}`}>{m.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                ))}
              </div>
            ) : <div className="p-6 text-sm text-gray-500 text-center">No outlets yet — assign first merchant to activate storefront.</div>}
          </Section>
          {doc.operatingHours && (
            <Section title="Default Operating Hours">
              <div className="divide-y divide-gray-100 dark:divide-[#262626]">
                {Object.entries(doc.operatingHours).map(([day, h]: [string, any]) => (
                  <div key={day} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-gray-700 dark:text-white capitalize">{day}</span>
                    <span className="text-gray-500 dark:text-[#a1a1aa]">{h.closed ? 'Closed' : `${h.open} – ${h.close}`}</span>
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
              <div className="flex justify-between"><span className="text-gray-500">ID</span><span className="font-mono text-xs text-gray-900 dark:text-white">#{doc.id}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VendorViewPage(){
  return (
    <ClientOnly fallback={<VendorViewSkeleton />}>
      <VendorViewContent />
    </ClientOnly>
  )
}
