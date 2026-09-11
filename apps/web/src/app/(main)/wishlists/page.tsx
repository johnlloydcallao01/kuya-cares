'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from '@/components/ui/ImageWrapper';
import Link from 'next/link';
import LocationMerchantCard from '@/components/cards/LocationMerchantCard';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  getActiveAddressNamesForMerchants,
  type LocationBasedMerchant,
} from '@encreasl/client-services';
import {
  getWishlistDocsForCurrentUser,
  removeMerchantFromWishlist,
  removeMerchantProductFromWishlist,
  removeWishlistDocById,
  clearWishlistForCurrentUser,
} from '@/lib/client-services/wishlist-service';
import { toast } from 'react-hot-toast';

type WishlistDoc = any;

const formatCurrency = (value: number | null | undefined) => {
  if (value == null) return null;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value));
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

const isMerchantProductDoc = (doc: any) => {
  const itemType = String(doc?.itemType || '').toLowerCase();
  return itemType === 'merchantproduct' || itemType === 'merchant_product' || !!doc?.merchantProduct;
};

const getImageUrl = (media: any): string | null => {
  if (!media) return null;
  return media.cloudinaryURL || media.url || media.thumbnailURL || null;
};

const getProductImageUrl = (product: any): string | null => {
  const primary = product?.media?.primaryImage || null;
  const primaryUrl = getImageUrl(primary);
  if (primaryUrl) return primaryUrl;
  const images = Array.isArray(product?.media?.images) ? product.media.images : [];
  const firstImage = images.length > 0 ? images[0]?.image : null;
  const firstUrl = getImageUrl(firstImage);
  if (firstUrl) return firstUrl;
  return getImageUrl(product?.media?.image || null);
};

