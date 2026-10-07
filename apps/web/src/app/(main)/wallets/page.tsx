'use client';

/**
 * Thin /wallets page (BFF pattern).
 * All domain data comes from wallet server actions (CMS aggregation
 * endpoint owns user resolution, ledger joins, stats). This component
 * only manages UI state and renders.
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useUser } from '@/hooks/useAuth';
import { WalletsPageSkeleton } from '@/components/skeletons/WalletsSkeleton';
import TopupModal from '@/components/wallets/TopupModal';
import WithdrawModal from '@/components/wallets/WithdrawModal';
import { formatPHP } from '@/types/order';
import {
  WALLET_ENTRY_TYPES,
  formatSignedPHP,
  getEntryMeta,
  type WalletBalance,
  type WalletTransactionUI,
} from '@/types/wallet';
import {
  fetchWalletSummary,
  requestWithdrawal,
} from '@/lib/client-services/wallet-service';

const BRAND = '#239459';
const PAGE_SIZE = 20;

type TypeFilter = 'all' | (typeof WALLET_ENTRY_TYPES)[number];

const TYPE_TABS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'topup', label: 'Top-ups' },
  { id: 'payment', label: 'Payments' },
  { id: 'refund', label: 'Refunds' },
  { id: 'cashback', label: 'Cashback' },
  { id: 'withdrawal', label: 'Withdrawals' },
  { id: 'adjustment', label: 'Adjustments' },
  { id: 'expiry', label: 'Expired' },
];

export default function WalletsPage() {
  return (
    <Suspense fallback={<WalletsPageSkeleton />}>
      <WalletsContent />
    </Suspense>
  );
}

function WalletsContent() {
  const searchParams = useSearchParams();
  const { user } = useUser();

  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [history, setHistory] = useState<WalletTransactionUI[]>([]);
  const [stats, setStats] = useState({ toppedUp: 0, spent: 0, cashback: 0, refunded: 0, totalDocs: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBalance, setShowBalance] = useState(true);

  const [topupOpen, setTopupOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [welcomedReturn, setWelcomedReturn] = useState(false);

  // Member-safe: signed-in members have no customer doc (WALLET_NO_CUSTOMER).
  // They see the 0.00 hero + empty history, never a red error wall.
  const applyNoCustomerEmpty = useCallback(() => {
    setWallet({ balance: 0, currency: 'PHP', status: 'active', walletId: null });
    setStats({ toppedUp: 0, spent: 0, cashback: 0, refunded: 0, totalDocs: 0 });
    setHistory([]);
    setPage(1);
    setTotalPages(1);
    setError(null);
  }, []);

  const loadPage = useCallback(
    async (nextPage: number, opts: { silent?: boolean; reset?: boolean; type?: TypeFilter; q?: string } = {}) => {
      try {
        if (!opts.silent) {
          if (nextPage > 1) setLoadingMore(true);
          else if (opts.reset) setRefreshing(true);
          else setLoading(true);
        }
        setError(null);
        const summary = await fetchWalletSummary({
          type: opts.type ?? typeFilter,
          page: nextPage,
          limit: PAGE_SIZE,
          q: opts.q ?? searchQuery,
        });
        setWallet(summary.wallet);
        setStats(summary.stats);
        setHistory((prev) => (nextPage === 1 ? summary.history.docs : [...prev, ...summary.history.docs]));
        setPage(summary.history.page);
        setTotalPages(summary.history.totalPages);
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (msg.includes('WALLET_NO_CUSTOMER')) {
          applyNoCustomerEmpty();
          if (opts.silent) toast.error('Wallet not available for this account yet');
          return;
        }
        if (!opts.silent) setError(e?.message || 'Failed to load wallet');
        else toast.error(e?.message || 'Refresh failed — showing saved data');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [typeFilter, searchQuery, applyNoCustomerEmpty],
  );

  const loadPageRef = useRef(loadPage);
  loadPageRef.current = loadPage;
  const filterFirstRun = useRef(true);
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const withdrawGuardRef = useRef(false);

  // Balance-settle poll: top-up credit lands via async PayMongo webhook, so a
  // single refresh after Done can still show the old balance. Poll silently
  // until balance/totalDocs moves (max 6 × 10s), then stop. No interval when
  // idle — write-settled polling only, never background polling.
  const pollUntilSettled = useCallback(
    async (baseline: { balance: number; totalDocs: number }) => {
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 10000));
        if (typeof document !== 'undefined' && document.hidden) continue;
        await loadPageRef.current(1, { silent: true });
        const w = walletRef.current;
        const s = statsRef.current;
        if (w && (w.balance !== baseline.balance || s.totalDocs !== baseline.totalDocs)) {
          toast.success('Wallet balance updated');
          return;
        }
      }
    },
    [],
  );

  useEffect(() => {
    loadPageRef.current(1);
  }, []);

  // Debounced server-side search input.
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim().toLowerCase()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Refetch from server when filter/search changes (server owns filtering).
  // Skips the initial run — the mount effect already fetched.
  useEffect(() => {
    if (filterFirstRun.current) {
      filterFirstRun.current = false;
      return;
    }
    loadPageRef.current(1, { reset: true, type: typeFilter, q: searchQuery });
  }, [typeFilter, searchQuery]);

  // Returning from PayMongo redirect → refresh once, then poll until the
  // webhook credit lands (single 2.5s refresh showed stale balances).
  useEffect(() => {
    if (searchParams?.get('topup') === 'return' && !welcomedReturn && !loading) {
      setWelcomedReturn(true);
      toast.success('Payment return detected — refreshing balance');
      const baseline = {
        balance: walletRef.current?.balance ?? 0,
        totalDocs: statsRef.current?.totalDocs ?? 0,
      };
      const t = setTimeout(() => {
        loadPage(1, { reset: true });
        void pollUntilSettled(baseline);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [searchParams, loading, welcomedReturn, loadPage, pollUntilSettled]);

  const handleWithdraw = useCallback(
    async (amount: number, destination: string) => {
      if (withdrawGuardRef.current) return;
      withdrawGuardRef.current = true;
      setWithdrawing(true);
      try {
        await requestWithdrawal({ amount, destination });
        toast.success('Withdrawal requested — under review');
        setWithdrawOpen(false);
        await loadPage(1, { reset: true });
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (msg.includes('WALLET_NO_CUSTOMER')) toast.error('Wallet not available for this account yet');
        else toast.error(e?.message || 'Withdrawal failed');
      } finally {
        setWithdrawing(false);
        withdrawGuardRef.current = false;
      }
    },
    [loadPage],
  );

  const displayName =
    user && (user.firstName || user.lastName)
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
      : 'KuyaCares Customer';

  const isFiltered = searchQuery !== '' || typeFilter !== 'all';

  const visible = useMemo(() => history, [history]);

  // Static derivations memoized (§4b: rebuilt per render otherwise).
  const statCards = useMemo(
    () => [
      { label: 'Topped up', value: formatPHP(stats.toppedUp), icon: 'fa-arrow-down', bg: 'bg-green-50', fg: 'text-green-700' },
      { label: 'Spent', value: formatPHP(stats.spent), icon: 'fa-receipt', bg: 'bg-blue-50', fg: 'text-blue-700' },
      { label: 'Cashback', value: formatPHP(stats.cashback), icon: 'fa-coins', bg: 'bg-amber-50', fg: 'text-amber-700' },
      { label: 'Refunded', value: formatPHP(stats.refunded), icon: 'fa-undo', bg: 'bg-emerald-50', fg: 'text-emerald-700' },
    ],
    [stats],
  );

  if (loading) return <WalletsPageSkeleton />;

  // Member-safe: WALLET_NO_CUSTOMER is handled as a 0.00 empty state above.
  if (error && !wallet && !error.includes('WALLET_NO_CUSTOMER')) {
    const noSession = error.includes('WALLET_NO_SESSION');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
            <i className={`fas ${noSession ? 'fa-user-lock' : 'fa-exclamation-triangle'} text-red-500 text-xl`} />
          </div>
          <h2 className="text-lg font-extrabold text-gray-900 mb-2">Couldn&apos;t load wallet</h2>
          <p className="text-sm text-gray-500 mb-5">
            {noSession ? 'Please sign in to view your wallet.' : error}
          </p>
          {noSession ? (
            <Link
              href="/signin"
              className="block w-full py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90"
              style={{ backgroundColor: BRAND }}
            >
              <i className="fas fa-sign-in-alt mr-2" />
              Sign in
            </Link>
          ) : (
            <button
              onClick={() => loadPage(1, { reset: true })}
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

  const frozen = wallet?.status !== 'active';
  const hasMore = page < totalPages;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="w-full px-3 sm:px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">My Wallet</h1>
              <p className="text-gray-500 mt-0.5 text-sm">Top up, pay, earn cashback & track every peso</p>
            </div>
            <button
              onClick={() => loadPage(1, { reset: true })}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              <i className={`fas fa-sync-alt ${refreshing ? 'fa-spin' : ''}`} style={{ color: BRAND }} />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </div>

          {/* Balance hero — ShopeePay / GCash style */}
          <div
            className="mt-4 rounded-2xl p-5 text-white shadow-md relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #12522f 100%)` }}
          >
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
            <div className="absolute -right-2 top-10 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                  <i className="fas fa-wallet mr-1.5" />
                  KuyaCares Wallet
                </span>
                <div className="flex items-center gap-2">
                  {frozen && (
                    <span className="text-[10px] font-extrabold bg-red-500/90 px-2 py-0.5 rounded-full uppercase">
                      {wallet?.status}
                    </span>
                  )}
                  <button
                    onClick={() => setShowBalance((s) => !s)}
                    className="text-white/80 hover:text-white"
                    aria-label={showBalance ? 'Hide balance' : 'Show balance'}
                  >
                    <i className={`fas ${showBalance ? 'fa-eye' : 'fa-eye-slash'}`} />
                  </button>
                </div>
              </div>
              <p className="text-3xl sm:text-4xl font-extrabold mt-2 tracking-tight">
                {showBalance ? formatPHP(wallet?.balance ?? 0) : '₱••••••'}
              </p>
              <p className="text-[11px] text-white/70 mt-1">
                {wallet?.currency || 'PHP'} • {stats.totalDocs} transaction{stats.totalDocs === 1 ? '' : 's'}
              </p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setTopupOpen(true)}
                  disabled={frozen}
                  className="flex-1 py-2.5 bg-white rounded-xl font-extrabold text-sm active:scale-[0.98] transition-all disabled:opacity-60"
                  style={{ color: BRAND }}
                >
                  <i className="fas fa-plus-circle mr-2" />
                  Top Up
                </button>
                <button
                  onClick={() => setWithdrawOpen(true)}
                  disabled={frozen}
                  className="flex-1 py-2.5 bg-white/15 border border-white/30 text-white rounded-xl font-extrabold text-sm hover:bg-white/25 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  <i className="fas fa-arrow-up mr-2" />
                  Withdraw
                </button>
                <Link
                  href="/orders"
                  className="py-2.5 px-4 bg-white/15 border border-white/30 text-white rounded-xl font-extrabold text-sm hover:bg-white/25 active:scale-[0.98] transition-all"
                  title="Pay orders with wallet"
                >
                  <i className="fas fa-receipt" />
                </Link>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
            {statCards.map((s) => (
              <div key={s.label} className={`${s.bg} rounded-xl px-3 py-2.5 flex items-center gap-2.5`}>
                <i className={`fas ${s.icon} ${s.fg}`} />
                <div className="min-w-0">
                  <p className={`text-sm font-extrabold truncate ${s.fg}`}>{s.value}</p>
                  <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Type tabs */}
        <div className="border-t border-gray-100">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide px-3 py-2.5">
            {TYPE_TABS.map((t) => {
              const active = typeFilter === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTypeFilter(t.id)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold text-[13px] transition-all border ${
                    active
                      ? 'text-white shadow-md border-transparent'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  style={active ? { backgroundColor: BRAND } : {}}
                >
                  {t.label}
                  {t.id === 'all' && (
                    <span className={`ml-1.5 text-[11px] font-extrabold ${active ? 'text-white/80' : 'text-gray-400'}`}>
                      {stats.totalDocs}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full px-3 sm:px-4 py-4">
        {/* Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3.5 mb-4">
          <div className="relative">
            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search by type, order #, gateway, amount…"
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
        </div>

        {/* History */}
        {visible.length > 0 ? (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {visible.map((tx, i) => {
                const meta = getEntryMeta(tx.type);
                return (
                  <div
                    key={tx.id}
                    className={`flex items-center gap-3 p-4 ${i > 0 ? 'border-t border-gray-100' : ''} hover:bg-gray-50/60 transition-colors`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                      <i className={`${meta.icon} text-gray-500 text-sm`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold text-gray-900">{meta.label}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.pill}`}>
                          {tx.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                        {tx.createdAt}
                        {tx.orderId ? ` • Order #${String(tx.orderId).padStart(5, '0')}` : ''}
                        {tx.gateway ? ` • ${tx.gateway}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-extrabold ${meta.amountClass}`}>{formatSignedPHP(tx.amount)}</p>
                      <p className="text-[10px] text-gray-400">Bal {formatPHP(tx.balanceAfter)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <div className="text-center mt-5">
                <button
                  onClick={() => loadPage(page + 1)}
                  disabled={loadingMore}
                  className="px-8 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 shadow-sm disabled:opacity-60"
                >
                  {loadingMore ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-chevron-down mr-2" />}
                  Show more
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-10">
            <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <div className="w-20 h-20 mx-auto mb-5 bg-gray-50 rounded-full flex items-center justify-center">
                <i className="fas fa-wallet text-2xl text-gray-300" />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 mb-2">
                {isFiltered ? 'No matching transactions' : 'No transactions yet'}
              </h3>
              <p className="text-gray-500 mb-6 text-sm">
                {isFiltered
                  ? 'Try a different keyword or type.'
                  : 'Top up your wallet to pay faster and earn cashback.'}
              </p>
              {isFiltered ? (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setTypeFilter('all');
                  }}
                  className="px-6 py-2.5 text-white rounded-xl font-bold text-sm shadow-md hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  Clear filters
                </button>
              ) : (
                <button
                  onClick={() => setTopupOpen(true)}
                  className="px-6 py-2.5 text-white rounded-xl font-bold text-sm shadow-md hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  <i className="fas fa-plus-circle mr-2" />
                  Top up now
                </button>
              )}
            </div>
          </div>
        )}

        {/* How it works — Foodpanda/Shopee style explainer */}
        <div className="mt-5 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-extrabold text-gray-900 mb-3">How KuyaCares Wallet works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px] text-gray-600">
            <div className="flex gap-2.5">
              <i className="fas fa-plus-circle mt-0.5" style={{ color: BRAND }} />
              <p><span className="font-bold text-gray-800">Top up</span> via card, GCash, GrabPay, Maya or QR Ph. Balance credits after payment confirmation.</p>
            </div>
            <div className="flex gap-2.5">
              <i className="fas fa-bolt mt-0.5" style={{ color: BRAND }} />
              <p><span className="font-bold text-gray-800">Pay instantly</span> at checkout with your balance — no redirects, plus cashback on eligible orders.</p>
            </div>
            <div className="flex gap-2.5">
              <i className="fas fa-undo mt-0.5" style={{ color: BRAND }} />
              <p><span className="font-bold text-gray-800">Refunds & withdrawals</span> land back in your wallet; withdraw to GCash, Maya or bank anytime.</p>
            </div>
          </div>
        </div>
      </div>

      <TopupModal
        isOpen={topupOpen}
        customerName={displayName}
        customerEmail={user?.email || ''}
        onClose={(refresh) => {
          setTopupOpen(false);
          if (refresh) {
            const baseline = {
              balance: walletRef.current?.balance ?? 0,
              totalDocs: statsRef.current?.totalDocs ?? 0,
            };
            loadPage(1, { reset: true });
            // Credit is async — keep polling silently until it lands.
            void pollUntilSettled(baseline);
          }
        }}
      />
      <WithdrawModal
        isOpen={withdrawOpen}
        balance={wallet?.balance ?? 0}
        submitting={withdrawing}
        onClose={() => setWithdrawOpen(false)}
        onSubmit={handleWithdraw}
      />
    </div>
  );
}
