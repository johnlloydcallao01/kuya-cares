'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClientOnly } from '@/app/seller/_components/ClientOnly';
import {
  Building2,
  BadgeCheck,
  Mail,
  Phone,
  Globe,
  AlertCircle,
  RefreshCw,
  Store,
  Star,
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  Pencil,
  X,
  Save,
} from 'lucide-react';

type MediaRef = { id: number; url: string | null; filename?: string } | null;

type Vendor = {
  id: number;
  businessName: string;
  legalName: string;
  businessRegistrationNumber?: string | null;
  taxIdentificationNumber?: string | null;
  primaryContactEmail: string;
  primaryContactPhone: string;
  websiteUrl?: string | null;
  businessType?: string | null;
  cuisineTypes?: unknown;
  isActive?: boolean | null;
  verificationStatus: string;
  onboardingDate?: string | null;
  averageRating: number;
  totalReviews: number;
  totalOrders: number;
  totalMerchants: number;
  description?: string | null;
  operatingHours?: unknown;
  socialMediaLinks?: Record<string, string | null> | null;
  businessLicense: MediaRef;
  taxCertificate: MediaRef;
  logo: MediaRef;
  createdAt: string;
  updatedAt: string;
  merchants?: MerchantSummary[];
  merchantsCount?: number;
};

type MerchantSummary = {
  id: number;
  outletName: string;
  operationalStatus: string;
  isActive?: boolean | null;
  isAcceptingOrders?: boolean | null;
  averageRating: number;
  totalReviews: number;
  createdAt: string;
  updatedAt: string;
};

type BusinessProfileDraft = {
  businessName: string;
  legalName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  websiteUrl: string;
  businessType: string;
  cuisineTypes: string;
  description: string;
  facebook: string;
  instagram: string;
  twitter: string;
  socialWebsite: string;
};

const BUSINESS_TYPES = [
  ['restaurant', 'Restaurant'],
  ['fast_food', 'Fast Food'],
  ['grocery', 'Grocery Store'],
  ['pharmacy', 'Pharmacy'],
  ['convenience', 'Convenience Store'],
  ['bakery', 'Bakery'],
  ['coffee_shop', 'Coffee Shop'],
  ['other', 'Other'],
];

function toBusinessProfileDraft(vendor: Vendor): BusinessProfileDraft {
  const socials = vendor.socialMediaLinks && typeof vendor.socialMediaLinks === 'object' ? vendor.socialMediaLinks : {};
  const socialValue = (key: string) => typeof socials[key] === 'string' ? socials[key] as string : '';
  return {
    businessName: vendor.businessName || '',
    legalName: vendor.legalName || '',
    primaryContactEmail: vendor.primaryContactEmail || '',
    primaryContactPhone: vendor.primaryContactPhone || '',
    websiteUrl: vendor.websiteUrl || '',
    businessType: vendor.businessType || 'other',
    cuisineTypes: Array.isArray(vendor.cuisineTypes) ? vendor.cuisineTypes.map(String).join(', ') : '',
    description: vendor.description || '',
    facebook: socialValue('facebook'),
    instagram: socialValue('instagram'),
    twitter: socialValue('twitter'),
    socialWebsite: socialValue('website'),
  };
}

