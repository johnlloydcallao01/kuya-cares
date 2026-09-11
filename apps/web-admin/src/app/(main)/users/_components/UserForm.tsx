'use client'

import React, { useState, useEffect } from 'react'
import {
  User as UserIcon, Mail, Phone, MapPin, CalendarDays, ShieldCheck, BadgeCheck,
  AlertCircle, RefreshCw, Crown, Image as ImageIcon, Lock, Globe, Fingerprint
} from '@/components/ui/IconWrapper'
import { MediaUploader } from '@/components/cms/MediaUploader'

const ROLE_OPTS = [
  { value: 'admin', label: 'Admin' },
  { value: 'customer', label: 'Customer' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'driver', label: 'Driver' },
  { value: 'service', label: 'Service Account' },
]
const GENDER_OPTS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]
const CIVIL_OPTS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'separated', label: 'Separated' },
]

type UserDoc = {
  id: number
  email: string
  firstName: string
  lastName: string
  middleName: string | null
  nameExtension: string | null
  phone: string | null
  username: string | null
  gender: string | null
  civilStatus: string | null
  nationality: string | null
  birthDate: string | null
  placeOfBirth: string | null
  completeAddress: string | null
  role: string
  isActive: boolean
  profilePicture: any
  createdAt: string
  updatedAt: string
}

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

