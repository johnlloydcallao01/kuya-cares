'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, notFound } from 'next/navigation';
import { ClientOnly } from '@/components/ClientOnly';
import {
  ArrowLeft,
  Edit,
  Store,
  MapPin,
  Phone,
  Mail,
  Clock,
  Truck,
  DollarSign,
  AlertCircle,
  Globe,
  Tag,
  CheckCircle,
  XCircle,
} from '@/components/ui/IconWrapper';

type Outlet = {
  id: string;
  outletName: string;
  outletCode: string;
  description: string;
  specialInstructions: string;
  tags: string[];
  isActive: boolean;
  isAcceptingOrders: boolean;
  operationalStatus: string;
  operatingHours: Record<string, { open: string; close: string; closed: boolean }> | null;
  contactInfo: { phone: string; email: string; managerName: string; managerPhone: string };
  deliverySettings: {
    minimumOrderAmount: number;
    deliveryFee: number;
    freeDeliveryThreshold: number;
    estimatedDeliveryTimeMinutes: number;
    maxDeliveryTimeMinutes: number;
    deliveryRadiusMeters: number;
    maxDeliveryRadiusMeters: number;
    deliveryFeePerKm: number;
  };
  address: { id?: string | number | null; formattedAddress: string; street: string; locality: string; province: string; postalCode: string; country: string; latitude: number; longitude: number } | null;
  activeAddress?: { id?: string | number | null; formattedAddress?: string } | null;
  activeAddressId?: string | number | null;
  coordinates: { latitude: number; longitude: number };
  media: { thumbnail: { url: string } | null; storeFrontImage: { url: string } | null };
  createdAt: string;
  updatedAt: string;
};

function operationalBadge(status: string) {
  const s = String(status).toLowerCase();
  if (s === 'open') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
  if (s === 'busy') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
  if (s === 'temp_closed') return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800';
  if (s === 'closed') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';
  if (s === 'maintenance') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
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

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(iso).slice(0, 10);
  }
}

function OutletViewSkeleton() {
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>;
}

function OutletViewContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [doc, setDoc] = useState<Outlet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/outlets/${id}?_t=${Date.now()}`, { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed to load outlet');
        if (!cancelled) setDoc(j.outlet);
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
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
        <div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
      </div>
    );
  }
  if (error || !doc) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/outlets'))} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load outlet</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/outlets" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><ArrowLeft className="w-4 h-4" /> Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/outlets'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
            {doc.media?.thumbnail?.url ? <img src={doc.media.thumbnail.url} alt={doc.outletName} className="h-12 w-12 rounded-xl object-cover" /> : doc.outletName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{doc.outletName}</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] font-mono">{doc.outletCode} • ID #{doc.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/outlets/${doc.id}/edit`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Edit className="w-4 h-4" /> Edit</Link>
          <Link href="/outlets" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50">Close</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Operational Status</p><p className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${operationalBadge(doc.operationalStatus)}`}>{doc.operationalStatus.replace('_', ' ')}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Active</p><p className={`mt-2 font-semibold text-sm ${doc.isActive ? 'text-emerald-600' : 'text-zinc-500'}`}>{doc.isActive ? 'Active branch' : 'Inactive'}</p><p className="text-xs text-gray-500 mt-1">{doc.isAcceptingOrders ? 'Accepting orders' : 'Not accepting'}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Delivery Radius</p><p className="mt-2 font-bold flex items-center gap-1 text-lg"><Truck className="w-5 h-5 text-[#eba236]" /> {(doc.deliverySettings.deliveryRadiusMeters / 1000).toFixed(1)} km</p><p className="text-xs text-gray-500">Min ₱{doc.deliverySettings.minimumOrderAmount} • Fee ₱{doc.deliverySettings.deliveryFee}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Location</p><p className="mt-2 font-semibold text-sm text-gray-900 dark:text-white truncate">{doc.address?.locality || '—'}</p><p className="text-xs text-gray-500 truncate">{doc.address?.province || doc.address?.formattedAddress || '—'}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Section title="Outlet Information">
            <Row label="Outlet name" value={doc.outletName} />
            <Row label="Outlet code" value={doc.outletCode} mono />
            <Row label="Description" value={doc.description || '—'} />
            <Row label="Special instructions" value={doc.specialInstructions || '—'} />
            <Row label="Tags" value={doc.tags.length ? doc.tags.join(', ') : '—'} icon={<Tag className="w-3 h-3" />} />
          </Section>
          <Section title="Contact">
            <Row label="Email" value={doc.contactInfo.email || '—'} icon={<Mail className="w-3 h-3" />} />
            <Row label="Phone" value={doc.contactInfo.phone || '—'} icon={<Phone className="w-3 h-3" />} />
            <Row label="Manager" value={doc.contactInfo.managerName || '—'} />
            <Row label="Manager phone" value={doc.contactInfo.managerPhone || '—'} icon={<Phone className="w-3 h-3" />} />
          </Section>
          <Section title="Address & Location">
            <Row label="Active Address ID" value={(doc.activeAddressId ?? doc.activeAddress?.id ?? doc.address?.id) != null ? `#${doc.activeAddressId ?? doc.activeAddress?.id ?? doc.address?.id}` : '—'} mono icon={<MapPin className="w-3 h-3" />} />
            <Row label="Formatted" value={doc.address?.formattedAddress || '—'} icon={<MapPin className="w-3 h-3" />} />
            <Row label="Street" value={doc.address?.street || '—'} />
            <Row label="City" value={doc.address?.locality || '—'} />
            <Row label="Province" value={doc.address?.province || '—'} />
            <Row label="Postal code" value={doc.address?.postalCode || '—'} mono />
            <Row label="Coordinates" value={doc.coordinates.latitude && doc.coordinates.longitude ? `${doc.coordinates.latitude.toFixed(5)}, ${doc.coordinates.longitude.toFixed(5)}` : '—'} mono icon={<Globe className="w-3 h-3" />} />
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Delivery Settings">
            <Row label="Min order" value={`₱${doc.deliverySettings.minimumOrderAmount}`} icon={<DollarSign className="w-3 h-3" />} />
            <Row label="Base fee" value={`₱${doc.deliverySettings.deliveryFee}`} />
            <Row label="Fee per km" value={`₱${doc.deliverySettings.deliveryFeePerKm}`} />
            <Row label="Free delivery" value={doc.deliverySettings.freeDeliveryThreshold ? `₱${doc.deliverySettings.freeDeliveryThreshold}` : '—'} />
            <Row label="Radius" value={`${(doc.deliverySettings.deliveryRadiusMeters / 1000).toFixed(1)} km (max ${(doc.deliverySettings.maxDeliveryRadiusMeters / 1000).toFixed(1)} km)`} icon={<Truck className="w-3 h-3" />} />
            <Row label="Est. time" value={`${doc.deliverySettings.estimatedDeliveryTimeMinutes} – ${doc.deliverySettings.maxDeliveryTimeMinutes} min`} icon={<Clock className="w-3 h-3" />} />
          </Section>
          {doc.operatingHours && (
            <Section title="Operating Hours">
              <div className="divide-y divide-gray-100 dark:divide-[#262626]">
                {Object.entries(doc.operatingHours).map(([day, h]: [string, { open: string; close: string; closed: boolean }]) => (
                  <div key={day} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-gray-700 dark:text-white capitalize">{day}</span>
                    <span className="text-gray-500 dark:text-[#a1a1aa]">{h.closed ? 'Closed' : `${h.open} – ${h.close}`}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
          <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Timeline</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(doc.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Updated</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(doc.updatedAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ID</span><span className="font-mono text-xs text-gray-900 dark:text-white">#{doc.id}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OutletViewPage() {
  // SSR-level guard: reserved/deleted slugs must 404 with proper status instead
  // of prerendering the skeleton and matching [id] as id="hours". Runs during
  // prerender AND hydration, before ClientOnly.
  const params = useParams();
  const id = params.id as string;
  if (['new', 'hours', 'delivery', 'media', 'service-area'].includes(id)) {
    notFound();
  }
  return (
    <ClientOnly fallback={<OutletViewSkeleton />}>
      <OutletViewContent />
    </ClientOnly>
  );
}