function verificationBadge(status: string) {
  const s = String(status).toLowerCase();
  if (s === 'verified') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
  if (s === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
  if (s === 'rejected' || s === 'suspended') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
      <div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden bg-white dark:bg-[#171717]">{children}</div>
    </div>
  );
}

function Row({ label, value, mono, icon }: { label: string; value: React.ReactNode; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0 flex items-center gap-1">{icon}{label}</span>
      <span className={`text-gray-900 dark:text-white text-right max-w-[60%] break-words ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value as unknown as string}</span>
    </div>
  );
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(iso).slice(0, 10);
  }
}

function fmtList(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).filter(Boolean).join(', ') || '—';
  if (v == null || v === '') return '—';
  return String(v);
}

function BusinessProfileSkeleton() {
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>;
}

function BusinessProfileContent() {
  const [vendorData, setVendor] = useState<Vendor | null>(null);
  const [vendorProfiles, setVendorProfiles] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [allOutlets, setOutlets] = useState<MerchantSummary[]>([]);
  const [allOutletsCount, setOutletsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BusinessProfileDraft | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/seller-business/profile?_t=${Date.now()}`, { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed to load business profile');
        if (!cancelled) {
          setVendor(j.vendor ?? null);
          const profiles = Array.isArray(j.vendors) ? j.vendors as Vendor[] : [];
          setVendorProfiles(profiles);
          setSelectedVendorId(String(profiles[0]?.id ?? j.vendor?.id ?? ''));
          setOutlets(Array.isArray(j.merchants) ? j.merchants : []);
          setOutletsCount(typeof j.merchantsCount === 'number' ? j.merchantsCount : Array.isArray(j.merchants) ? j.merchants.length : null);
          if (!j.vendor) throw new Error('Vendor profile not found');
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
        <div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
      </div>
    );
  }

  const vendor = vendorProfiles.find((profile) => String(profile.id) === selectedVendorId) ?? vendorData;
  const outlets = vendor?.merchants ?? allOutlets;
  const outletsCount = vendor?.merchantsCount ?? allOutletsCount;

  function startEditing() {
    if (!vendor) return;
    setDraft(toBusinessProfileDraft(vendor));
    setSaveError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setDraft(null);
    setSaveError(null);
  }

  async function saveBusinessProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vendor || !draft) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch('/api/seller-business/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: vendor.id,
          businessName: draft.businessName,
          legalName: draft.legalName,
          primaryContactEmail: draft.primaryContactEmail,
          primaryContactPhone: draft.primaryContactPhone,
          websiteUrl: draft.websiteUrl,
          businessType: draft.businessType,
          cuisineTypes: draft.cuisineTypes.split(',').map((value) => value.trim()).filter(Boolean),
          description: draft.description,
          socialMediaLinks: {
            facebook: draft.facebook,
            instagram: draft.instagram,
            twitter: draft.twitter,
            website: draft.socialWebsite,
          },
        }),
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update business profile');
      if (!result.vendor || Number(result.vendor.id) !== vendor.id) {
        throw new Error('The CMS returned an invalid business profile update.');
      }

      const updatedVendor = { ...vendor, ...result.vendor } as Vendor;
      setVendor(updatedVendor);
      setVendorProfiles((profiles) => profiles.map((profile) => profile.id === vendor.id ? { ...profile, ...result.vendor } : profile));
      setIsEditing(false);
      setDraft(null);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to update business profile');
    } finally {
      setIsSaving(false);
    }
  }

  if (error || !vendor) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load business profile</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium"><RefreshCw className="w-4 h-4" /> Retry</button>
        </div>
      </div>
    );
  }

  const socials = vendor.socialMediaLinks && typeof vendor.socialMediaLinks === 'object' ? vendor.socialMediaLinks : null;

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-[#239459] text-white flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
            {vendor.logo?.url ? <img src={vendor.logo.url} alt={vendor.businessName} className="h-12 w-12 rounded-xl object-cover" /> : <Building2 className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{vendor.businessName || 'Company Information'}</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">Manage your business details and contact information.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {vendorProfiles.length > 1 && (
            <select
              value={selectedVendorId}
              onChange={(event) => setSelectedVendorId(event.target.value)}
              disabled={isEditing}
              aria-label="Select business profile"
              className="max-w-48 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] text-sm text-gray-700 dark:text-[#a1a1aa]"
            >
              {vendorProfiles.map((profile) => (
                <option key={profile.id} value={String(profile.id)}>{profile.businessName || `Vendor #${profile.id}`}</option>
              ))}
            </select>
          )}
          {!isEditing && <button type="button" onClick={startEditing} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#239459] hover:bg-[#215035] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Pencil className="w-4 h-4" /> Edit profile</button>}
          <Link href="/seller/business/verification" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50"><ShieldCheck className="w-4 h-4" /> Verification</Link>
          <Link href="/seller/outlets" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#239459] hover:bg-[#215035] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Store className="w-4 h-4" /> Outlets</Link>
        </div>
      </div>

      {isEditing && draft && (
        <form onSubmit={saveBusinessProfile} className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-5 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Edit business profile</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">Registration numbers and submitted documents are managed separately. Profile changes do not change verification status.</p>
          </div>
          {saveError && <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">{saveError}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              Business name
              <input required minLength={2} maxLength={160} value={draft.businessName} onChange={(event) => setDraft({ ...draft, businessName: event.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-[#3f3f46] bg-white dark:bg-[#111] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              Legal name
              <input required minLength={2} maxLength={160} value={draft.legalName} onChange={(event) => setDraft({ ...draft, legalName: event.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-[#3f3f46] bg-white dark:bg-[#111] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              Business type
              <select value={draft.businessType} onChange={(event) => setDraft({ ...draft, businessType: event.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-[#3f3f46] bg-white dark:bg-[#111] px-3 py-2 text-sm">
                {BUSINESS_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              Contact email
              <input required type="email" value={draft.primaryContactEmail} onChange={(event) => setDraft({ ...draft, primaryContactEmail: event.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-[#3f3f46] bg-white dark:bg-[#111] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              Contact phone
              <input required type="tel" maxLength={40} value={draft.primaryContactPhone} onChange={(event) => setDraft({ ...draft, primaryContactPhone: event.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-[#3f3f46] bg-white dark:bg-[#111] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              Website
              <input type="url" placeholder="https://example.com" value={draft.websiteUrl} onChange={(event) => setDraft({ ...draft, websiteUrl: event.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-[#3f3f46] bg-white dark:bg-[#111] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              Cuisine types
              <input value={draft.cuisineTypes} onChange={(event) => setDraft({ ...draft, cuisineTypes: event.target.value })} placeholder="Filipino, Japanese" className="w-full rounded-lg border border-gray-300 dark:border-[#3f3f46] bg-white dark:bg-[#111] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200 md:col-span-2">
              Description
              <textarea rows={3} maxLength={2000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-[#3f3f46] bg-white dark:bg-[#111] px-3 py-2 text-sm" />
            </label>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Social media</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                ['facebook', 'Facebook'],
                ['instagram', 'Instagram'],
                ['twitter', 'Twitter'],
                ['socialWebsite', 'Other website link'],
              ] as const).map(([key, label]) => (
                <label key={key} className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                  {label}
                  <input value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-[#3f3f46] bg-white dark:bg-[#111] px-3 py-2 text-sm" />
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelEditing} disabled={isSaving} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-[#3f3f46] text-sm font-medium text-gray-700 dark:text-gray-200 disabled:opacity-50"><X className="w-4 h-4" /> Cancel</button>
            <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#239459] hover:bg-[#215035] text-sm font-semibold text-white disabled:opacity-50"><Save className="w-4 h-4" /> {isSaving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Verification</p><p className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${verificationBadge(vendor.verificationStatus)}`}>{vendor.verificationStatus}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Status</p><p className={`mt-2 font-semibold text-sm ${vendor.isActive ? 'text-emerald-600' : 'text-zinc-500'}`}>{vendor.isActive ? 'Active' : 'Inactive'}</p><p className="text-xs text-gray-500 mt-1 capitalize">{vendor.businessType || '—'}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Outlets</p><p className="mt-2 font-bold flex items-center gap-1 text-lg"><Store className="w-5 h-5 text-[#239459]" /> {outletsCount ?? vendor.totalMerchants ?? outlets.length}</p><p className="text-xs text-gray-500">{vendor.totalOrders} orders lifetime</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Rating</p><p className="mt-2 font-bold flex items-center gap-1 text-lg"><Star className="w-5 h-5 text-[#239459]" /> {Number(vendor.averageRating || 0).toFixed(1)}</p><p className="text-xs text-gray-500">{vendor.totalReviews} reviews</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Section title="Business Identity">
            <Row label="Business name" value={vendor.businessName || '—'} icon={<Building2 className="w-3 h-3" />} />
            <Row label="Legal name" value={vendor.legalName || '—'} />
            <Row label="Business type" value={vendor.businessType || '—'} />
            <Row label="Cuisine types" value={fmtList(vendor.cuisineTypes)} />
            <Row label="Description" value={vendor.description || '—'} />
          </Section>
          <Section title="Contact">
            <Row label="Email" value={vendor.primaryContactEmail || '—'} icon={<Mail className="w-3 h-3" />} />
            <Row label="Phone" value={vendor.primaryContactPhone || '—'} icon={<Phone className="w-3 h-3" />} />
            <Row label="Website" value={vendor.websiteUrl || '—'} icon={<Globe className="w-3 h-3" />} />
            {socials && Object.entries(socials).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><Row label={k} value={String(v)} mono /></div>
            ))}
          </Section>
          <Section title="Documents">
            <Row label="Business license" value={vendor.businessLicense?.url ? `#${vendor.businessLicense.id} • ${vendor.businessLicense.filename || 'file'}` : '—'} mono icon={<FileText className="w-3 h-3" />} />
            <Row label="Tax certificate" value={vendor.taxCertificate?.url ? `#${vendor.taxCertificate.id} • ${vendor.taxCertificate.filename || 'file'}` : '—'} mono icon={<FileText className="w-3 h-3" />} />
            <Row label="Logo" value={vendor.logo?.url ? `#${vendor.logo.id}` : '—'} mono icon={<ImageIcon className="w-3 h-3" />} />
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Registration & Verification">
            <Row label="Registration no." value={vendor.businessRegistrationNumber || '—'} mono icon={<BadgeCheck className="w-3 h-3" />} />
            <Row label="TIN" value={vendor.taxIdentificationNumber || '—'} mono />
            <Row label="Verification" value={vendor.verificationStatus} />
            <Row label="Onboarded" value={fmtDate(vendor.onboardingDate)} />
          </Section>
          <Section title={`Outlets (${outlets.length})`}>
            {outlets.length === 0 ? (
              <Row label="Outlets" value="No outlets yet" />
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-[#262626]">
                {outlets.slice(0, 8).map((o) => (
                  <div key={o.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-gray-700 dark:text-white truncate max-w-[60%]">{o.outletName}</span>
                    <span className="text-gray-500 dark:text-[#a1a1aa] text-xs capitalize">{o.operationalStatus}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
          <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Timeline</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(vendor.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Updated</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(vendor.updatedAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Vendor ID</span><span className="font-mono text-xs text-gray-900 dark:text-white">#{vendor.id}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BusinessProfilePage() {
  return (
    <ClientOnly fallback={<BusinessProfileSkeleton />}>
      <BusinessProfileContent />
    </ClientOnly>
  );
}
