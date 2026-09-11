'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from '@/components/ui/ImageWrapper';
import ProductStickyHeader from '@/components/merchant/ProductStickyHeader';
import ProductModifiers from '@/components/merchant/ProductModifiers';
import { Skeleton } from '@/components/ui/Skeleton';
import { Product, ModifierGroup, ModifierOption } from '@/types/product';
import { useCart } from '@/contexts/CartContext';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import {
  addMerchantProductToWishlist,
  getWishlistMerchantProductIdsForCurrentUser,
  removeMerchantProductFromWishlist,
} from '@/lib/client-services/wishlist-service';

interface ProductDetailClientProps {
  merchantSlugId: string;
  productId: string;
}

function formatPrice(value: number | null): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value));
}

function getImageUrl(media: any): string | null {
  if (!media) return null;
  return media.cloudinaryURL || media.url || media.thumbnailURL || null;
}

export default function ProductDetailClient({ merchantSlugId, productId }: ProductDetailClientProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showCartBar, setShowCartBar] = useState(false);
  const [modifierSelection, setModifierSelection] = useState<Record<string, string[]>>({});
  const [modifierError, setModifierError] = useState<string | null>(null);
  const [merchantProductId, setMerchantProductId] = useState<number | null>(null);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const wishlistRequestInFlight = useRef(false);
  const queuedWishlistState = useRef<boolean | null>(null);
  const { addToCart, items } = useCart();
  const router = useRouter();
  const basePrice = product?.basePrice ?? null;
  const compareAtPrice = product?.compareAtPrice ?? null;
  const merchantIdNum = merchantSlugId ? Number(merchantSlugId.split('-').pop() || '') : NaN;
  const productIdNum = Number(productId);

  const hasInvalidModifiers = React.useMemo(() => {
    if (!product || !product.modifierGroups || product.modifierGroups.length === 0) {
      return false;
    }
    for (const group of product.modifierGroups) {
      const selectedIds = modifierSelection[group.id] || [];
      const count = selectedIds.length;
      if (group.is_required && count === 0) {
        return true;
      }
      if (group.min_selections > 0 && count < group.min_selections) {
        return true;
      }
      if (typeof group.max_selections === 'number' && count > group.max_selections) {
        return true;
      }
    }
    return false;
  }, [product, modifierSelection]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const anyWindow = window as any;
    anyWindow.__tap2goProductDetailHasInvalidModifiers = hasInvalidModifiers;
    window.dispatchEvent(
      new CustomEvent('tap2go:productDetail:validation', {
        detail: { hasInvalidModifiers },
      }),
    );
  }, [hasInvalidModifiers]);

  const handleAddToCart = useCallback(
    (quantityOverride?: number) => {
      if (hasInvalidModifiers) {
        setModifierError('Please review your selections for required options.');
        return;
      }

      const selectedModifierPayload: any[] = [];
      if (product && product.modifierGroups && product.modifierGroups.length > 0) {
        for (const group of product.modifierGroups) {
          const selectedIds = modifierSelection[group.id] || [];
          const options = group.options || [];
          selectedIds.forEach((id) => {
            const opt = options.find((o) => o.id === id);
            if (!opt) return;
            selectedModifierPayload.push({
              groupId: group.id,
              groupName: group.name,
              isRequired: group.is_required,
              optionId: opt.id,
              name: opt.name,
              price: opt.price_adjustment || 0,
            });
          });
        }
      }

      const slug = merchantSlugId || '';
      const merchantId = slug ? Number(slug.split('-').pop() || '') : NaN;
      if (!merchantId || Number.isNaN(merchantId)) return;
      const numericProductId = Number(productId);
      if (!numericProductId || Number.isNaN(numericProductId)) return;

      const effectiveQuantity =
        typeof quantityOverride === 'number' && !Number.isNaN(quantityOverride)
          ? quantityOverride
          : quantity;

      setShowCartBar(true);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;

      const run = async () => {
        try {
          const url = `${API_BASE}/merchant-products?where[merchant_id][equals]=${merchantId}&where[product_id][equals]=${numericProductId}&limit=1`;
          const res = await fetch(url, { headers, cache: 'no-store' });
          if (!res.ok) return;
          const data = await res.json();
          const doc = Array.isArray(data?.docs) && data.docs.length > 0 ? data.docs[0] : null;
          const merchantProductId =
            (doc && (typeof doc.id === 'number' ? doc.id : Number(doc.id))) || null;
          if (!merchantProductId) return;

          await addToCart({
            merchantId,
            productId: numericProductId,
            merchantProductId,
            quantity: effectiveQuantity,
            priceAtAdd: basePrice ?? 0,
            compareAtPrice: compareAtPrice ?? null,
            selectedModifiers:
              selectedModifierPayload.length > 0 ? selectedModifierPayload : null,
          });
        } catch {}
      };

      run();
    },
    [addToCart, basePrice, compareAtPrice, hasInvalidModifiers, merchantSlugId, product, productId, quantity, router],
  );

  useEffect(() => {
    setShowCartBar(false);
  }, [merchantSlugId, productId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (typeof window === 'undefined') return;
        const userStr = window.localStorage.getItem('grandline_auth_user');
        const userId = userStr
          ? (() => {
              try {
                return JSON.parse(userStr)?.id;
              } catch {
                return null;
              }
            })()
          : null;
        if (!merchantIdNum || Number.isNaN(merchantIdNum)) return;
        if (!productIdNum || Number.isNaN(productIdNum)) return;
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
        if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
        const mpUrl = `${API_BASE}/merchant-products?where[merchant_id][equals]=${merchantIdNum}&where[product_id][equals]=${productIdNum}&limit=1`;
        const mpRes = await fetch(mpUrl, { headers, cache: 'no-store' });
        if (!mpRes.ok) return;
        const mpData = await mpRes.json();
        const mpDoc =
          Array.isArray(mpData?.docs) && mpData.docs.length > 0 ? mpData.docs[0] : null;
        const merchantProductId =
          (mpDoc &&
            (typeof mpDoc.id === 'number' ? mpDoc.id : Number(mpDoc.id))) ||
          null;
        if (!merchantProductId) return;
        setMerchantProductId(merchantProductId);
        if (!userId) return;
        const body = JSON.stringify({
          user: userId,
          itemType: 'merchant_product',
          merchant: merchantIdNum,
          merchantProduct: merchantProductId,
          product: productIdNum,
          source: 'web',
        });
        const res = await fetch(`${API_BASE}/recent-views`, {
          method: 'POST',
          headers,
          body,
        });
        if (cancelled || res.ok) return;
        const compositeKey = `${userId}:merchant_product:${merchantIdNum}:${merchantProductId}`;
        const existsUrl = `${API_BASE}/recent-views?where[compositeKey][equals]=${encodeURIComponent(
          compositeKey,
        )}&limit=1`;
        const getRes = await fetch(existsUrl, { headers });
        if (!getRes.ok) return;
        const data = await getRes.json();
        const id = data?.docs?.[0]?.id;
        if (!id) return;
        await fetch(`${API_BASE}/recent-views/${id}`, {
          method: 'PATCH',
          headers,
          body: '{}',
        });
      } catch {}
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [merchantSlugId, productId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!merchantProductId) {
          setIsWishlisted(false);
          return;
        }
        const ids = await getWishlistMerchantProductIdsForCurrentUser();
        if (cancelled) return;
        const setIds = new Set(ids.map((v) => String(v)));
        setIsWishlisted(setIds.has(String(merchantProductId)));
      } catch {}
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [merchantProductId]);

  const performWishlistUpdate = useCallback(
    async (desired: boolean) => {
      if (!merchantProductId || !merchantIdNum || Number.isNaN(merchantIdNum) || !productIdNum || Number.isNaN(productIdNum)) {
        toast.error('Unable to update wishlist');
        return;
      }
      try {
        if (desired) {
          await addMerchantProductToWishlist({
            merchantId: merchantIdNum,
            productId: productIdNum,
            merchantProductId,
          });
          toast.success('Added to wishlist', { id: `wishlist-mp-${merchantProductId}` });
        } else {
          await removeMerchantProductFromWishlist(merchantProductId);
          toast.success('Removed from wishlist', { id: `wishlist-mp-${merchantProductId}` });
        }
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : 'Wishlist update failed';
        toast.error(message, { id: `wishlist-mp-${merchantProductId}-error` });
        try {
          const ids = await getWishlistMerchantProductIdsForCurrentUser();
          const setIds = new Set(ids.map((v) => String(v)));
          setIsWishlisted(setIds.has(String(merchantProductId)));
        } catch {}
      }
    },
    [merchantIdNum, merchantProductId, productIdNum],
  );

  const flushWishlistUpdate = useCallback(
    async (desired: boolean) => {
      if (wishlistRequestInFlight.current) {
        queuedWishlistState.current = desired;
        return;
      }
      wishlistRequestInFlight.current = true;
      let nextDesired: boolean | null = desired;
      while (nextDesired !== null) {
        queuedWishlistState.current = null;
        await performWishlistUpdate(nextDesired);
        nextDesired = queuedWishlistState.current;
      }
      wishlistRequestInFlight.current = false;
    },
    [performWishlistUpdate],
  );

  const toggleWishlist = useCallback(() => {
    if (!merchantProductId || !merchantIdNum || Number.isNaN(merchantIdNum) || !productIdNum || Number.isNaN(productIdNum)) {
      toast.error('Unable to update wishlist');
      return;
    }
    setIsWishlisted((prev) => {
      const desired = !prev;
      flushWishlistUpdate(desired);
      return desired;
    });
  }, [flushWishlistUpdate, merchantIdNum, merchantProductId, productIdNum]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const anyWindow = window as any;
    anyWindow.__tap2goProductDetailAddToCart = async (q?: number) => {
      await handleAddToCart(q);
    };
    return () => {
      if (typeof window === 'undefined') return;
      const w = window as any;
      if (w.__tap2goProductDetailAddToCart) {
        delete w.__tap2goProductDetailAddToCart;
      }
    };
  }, [handleAddToCart]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
    if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;

    const fetchProduct = async () => {
      try {
        // 1. Fetch Product
        const productRes = await fetch(`${API_BASE}/products/${productId}?depth=2`, {
          headers,
          signal: controller.signal,
        });

        if (!productRes.ok) throw new Error('Failed to load product');
        const productData: Product = await productRes.json();

        if (!active) return;

        // 2. Fetch Modifier Groups
        const groupsRes = await fetch(`${API_BASE}/modifier-groups?where[product_id][equals]=${productId}&limit=100&sort=sort_order`, {
          headers,
          signal: controller.signal,
        });

        let modifierGroups: ModifierGroup[] = [];
        if (groupsRes.ok) {
          const groupsData = await groupsRes.json();
          modifierGroups = groupsData.docs || [];
        }

        // 3. Fetch Modifier Options
        if (modifierGroups.length > 0) {
          const groupIds = modifierGroups.map(g => g.id).join(',');
          const optionsRes = await fetch(`${API_BASE}/modifier-options?where[modifier_group_id][in]=${groupIds}&limit=500&sort=sort_order`, {
            headers,
            signal: controller.signal,
          });

          let allOptions: ModifierOption[] = [];
          if (optionsRes.ok) {
            const optionsData = await optionsRes.json();
            allOptions = optionsData.docs || [];
          }

          // 4. Associate Options with Groups
          modifierGroups = modifierGroups.map(group => ({
            ...group,
            options: allOptions.filter(opt => {
              const groupId = typeof opt.modifier_group_id === 'object' && opt.modifier_group_id !== null
                ? (opt.modifier_group_id as any).id
                : opt.modifier_group_id;
              return groupId === group.id;
            })
          }));
        }

        setProduct({
          ...productData,
          modifierGroups,
        });
      } catch (err: any) {
        if (active) {
          setError(err.message || 'An error occurred');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchProduct();

    return () => {
      active = false;
      controller.abort();
    };
  }, [productId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <ProductStickyHeader
          fallbackHref={`/merchant/${merchantSlugId}`}
          isWishlisted={isWishlisted}
          onToggleWishlist={toggleWishlist}
        />
        {/* Hero Skeleton */}
        <div className="relative w-full aspect-[72/26] lg:aspect-[72/20] -mt-12 lg:-mt-12 bg-gray-200 animate-pulse" />
        
        <div className="w-full px-4 pb-8 pt-5">
          <div className="max-w-2xl mx-auto">
             {/* Title Skeleton */}
            <div className="mb-6 space-y-4">
               <Skeleton className="h-8 w-3/4" />
               <Skeleton className="h-8 w-1/4" />
               <Skeleton className="h-4 w-full" />
               <Skeleton className="h-4 w-5/6" />
            </div>
            
             {/* Modifiers Skeleton */}
            <div className="space-y-8 mt-8">
               {[1, 2].map((i) => (
                  <div key={i} className="pt-6 border-t border-gray-100">
                     <Skeleton className="h-6 w-1/3 mb-4" />
                     <div className="space-y-3">
                        {[1, 2, 3].map((j) => (
                           <Skeleton key={j} className="h-12 w-full rounded-lg" />
                        ))}
                     </div>
                  </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ProductStickyHeader fallbackHref={`/merchant/${merchantSlugId}`} />
        <div className="w-full px-2.5 py-6 pt-20">
          <div className="bg-white rounded-lg shadow-sm p-5 text-center">
             <p className="text-red-600">{error || 'Failed to load product'}</p>
             <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
             >
                Retry
             </button>
          </div>
        </div>
      </div>
    );
  }

  const primaryImage = getImageUrl(product.media?.primaryImage);
  const name = product.name || '';
  const shortDescription = product.shortDescription ?? null;

  const slugForCart = merchantSlugId || '';
  const merchantIdForCart = slugForCart ? Number(slugForCart.split('-').pop() || '') : NaN;
  const numericProductIdForCart = Number(productId);

  let currentQuantity = 0;
  let currentSubtotal = 0;
  let currentMerchantName = '';

  if (
    merchantIdForCart &&
    !Number.isNaN(merchantIdForCart) &&
    numericProductIdForCart &&
    !Number.isNaN(numericProductIdForCart)
  ) {
    for (const item of items) {
      if (item.merchant === merchantIdForCart && item.product === numericProductIdForCart) {
        currentQuantity += item.quantity;
        currentSubtotal += item.subtotal;
        if (!currentMerchantName && item.merchantName) {
          currentMerchantName = item.merchantName;
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <ProductStickyHeader
        fallbackHref={`/merchant/${merchantSlugId}`}
        isWishlisted={isWishlisted}
        onToggleWishlist={toggleWishlist}
      />
      <div className="relative w-full aspect-[72/26] lg:aspect-[72/20] -mt-12 lg:-mt-12">
        {primaryImage ? (
          <Image src={primaryImage} alt={name} fill className="object-cover" priority />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-100">No image</div>
        )}
      </div>

      <div className="w-full px-4 pb-8 pt-5">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <div className="hidden md:block mb-4">
              {showCartBar && currentQuantity > 0 ? (
                <button
                  type="button"
                  className="w-full flex items-center justify-between rounded-full px-4 py-2 text-white shadow-md"
                  style={{ backgroundColor: '#f61b73' }}
                  onClick={() => {
                    if (merchantIdForCart && !Number.isNaN(merchantIdForCart)) {
                      router.push(`/carts/${merchantIdForCart}` as any);
                    } else {
                      router.push('/carts' as any);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full border border-white flex items-center justify-center text-sm font-semibold">
                      {currentQuantity}
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-semibold">View your cart</span>
                      {currentMerchantName && (
                        <span className="text-xs opacity-90 line-clamp-1">
                          {currentMerchantName}
                        </span>
                      )}
                    </div>
                  </div>
                  {formatPrice(currentSubtotal) && (
                    <span className="text-sm font-semibold">
                      {formatPrice(currentSubtotal)}
                    </span>
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                      className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-700"
                    >
                      <span className="text-lg leading-none">−</span>
                    </button>
                    <span className="mx-3 text-base font-medium text-gray-900">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQuantity((prev) => Math.min(99, prev + 1))}
                      className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-700"
                    >
                      <span className="text-lg leading-none">+</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={hasInvalidModifiers}
                    className="h-11 px-6 rounded-full font-semibold text-white text-sm shadow-md hover:shadow-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#eba236' }}
                    onClick={() => {
                      if (!hasInvalidModifiers) {
                        handleAddToCart();
                      } else {
                        setModifierError('Please review your selections for required options.');
                      }
                    }}
                  >
                    Add to cart
                  </button>
                </div>
              )}
            </div>
            {modifierError && (
              <p className="mt-2 text-sm text-red-600">{modifierError}</p>
            )}
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{name}</h1>
            <div className="mt-3 flex items-baseline gap-3">
              {formatPrice(basePrice) && (
                <span className="text-2xl font-bold text-gray-900">{formatPrice(basePrice)}</span>
              )}
              {formatPrice(compareAtPrice) && (compareAtPrice as number) > (basePrice ?? 0) && (
                <span className="text-base text-gray-500 line-through">{formatPrice(compareAtPrice)}</span>
              )}
            </div>
            {shortDescription && (
              <p className="mt-4 text-gray-600 leading-relaxed whitespace-pre-line">{shortDescription}</p>
            )}
          </div>

          {product.modifierGroups && product.modifierGroups.length > 0 && (
            <ProductModifiers
              modifierGroups={product.modifierGroups}
              selected={modifierSelection}
              onChange={(next) => {
                setModifierSelection(next);
                if (modifierError) {
                  setModifierError(null);
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
