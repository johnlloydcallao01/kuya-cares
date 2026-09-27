'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { getCurrentUserIdFromStorage } from '@/lib/client-services/wishlist-service';
import { OrdersPageSkeleton } from '@/components/skeletons/OrdersSkeleton';
import OrderCard from '@/components/orders/OrderCard';
import RateOrderModal from '@/components/orders/RateOrderModal';
import OrderReceiptModal from '@/components/orders/OrderReceiptModal';
import { useCart } from '@/contexts/CartContext';
import {
  cancelOrder,
  copyText,
  fetchCustomerOrders,
  resolveCustomerId,
  submitOrderReview,
} from '@/lib/client-services/order-service';
import {
  formatPHP,
  getStatusMeta,
  ORDER_STATUSES,
  type DateRangeFilter,
  type FulfillmentFilter,
  type OrderUI,
  type SortKey,
} from '@/types/order';

const PAGE_SIZE = 12;
const POLL_MS = 30000;
const BRAND = '#239459';

type StatusFilter = 'all' | (typeof ORDER_STATUSES)[number];

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready_for_pickup', label: 'Ready' },
  { id: 'on_delivery', label: 'On the way' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'highest', label: 'Highest total' },
  { id: 'lowest', label: 'Lowest total' },
];

export default function OrdersPage() {
  const router = useRouter();
  const { addToCart } = useCart();

  const [orders, setOrders] = useState<OrderUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);

  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [fulfillment, setFulfillment] = useState<FulfillmentFilter>('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');

  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderUI | null>(null);
  const [rateTarget, setRateTarget] = useState<OrderUI | null>(null);
  const [rateSubmitting, setRateSubmitting] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<OrderUI | null>(null);

  const tabsRef = useRef<HTMLDivElement | null>(null);
  const userIdRef = useRef<string | number | null>(null);

  const load = useCallback(async (opts: { silent?: boolean; reset?: boolean; pageNum?: number } = {}) => {
    const userId = userIdRef.current ?? getCurrentUserIdFromStorage();
    userIdRef.current = userId;
    if (!userId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    try {
      if (!opts.silent) {
        if ((opts.pageNum ?? 1) > 1) setLoadingMore(true);
        else if (!opts.reset) setLoading(true);
        else setRefreshing(true);
      }
      setError(null);
      const res = await fetchCustomerOrders(userId, {
        limit: 100,
        page: 1,
      });
      setOrders(res.orders);
      setTotalDocs(res.totalDocs || res.orders.length);
      setTotalPages(res.totalPages || 1);
      setPage(1);
    } catch (e: any) {
      setError(e?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh active orders (Shopee/Foodpanda style live status)
  useEffect(() => {
    if (loading) return;
    const t = setInterval(() => {
      const hasActive = orders.some((o) => getStatusMeta(o.status).group === 'active');
      if (hasActive) load({ silent: true });
    }, POLL_MS);
    return () => clearInterval(t);
  }, [loading, orders, load]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const s of ORDER_STATUSES) c[s] = 0;
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const stats = useMemo(() => {
    const active = orders.filter((o) => getStatusMeta(o.status).group === 'active').length;
    const delivered = counts['delivered'] ?? 0;
    const spent = orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((s, o) => s + (Number.isFinite(o.total) ? o.total : 0), 0);
    return { total: orders.length, active, delivered, spent };
  }, [orders, counts]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    let list = orders.filter((o) => {
      if (activeFilter !== 'all' && o.status !== activeFilter) return false;
      if (fulfillment !== 'all' && o.fulfillmentType !== fulfillment) return false;
      if (dateRange !== 'all') {
        const window = dateRange === 'today' ? day : dateRange === '7d' ? 7 * day : 30 * day;
        if (!o.placedAtTs || now - o.placedAtTs > window) return false;
      }
      if (searchQuery) {
        const hay = `${o.orderNumber} ${o.restaurant} ${o.items.map((i) => i.name).join(' ')}`.toLowerCase();
        if (!hay.includes(searchQuery)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === 'newest') return b.placedAtTs - a.placedAtTs;
      if (sort === 'oldest') return a.placedAtTs - b.placedAtTs;
      if (sort === 'highest') return b.total - a.total;
      return a.total - b.total;
    });
    return list;
  }, [orders, activeFilter, fulfillment, dateRange, searchQuery, sort]);

  const visible = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
  const hasMore = visible.length < filtered.length;

  const scrollTabs = (dir: 1 | -1) => {
    tabsRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

  const handleTrack = useCallback(
    (order: OrderUI) => router.push(`/orders/${order.orderId}/tracking`),
    [router],
  );

  const handleCopy = useCallback(async (order: OrderUI) => {
    try {
      await copyText(order.orderNumber);
      toast.success(`${order.orderNumber} copied`);
    } catch {
      toast.error('Copy failed');
    }
  }, []);

  const handleReorder = useCallback(
    async (order: OrderUI) => {
      if (!order.items.length) {
        toast.error('No items to reorder');
        return;
      }
      setReorderingId(order.orderId);
      try {
        let added = 0;
        for (const item of order.items) {
          if (item.productId == null || item.merchantProductId == null || order.merchantId == null) continue;
          try {
            await addToCart({
              merchantId: Number(order.merchantId),
              productId: Number(item.productId),
              merchantProductId: Number(item.merchantProductId),
              quantity: item.quantity,
              priceAtAdd: item.price,
            });
            added += 1;
          } catch {
            /* try next item */
          }
        }
        if (added > 0) {
          toast.success(`${added} item${added === 1 ? '' : 's'} added back to cart`);
          router.push('/carts');
        } else {
          toast.error('Could not reorder — items may be unavailable');
        }
      } finally {
        setReorderingId(null);
      }
    },
    [addToCart, router],
  );

  const confirmCancel = useCallback(async () => {
    if (!cancelTarget) return;
    setCancellingId(cancelTarget.orderId);
    try {
      await cancelOrder(cancelTarget.orderId);
      toast.success('Order cancelled');
      setCancelTarget(null);
      await load({ silent: true });
    } catch (e: any) {
      toast.error(e?.message || 'Cancel failed');
    } finally {
      setCancellingId(null);
    }
  }, [cancelTarget, load]);

  const handleRateSubmit = useCallback(
    async (rating: number, comment: string) => {
      if (!rateTarget) return;
      setRateSubmitting(true);
      try {
        const userId = userIdRef.current ?? getCurrentUserIdFromStorage();
        if (!userId) throw new Error('Please sign in to rate');
        const customerId = await resolveCustomerId(userId);
        if (!customerId) throw new Error('Customer profile not found');
        if (rateTarget.merchantId == null) throw new Error('Merchant not found');
        await submitOrderReview({
          orderId: rateTarget.orderId,
          customerId,
          merchantId: rateTarget.merchantId,
          rating,
          comment,
        });
        toast.success('Thanks for your rating!');
        setRateTarget(null);
      } catch (e: any) {
        toast.error(e?.message || 'Rating failed');
      } finally {
        setRateSubmitting(false);
      }
    },
    [rateTarget],
  );

  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setActiveFilter('all');
    setFulfillment('all');
    setDateRange('all');
    setSort('newest');
  };

  if (loading) return <OrdersPageSkeleton />;

  if (error && orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
            <i className="fas fa-exclamation-triangle text-red-500 text-xl" />
          </div>
          <h2 className="text-lg font-extrabold text-gray-900 mb-2">Couldn&apos;t load orders</h2>
          <p className="text-sm text-gray-500 mb-5">{error}</p>
          <button
            onClick={() => load({ reset: true })}
            className="w-full py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            <i className="fas fa-redo mr-2" />Try again
          </button>
        </div>
      </div>
    );
  }

  const isFiltered = searchQuery !== '' || activeFilter !== 'all' || fulfillment !== 'all' || dateRange !== 'all';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-20">
        <div className="w-full px-3 sm:px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">My Orders</h1>
              <p className="text-gray-500 mt-0.5 text-sm">
                {totalDocs > 0 ? `${totalDocs} order${totalDocs === 1 ? '' : 's'} • ` : ''}Track, reorder & manage
              </p>
            </div>
            <button
              onClick={() => load({ reset: true })}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              <i className={`fas fa-sync-alt ${refreshing ? 'fa-spin' : ''}`} style={{ color: BRAND }} />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </div>

          {/* Stats — Shopee / Lazada style overview */}
          {orders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
              {[
                { label: 'Total orders', value: String(stats.total), icon: 'fa-receipt', bg: 'bg-gray-50', fg: 'text-gray-700' },
                { label: 'Active', value: String(stats.active), icon: 'fa-motorcycle', bg: 'bg-blue-50', fg: 'text-blue-700' },
                { label: 'Delivered', value: String(stats.delivered), icon: 'fa-check-circle', bg: 'bg-green-50', fg: 'text-green-700' },
                { label: 'Total spent', value: formatPHP(stats.spent), icon: 'fa-wallet', bg: 'bg-amber-50', fg: 'text-amber-700' },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-xl px-3 py-2.5 flex items-center gap-2.5`}>
                  <i className={`fas ${s.icon} ${s.fg}`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-extrabold truncate ${s.fg}`}>{s.value}</p>
                    <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status tabs — native scroll (accessible, enterprise) */}
        <div className="border-t border-gray-100">
          <div className="flex items-center">
            <button
              onClick={() => scrollTabs(-1)}
              className="hidden sm:flex px-2 py-3 text-gray-400 hover:text-gray-700"
              aria-label="Scroll tabs left"
            >
              <i className="fas fa-chevron-left text-xs" />
            </button>
            <div ref={tabsRef} className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide px-3 py-2.5">
              {STATUS_TABS.map((t) => {
                const active = activeFilter === t.id;
                const count = counts[t.id] ?? 0;
                return (
                  <button
                    key={t.id}
                    onClick={() => { setActiveFilter(t.id); setPage(1); }}
                    className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold text-[13px] transition-all border ${
                      active
                        ? 'text-white shadow-md border-transparent'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    style={active ? { backgroundColor: BRAND } : {}}
                  >
                    {t.label}
                    <span className={`ml-1.5 text-[11px] font-extrabold ${active ? 'text-white/80' : 'text-gray-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => scrollTabs(1)}
              className="hidden sm:flex px-2 py-3 text-gray-400 hover:text-gray-700"
              aria-label="Scroll tabs right"
            >
              <i className="fas fa-chevron-right text-xs" />
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-3 sm:px-4 py-4">
        {/* Toolbar: search + sort + filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3.5 mb-4">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="flex-1 relative">
              <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="text"
                placeholder="Search by order #, restaurant, or item…"
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
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
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-gray-600">
                <i className="fas fa-sort text-gray-400" />
                <select
                  value={sort}
                  onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2.5 text-[13px] font-bold text-gray-700 outline-none"
                >
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </label>
              <div className="inline-flex bg-gray-50 border border-gray-200 rounded-xl p-1">
                {(['all', 'delivery', 'pickup'] as FulfillmentFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setFulfillment(f); setPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-bold capitalize transition-all ${
                      fulfillment === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {f === 'all' ? 'All types' : f}
                  </button>
                ))}
              </div>
              <div className="inline-flex bg-gray-50 border border-gray-200 rounded-xl p-1">
                {(['all', 'today', '7d', '30d'] as DateRangeFilter[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => { setDateRange(d); setPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                      dateRange === d ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {d === 'all' ? 'Anytime' : d === 'today' ? 'Today' : `Last ${d}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {isFiltered && (
            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                <span className="font-bold text-gray-800">{filtered.length}</span> result{filtered.length === 1 ? '' : 's'}
              </p>
              <button onClick={clearFilters} className="text-xs font-bold hover:opacity-80" style={{ color: BRAND }}>
                <i className="fas fa-times mr-1" />Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* List */}
        {visible.length > 0 ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {visible.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onTrack={handleTrack}
                  onReorder={handleReorder}
                  onRate={(o) => setRateTarget(o)}
                  onCancel={(o) => setCancelTarget(o)}
                  onReceipt={(o) => setReceiptOrder(o)}
                  onCopy={handleCopy}
                  reorderingId={reorderingId}
                  cancellingId={cancellingId}
                />
              ))}
            </div>
            {hasMore && (
              <div className="text-center mt-6">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loadingMore}
                  className="px-8 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 shadow-sm disabled:opacity-60"
                >
                  {loadingMore ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-chevron-down mr-2" />}
                  Show more ({filtered.length - visible.length} left)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <div className="w-20 h-20 mx-auto mb-5 bg-gray-50 rounded-full flex items-center justify-center">
                <i className={`fas ${isFiltered ? 'fa-search' : 'fa-shopping-bag'} text-2xl text-gray-300`} />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 mb-2">
                {isFiltered ? 'No matching orders' : 'No orders yet'}
              </h3>
              <p className="text-gray-500 mb-6 text-sm">
                {isFiltered
                  ? 'Try a different keyword, status, or date range.'
                  : 'Your food orders will appear here. Hungry? Let\'s fix that.'}
              </p>
              {isFiltered ? (
                <button
                  onClick={clearFilters}
                  className="px-6 py-2.5 text-white rounded-xl font-bold text-sm shadow-md hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  Clear filters
                </button>
              ) : (
                <Link
                  href="/merchants"
                  className="inline-block px-6 py-2.5 text-white rounded-xl font-bold text-sm shadow-md hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  <i className="fas fa-utensils mr-2" />Browse restaurants
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cancel confirm */}
      {cancelTarget && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setCancelTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-gray-900 mb-1">Cancel this order?</h3>
            <p className="text-sm text-gray-500 mb-5">
              {cancelTarget.orderNumber} • {cancelTarget.restaurant} • {formatPHP(cancelTarget.total)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCancelTarget(null)}
                className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-200"
              >
                Keep order
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancellingId != null}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-60"
              >
                {cancellingId ? <i className="fas fa-spinner fa-spin mr-2" /> : null}
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {rateTarget && (
        <RateOrderModal
          isOpen
          restaurantName={rateTarget.restaurant}
          orderNumber={rateTarget.orderNumber}
          submitting={rateSubmitting}
          onClose={() => setRateTarget(null)}
          onSubmit={handleRateSubmit}
        />
      )}

      <OrderReceiptModal
        order={receiptOrder}
        onClose={() => setReceiptOrder(null)}
        onTrack={handleTrack}
      />
    </div>
  );
}