export default function WishlistsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [wishlistDocs, setWishlistDocs] = useState<WishlistDoc[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressMap, setAddressMap] = useState<Record<string, string>>({});
  const [etaMap, setEtaMap] = useState<Record<string, string>>({});
  const [enrichedMerchants, setEnrichedMerchants] = useState<Record<string, LocationBasedMerchant>>({});
  const [activeTab, setActiveTab] = useState<'all' | 'merchants' | 'products'>('all');

  const loadWishlist = useCallback(async (options?: { signal?: { cancelled: boolean } }) => {
    const signal = options?.signal;
    setIsLoading(true);
    setError(null);
    try {
      const docs = await getWishlistDocsForCurrentUser();
      if (signal?.cancelled) return;
      setWishlistDocs(docs);
      const baseMerchants: LocationBasedMerchant[] = docs
        .map((doc: any) => {
          if (doc?.merchant?.id) return doc.merchant;
          const mpMerchant = doc?.merchantProduct?.merchant;
          if (mpMerchant?.id) return mpMerchant;
          return null;
        })
        .filter((m: any) => m && m.id) as LocationBasedMerchant[];
      const merchantIds = Array.from(new Set(baseMerchants.map((m) => String(m.id))));
      let merchantMap: Record<string, LocationBasedMerchant> = {};
      try {
        const { getCurrentCustomerId, getLocationBasedMerchants } = await import('@encreasl/client-services');
        const customerId = await getCurrentCustomerId();
        if (customerId) {
          const locationMerchants = await getLocationBasedMerchants({ customerId, limit: 9999 });
          const map: Record<string, LocationBasedMerchant> = {};
          for (const m of locationMerchants) {
            const mid = String((m as any).id);
            if (merchantIds.includes(mid)) {
              map[mid] = m;
            }
          }
          merchantMap = map;
        }
      } catch {
      }
      const effectiveMerchants: LocationBasedMerchant[] = baseMerchants.map((m) => {
        const mid = String(m.id);
        return merchantMap[mid] || m;
      });
      if (!signal?.cancelled) {
        const nextEnriched: Record<string, LocationBasedMerchant> = {};
        effectiveMerchants.forEach((m) => {
          const mid = String((m as any).id);
          nextEnriched[mid] = m;
        });
        setEnrichedMerchants(nextEnriched);
      }
      if (effectiveMerchants.length > 0) {
        const addressNames = await getActiveAddressNamesForMerchants(effectiveMerchants);
        if (!signal?.cancelled) {
          setAddressMap(addressNames);
        }
      } else {
        if (!signal?.cancelled) {
          setAddressMap({});
        }
      }
      if (!signal?.cancelled) {
        const nextEta: Record<string, string> = {};
        effectiveMerchants.forEach((m: any) => {
          const mid = String(m.id);
          const eta =
            (m as any).estimatedDeliveryTime ||
            (m as any).deliverySettings?.estimatedDeliveryTime ||
            '';
          if (eta) nextEta[mid] = String(eta);
        });
        setEtaMap(nextEta);
      }
    } catch (err) {
      if (!signal?.cancelled) {
        setError('Failed to load wishlist. Please try again.');
        setWishlistDocs([]);
        setAddressMap({});
        setEtaMap({});
      }
    } finally {
      if (!signal?.cancelled) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    loadWishlist({ signal });
    return () => {
      signal.cancelled = true;
    };
  }, [loadWishlist]);

  const filteredMerchantDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return wishlistDocs.filter((doc: any) => {
      if (isMerchantProductDoc(doc)) return false;
      if (!doc?.merchant) return false;
      if (!q) return true;
      const merchant = doc.merchant;
      const merchantName = String(
        merchant?.outletName || merchant?.vendor?.businessName || '',
      ).toLowerCase();
      return merchantName.includes(q);
    });
  }, [wishlistDocs, searchQuery]);

  const filteredProductDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return wishlistDocs.filter((doc: any) => {
      if (!isMerchantProductDoc(doc)) return false;
      const merchant =
        doc?.merchant ||
        doc?.merchantProduct?.merchant ||
        doc?.merchantProduct?.merchant_id;
      const product =
        doc?.product ||
        doc?.merchantProduct?.product ||
        doc?.merchantProduct?.product_id;
      if (!merchant || !product) return false;
      if (!q) return true;
      const merchantName = String(
        merchant?.outletName || merchant?.vendor?.businessName || '',
      ).toLowerCase();
      const productName = String(product?.name || '').toLowerCase();
      return merchantName.includes(q) || productName.includes(q);
    });
  }, [wishlistDocs, searchQuery]);

  const handleRemoveFromWishlist = (doc: WishlistDoc) => {
    const merchantId = doc?.merchant?.id ?? doc?.merchant;
    if (!merchantId) return;
    setWishlistDocs((prev) => prev.filter((item: any) => item?.id !== doc?.id));
    (async () => {
      try {
        await removeMerchantFromWishlist(merchantId);
        toast.success('Removed from wishlist', { id: `wishlist-${merchantId}` });
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : 'Failed to update wishlist';
        toast.error(message, { id: `wishlist-${merchantId}-error` });
        await loadWishlist();
      }
    })();
  };

  const handleRemoveProductFromWishlist = (doc: WishlistDoc) => {
    const merchantProduct = doc?.merchantProduct;
    const merchantProductId =
      typeof merchantProduct === 'object' && merchantProduct !== null
        ? merchantProduct.id
        : merchantProduct;
    if (!merchantProductId) return;
    setWishlistDocs((prev) => prev.filter((item: any) => item?.id !== doc?.id));
    (async () => {
      try {
        await removeMerchantProductFromWishlist(merchantProductId);
        toast.success('Removed from wishlist', { id: `wishlist-mp-${merchantProductId}` });
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : 'Failed to update wishlist';
        toast.error(message, { id: `wishlist-mp-${merchantProductId}-error` });
        await loadWishlist();
      }
    })();
  };

  const clearAllWishlist = async () => {
    const docsToRemove = wishlistDocs
      .map((doc: any) => doc?.id)
      .filter((id: any) => id !== null && id !== undefined);
    setWishlistDocs([]);
    setAddressMap({});
    setEtaMap({});
    setEnrichedMerchants({});
    try {
      await clearWishlistForCurrentUser();
      toast.success('Wishlist cleared', { id: 'wishlist-clear' });
    } catch (err) {
      try {
        if (docsToRemove.length > 0) {
          await Promise.all(docsToRemove.map((id: any) => removeWishlistDocById(id)));
          toast.success('Wishlist cleared', { id: 'wishlist-clear' });
          return;
        }
      } catch {}
      const message = err instanceof Error && err.message ? err.message : 'Failed to clear wishlist';
      toast.error(message, { id: 'wishlist-clear-error' });
      await loadWishlist();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const merchantCount = useMemo(
    () =>
      wishlistDocs.filter(
        (doc: any) => doc?.merchant && !isMerchantProductDoc(doc),
      ).length,
    [wishlistDocs],
  );

  const productCount = useMemo(
    () =>
      wishlistDocs.filter(
        (doc: any) => isMerchantProductDoc(doc),
      ).length,
    [wishlistDocs],
  );

  const showMerchants = activeTab !== 'products';
  const showProducts = activeTab !== 'merchants';
  const visibleMerchantDocs = showMerchants ? filteredMerchantDocs : [];
  const visibleProductDocs = showProducts ? filteredProductDocs : [];
  const visibleCount = visibleMerchantDocs.length + visibleProductDocs.length;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white shadow-sm">
        <div className="w-full px-2.5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                My Wishlists
              </h1>
              <div className="mt-1 text-sm text-gray-600">
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 w-28" />
                  </span>
                ) : (
                  <>
                    {merchantCount} restaurants, {productCount} items saved
                  </>
                )}
              </div>
            </div>
            {merchantCount + productCount > 0 && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={clearAllWishlist}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <i className="fas fa-trash mr-2"></i>
                  Clear Wishlist
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white">
        <div className="w-full px-2.5 py-3">
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <input
              type="text"
              placeholder="Search your wishlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 text-sm"
              style={{ '--tw-ring-color': '#eba236' } as any}
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-white rounded-r-lg px-3 hover:opacity-90 transition-colors"
                style={{ backgroundColor: '#eba236' }}
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-[#eba236] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('merchants')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'merchants'
                  ? 'bg-[#eba236] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Merchants
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'products'
                  ? 'bg-[#eba236] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Food Items
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-2.5 py-4">
        {isLoading ? (
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
        ) : error ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-50 rounded-full flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-3xl text-red-400"></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Failed to load wishlist
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
          </div>
        ) : visibleCount === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <i className="fas fa-heart text-3xl text-gray-400"></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No wishlist items found' : 'Your wishlist is empty'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Start adding your favorites!'}
            </p>
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="text-white px-6 py-3 rounded-lg hover:opacity-90 transition-colors font-medium"
                style={{ backgroundColor: '#eba236' }}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {visibleMerchantDocs.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Restaurants
                  </h2>
                  <span className="text-sm text-gray-500">
                    {visibleMerchantDocs.length} saved
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visibleMerchantDocs.map((doc: any) => {
                    if (!doc?.merchant) return null;
                    const baseMerchant = doc.merchant;
                    const merchantId = String(baseMerchant.id);
                    const enriched = enrichedMerchants[merchantId];
                    const sourceMerchant = (enriched as any) || (baseMerchant as any);
                    const merchantWithEta = {
                      ...sourceMerchant,
                      estimatedDeliveryTime:
                        etaMap[merchantId] ||
                        (sourceMerchant as any).estimatedDeliveryTime ||
                        (sourceMerchant as any).deliverySettings?.estimatedDeliveryTime ||
                        '',
                    };
                    return (
                      <LocationMerchantCard
                        key={`wishlist-merchant-${doc.id}`}
                        merchant={merchantWithEta as any}
                        isWishlisted={true}
                        onToggleWishlist={() => handleRemoveFromWishlist(doc)}
                        addressName={addressMap[merchantId] || null}
                      />
                    );
                  })}
                </div>
              </div>
            )}
            {visibleProductDocs.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Food Items
                  </h2>
                  <span className="text-sm text-gray-500">
                    {visibleProductDocs.length} saved
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visibleProductDocs.map((doc: any) => {
                    const merchant =
                      doc?.merchant ||
                      doc?.merchantProduct?.merchant ||
                      doc?.merchantProduct?.merchant_id;
                    const product =
                      doc?.product ||
                      doc?.merchantProduct?.product ||
                      doc?.merchantProduct?.product_id;
                    if (!merchant || !product) return null;
                    const merchantSlugId = buildMerchantSlugId(merchant);
                    const productSlugId = `${toSlug(product?.name)}-${product?.id}`;
                    const href = `/merchant/${merchantSlugId}/${productSlugId}`;
                    const imageUrl = getProductImageUrl(product);
                    const price = formatCurrency(product?.basePrice ?? null);
                    const compareAt = formatCurrency(
                      product?.compareAtPrice ?? null,
                    );
                    return (
                      <div
                        key={`wishlist-product-${doc.id}`}
                        className="bg-white rounded-lg shadow-sm overflow-hidden"
                      >
                        <Link href={href} className="block">
                          <div className="relative aspect-square bg-gray-100">
                            {imageUrl ? (
                              <Image
                                src={imageUrl}
                                alt={product?.name || 'Product'}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                No image
                              </div>
                            )}
                            <button
                              type="button"
                              aria-label="Remove from wishlist"
                              aria-pressed={true}
                              onClick={(e) => {
                                e.preventDefault();
                                handleRemoveProductFromWishlist(doc);
                              }}
                              className="absolute top-2 right-2 w-[28px] h-[28px] rounded-full bg-white flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
                              style={{ zIndex: 2 }}
                            >
                              <i className="fas fa-heart text-[16px]" style={{ color: "#f3a823", WebkitTextStroke: "2px #333" }}></i>
                            </button>
                          </div>
                          <div className="p-4">
                            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                              {product?.name}
                            </h3>
                            <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                              {merchant?.outletName ||
                                merchant?.vendor?.businessName ||
                                ''}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              {price && (
                                <span className="text-base font-bold text-gray-900">
                                  {price}
                                </span>
                              )}
                              {compareAt &&
                                product?.compareAtPrice >
                                  (product?.basePrice ?? 0) && (
                                  <span className="text-sm text-gray-500 line-through">
                                    {compareAt}
                                  </span>
                                )}
                            </div>
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
