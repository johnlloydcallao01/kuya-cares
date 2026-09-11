'use client'

import React, { useState, useEffect } from 'react'
import {
  Building, Mail, Store, ShieldCheck, AlertCircle, RefreshCw, Users,
  Image as ImageIcon, FileText, Star, CreditCard, Globe, Clock
} from '@/components/ui/IconWrapper'
import { MediaUploader } from '@/components/cms/MediaUploader'

const BUSINESS_OPTS = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'fast_food', label: 'Fast Food' },
  { value: 'grocery', label: 'Grocery Store' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'convenience', label: 'Convenience Store' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'coffee_shop', label: 'Coffee Shop' },
  { value: 'other', label: 'Other' },
]
const VERIFICATION_OPTS = [
  { value: 'pending', label: 'Pending Verification' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
]
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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
}

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

export function VendorForm({ initial, onSuccess, onCancel }: { initial?: VendorDoc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoId, setLogoId] = useState<string | number | undefined>(initial?.logo?.id)
  const [licenseId, setLicenseId] = useState<string | number | undefined>(initial?.businessLicense?.id)
  const [certId, setCertId] = useState<string | number | undefined>(initial?.taxCertificate?.id)

  const [form, setForm] = useState({
    businessName: initial?.businessName || '',
    legalName: initial?.legalName || '',
    businessRegistrationNumber: initial?.businessRegistrationNumber || '',
    taxIdentificationNumber: initial?.taxIdentificationNumber || '',
    primaryContactEmail: initial?.primaryContactEmail || '',
    primaryContactPhone: initial?.primaryContactPhone || '',
    websiteUrl: initial?.websiteUrl || '',
    businessType: initial?.businessType || 'restaurant',
    cuisineTypesText: Array.isArray(initial?.cuisineTypes) ? (initial?.cuisineTypes as string[]).join(', ') : typeof initial?.cuisineTypes === 'string' ? initial?.cuisineTypes : '',
    isActive: initial?.isActive ?? true,
    verificationStatus: initial?.verificationStatus || 'pending',
    onboardingDate: initial?.onboardingDate ? String(initial.onboardingDate).slice(0, 16) : '',
    averageRating: initial?.averageRating ?? 0,
    totalReviews: initial?.totalReviews ?? 0,
    totalOrders: initial?.totalOrders ?? 0,
    totalMerchants: initial?.totalMerchants ?? 0,
    description: initial?.description || '',
    // social media group
    facebook: initial?.socialMediaLinks?.facebook || '',
    instagram: initial?.socialMediaLinks?.instagram || '',
    twitter: initial?.socialMediaLinks?.twitter || '',
    socialWebsite: initial?.socialMediaLinks?.website || '',
    // operating hours (json) — map of day -> { open, close, closed }
    hours: buildHours(initial?.operatingHours),
    // owner (create only)
    ownerFirstName: '',
    ownerLastName: '',
    ownerEmail: '',
    ownerPassword: '',
  })
  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))
  const setDay = (day: string, key: string, v: any) =>
    setForm((prev) => {
      const current = prev.hours[day] || { open: '09:00', close: '21:00', closed: false }
      const periods = current.periods || [{ open: current.open, close: current.close }]
      return { ...prev, hours: { ...prev.hours, [day]: { ...current, [key]: v, periods: key === 'closed' ? periods : periods.map((period, index) => index === 0 ? { ...period, [key]: v } : period) } } }
    })
  const addPeriod = (day: string) => setForm((prev) => {
    const current = prev.hours[day] || { open: '09:00', close: '21:00', closed: false }
    return { ...prev, hours: { ...prev.hours, [day]: { ...current, closed: false, periods: [...(current.periods || [{ open: current.open, close: current.close }]), { open: '17:00', close: '21:00' }] } } }
  })
  const removePeriod = (day: string, index: number) => setForm((prev) => {
    const current = prev.hours[day]
    if (!current?.periods || current.periods.length <= 1) return prev
    const periods = current.periods.filter((_, periodIndex) => periodIndex !== index)
    return { ...prev, hours: { ...prev.hours, [day]: { ...current, open: periods[0].open, close: periods[0].close, periods } } }
  })

  useEffect(() => {
    if (!initial) return
    setForm({
      businessName: initial?.businessName || '',
      legalName: initial?.legalName || '',
      businessRegistrationNumber: initial?.businessRegistrationNumber || '',
      taxIdentificationNumber: initial?.taxIdentificationNumber || '',
      primaryContactEmail: initial?.primaryContactEmail || '',
      primaryContactPhone: initial?.primaryContactPhone || '',
      websiteUrl: initial?.websiteUrl || '',
      businessType: initial?.businessType || 'restaurant',
      cuisineTypesText: Array.isArray(initial?.cuisineTypes) ? (initial?.cuisineTypes as string[]).join(', ') : typeof initial?.cuisineTypes === 'string' ? initial?.cuisineTypes : '',
      isActive: initial?.isActive ?? true,
      verificationStatus: initial?.verificationStatus || 'pending',
      onboardingDate: initial?.onboardingDate ? String(initial.onboardingDate).slice(0, 16) : '',
      averageRating: initial?.averageRating ?? 0,
      totalReviews: initial?.totalReviews ?? 0,
      totalOrders: initial?.totalOrders ?? 0,
      totalMerchants: initial?.totalMerchants ?? 0,
      description: initial?.description || '',
      facebook: initial?.socialMediaLinks?.facebook || '',
      instagram: initial?.socialMediaLinks?.instagram || '',
      twitter: initial?.socialMediaLinks?.twitter || '',
      socialWebsite: initial?.socialMediaLinks?.website || '',
      hours: buildHours(initial?.operatingHours),
      ownerFirstName: '',
      ownerLastName: '',
      ownerEmail: '',
      ownerPassword: '',
    })
    setLogoId(initial?.logo?.id)
    setLicenseId(initial?.businessLicense?.id)
    setCertId(initial?.taxCertificate?.id)
    setError(null)
  }, [initial])

  const submit = async () => {
    setError(null)
    if (!form.businessName.trim() || form.businessName.trim().length < 2) return setError('Business name is required (min 2 chars)')
    if (!form.legalName.trim() || form.legalName.trim().length < 2) return setError('Legal name is required')
    if (!form.businessRegistrationNumber.trim()) return setError('Business registration number is required')
    if (!form.primaryContactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.primaryContactEmail.trim())) return setError('Valid contact email is required')
    if (!form.primaryContactPhone.trim()) return setError('Contact phone is required')
    if (form.websiteUrl && form.websiteUrl.trim()) { try { new URL(form.websiteUrl.trim()) } catch { return setError('Website URL must be valid (include https://)') } }
    if (form.averageRating < 0 || form.averageRating > 5) return setError('Average rating must be between 0 and 5')
    if (form.totalReviews < 0) return setError('Total reviews cannot be negative')
    if (form.totalOrders < 0) return setError('Total orders cannot be negative')
    if (form.totalMerchants < 0) return setError('Total merchants cannot be negative')
    if (!isEdit && !form.ownerEmail.trim() && !form.primaryContactEmail.trim()) return setError('Owner email or contact email required to create owner account')
    if (!isEdit && form.ownerPassword && form.ownerPassword.length < 8) return setError('Owner password must be at least 8 characters (or leave blank to auto-generate)')

    // build operating hours json only for days with open/close (all until edited)
    const operatingHours: Record<string, { open: string; close: string }[]> | null = {}
    for (const day of DAYS) {
      const h = form.hours[day]
      if (h) operatingHours[day.toLowerCase()] = h.closed ? [] : [{ open: h.open || '09:00', close: h.close || '21:00' }]
    }

    setSaving(true)
    try {
      const payload: any = {
        businessName: form.businessName.trim(),
        legalName: form.legalName.trim(),
        businessRegistrationNumber: form.businessRegistrationNumber.trim(),
        taxIdentificationNumber: form.taxIdentificationNumber.trim() || null,
        primaryContactEmail: form.primaryContactEmail.trim().toLowerCase(),
        primaryContactPhone: form.primaryContactPhone.trim(),
        websiteUrl: form.websiteUrl.trim() || null,
        businessType: form.businessType,
        cuisineTypes: form.cuisineTypesText.trim() ? form.cuisineTypesText.split(',').map((s) => s.trim()).filter(Boolean) : null,
        isActive: form.isActive,
        verificationStatus: form.verificationStatus,
        onboardingDate: form.onboardingDate || (isEdit ? undefined : undefined),
        averageRating: Number(form.averageRating) || 0,
        totalReviews: Number(form.totalReviews) || 0,
        totalOrders: Number(form.totalOrders) || 0,
        description: form.description.trim() || null,
        operatingHours,
        socialMediaLinks: {
          facebook: form.facebook.trim() || null,
          instagram: form.instagram.trim() || null,
          twitter: form.twitter.trim() || null,
          website: form.socialWebsite.trim() || null,
        },
      }
      // media ids (matching Vendors.ts upload fields)
      if (logoId != null && logoId !== '') payload.logo = Number(logoId)
      if (licenseId != null && licenseId !== '') payload.businessLicense = Number(licenseId)
      if (certId != null && certId !== '') payload.taxCertificate = Number(certId)
      if (isEdit) payload.totalMerchants = Number(form.totalMerchants) || 0
      if (!isEdit) {
        if (form.ownerFirstName.trim()) payload.ownerFirstName = form.ownerFirstName.trim()
        if (form.ownerLastName.trim()) payload.ownerLastName = form.ownerLastName.trim()
        if (form.ownerEmail.trim()) payload.ownerEmail = form.ownerEmail.trim().toLowerCase()
        if (form.ownerPassword.trim()) payload.ownerPassword = form.ownerPassword
      }
      const url = isEdit ? `/api/vendors/${(initial as any).id}` : '/api/vendors'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(j.error || j.details || 'Request failed')
      onSuccess()
    } catch (e:any) { setError(e?.message || 'Save failed') }
    finally { setSaving(false) }
  }

  const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm'
  const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
      <div className="p-6 space-y-6">
        {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}

        {/* 1. Core Business Information */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Building className="w-4 h-4 text-[#eba236]" /> Business Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className={labelCls}>Business name *</label><input value={form.businessName} onChange={(e)=>set('businessName', e.target.value)} placeholder="Jollibee Corporation" className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Legal name * <span className="text-gray-400 font-normal">(as registered with government)</span></label><input value={form.legalName} onChange={(e)=>set('legalName', e.target.value)} placeholder="Jollibee Foods Corporation" className={inputCls} /></div>
            <div><label className={labelCls}>Registration No. * <span className="text-gray-400 font-normal">(DTI/SEC, unique)</span></label><input value={form.businessRegistrationNumber} onChange={(e)=>set('businessRegistrationNumber', e.target.value)} placeholder="DTI-123456" className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Tax Identification No. (TIN) <span className="text-gray-400 font-normal">(unique)</span></label><input value={form.taxIdentificationNumber} onChange={(e)=>set('taxIdentificationNumber', e.target.value)} placeholder="123-456-789-000" className={`${inputCls} font-mono`} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Website URL</label><input value={form.websiteUrl} onChange={(e)=>set('websiteUrl', e.target.value)} placeholder="https://example.com" className={inputCls} /></div>
          </div>
        </div>

        {/* 2. Contact Information */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Mail className="w-4 h-4 text-blue-600" /> Contact Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Primary contact email *</label><input value={form.primaryContactEmail} onChange={(e)=>set('primaryContactEmail', e.target.value)} placeholder="ops@jollibee.com" type="email" className={inputCls} /></div>
            <div><label className={labelCls}>Primary contact phone *</label><input value={form.primaryContactPhone} onChange={(e)=>set('primaryContactPhone', e.target.value)} placeholder="+63 912 345 6789" className={inputCls} /></div>
          </div>
        </div>

        {/* 3. Business Classification */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Store className="w-4 h-4 text-emerald-600" /> Business Classification</h4>
          <div className="grid grid-cols-1 gap-3">
            <div className="sm:col-span-2"><label className={labelCls}>Business type *</label><select value={form.businessType} onChange={(e)=>set('businessType', e.target.value)} className={inputCls}>{BUSINESS_OPTS.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="sm:col-span-2"><label className={labelCls}>Cuisine types <span className="text-gray-400 font-normal">(comma separated)</span></label><input value={form.cuisineTypesText} onChange={(e)=>set('cuisineTypesText', e.target.value)} placeholder="Filipino, Fast Food, Chicken" className={inputCls} /></div>
          </div>
        </div>

        {/* 4. Operational Status */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-amber-600" /> Operational Status</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={labelCls}>Verification status *</label><select value={form.verificationStatus} onChange={(e)=>set('verificationStatus', e.target.value)} className={inputCls}>{VERIFICATION_OPTS.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><label className={labelCls}>Onboarding date</label><input type="datetime-local" value={form.onboardingDate} onChange={(e)=>set('onboardingDate', e.target.value)} className={inputCls} /></div>
            <div className="flex items-center gap-3 pt-6"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={(e)=>set('isActive', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Active partner</span></label></div>
          </div>
        </div>

        {/* 5. Business Metrics */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-amber-400" /> Business Metrics</h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div><label className={labelCls}>Average rating <span className="text-gray-400 font-normal">(0–5)</span></label><input type="number" min={0} max={5} step={0.1} value={form.averageRating} onChange={(e)=>set('averageRating', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Total reviews</label><input type="number" min={0} value={form.totalReviews} onChange={(e)=>set('totalReviews', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Total orders</label><input type="number" min={0} value={form.totalOrders} onChange={(e)=>set('totalOrders', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>{isEdit ? 'Total merchants *' : 'Total merchants (auto)'}</label><input type="number" min={0} value={form.totalMerchants} onChange={(e)=>set('totalMerchants', e.target.value)} disabled={!isEdit} className={`${inputCls} ${!isEdit ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
          </div>
          {!isEdit && <p className="text-xs text-gray-400 mt-1.5">Merchant count is derived from linked outlets and defaults to 0 on creation.</p>}
        </div>

        {/* 6. Business Documents (Payloce upload fields) */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-[#eba236]" /> Business Documents</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}><ImageIcon className="w-3.5 h-3.5 inline mr-1" /> Business Logo</label>
              <MediaUploader value={logoId} onChange={(id) => setLogoId(id)} accept="image/*" className="mt-1" />
            </div>
            <div>
              <label className={labelCls}><FileText className="w-3.5 h-3.5 inline mr-1" /> Business License</label>
              <MediaUploader value={licenseId} onChange={(id) => setLicenseId(id)} accept="image/*,application/pdf" className="mt-1" />
            </div>
            <div>
              <label className={labelCls}><CreditCard className="w-3.5 h-3.5 inline mr-1" /> Tax Certificate</label>
              <MediaUploader value={certId} onChange={(id) => setCertId(id)} accept="image/*,application/pdf" className="mt-1" />
            </div>
          </div>
        </div>

        {/* 7. Description */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Description</h4>
          <textarea value={form.description} onChange={(e)=>set('description', e.target.value)} rows={3} placeholder="Business overview for internal review…" className={inputCls} />
        </div>

        {/* 8. Operating Hours */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-[#eba236]" /> Default Operating Hours <span className="text-xs font-normal text-gray-400">(can be overridden by individual merchants)</span></h4>
          <div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden">
            {DAYS.map((day) => {
              const h = form.hours[day] || { open: '09:00', close: '21:00', closed: false }
              return (
                <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-2.5">
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-24 shrink-0">{day}</span>
                  <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#a1a1aa] cursor-pointer shrink-0">
                    <input type="checkbox" checked={!!h.closed} onChange={(e)=>setDay(day, 'closed', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> Closed
                  </label>
                  <div className={`flex flex-col gap-2 ${h.closed ? 'opacity-40 pointer-events-none' : ''}`}>
                    {(h.periods || [{ open: h.open || '09:00', close: h.close || '21:00' }]).map((period, periodIndex) => (
                      <div key={`${day}-${periodIndex}`} className="flex items-center gap-2">
                        <input type="time" value={periodIndex === 0 ? h.open : period.open} onChange={(e)=>periodIndex === 0 ? setDay(day, 'open', e.target.value) : setForm((prev) => ({ ...prev, hours: { ...prev.hours, [day]: { ...h, periods: (h.periods || [period]).map((p, i) => i === periodIndex ? { ...p, open: e.target.value } : p) } } }))} className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm" disabled={h.closed} />
                        <span className="text-gray-400">to</span>
                        <input type="time" value={periodIndex === 0 ? h.close : period.close} onChange={(e)=>periodIndex === 0 ? setDay(day, 'close', e.target.value) : setForm((prev) => ({ ...prev, hours: { ...prev.hours, [day]: { ...h, periods: (h.periods || [period]).map((p, i) => i === periodIndex ? { ...p, close: e.target.value } : p) } } }))} className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm" disabled={h.closed} />
                        {periodIndex > 0 && <button type="button" onClick={() => removePeriod(day, periodIndex)} disabled={h.closed} className="text-xs text-red-600 hover:underline">Remove</button>}
                      </div>
                    ))}
                    <button type="button" onClick={() => addPeriod(day)} disabled={h.closed} className="self-start text-xs font-medium text-[#b97810] hover:underline">Add period</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 9. Social & Web (group) */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Globe className="w-4 h-4 text-blue-500" /> Social & Web Presence</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Facebook</label><input value={form.facebook} onChange={(e)=>set('facebook', e.target.value)} placeholder="facebook.com/brand" className={inputCls} /></div>
            <div><label className={labelCls}>Instagram</label><input value={form.instagram} onChange={(e)=>set('instagram', e.target.value)} placeholder="@brand" className={inputCls} /></div>
            <div><label className={labelCls}>Twitter</label><input value={form.twitter} onChange={(e)=>set('twitter', e.target.value)} placeholder="@brand" className={inputCls} /></div>
            <div><label className={labelCls}>Website</label><input value={form.socialWebsite} onChange={(e)=>set('socialWebsite', e.target.value)} placeholder="https://brand.com" className={inputCls} /></div>
          </div>
        </div>

        {/* 10. Owner Account (create only) */}
        {!isEdit && (
          <div className="rounded-xl border border-dashed border-[#eba236]/30 dark:border-[#eba236]/30 bg-[#eba236]/10 dark:bg-[#eba236]/10 p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Users className="w-4 h-4 text-[#eba236]" /> Owner Account <span className="text-xs font-normal text-gray-500">(maps to required <span className="font-mono">user</span> field)</span></h4>
            <p className="text-xs text-gray-600 dark:text-[#a1a1aa] mt-1">If this email already exists as a vendor user, it will be linked. Otherwise a new vendor login is created. Password auto-generates if blank.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div><label className={labelCls}>Owner first name</label><input value={form.ownerFirstName} onChange={(e)=>set('ownerFirstName', e.target.value)} placeholder="Juan" className={inputCls} /></div>
              <div><label className={labelCls}>Owner last name</label><input value={form.ownerLastName} onChange={(e)=>set('ownerLastName', e.target.value)} placeholder="Dela Cruz" className={inputCls} /></div>
              <div><label className={labelCls}>Owner email</label><input value={form.ownerEmail} onChange={(e)=>set('ownerEmail', e.target.value)} placeholder="owner@business.com (defaults to contact email)" className={inputCls} /></div>
              <div><label className={labelCls}>Temp password</label><input value={form.ownerPassword} onChange={(e)=>set('ownerPassword', e.target.value)} placeholder="leave blank to auto-generate" type="password" className={inputCls} /></div>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create vendor'}
        </button>
      </div>
    </div>
  )
}

function buildHours(operatingHours: any): Record<string, { open: string; close: string; closed: boolean; periods?: { open: string; close: string }[] }> {
  const out: Record<string, { open: string; close: string; closed: boolean; periods?: { open: string; close: string }[] }> = {}
  const src = operatingHours && typeof operatingHours === 'object' ? operatingHours : {}
  for (const day of DAYS) {
    const key = day.toLowerCase()
    const raw = src[key]
    const h = Array.isArray(raw) ? raw[0] : raw
    out[day] = h && typeof h === 'object'
      ? { open: h.open || '09:00', close: h.close || '21:00', closed: !!h.closed, ...(Array.isArray(raw) ? { periods: raw } : {}) }
      : { open: '09:00', close: '21:00', closed: false }
  }
  return out
}
