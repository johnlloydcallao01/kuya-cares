'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClientOnly } from '@/components/ClientOnly';
import {
  Package,
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Tag,
} from '@/components/ui/IconWrapper';

type ProductRow = {
  merchantProductId: number;
  merchant: { id: number; outletName: string; outletCode: string } | null;
  product: {
    id: number;
    name: string;
    slug: string;
    sku: string;
    productType: string;
    basePrice: number;
    primaryImage: { url: string } | null;
  } | null;
  priceOverride: number | null;
  stockQuantity: number;
  isActive: boolean;
  isAvailable: boolean;
  createdAt: string;
};

type Metrics = {
  totalListings: number;
  activeListings: number;
  availableListings: number;
  outOfStock: number;
  totalProducts: number;
};

const TYPE_OPTS: { value: string; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'variable', label: 'Variable' },
  { value: 'grouped', label: 'Grouped' },
];

const ACTIVE_OPTS: { value: string; label: string }[] = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'P';
}

function fmtCurrency(n: number) {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function KpiCard({ title, value, sub, icon, iconBg }: { title: string; value: string; sub?: string; icon: React.ReactNode; iconBg: string }) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa] truncate">{title}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1 truncate">{sub}</p>}
        </div>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      </div>
    </div>
  );
}

function FilterPills({ label, options, value, onToggle }: { label: string; options: { value: string; label: string }[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => onToggle(opt.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProductsSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="p-4 space-y-3 animate-pulse">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div>
    </div>
  );
}

function ProductsPageContent() {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<string>('-createdAt');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 400);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, typeFilter, activeFilter, sort]);

  const activeFilterCount = useMemo(() => typeFilter.length + activeFilter.length + (debouncedQ ? 1 : 0), [typeFilter, activeFilter, debouncedQ]);

  const load = useCallback(async (opts?: { hard?: boolean }) => {
    if (opts?.hard) {
      setRows([]);
      setMetrics(null);
    }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (debouncedQ) qs.set('search', debouncedQ);
      if (typeFilter.length === 1) qs.set('productType', typeFilter[0]);
      if (activeFilter.length === 1) qs.set('isActive', activeFilter[0]);
      qs.set('limit', '200');
      const res = await fetch(`/api/products?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to load products');
      setRows(Array.isArray(j.products) ? j.products : []);
      setMetrics(j.metrics || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, typeFilter, activeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleType = (v: string) => setTypeFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const toggleActive = (v: string) => setActiveFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const clearAll = () => {
    setQ('');
    setDebouncedQ('');
    setTypeFilter([]);
    setActiveFilter([]);
  };

  const filtered = useMemo(() => {
    let arr = [...rows];
    if (typeFilter.length > 1) arr = arr.filter((r) => typeFilter.includes(String(r.product?.productType || '').toLowerCase()));
    if (activeFilter.length > 1) arr = arr.filter((r) => activeFilter.includes(String(r.isActive)));
    if (sort === 'name') arr.sort((a, b) => (a.product?.name || '').localeCompare(b.product?.name || ''));
    else if (sort === '-name') arr.sort((a, b) => (b.product?.name || '').localeCompare(a.product?.name || ''));
    else if (sort === 'price') arr.sort((a, b) => (a.product?.basePrice || 0) - (b.product?.basePrice || 0));
    else if (sort === '-price') arr.sort((a, b) => (b.product?.basePrice || 0) - (a.product?.basePrice || 0));
    return arr;
  }, [rows, typeFilter, activeFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const paged = useMemo(() => {
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, page, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const isInitial = loading && rows.length === 0 && !metrics;

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><Package className="w-4 h-4" /></span>
            Products
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Vendor catalog across your outlets — availability, stock & pricing.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load({ hard: true })}
            disabled={loading}
            aria-label="Refresh products"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {metrics ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Listings" value={String(metrics.totalListings)} sub={`${metrics.totalProducts} products`} icon={<Package className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Active" value={String(metrics.activeListings)} sub={`${metrics.availableListings} available`} icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Out of Stock" value={String(metrics.outOfStock)} sub="needs restock" icon={<Clock className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="Inactive" value={String(metrics.totalListings - metrics.activeListings)} sub="hidden listings" icon={<XCircle className="w-5 h-5 text-white" />} iconBg="bg-zinc-600" />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />
          ))}
        </div>
      ) : null}

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product name, SKU, outlet…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-white">
                <option value="-createdAt">Newest first</option>
                <option value="name">Name A–Z</option>
                <option value="-name">Name Z–A</option>
                <option value="price">Price low–high</option>
                <option value="-price">Price high–low</option>
              </select>
            </div>
            <span className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] text-gray-600 dark:text-[#a1a1aa]">10 / page</span>
            <button onClick={() => setShowFilters((v) => !v)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition shrink-0 ${activeFilterCount ? 'bg-[#eba236] hover:bg-[#c88a20] text-white border-[#eba236]' : 'bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filters {activeFilterCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#eba236]">{activeFilterCount}</span>} <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {activeFilterCount > 0 && <button onClick={clearAll} className="text-sm font-medium text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900">Clear all</button>}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262626] space-y-4">
            <FilterPills label="Product Type" options={TYPE_OPTS} value={typeFilter} onToggle={toggleType} />
            <FilterPills label="Status" options={ACTIVE_OPTS} value={activeFilter} onToggle={toggleActive} />
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {typeFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium capitalize">{TYPE_OPTS.find(o => o.value === v)?.label || v} <button onClick={() => toggleType(v)}><X className="w-3 h-3" /></button></span>)}
            {activeFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{ACTIVE_OPTS.find(o => o.value === v)?.label || v} <button onClick={() => toggleActive(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load products</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        )}
        {!error && isInitial ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : !error && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4"><Package className="w-8 h-8 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No products found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Try adjusting search or filters.</p>
          </div>
        ) : !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Product</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Outlet</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Price</th>
                    <th className="text-right px-4 py-3 font-medium hidden xl:table-cell">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {paged.map((r) => (
                    <tr key={r.merchantProductId} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[220px]">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                            {r.product?.primaryImage?.url ? <img src={r.product.primaryImage.url} alt={r.product?.name} className="h-9 w-9 rounded-xl object-cover" /> : initials(r.product?.name || 'P')}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">{r.product?.name || '—'}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[180px] font-mono">{r.product?.sku || `#${r.product?.id}`} • {r.product?.productType}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="text-xs text-gray-900 dark:text-white truncate max-w-[220px]">{r.merchant?.outletName || '—'}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[220px] font-mono">{r.merchant?.outletCode || `#${r.merchant?.id}`}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${r.isActive && r.isAvailable ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300'}`}>
                          <span className={`h-2 w-2 rounded-full ${r.isActive && r.isAvailable ? 'bg-emerald-500' : 'bg-red-500'}`} /> {r.isActive ? (r.isAvailable ? 'Available' : 'Unavailable') : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmtCurrency(r.priceOverride ?? r.product?.basePrice ?? 0)}</span>
                        {r.priceOverride != null && <div className="text-[11px] text-gray-400">override</div>}
                      </td>
                      <td className="px-4 py-3 text-right hidden xl:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-semibold text-gray-700 dark:text-white">
                          <Tag className="w-3 h-3 text-[#eba236]" /> {r.stockQuantity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {page} of {totalPages} • {filtered.length} listings • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                    if (n > totalPages) return null;
                    return <button key={n} onClick={() => setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n === page ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>;
                  })}
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <ClientOnly fallback={<ProductsSkeleton />}>
      <ProductsPageContent />
    </ClientOnly>
  );
}
