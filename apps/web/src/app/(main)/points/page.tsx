'use client';

/**
 * Thin /points page (BFF pattern, marketplace-grade loyalty).
 * Overview (balance, tier, activity, earn rules), rewards catalog,
 * points history, achievements. Server actions own all data.
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { PointsPageSkeleton } from '@/components/skeletons/PointsSkeleton';
import RewardCard from '@/components/loyalty/RewardCard';
import AchievementCard from '@/components/loyalty/AchievementCard';
import {
  earnRuleLabel,
  entryMeta,
  type AchievementUI,
  type EarnRule,
  type LoyaltySummary,
  type PointsEntry,
  type RewardUI,
} from '@/types/loyalty';
import {
  claimAchievement,
  fetchLoyaltyCatalog,
  fetchLoyaltyHistory,
  fetchLoyaltySummary,
  redeemReward,
} from '@/lib/client-services/loyalty-service';

const BRAND = '#239459';
const PAGE_SIZE = 20;

type Tab = 'overview' | 'rewards' | 'history' | 'achievements';
type HistoryFilter = 'all' | 'earn' | 'redeem' | 'expiry';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'history', label: 'History' },
  { id: 'achievements', label: 'Achievements' },
];

const HISTORY_FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'earn', label: 'Earned' },
  { id: 'redeem', label: 'Redeemed' },
  { id: 'expiry', label: 'Expired' },
];

const REWARD_CATS = [
  { id: 'all', label: 'All' },
  { id: 'food', label: 'Food' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'discount', label: 'Discount' },
  { id: 'exclusive', label: 'Exclusive' },
];

export default function PointsPage() {
  return (
    <Suspense fallback={<PointsPageSkeleton />}>
      <PointsContent />
    </Suspense>
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return pointsDateFormatter.format(d);
}

// Hoisted (§4b item 1): one shared date formatter instead of a fresh
// toLocaleDateString per row per render.
const pointsDateFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function PointsContent() {
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<LoyaltySummary | null>(null);
  const [rules, setRules] = useState<EarnRule[]>([]);
  const [rewards, setRewards] = useState<RewardUI[]>([]);
  const [achievements, setAchievements] = useState<AchievementUI[]>([]);
  const [history, setHistory] = useState<PointsEntry[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyMore, setHistoryMore] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [rewardCat, setRewardCat] = useState('all');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | number | null>(null);
  const [claimingId, setClaimingId] = useState<string | number | null>(null);
  const [filteringHistory, setFilteringHistory] = useState(false);

  const loadAll = useCallback(async (opts: { silent?: boolean; reset?: boolean } = {}) => {
    try {
      if (!opts.silent) {
        if (opts.reset) setRefreshing(true);
        else setLoading(true);
      }
      setError(null);
      const [s, catalog, h] = await Promise.all([
        fetchLoyaltySummary(),
        fetchLoyaltyCatalog(),
        fetchLoyaltyHistory({ limit: PAGE_SIZE }),
      ]);
      setSummary(s);
      setRules(catalog.earnRules);
      setRewards(catalog.rewards);
      setAchievements(catalog.achievements);
      setHistory(h.docs);
      setHistoryPage(h.page);
      setHistoryMore(h.hasNextPage);
    } catch (e: any) {
      if (!opts.silent) setError(e?.message || 'Failed to load points');
      else toast.error(e?.message || 'Refresh failed — showing saved data');
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

  const refreshCatalog = useCallback(async () => {
    try {
      const [s, catalog] = await Promise.all([fetchLoyaltySummary(), fetchLoyaltyCatalog()]);
      setSummary(s);
      setRules(catalog.earnRules);
      setRewards(catalog.rewards);
      setAchievements(catalog.achievements);
    } catch (e: any) {
      toast.error(e?.message || 'Refresh failed');
    }
  }, []);

  const loadHistoryPage = useCallback(async (nextPage: number, type: HistoryFilter) => {
    try {
      // Keep stale rows on filter change (no false-empty flash): only the
      // inline spinner shows while the first page reloads.
      if (nextPage === 1) setFilteringHistory(true);
      else setLoadingMore(true);
      const h = await fetchLoyaltyHistory({ type, page: nextPage, limit: PAGE_SIZE });
      setHistory((prev) => (nextPage === 1 ? h.docs : [...prev, ...h.docs]));
      setHistoryPage(h.page);
      setHistoryMore(h.hasNextPage);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load history');
    } finally {
      setLoadingMore(false);
      setFilteringHistory(false);
    }
  }, []);

  const handleHistoryFilter = useCallback(
    (t: HistoryFilter) => {
      if (t === historyFilter) return;
      setHistoryFilter(t);
      loadHistoryPage(1, t);
    },
    [loadHistoryPage, historyFilter],
  );

  // Global mutation lock: per-card redeemingId blocks only the same card,
  // so two fast taps on DIFFERENT rewards both passed the stale-balance
  // check and double-burned. While any mutation is in flight, all redeem
  // and claim buttons go inert.
  const mutating = redeemingId != null || claimingId != null;

  const handleRedeem = useCallback(async (r: RewardUI) => {
    if (redeemingId != null || claimingId != null) return;
    setRedeemingId(r.id);
    try {
      const res = await redeemReward(r.id);
      toast.success(`Redeemed! Balance: ${res.newBalance.toLocaleString()} pts${res.claimId ? ' • voucher added to wallet' : ''}`);
      await refreshCatalog();
      await loadHistoryPage(1, historyFilter);
    } catch (e: any) {
      toast.error(e?.message || 'Redeem failed');
    } finally {
      setRedeemingId(null);
    }
  }, [refreshCatalog, loadHistoryPage, historyFilter, redeemingId, claimingId]);

  const handleClaimAchievement = useCallback(
    async (a: AchievementUI) => {
      if (redeemingId != null || claimingId != null) return;
      setClaimingId(a.id);
      try {
        const res = await claimAchievement(a.id);
        toast.success(`+${res.granted.toLocaleString()} pts claimed!`);
        await refreshCatalog();
        // The grant posts a ledger row — refresh history so the +X pts line
        // appears without a manual reload (was: invisible until revisit).
        await loadHistoryPage(1, historyFilter);
      } catch (e: any) {
        toast.error(e?.message || 'Claim failed');
      } finally {
        setClaimingId(null);
      }
    },
    [refreshCatalog, loadHistoryPage, historyFilter, redeemingId, claimingId],
  );

  const filteredRewards = useMemo(() => {
    if (rewardCat === 'all') return rewards;
    return rewards.filter((r) => r.category === rewardCat);
  }, [rewards, rewardCat]);

  if (loading) return <PointsPageSkeleton />;

  if (error && !summary) {
    const noSession = error.includes('LOYALTY_NO_SESSION');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
            <i className={`fas ${noSession ? 'fa-user-lock' : 'fa-exclamation-triangle'} text-red-500 text-xl`} />
          </div>
          <h2 className="text-lg font-extrabold text-gray-900 mb-2">Couldn&apos;t load points</h2>
          <p className="text-sm text-gray-500 mb-5">{noSession ? 'Please sign in to view points.' : error}</p>
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

  if (!summary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
            <i className="fas fa-exclamation-triangle text-red-500 text-xl" />
          </div>
          <h2 className="text-lg font-extrabold text-gray-900 mb-2">Points unavailable</h2>
          <p className="text-sm text-gray-500 mb-5">
            {error ?? 'Your loyalty data could not be shown right now.'}
          </p>
          <button
            onClick={() => loadAll({ reset: true })}
            className="w-full py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            <i className="fas fa-redo mr-2" />
            Try again
          </button>
        </div>
      </div>
    );
  }
  const balance = summary.balance;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="w-full px-3 sm:px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Points & Rewards</h1>
              <p className="text-gray-500 mt-0.5 text-sm">Earn on every order, redeem treats</p>
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

          {/* Balance hero */}
          <div
            className="mt-4 rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #b45309 100%)` }}
          >
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Current Balance</p>
                <p className="text-3xl sm:text-4xl font-extrabold mt-1 tracking-tight">
                  <i className="fas fa-coins mr-2 text-2xl" />
                  {balance.toLocaleString()}
                  <span className="text-base font-bold text-white/70 ml-1">pts</span>
                </p>
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/20 text-[13px]">
                  <span><span className="text-white/70">This month:</span> <b>+{summary.thisMonthEarned.toLocaleString()}</b></span>
                  <span><span className="text-white/70">Lifetime:</span> <b>{summary.lifetimeEarned.toLocaleString()} / {summary.lifetimeRedeemed.toLocaleString()}</b></span>
                </div>
              </div>
              <div className="sm:text-right">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-white/15 border border-white/30">
                  <i className="fas fa-crown" />
                  {summary.tier.name} • {summary.tier.multiplier}x
                </span>
                <p className="text-[11px] text-white/70 mt-1.5">
                  {summary.tier.next
                    ? `${summary.tier.next.ordersToNext} orders to ${summary.tier.next.name}`
                    : 'Top tier reached'}
                </p>
                {summary.tier.next && (
                  <div className="h-1.5 bg-white/20 rounded-full mt-1.5 overflow-hidden sm:w-40">
                    <div className="h-full bg-white rounded-full" style={{ width: `${summary.tier.next.progressPct}%` }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mt-4 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                  tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full px-3 sm:px-4 py-4">
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-base font-extrabold text-gray-900 mb-3">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTab('rewards')}
                  className="py-3 px-4 bg-white text-[#239459] rounded-xl font-bold text-sm border border-[#239459] hover:bg-[#239459] hover:text-white transition-all"
                >
                  <i className="fas fa-gift mr-2" />
                  Browse Rewards
                </button>
                <button
                  onClick={() => setTab('achievements')}
                  className="py-3 px-4 bg-white text-[#239459] rounded-xl font-bold text-sm border border-[#239459] hover:bg-[#239459] hover:text-white transition-all"
                >
                  <i className="fas fa-trophy mr-2" />
                  View Achievements
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-extrabold text-gray-900">Recent Activity</h2>
                <button onClick={() => setTab('history')} className="text-[13px] font-bold hover:opacity-80" style={{ color: BRAND }}>
                  View All
                </button>
              </div>
              {summary.recent.length === 0 && <p className="text-sm text-gray-400 py-2">No activity yet — earn points on delivered orders.</p>}
              {summary.recent.slice(0, 3).map((tx) => {
                const meta = entryMeta(tx.type);
                return (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                      <i className={`${meta.icon} text-xs text-gray-500`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900">
                        {tx.type === 'earn' ? 'Points earned' : tx.type === 'redeem' ? 'Reward redeemed' : 'Points expired'}
                        {tx.orderId ? ` • #${String(tx.orderId).padStart(5, '0')}` : ''}
                      </p>
                      <p className="text-[11px] text-gray-400">{formatDate(tx.createdAt)}</p>
                    </div>
                    <p className={`text-sm font-extrabold ${meta.amountClass}`}>
                      {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-base font-extrabold text-gray-900 mb-3">Ways to Earn</h2>
              {rules.length === 0 && <p className="text-sm text-gray-400">Earn rules coming soon.</p>}
              {rules.map((r) => {
                const { title, detail } = earnRuleLabel(r);
                return (
                  <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-2 last:mb-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${BRAND}1a` }}>
                      <i className="fas fa-coins text-sm" style={{ color: BRAND }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900">{title}</p>
                      <p className="text-[11px] text-gray-500">{detail}</p>
                    </div>
                    <span className="text-[13px] font-extrabold" style={{ color: BRAND }}>
                      {r.event === 'order_delivered' && r.ratePerPeso > 0 ? `${r.ratePerPeso}x` : `+${r.points}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'rewards' && (
          <div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4">
              {REWARD_CATS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setRewardCat(c.id)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold text-[13px] transition-all border ${
                    rewardCat === c.id ? 'text-white shadow-md border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  style={rewardCat === c.id ? { backgroundColor: BRAND } : {}}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {filteredRewards.length === 0 ? (
              <div className="text-center py-10">
                <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                  <div className="w-20 h-20 mx-auto mb-5 bg-gray-50 rounded-full flex items-center justify-center">
                    <i className="fas fa-gift text-2xl text-gray-300" />
                  </div>
                  <h3 className="text-lg font-extrabold text-gray-900 mb-2">No rewards here yet</h3>
                  <p className="text-gray-500 text-sm">New treats land here — keep earning.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {filteredRewards.map((r) => (
                  <RewardCard key={r.id} reward={r} balance={balance} redeemingId={redeemingId} mutating={mutating} onRedeem={handleRedeem} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4">
              {HISTORY_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleHistoryFilter(f.id)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold text-[13px] transition-all border ${
                    historyFilter === f.id ? 'text-white shadow-md border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  style={historyFilter === f.id ? { backgroundColor: BRAND } : {}}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {filteringHistory ? (
                <p className="p-6 text-center text-sm text-gray-400">
                  <i className="fas fa-spinner fa-spin mr-2" />Loading transactions…
                </p>
              ) : (
                <>
              {history.length === 0 && (
                <p className="p-6 text-center text-sm text-gray-400">No transactions yet.</p>
              )}
              {history.map((tx, i) => {
                const meta = entryMeta(tx.type);
                return (
                  <div key={tx.id} className={`flex items-center gap-3 p-4 ${i > 0 ? 'border-t border-gray-100' : ''} hover:bg-gray-50/60`}>
                    <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                      <i className={`${meta.icon} text-sm text-gray-500`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900">
                        {tx.type === 'earn' ? 'Points earned' : tx.type === 'redeem' ? 'Reward redeemed' : 'Points expired'}
                        {tx.orderId ? ` • #${String(tx.orderId).padStart(5, '0')}` : ''}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {formatDate(tx.createdAt)} • Bal {tx.pointsAfter.toLocaleString()} pts
                      </p>
                    </div>
                    <p className={`text-sm font-extrabold ${meta.amountClass}`}>
                      {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString()}
                    </p>
                  </div>
                );
              })}
                </>
              )}
            </div>
            {historyMore && (
              <div className="text-center mt-5">
                <button
                  onClick={() => loadHistoryPage(historyPage + 1, historyFilter)}
                  disabled={loadingMore}
                  className="px-8 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 shadow-sm disabled:opacity-60"
                >
                  {loadingMore ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-chevron-down mr-2" />}
                  Show more
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'achievements' && (
          <div>
            {achievements.length === 0 ? (
              <div className="text-center py-10">
                <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                  <div className="w-20 h-20 mx-auto mb-5 bg-gray-50 rounded-full flex items-center justify-center">
                    <i className="fas fa-trophy text-2xl text-gray-300" />
                  </div>
                  <h3 className="text-lg font-extrabold text-gray-900 mb-2">No challenges yet</h3>
                  <p className="text-gray-500 text-sm">Challenges appear here — complete them for bonus points.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {achievements.map((a) => (
                  <AchievementCard key={a.id} achievement={a} claimingId={claimingId} mutating={mutating} onClaim={handleClaimAchievement} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

}
