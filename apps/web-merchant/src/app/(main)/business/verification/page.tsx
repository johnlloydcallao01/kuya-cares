'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClientOnly } from '@/components/ClientOnly';
import {
  ShieldCheck,
  BadgeCheck,
  FileText,
  AlertCircle,
  RefreshCw,
  Store,
  Building2,
  CheckCircle,
  Clock,
} from '@/components/ui/IconWrapper';

type MediaRef = { id: number; url: string | null; filename?: string } | null;

type Vendor = {
  id: number;
  businessName: string;
  legalName: string;
  businessRegistrationNumber?: string | null;
  taxIdentificationNumber?: string | null;
  businessType?: string | null;
  isActive?: boolean | null;
  verificationStatus: string;
  onboardingDate?: string | null;
  businessLicense: MediaRef;
  taxCertificate: MediaRef;
  logo: MediaRef;
  createdAt: string;
  updatedAt: string;
};

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

function DocRow({ label, doc }: { label: string; doc: MediaRef }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0 flex items-center gap-1"><FileText className="w-3 h-3" />{label}</span>
      <span className="text-right max-w-[60%]">
        {doc?.url ? (
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-xs text-gray-900 dark:text-white">#{doc.id}</span>
            <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#eba236] hover:text-[#c88a20]">View</a>
          </span>
        ) : (
          <span className="text-xs text-gray-400">Not submitted</span>
        )}
      </span>
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

function statusMessage(status: string): { title: string; body: string } {
  const s = String(status).toLowerCase();
  if (s === 'verified') return { title: 'Your business is verified', body: 'You can operate outlets and accept orders. Keep your registration documents up to date.' };
  if (s === 'pending') return { title: 'Verification under review', body: 'Your registration was submitted and is awaiting admin approval. You will be notified by email once reviewed.' };
  if (s === 'rejected') return { title: 'Verification needs attention', body: 'Your submission was not approved. Check your registration numbers and documents, then contact support.' };
  if (s === 'suspended') return { title: 'Account suspended', body: 'Your business is suspended. Contact support to resolve this.' };
  return { title: 'Verification status', body: 'Check your registration details below.' };
}

function BusinessVerificationSkeleton() {
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>;
}

function BusinessVerificationContent() {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Same BFF aggregation as Company Information — verification is a projection,
        // not a new join (BFF-pattern: reuse endpoint, no new CMS route needed).
        const res = await fetch(`/api/business/profile?_t=${Date.now()}`, { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed to load verification status');
        if (!cancelled) {
          if (!j.vendor) throw new Error('Vendor profile not found');
          setVendor(j.vendor);
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

  if (error || !vendor) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load verification</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="w-4 h-4" /> Retry</button>
        </div>
      </div>
    );
  }

  const msg = statusMessage(vendor.verificationStatus);
  const docsSubmitted = [vendor.businessLicense, vendor.taxCertificate].filter((d) => d?.url).length;

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-[#eba236] text-white flex items-center justify-center shrink-0 overflow-hidden">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Registration & Verification</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">Verification status — read-only, managed by admin.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/business/profile" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50"><Building2 className="w-4 h-4" /> Company Info</Link>
          <Link href="/outlets" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Store className="w-4 h-4" /> Outlets</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Verification</p><p className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${verificationBadge(vendor.verificationStatus)}`}>{vendor.verificationStatus}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Account</p><p className={`mt-2 font-semibold text-sm ${vendor.isActive ? 'text-emerald-600' : 'text-zinc-500'}`}>{vendor.isActive ? 'Active' : 'Inactive'}</p><p className="text-xs text-gray-500 mt-1 capitalize">{vendor.businessType || '—'}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Documents</p><p className="mt-2 font-bold flex items-center gap-1 text-lg"><FileText className="w-5 h-5 text-[#eba236]" /> {docsSubmitted}/2</p><p className="text-xs text-gray-500">license + certificate</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Onboarded</p><p className="mt-2 font-semibold text-sm text-gray-900 dark:text-white">{fmtDate(vendor.onboardingDate)}</p><p className="text-xs text-gray-500 mt-1">Vendor #{vendor.id}</p></div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#eba236] flex items-center justify-center shrink-0">
          {vendor.verificationStatus.toLowerCase() === 'verified' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{msg.title}</p>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-0.5">{msg.body}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Section title="Registration Numbers">
            <Row label="Business name" value={vendor.businessName || '—'} icon={<Building2 className="w-3 h-3" />} />
            <Row label="Legal name" value={vendor.legalName || '—'} />
            <Row label="Registration no." value={vendor.businessRegistrationNumber || '—'} mono icon={<BadgeCheck className="w-3 h-3" />} />
            <Row label="TIN" value={vendor.taxIdentificationNumber || '—'} mono />
          </Section>
          <Section title="Submitted Documents">
            <DocRow label="Business license" doc={vendor.businessLicense} />
            <DocRow label="Tax certificate" doc={vendor.taxCertificate} />
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Verification Status">
            <Row label="Status" value={vendor.verificationStatus} />
            <Row label="Account active" value={vendor.isActive ? 'Yes' : 'No'} />
            <Row label="Business type" value={vendor.businessType || '—'} />
          </Section>
          <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Timeline</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Onboarded</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(vendor.onboardingDate)}</span></div>
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

export default function BusinessVerificationPage() {
  return (
    <ClientOnly fallback={<BusinessVerificationSkeleton />}>
      <BusinessVerificationContent />
    </ClientOnly>
  );
}
