'use client';

/**
 * Unified voucher wallet (single page, marketplace-style).
 * Merges the claimable pool + the customer's claims client-side into one
 * list. Each card carries its wallet state (to-claim / claimed / used /
 * expired) with the matching action. Server actions still own all data.
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { VouchersPageSkeleton } from '@/components/skeletons/VouchersSkeleton';
import VoucherCard from '@/components/vouchers/VoucherCard';
import VoucherDetailModal from '@/components/vouchers/VoucherDetailModal';
import type { MyVoucher, VoucherUI } from '@/types/voucher';
import {
  claimVoucher,
  copyVoucherCode,
  fetchClaimableVouchers,
  fetchMyVouchers,
} from '@/lib/client-services/voucher-service';

const BRAND = '#239459';

type WalletFilter = 'all' | 'available' | 'to_claim' | 'used' | 'expired';

interface WalletEntry {
  voucher: VoucherUI;
  /** wallet state derived from claims pool */
  state: 'to_claim' | 'available' | 'used' | 'expired';
}

const FILTERS: { id: WalletFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'to_claim', label: 'To Claim' },
  { id: 'used', label: 'Used' },
  { id: 'expired', label: 'Expired' },
];

export default function VouchersPage() {
  return (
    <Suspense fallback={<VouchersPageSkeleton />}>
      <VouchersContent />
    </Suspense>
  );
}

