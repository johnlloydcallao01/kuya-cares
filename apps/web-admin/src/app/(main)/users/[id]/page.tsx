'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ClientOnly } from '@/components/ClientOnly'
import { ArrowLeft, RefreshCw, AlertCircle, Users, Mail, Phone, CalendarDays, ShieldCheck } from '@/components/ui/IconWrapper'

type UserDoc = {
  id: number
  email: string
  firstName: string
  lastName: string
  phone: string | null
  username: string | null
  role: string
  isActive: boolean
  gender: string | null
  civilStatus: string | null
  createdAt: string
  updatedAt: string
  lastLogin: string | null
  profilePicture: { id: number; url: string | null; filename: string | null } | null
  completeAddress: string | null
}

function fmtDate(iso: string | null) { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year:'numeric', month:'short', day:'numeric'}) } catch { return String(iso).slice(0,10)} }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden"><div className="px-4 py-3 border-b border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a]"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3></div><div className="divide-y divide-gray-100 dark:divide-[#262626]">{children}</div></div>
}
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex justify-between gap-4 px-4 py-2.5 text-sm"><span className="text-xs text-gray-500 dark:text-[#a1a1aa]">{label}</span><span className={`text-gray-900 dark:text-white text-right max-w-[60%] break-words ${mono?'font-mono text-xs':''}`}>{value}</span></div>
}

function UserDetailSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-32 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function UserDetailContent() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id
  const [doc, setDoc] = useState<UserDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/users/${id}`, { cache: 'no-store' })
      if (!res.ok) { const t = await res.text(); try { const j=JSON.parse(t); throw new Error(j.error||'Failed to load user')} catch { throw new Error(t||'Failed')} }
      const json = await res.json()
      setDoc(json.doc || json)
    } catch (e:any) { setError(e?.message||'Failed') } finally { setLoading(false) }
  }
  useEffect(()=>{ void load() },[id])

  if (loading) return <div className="space-y-6 py-5 px-2.5"><div className="h-32 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
  if (error) return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col items-center justify-center py-16 px-6 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
        <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
        <h3 className="font-semibold">Failed to load user</h3><p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
        <button onClick={()=>void load()} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
      </div>
    </div>
  )
  if (!doc) return null

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex items-center gap-3">
        <button onClick={()=> router.push('/users')} className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 truncate"><span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center shrink-0"><Users className="w-4 h-4" /></span>{doc.firstName} {doc.lastName}</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] truncate">{doc.email} • {doc.role}</p>
        </div>
        <Link href={`/users/${doc.id}/edit`} className="px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold">Edit</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Account">
          <Row label="Email" value={doc.email} />
          <Row label="Username" value={doc.username || '—'} mono />
          <Row label="Role" value={doc.role} />
          <Row label="Status" value={doc.isActive ? 'Active' : 'Inactive'} />
          <Row label="Gender" value={doc.gender || '—'} />
          <Row label="Civil Status" value={doc.civilStatus || '—'} />
        </Section>
        <Section title="Contact & Timeline">
          <Row label="Phone" value={doc.phone || '—'} />
          <Row label="Address" value={doc.completeAddress || '—'} />
          <Row label="Created" value={fmtDate(doc.createdAt)} />
          <Row label="Updated" value={fmtDate(doc.updatedAt)} />
          <Row label="Last Login" value={fmtDate(doc.lastLogin)} />
        </Section>
      </div>

      {doc.profilePicture?.url && (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4">
          <p className="text-sm font-semibold mb-2">Profile Picture</p>
          <img src={doc.profilePicture.url} alt={`${doc.firstName} ${doc.lastName}`} className="h-32 w-32 rounded-xl object-cover border border-gray-200 dark:border-[#262626]" />
        </div>
      )}
    </div>
  )
}

export default function UserDetailPage(){
  return (
    <ClientOnly fallback={<UserDetailSkeleton />}>
      <UserDetailContent />
    </ClientOnly>
  )
}
