'use client'

import React, { useState, useEffect } from 'react'
import {
  Users, Mail, Ticket, CalendarDays, Award, GraduationCap, AlertCircle, RefreshCw, MapPin, Lock
} from '@/components/ui/IconWrapper'

const LEVEL_OPTS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

type CustomerDoc = {
  id: number
  email: string
  srn: string | null
  couponCode: string | null
  enrollmentDate: string | null
  currentLevel: string
  activeAddress: any
  user: any
}

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236]'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

export function CustomerForm({ initial, onSuccess, onCancel }: { initial?: CustomerDoc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    srn: initial?.srn || '',
    couponCode: initial?.couponCode || '',
    enrollmentDate: initial?.enrollmentDate ? String(initial.enrollmentDate).slice(0, 16) : '',
    currentLevel: initial?.currentLevel || 'beginner',
    activeAddress: initial?.activeAddress?.id ? String(initial.activeAddress.id) : '',
    // owner (create only)
    ownerFirstName: '',
    ownerLastName: '',
    ownerEmail: '',
    ownerPassword: '',
    ownerPhone: '',
    username: '',
  })
  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!initial) return
    setForm({
      srn: initial?.srn || '',
      couponCode: initial?.couponCode || '',
      enrollmentDate: initial?.enrollmentDate ? String(initial.enrollmentDate).slice(0, 16) : '',
      currentLevel: initial?.currentLevel || 'beginner',
      activeAddress: initial?.activeAddress?.id ? String(initial.activeAddress.id) : '',
      ownerFirstName: '',
      ownerLastName: '',
      ownerEmail: '',
      ownerPassword: '',
      ownerPhone: '',
      username: '',
    })
    setError(null)
  }, [initial])

  const submit = async () => {
    setError(null)
    if (form.currentLevel && !LEVEL_OPTS.some((o) => o.value === form.currentLevel)) return setError('Invalid level')
    if (form.enrollmentDate) {
      const d = new Date(form.enrollmentDate)
      if (Number.isNaN(d.getTime())) return setError('Enrollment date must be valid')
    }
    if (!isEdit) {
      if (!form.ownerEmail.trim() && !form.ownerFirstName.trim() && !form.ownerLastName.trim()) {
        // allow auto but require email
        if (!form.ownerEmail.trim()) return setError('Owner email is required to create customer account')
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail.trim())) return setError('Owner email must be valid')
      }
      if (form.ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail.trim())) return setError('Owner email must be valid')
      if (form.ownerPassword && form.ownerPassword.length < 8) return setError('Owner password must be at least 8 characters (or leave blank to auto-generate)')
    }

    setSaving(true)
    try {
      const initialEmail = typeof initial?.email === 'string' ? initial.email : ''
      const payload: any = {
        srn: form.srn.trim() || null,
        couponCode: form.couponCode.trim() || null,
        enrollmentDate: form.enrollmentDate ? new Date(form.enrollmentDate).toISOString() : undefined,
        currentLevel: form.currentLevel,
        activeAddress: form.activeAddress.trim() ? Number(form.activeAddress.trim()) : null,
      }
      if (!isEdit) {
        if (form.ownerFirstName.trim()) payload.ownerFirstName = form.ownerFirstName.trim()
        if (form.ownerLastName.trim()) payload.ownerLastName = form.ownerLastName.trim()
        if (form.ownerEmail.trim()) payload.ownerEmail = form.ownerEmail.trim().toLowerCase()
        if (form.ownerPassword.trim()) payload.ownerPassword = form.ownerPassword
        if (form.ownerPhone.trim()) payload.ownerPhone = form.ownerPhone.trim()
        if (form.username.trim()) payload.username = form.username.trim()
        // also support firstName/lastName/email alias
        if (!payload.ownerEmail && initialEmail) payload.ownerEmail = initialEmail
      }
      const url = isEdit ? `/api/customers/${(initial as any).id}` : '/api/customers'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || j.details || 'Request failed')
      onSuccess()
    } catch (e: any) { setError(e?.message || 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
      <div className="p-6 space-y-6">
        {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}

        {/* 1. Customer Profile */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-[#eba236]" /> Customer Profile</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>SRN <span className="text-gray-400 font-normal">(unique, optional)</span></label><input value={form.srn} onChange={(e)=>set('srn', e.target.value)} placeholder="SRN-2026-001" className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Coupon Code</label><div className="relative"><Ticket className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={form.couponCode} onChange={(e)=>set('couponCode', e.target.value)} placeholder="WELCOME10" className={`${inputCls} pl-9`} /></div></div>
            <div><label className={labelCls}>Learning Level *</label><select value={form.currentLevel} onChange={(e)=>set('currentLevel', e.target.value)} className={inputCls}>{LEVEL_OPTS.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><label className={labelCls}>Enrollment Date</label><input type="datetime-local" value={form.enrollmentDate} onChange={(e)=>set('enrollmentDate', e.target.value)} className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Active Address ID <span className="text-gray-400 font-normal">(optional — links to addresses collection)</span></label><div className="relative"><MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={form.activeAddress} onChange={(e)=>set('activeAddress', e.target.value)} placeholder="e.g. 123" className={`${inputCls} pl-9 font-mono`} /></div><p className="text-xs text-gray-400 mt-1">Leave blank to keep no active address. Enter a valid address ID owned by this user.</p></div>
          </div>
        </div>

        {/* 2. Owner Account (create only) */}
        {!isEdit && (
          <div className="rounded-xl border border-dashed border-[#eba236]/30 dark:border-[#eba236]/30 bg-[#eba236]/10 dark:bg-[#eba236]/10 p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Users className="w-4 h-4 text-[#eba236]" /> Owner Account <span className="text-xs font-normal text-gray-500">(maps to required <span className="font-mono">user</span> field)</span></h4>
            <p className="text-xs text-gray-600 dark:text-[#a1a1aa] mt-1">If this email already exists as a customer user, it will be linked. Otherwise a new customer login is created. Password auto-generates if blank.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div><label className={labelCls}>Owner first name *</label><input value={form.ownerFirstName} onChange={(e)=>set('ownerFirstName', e.target.value)} placeholder="Juan" className={inputCls} /></div>
              <div><label className={labelCls}>Owner last name *</label><input value={form.ownerLastName} onChange={(e)=>set('ownerLastName', e.target.value)} placeholder="Dela Cruz" className={inputCls} /></div>
              <div><label className={labelCls}>Owner email *</label><input value={form.ownerEmail} onChange={(e)=>set('ownerEmail', e.target.value)} placeholder="customer@example.com" className={inputCls} /></div>
              <div><label className={labelCls}>Phone</label><input value={form.ownerPhone} onChange={(e)=>set('ownerPhone', e.target.value)} placeholder="+63 9xx xxx xxxx" className={inputCls} /></div>
              <div><label className={labelCls}>Username <span className="text-gray-400 font-normal">(optional)</span></label><input value={form.username} onChange={(e)=>set('username', e.target.value)} placeholder="juandc" className={inputCls} /></div>
              <div><label className={labelCls}><Lock className="w-3 h-3 inline mr-1" />Temp password</label><input value={form.ownerPassword} onChange={(e)=>set('ownerPassword', e.target.value)} placeholder="leave blank to auto-generate" type="password" className={inputCls} /></div>
            </div>
          </div>
        )}

        {isEdit && (
          <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-4 flex gap-3">
            <AlertCircle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 dark:text-[#a1a1aa] leading-relaxed">Editing customer profile fields only. To change the linked user&apos;s name, email, phone or active status, use the <span className="font-semibold text-gray-900 dark:text-white">Users</span> page or toggle status directly from the customers table. The <span className="font-mono">user</span> link itself cannot be reassigned here.</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create customer'}
        </button>
      </div>
    </div>
  )
}