function VouchersContent() {
  const [entries, setEntries] = useState<WalletEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<WalletFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [claimingId, setClaimingId] = useState<string | number | null>(null);
  const [detail, setDetail] = useState<VoucherUI | null>(null);

  const loadAll = useCallback(async (opts: { silent?: boolean; reset?: boolean } = {}) => {
    try {
      if (!opts.silent) {
        if (opts.reset) setRefreshing(true);
        else setLoading(true);
      }
      setError(null);
      // Two calls, not four (§4 single query): mine?filter=all returns all
      // three buckets in one claims scan; the page splits by computedStatus.
      const [claimable, mineAll] = await Promise.all([
        fetchClaimableVouchers({ limit: 50 }),
        fetchMyVouchers('all'),
      ]);
      const available = mineAll.filter((m) => m.computedStatus === 'available');
      const used = mineAll.filter((m) => m.computedStatus === 'used');
      const expired = mineAll.filter((m) => m.computedStatus === 'expired');
      const byKey = new Map<string, WalletEntry>();
      const push = (v: VoucherUI | MyVoucher, state: WalletEntry['state']) => {
        // Merge by coupon id, not code: platform codes may repeat across
        // vendors ((code,vendor) unique), and code-keying collapsed distinct
        // coupons into one card, silently dropping terms.
        const key = `${String(v.code).toUpperCase()}::${String((v as any).id)}`;
        const prev = byKey.get(key);
        // Best state wins: available > to_claim > used > expired display priority
        // is handled at render; here claimed rows enrich pool rows.
        if (!prev) {
          byKey.set(key, { voucher: { ...v, claimed: state !== 'to_claim', used: state === 'used' }, state });
        } else if (prev.state === 'to_claim' && state !== 'to_claim') {
          byKey.set(key, { voucher: { ...v, claimed: true, used: state === 'used' }, state });
        }
      };
      for (const m of [...available, ...used, ...expired]) {
        push(m, m.computedStatus === 'available' ? 'available' : m.computedStatus);
      }
      for (const v of claimable) {
        const key = `${String(v.code).toUpperCase()}::${String((v as any).id)}`;
        if (!byKey.has(key)) push(v, 'to_claim');
        else if (v.featured) {
          // Keep featured flag on the merged card.
          const e = byKey.get(key)!;
          e.voucher = { ...e.voucher, featured: true, imageUrl: e.voucher.imageUrl ?? v.imageUrl };
        }
      }
      const rank: Record<WalletEntry['state'], number> = { available: 0, to_claim: 1, used: 2, expired: 3 };
      const merged = [...byKey.values()].sort((a, b) => {
        if (Number(b.voucher.featured) !== Number(a.voucher.featured)) {
          return Number(b.voucher.featured) - Number(a.voucher.featured);
        }
        return rank[a.state] - rank[b.state];
      });
      setEntries(merged);
    } catch (e: any) {
      if (!opts.silent) setError(e?.message || 'Failed to load vouchers');
      else toast.error(e?.message || 'Refresh failed — showing saved list');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadRef = useRef(loadAll);
  loadRef.current = loadAll;
  const mountedOnce = useRef(false);

  useEffect(() => {
    if (mountedOnce.current) return;
    mountedOnce.current = true;
    loadRef.current({});
  }, []);

  const handleClaim = useCallback(async (v: VoucherUI) => {
    setClaimingId(v.id);
    try {
      await claimVoucher({ couponId: v.id });
      toast.success(`${v.code} claimed to your wallet`);
      // Instant local patch for feedback, then a silent reload to reconcile
      // usesLeftForUser/expiry-derived state (an exhausted voucher must not
      // sit green as "available" until the next manual refresh).
      setEntries((prev) =>
        prev.map((e) =>
          String(e.voucher.id) === String(v.id)
            ? { voucher: { ...e.voucher, claimed: true, claimStatus: 'claimed' }, state: 'available' as const }
            : e,
        ),
      );
      setDetail((d) =>
        d && String(d.id) === String(v.id) ? { ...d, claimed: true, claimStatus: 'claimed' } : d,
      );
      await loadRef.current({ silent: true });
    } catch (e: any) {
      toast.error(e?.message || 'Claim failed');
    } finally {
      setClaimingId(null);
    }
  }, []);

  const handleClaimCode = useCallback(async () => {
    const code = codeInput.trim();
    if (!code) return;
    setCodeBusy(true);
    try {
      const v = await claimVoucher({ code });
      toast.success(`${v.code} claimed to your wallet`);
      setCodeInput('');
      await loadRef.current({ reset: true });
    } catch (e: any) {
      toast.error(e?.message || 'Invalid code');
    } finally {
      setCodeBusy(false);
    }
  }, [codeInput]);

  const handleCopy = useCallback(async (v: VoucherUI) => {
    try {
      await copyVoucherCode(v.code);
      toast.success(`${v.code} copied`);
    } catch {
      toast.error('Copy failed');
    }
  }, []);

  const query = searchInput.trim().toLowerCase();
  const visible = useMemo(() => {
    return entries.filter((e) => {
      if (filter !== 'all' && e.state !== filter) return false;
      if (!query) return true;
      return `${e.voucher.title} ${e.voucher.code} ${e.voucher.shortCopy ?? ''} ${e.voucher.vendorName ?? ''}`
        .toLowerCase()
        .includes(query);
    });
  }, [entries, filter, query]);

  const counts = useMemo(() => {
    const c: Record<WalletFilter, number> = { all: entries.length, available: 0, to_claim: 0, used: 0, expired: 0 };
    for (const e of entries) c[e.state] += 1;
    return c;
  }, [entries]);

  if (loading) return <VouchersPageSkeleton />;

  if (error && entries.length === 0) {
    const noSession = error.includes('VOUCHERS_NO_SESSION');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
            <i className={`fas ${noSession ? 'fa-user-lock' : 'fa-exclamation-triangle'} text-red-500 text-xl`} />
          </div>
          <h2 className="text-lg font-extrabold text-gray-900 mb-2">Couldn&apos;t load vouchers</h2>
          <p className="text-sm text-gray-500 mb-5">{noSession ? 'Please sign in to view vouchers.' : error}</p>
          {noSession ? (
            <Link
              href="/signin"
              className="block w-full py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90"
              style={{ backgroundColor: BRAND }}
            >
              Sign in
            </Link>
          ) : (
            <button
              onClick={() => loadAll({ reset: true })}
              className="w-full py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90"
              style={{ backgroundColor: BRAND }}
            >
              <i className="fas fa-redo mr-2" />
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  const isFiltered = query !== '' || filter !== 'all';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-20">
        <div className="w-full px-3 sm:px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Vouchers</h1>
              <p className="text-gray-500 mt-0.5 text-sm">
                {counts.available} available • Clip, save & auto-apply at checkout
              </p>
            </div>
            <button
              onClick={() => loadAll({ reset: true })}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <i className={`fas fa-sync-alt ${refreshing ? 'fa-spin' : ''}`} style={{ color: BRAND }} />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </div>

          {/* Status filters */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pt-3">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold text-[13px] transition-all border ${
                    active ? 'text-white shadow-md border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  style={active ? { backgroundColor: BRAND } : {}}
                >
                  {f.label}
                  <span className={`ml-1.5 text-[11px] font-extrabold ${active ? 'text-white/80' : 'text-gray-400'}`}>
                    {counts[f.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full px-3 sm:px-4 py-4">
        {/* Search + code entry */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3.5 mb-4 space-y-2.5">
          <div className="relative">
            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search vouchers by title, code, store…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:bg-white focus:border-transparent transition-all text-sm outline-none"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <i className="fas fa-times-circle" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <i className="fas fa-ticket-alt absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="text"
                placeholder="Have a code? Enter it here"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleClaimCode()}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-dashed border-gray-300 rounded-xl font-mono text-sm outline-none focus:ring-2 focus:bg-white"
              />
            </div>
            <button
              onClick={handleClaimCode}
              disabled={!codeInput.trim() || codeBusy}
              className="px-5 py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60 flex-shrink-0"
              style={{ backgroundColor: BRAND }}
            >
              {codeBusy ? <i className="fas fa-spinner fa-spin" /> : 'Claim'}
            </button>
          </div>
        </div>

        {visible.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {visible.map(({ voucher }) => (
              <VoucherCard
                key={`${voucher.code}-${voucher.id}`}
                voucher={voucher}
                claimingId={claimingId}
                onClaim={handleClaim}
                onCopy={handleCopy}
                onDetail={setDetail}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <div className="w-20 h-20 mx-auto mb-5 bg-gray-50 rounded-full flex items-center justify-center">
                <i className={`fas ${isFiltered ? 'fa-search' : 'fa-ticket-alt'} text-2xl text-gray-300`} />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 mb-2">
                {isFiltered ? 'No matching vouchers' : 'No vouchers right now'}
              </h3>
              <p className="text-gray-500 mb-6 text-sm">
                {isFiltered ? 'Try a different keyword or filter.' : 'New promos land here — check back soon.'}
              </p>
              {isFiltered && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setFilter('all');
                  }}
                  className="px-6 py-2.5 text-white rounded-xl font-bold text-sm shadow-md hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-extrabold text-gray-900 mb-3">How vouchers work</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px] text-gray-600">
            <div className="flex gap-2.5">
              <i className="fas fa-plus-circle mt-0.5" style={{ color: BRAND }} />
              <p><span className="font-bold text-gray-800">Claim</span> any voucher with one tap — it stays in your wallet until used or expired.</p>
            </div>
            <div className="flex gap-2.5">
              <i className="fas fa-bolt mt-0.5" style={{ color: BRAND }} />
              <p><span className="font-bold text-gray-800">Auto-apply</span> — checkout picks your best voucher, or enter a code manually.</p>
            </div>
            <div className="flex gap-2.5">
              <i className="fas fa-shield-alt mt-0.5" style={{ color: BRAND }} />
              <p><span className="font-bold text-gray-800">Verified server-side</span> — discounts are recomputed securely, never forged.</p>
            </div>
          </div>
        </div>
      </div>

      <VoucherDetailModal
        voucher={detail}
        claiming={detail != null && claimingId != null && String(claimingId) === String(detail.id)}
        onClose={() => setDetail(null)}
        onClaim={handleClaim}
        onCopy={handleCopy}
      />
    </div>
  );
}
