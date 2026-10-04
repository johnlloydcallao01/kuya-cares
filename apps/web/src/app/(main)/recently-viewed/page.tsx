'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from '@/components/ui/ImageWrapper';
import Link from 'next/link';
import LocationMerchantCard from '@/components/cards/LocationMerchantCard';
import {
  getActiveAddressNamesForMerchants,
  getLocationBasedMerchants,
  getCurrentCustomerId,
  type LocationBasedMerchant,
} from '@encreasl/client-services';
import {
  getWishlistMerchantIdsForCurrentUser,
  addMerchantToWishlist,
  removeMerchantFromWishlist,
} from '@/lib/client-services/wishlist-service';
import { MerchantClientService } from '@encreasl/client-services';
import { toast } from 'react-hot-toast';

type RecentViewDoc = any;

// Hoisted (§docs/performance.md §4b item 1 — kill per-row CPU): one shared
// formatter instead of `new Intl.NumberFormat` per card per render.
const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});

const formatCurrency = (value: number | null | undefined) => {
  if (value == null) return null;
  return phpFormatter.format(Number(value));
};

const toSlug = (name: string | null | undefined): string => {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return base || 'item';
};

const buildMerchantSlugId = (merchant: any): string => {
  const baseName =
    merchant?.outletName ||
    merchant?.vendor?.businessName ||
    String(merchant?.id || '');
  const slug = String(baseName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  const idPart = String(merchant?.id || '').trim();
  return idPart ? `${slug}-${idPart}` : slug || 'merchant';
};

// Short-TTL list cache (§docs/performance.md §4 cache wrapper, client-side
// analogue): the 40-doc depth=2 history is per-user and revalidates on
// every mount with zero sharing. Coalesce concurrent mounts onto one fetch
// and reuse rows for 2 minutes; mutations bust it (write-through).
const RECENT_VIEWS_TTL_MS = 2 * 60 * 1000;
const recentViewsCache = new Map<string, { data: RecentViewDoc[]; ts: number }>();
const recentViewsInflight = new Map<string, Promise<RecentViewDoc[]>>();

function bustRecentViewsCache(userId: string | number | null | undefined): void {
  if (userId == null) return;
  recentViewsCache.delete(String(userId));
}

function readStoredUserId(): string | number | null {
  if (typeof window === 'undefined') return null;
  const userStr = window.localStorage.getItem('grandline_auth_user');
  if (!userStr) return null;
  try {
    const id = JSON.parse(userStr)?.id;
    return typeof id === 'number' || typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

function MerchantTile({
  doc,
  merchantDetailsMap,
  etaMap,
  addressMap,
  wishlistIds,
  onToggleWishlist,
}: {
  doc: RecentViewDoc;
  merchantDetailsMap: Record<string, any>;
  etaMap: Record<string, string>;
  addressMap: Record<string, string>;
  wishlistIds: Set<string>;
  onToggleWishlist: (id: string) => void;
}) {
  const baseMerchant = doc.merchant;
  const merchantId = String(baseMerchant.id);
  const detailedMerchant = merchantDetailsMap[merchantId] || baseMerchant;
  const merchantWithEta = {
    ...detailedMerchant,
    estimatedDeliveryTime:
      etaMap[merchantId] ||
      detailedMerchant.estimatedDeliveryTime ||
      detailedMerchant.deliverySettings?.estimatedDeliveryTime ||
      '',
  };
  return (
    <LocationMerchantCard
      key={`merchant-${doc.id}`}
      merchant={merchantWithEta as any}
      isWishlisted={wishlistIds.has(merchantId)}
      onToggleWishlist={() => onToggleWishlist(merchantId)}
      addressName={addressMap[String(detailedMerchant.id)] || null}
    />
  );
}

function ProductTile({ doc }: { doc: RecentViewDoc }) {
  const merchant = doc?.merchant || doc?.merchantProduct?.merchant_id;
  const product = doc?.product || doc?.merchantProduct?.product_id;
  if (!merchant || !product) return null;
  const merchantSlugId = buildMerchantSlugId(merchant);
  const productSlugId = `${toSlug(product?.name)}-${product?.id}`;
  const href = `/merchant/${merchantSlugId}/${productSlugId}`;
  const primaryImage =
    product?.media?.primaryImage || product?.media?.image || null;
  const imageUrl =
    primaryImage?.cloudinaryURL ||
    primaryImage?.url ||
    primaryImage?.thumbnailURL ||
    null;
  const price = formatCurrency(product?.basePrice ?? null);
  const compareAt = formatCurrency(product?.compareAtPrice ?? null);
  return (
    <div
      key={`product-${doc.id}`}
      className="bg-white rounded-lg shadow-sm overflow-hidden"
    >
      <Link href={href}>
        <div className="relative aspect-square bg-gray-100">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product?.name || 'Product'}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 300px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              No image
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
            {product?.name}
          </h3>
          <p className="mt-1 text-xs text-gray-500 line-clamp-1">
            {merchant?.outletName || merchant?.vendor?.businessName || ''}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {price && (
              <span className="text-base font-bold text-gray-900">{price}</span>
            )}
            {compareAt &&
              product?.compareAtPrice > (product?.basePrice ?? 0) && (
                <span className="text-sm text-gray-500 line-through">
                  {compareAt}
                </span>
              )}
          </div>
        </div>
      </Link>
    </div>
  );
}

async function fetchRecentViews(
  apiBase: string,
  headers: Record<string, string>,
  userId: string | number,
): Promise<RecentViewDoc[]> {
  const key = String(userId);
  const hit = recentViewsCache.get(key);
  if (hit && Date.now() - hit.ts <= RECENT_VIEWS_TTL_MS) return hit.data;
  const running = recentViewsInflight.get(key);
  if (running) return running;
  const p = (async (): Promise<RecentViewDoc[]> => {
    try {
      const url =
        `${apiBase}/recent-views?where[user][equals]=${encodeURIComponent(key)}` +
        `&sort=-lastViewedAt&limit=40&depth=2`;
      const res = await fetch(url, { headers, cache: 'no-store' });
      if (!res.ok) return hit?.data ?? [];
      const data = await res.json();
      const docs = Array.isArray(data?.docs) ? data.docs : [];
      recentViewsCache.set(key, { data: docs, ts: Date.now() });
      return docs;
    } catch {
      return hit?.data ?? [];
    } finally {
      recentViewsInflight.delete(key);
    }
  })();
  recentViewsInflight.set(key, p);
  return p;
}

export default function RecentlyViewedPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentViews, setRecentViews] = useState<RecentViewDoc[]>([]);
  // Start true (§docs/performance.md §14 — never serve blank): first commit
  // paints the skeleton instead of an empty grid flashing into content.
  const [isLoading, setIsLoading] = useState(true);
  const [addressMap, setAddressMap] = useState<Record<string, string>>({});
  const [etaMap, setEtaMap] = useState<Record<string, string>>({});
  const [merchantDetailsMap, setMerchantDetailsMap] = useState<Record<string, any>>({});
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      try {
        const userStr =
          typeof window !== 'undefined'
            ? window.localStorage.getItem('grandline_auth_user')
            : null;
        const userId = userStr
          ? (() => {
              try {
                return JSON.parse(userStr)?.id;
              } catch {
                return null;
              }
            })()
          : null;
        if (!userId) {
          if (!cancelled) {
            setRecentViews([]);
            setAddressMap({});
            setEtaMap({});
            setIsLoading(false);
          }
          return;
        }
        const API_BASE =
          process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
        if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
        // Cached + coalesced (§4): repeat visits within TTL skip the
        // 40-doc depth=2 refetch entirely.
        const docs = await fetchRecentViews(API_BASE, headers, userId);
        if (cancelled) return;
        setRecentViews(docs);
        // Paint the grid NOW — enrichment maps (details / addresses / ETA)
        // stream in below without holding the skeleton (§24: skeleton only
        // on true first paint; background work never re-flashes it).
        setIsLoading(false);
        if (docs.length === 0) {
          setAddressMap({});
          setEtaMap({});
          return;
        }
          const uniqueMerchantIds: string[] = Array.from(
            new Set<string>(
              docs
                .filter(
                  (doc: any) =>
                    doc?.itemType === 'merchant' && doc?.merchant && doc.merchant.id,
                )
                .map((doc: any) => String(doc.merchant.id)),
            ),
          );
          const merchantDocs: LocationBasedMerchant[] = docs
            .filter(
              (doc: any) =>
                doc?.itemType === 'merchant' && doc?.merchant,
            )
            .map((doc: any) => {
              const m = doc.merchant as any;
              const estimatedDeliveryTime =
                m.estimatedDeliveryTime ||
                m.deliverySettings?.estimatedDeliveryTime ||
                '';
              return {
                ...m,
                estimatedDeliveryTime,
              } as LocationBasedMerchant;
            });
          // Enrichment fan-out (§docs/performance.md §4): details (bounded,
          // cached, singleflight) + per-merchant address names + ETA sidecar
          // run concurrently — the old code awaited all three sequentially
          // (details serially, one await per merchant).
          const DETAILS_CONCURRENCY = 5;
          const fetchDetails = (async () => {
            if (uniqueMerchantIds.length === 0) return;
            const queue = [...uniqueMerchantIds];
            const entries: [string, any][] = [];
            const workers = Array.from(
              { length: Math.min(DETAILS_CONCURRENCY, queue.length) },
              async () => {
                while (queue.length > 0) {
                  const id = queue.shift() as string;
                  try {
                    const full = await MerchantClientService.getMerchantById(id);
                    if (full) entries.push([id, full]);
                  } catch {}
                }
              },
            );
            await Promise.all(workers);
            if (!cancelled && entries.length > 0) {
              setMerchantDetailsMap((prev) => {
                const next = { ...prev };
                for (const [id, full] of entries) {
                  next[id] = full;
                }
                return next;
              });
            }
          })();
          const fetchAddresses = (async () => {
            if (merchantDocs.length === 0) {
              if (!cancelled) setAddressMap({});
              return;
            }
            try {
              const map =
                await getActiveAddressNamesForMerchants(merchantDocs);
              if (!cancelled) setAddressMap(map);
            } catch {
              if (!cancelled) setAddressMap({});
            }
          })();
          const fetchEta = (async () => {
            if (merchantDocs.length === 0) {
              if (!cancelled) setEtaMap({});
              return;
            }
            try {
              const customerId = await getCurrentCustomerId();
              if (!customerId) {
                if (!cancelled) setEtaMap({});
                return;
              }
              // Bounded sidecar: page holds ≤40 recent docs, so a 100-row
              // location pool covers the ETA join (was: hardcoded 200).
              // Shared singleflight cache coalesces with homepage/header.
              const locationMerchants = await getLocationBasedMerchants({
                customerId,
                limit: 100,
              });
              const nextEtaMap: Record<string, string> = {};
              for (const m of locationMerchants) {
                if (m.estimatedDeliveryTime) {
                  nextEtaMap[String(m.id)] = m.estimatedDeliveryTime;
                }
              }
              if (!cancelled) setEtaMap(nextEtaMap);
            } catch {
              if (!cancelled) setEtaMap({});
            }
          })();
          // Fire-and-forget: maps stream into state as each branch settles.
          // The grid is already painted (isLoading=false above), so the slow
          // ETA pool + backfill never gate first paint.
          void Promise.allSettled([fetchDetails, fetchAddresses, fetchEta]);
      } catch {
        if (!cancelled) {
          setRecentViews([]);
          setAddressMap({});
          setEtaMap({});
          setIsLoading(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const ids = await getWishlistMerchantIdsForCurrentUser();
        if (cancelled) return;
        const setIds = new Set<string>(ids.map((v) => String(v)));
        setWishlistIds(setIds);
      } catch {
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleWishlist = React.useCallback((id: string | number) => {
    const idStr = String(id);
    setWishlistIds(prev => {
      const next = new Set(prev);
      const willAdd = !next.has(idStr);
      if (willAdd) {
        next.add(idStr);
      } else {
        next.delete(idStr);
      }
      (async () => {
        try {
          if (willAdd) {
            await addMerchantToWishlist(id);
            toast.success('Added to wishlist', { id: `wishlist-${idStr}` });
          } else {
            await removeMerchantFromWishlist(id);
            toast.success('Removed from wishlist', { id: `wishlist-${idStr}` });
          }
        } catch (err) {
          setWishlistIds(current => {
            const rollback = new Set(current);
            if (willAdd) {
              rollback.delete(idStr);
            } else {
              rollback.add(idStr);
            }
            return rollback;
          });
          const message = err instanceof Error && err.message ? err.message : 'Wishlist update failed';
          toast.error(message, { id: `wishlist-${idStr}-error` });
        }
      })();
      return next;
    });
  }, []);

  const filterOptions = useMemo(() => {
    const total = recentViews.length;
    const restaurantCount = recentViews.filter(
      (doc) => doc?.itemType === 'merchant' && doc?.merchant,
    ).length;
    const foodCount = recentViews.filter(
      (doc) =>
        doc?.itemType === 'merchant_product' &&
        (doc?.product || doc?.merchantProduct),
    ).length;
    return [
      { id: 'all', label: 'All Items', count: total },
      { id: 'restaurants', label: 'Restaurants', count: restaurantCount },
      { id: 'food_items', label: 'Food Items', count: foodCount },
    ];
  }, [recentViews]);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return recentViews.filter((doc) => {
      const itemType = doc?.itemType;
      const isMerchant = itemType === 'merchant' && doc?.merchant;
      const isProduct =
        itemType === 'merchant_product' &&
        (doc?.product || doc?.merchantProduct);
      if (
        activeFilter === 'restaurants' &&
        !isMerchant
      ) {
        return false;
      }
      if (
        activeFilter === 'food_items' &&
        !isProduct
      ) {
        return false;
      }
      if (!q) return true;
      const merchant = doc?.merchant || doc?.merchantProduct?.merchant_id;
      const product = doc?.product || doc?.merchantProduct?.product_id;
      const merchantName = String(
        merchant?.outletName ||
          merchant?.vendor?.businessName ||
          '',
      ).toLowerCase();
      const productName = String(product?.name || '').toLowerCase();
      const text = `${merchantName} ${productName}`;
      if (!text.trim()) return false;
      return text.includes(q);
    });
  }, [recentViews, activeFilter, searchQuery]);

  // Single-pass split (§4b: no double map with return-null): the 'all' view
  // rendered filteredDocs twice and mounted empty sections.
  const { merchantTiles, productTiles } = useMemo(() => {
    const merchants: RecentViewDoc[] = [];
    const products: RecentViewDoc[] = [];
    for (const doc of filteredDocs) {
      if (doc?.itemType === 'merchant' && doc?.merchant) merchants.push(doc);
      else if (
        doc?.itemType === 'merchant_product' &&
        (doc?.product || doc?.merchantProduct)
      )
        products.push(doc);
    }
    return { merchantTiles: merchants, productTiles: products };
  }, [filteredDocs]);

  const handleRemoveFromHistory = async (docId: number | string) => {
    setRecentViews((prev) => prev.filter((doc) => doc?.id !== docId));
    // Write-through (§4 step 7 analogue): the cached list no longer matches
    // the server, so drop it — next mount refetches instead of flashing stale.
    bustRecentViewsCache(readStoredUserId());
    try {
      const API_BASE =
        process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
      await fetch(`${API_BASE}/recent-views/${docId}`, {
        method: 'DELETE',
        headers,
      });
    } catch {}
  };

  const clearAllHistory = async () => {
    setRecentViews([]);
    // Write-through: cleared history must not resurrect from cache.
    bustRecentViewsCache(readStoredUserId());
    try {
      const userStr =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('grandline_auth_user')
          : null;
      const userId = userStr
        ? (() => {
            try {
              return JSON.parse(userStr)?.id;
            } catch {
              return null;
            }
          })()
        : null;
      if (!userId) return;
      const API_BASE =
        process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
      const url = `${API_BASE}/recent-views?where[user][equals]=${encodeURIComponent(
        String(userId),
      )}`;
      await fetch(url, {
        method: 'DELETE',
        headers,
      });
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white shadow-sm">
        <div className="w-full px-2.5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Recently Viewed</h1>
              <p className="text-gray-600 mt-1 text-base">Items you&apos;ve recently browsed</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={clearAllHistory}
                className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm"
              >
                <i className="fas fa-trash mr-2"></i>
                Clear History
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-2.5 py-4">
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="Search recently viewed items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {filterOptions.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                    activeFilter === filter.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                  <span className="ml-1 text-xs opacity-75">({filter.count})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading && recentViews.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="group cursor-pointer animate-pulse">
                <div className="relative aspect-[2/1] bg-gray-200 rounded-lg overflow-hidden mb-3">
                  <div className="w-full h-full bg-gray-300"></div>
                  <div className="absolute top-2 left-2 bg-gray-300 rounded-full px-2 py-1">
                    <div className="h-3 w-12 bg-gray-400 rounded"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredDocs.length > 0 ? (
          activeFilter === 'all' ? (
            <div className="space-y-10">
              {merchantTiles.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">
                    Recently viewed restaurants
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {merchantTiles.map((doc) => (
                      <MerchantTile
                        key={`merchant-${doc.id}`}
                        doc={doc}
                        merchantDetailsMap={merchantDetailsMap}
                        etaMap={etaMap}
                        addressMap={addressMap}
                        wishlistIds={wishlistIds}
                        onToggleWishlist={toggleWishlist}
                      />
                    ))}
                  </div>
                </div>
              )}
              {productTiles.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">
                    Recently viewed food items
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {productTiles.map((doc) => (
                      <ProductTile key={`product-${doc.id}`} doc={doc} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {merchantTiles.map((doc) => (
                <MerchantTile
                  key={`merchant-${doc.id}`}
                  doc={doc}
                  merchantDetailsMap={merchantDetailsMap}
                  etaMap={etaMap}
                  addressMap={addressMap}
                  wishlistIds={wishlistIds}
                  onToggleWishlist={toggleWishlist}
                />
              ))}
              {productTiles.map((doc) => (
                <ProductTile key={`product-${doc.id}`} doc={doc} />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <i className="fas fa-history text-3xl text-gray-400"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {searchQuery ? 'No items found' : 'No recently viewed items'}
              </h3>
              <p className="text-gray-600 mb-6 text-base">
                {searchQuery
                  ? 'Try adjusting your search or filter criteria'
                  : 'Items you browse will appear here for easy access'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-md"
                >
                  Clear Search
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