export function UserForm({ initial, onSuccess, onCancel }: { initial?: UserDoc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profilePictureId, setProfilePictureId] = useState<string | number | undefined>(initial?.profilePicture?.id)

  const [form, setForm] = useState({
    firstName: initial?.firstName || '',
    lastName: initial?.lastName || '',
    middleName: initial?.middleName || '',
    nameExtension: initial?.nameExtension || '',
    username: initial?.username || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    gender: initial?.gender || '',
    civilStatus: initial?.civilStatus || '',
    nationality: initial?.nationality || '',
    birthDate: initial?.birthDate ? String(initial.birthDate).slice(0, 10) : '',
    placeOfBirth: initial?.placeOfBirth || '',
    completeAddress: initial?.completeAddress || '',
    role: initial?.role || 'customer',
    isActive: initial?.isActive ?? true,
    password: '',
    confirmPassword: '',
  })

  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!initial) return
    setForm({
      firstName: initial?.firstName || '',
      lastName: initial?.lastName || '',
      middleName: initial?.middleName || '',
      nameExtension: initial?.nameExtension || '',
      username: initial?.username || '',
      email: initial?.email || '',
      phone: initial?.phone || '',
      gender: initial?.gender || '',
      civilStatus: initial?.civilStatus || '',
      nationality: initial?.nationality || '',
      birthDate: initial?.birthDate ? String(initial.birthDate).slice(0, 10) : '',
      placeOfBirth: initial?.placeOfBirth || '',
      completeAddress: initial?.completeAddress || '',
      role: initial?.role || 'customer',
      isActive: initial?.isActive ?? true,
      password: '',
      confirmPassword: '',
    })
    setProfilePictureId(initial?.profilePicture?.id)
    setError(null)
  }, [initial])

  const submit = async () => {
    setError(null)
    if (!form.firstName.trim() || form.firstName.trim().length < 2) return setError('First name is required (min 2 chars)')
    if (!form.lastName.trim() || form.lastName.trim().length < 2) return setError('Last name is required (min 2 chars)')
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('Valid email is required')
    if (form.username && form.username.trim() && !/^[a-zA-Z0-9._-]+$/.test(form.username.trim())) return setError('Username may only contain letters, numbers, dot, underscore, hyphen')
    if (!ROLE_OPTS.some((o) => o.value === form.role)) return setError('Role must be selected')
    if (form.gender && !GENDER_OPTS.some((o) => o.value === form.gender)) return setError('Invalid gender')
    if (form.civilStatus && !CIVIL_OPTS.some((o) => o.value === form.civilStatus)) return setError('Invalid civil status')
    if (form.birthDate) {
      const d = new Date(form.birthDate)
      if (Number.isNaN(d.getTime())) return setError('Birth date must be a valid date')
    }
    // Grandline pattern: password is optional on edit — only validate/send if trimmed non-empty; confirm only needed when changing password
    const pwd = form.password.trim()
    const conf = form.confirmPassword.trim()
    if (!isEdit) {
      if (!pwd) return setError('Password is required for new users.')
      if (pwd.length < 8) return setError('Password is required (min 8 chars) for new user')
      if (pwd !== conf) return setError('Password and confirm password do not match')
    } else {
      // Edit: allow name/role/etc changes without touching password (grandline page.tsx:229-231 + actions.ts:178-180)
      if (pwd || conf) {
        if (pwd.length < 8) return setError('Password must be at least 8 characters (or leave blank to keep current)')
        if (pwd !== conf) return setError('Password and confirm password do not match')
      }
    }

    setSaving(true)
    try {
      const payload: any = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        middleName: form.middleName.trim() || null,
        nameExtension: form.nameExtension.trim() || null,
        username: form.username.trim() || null,
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        gender: form.gender || null,
        civilStatus: form.civilStatus || null,
        nationality: form.nationality.trim() || null,
        birthDate: form.birthDate ? new Date(form.birthDate).toISOString() : null,
        placeOfBirth: form.placeOfBirth.trim() || null,
        completeAddress: form.completeAddress.trim() || null,
        role: form.role,
        isActive: form.isActive,
      }
      if (profilePictureId != null && profilePictureId !== '') payload.profilePicture = Number(profilePictureId)
      // password handling — grandline pattern: only include if trimmed non-empty, otherwise omit so server keeps hash (actions.ts:178-180)
      if (!isEdit) {
        payload.password = pwd
      } else if (pwd) {
        payload.password = pwd
      }

      const url = isEdit ? `/api/users/${(initial as any).id}` : '/api/users'
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

        {/* 1. Personal Information */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><UserIcon className="w-4 h-4 text-[#eba236]" /> Personal Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>First name *</label><input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Juan" className={inputCls} /></div>
            <div><label className={labelCls}>Last name *</label><input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Dela Cruz" className={inputCls} /></div>
            <div><label className={labelCls}>Middle name</label><input value={form.middleName} onChange={(e) => set('middleName', e.target.value)} placeholder="Santos (optional)" className={inputCls} /></div>
            <div><label className={labelCls}>Name extension <span className="text-gray-400 font-normal">(Jr., Sr., III)</span></label><input value={form.nameExtension} onChange={(e) => set('nameExtension', e.target.value)} placeholder="Jr." className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Username <span className="text-gray-400 font-normal">(unique, letters/numbers/._-)</span></label><input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="juan.delacruz" className={`${inputCls} font-mono`} /></div>
          </div>
        </div>

        {/* 2. Contact Information */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Mail className="w-4 h-4 text-blue-600" /> Contact Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Email *</label><input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="juan@example.com" type="email" className={inputCls} /></div>
            <div><label className={labelCls}>Phone</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+63 912 345 6789" className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Complete address</label><textarea value={form.completeAddress} onChange={(e) => set('completeAddress', e.target.value)} placeholder="House, Street, Barangay, City, Province" rows={2} className={inputCls} /></div>
            <div><label className={labelCls}>Place of birth</label><input value={form.placeOfBirth} onChange={(e) => set('placeOfBirth', e.target.value)} placeholder="Manila, Philippines" className={inputCls} /></div>
            <div><label className={labelCls}>Nationality</label><input value={form.nationality} onChange={(e) => set('nationality', e.target.value)} placeholder="Filipino" className={inputCls} /></div>
          </div>
        </div>

        {/* 3. Identity Details */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-emerald-600" /> Identity Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={labelCls}>Gender</label><select value={form.gender} onChange={(e) => set('gender', e.target.value)} className={inputCls}><option value="">Select gender</option>{GENDER_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><label className={labelCls}>Civil status</label><select value={form.civilStatus} onChange={(e) => set('civilStatus', e.target.value)} className={inputCls}><option value="">Select status</option>{CIVIL_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><label className={labelCls}>Birth date</label><input type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} className={inputCls} /></div>
          </div>
        </div>

        {/* 4. Account & Role */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-amber-600" /> Account & Role</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Role *</label><select value={form.role} onChange={(e) => set('role', e.target.value)} className={inputCls}>{ROLE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="flex items-center gap-3 pt-6"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Active account</span><span className="text-xs text-gray-400"> — inactive users cannot log in</span></label></div>
          </div>
        </div>

        {/* 5. Security */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Lock className="w-4 h-4 text-zinc-600" /> Security</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>{isEdit ? 'New password' : 'Password *'} <span className="text-gray-400 font-normal">{isEdit ? '(leave blank to keep current)' : '(min 8 chars)'}</span></label><input value={form.password} onChange={(e) => set('password', e.target.value)} placeholder={isEdit ? '••••••••' : 'At least 8 characters'} type="password" autoComplete="new-password" className={inputCls} /></div>
            <div><label className={labelCls}>{isEdit ? 'Confirm new password' : 'Confirm password *'}</label><input value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} placeholder="Repeat password" type="password" autoComplete="new-password" className={inputCls} /></div>
          </div>
          {isEdit && <p className="text-xs text-gray-400 mt-1.5">Password change is optional on edit — only sent if filled. Leave both blank to keep current password (grandline page.tsx:229-231).</p>}
        </div>

        {/* 6. Profile Picture (Payload upload) */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-[#eba236]" /> Profile Picture</h4>
          <div className="max-w-sm">
            <label className={labelCls}><ImageIcon className="w-3.5 h-3.5 inline mr-1" /> Avatar image</label>
            <MediaUploader value={profilePictureId} onChange={(id) => setProfilePictureId(id)} accept="image/*" className="mt-1" />
            <p className="text-xs text-gray-400 mt-1.5">JPG/PNG/WebP — will be stored as `profilePicture` (media relation).</p>
          </div>
        </div>

      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create user'}
        </button>
      </div>
    </div>
  )
}
