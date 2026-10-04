'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Image from '@/components/ui/ImageWrapper';
import ProductStickyHeader from '@/components/merchant/ProductStickyHeader';
import ProductModifiers from '@/components/merchant/ProductModifiers';
import { Skeleton } from '@/components/ui/Skeleton';
import { Product, ModifierGroup, ModifierOption, ProductVariation, GroupedChild } from '@/types/product';
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
  let url = media.cloudinaryURL || media.url || media.thumbnailURL || null;
  if (url && !url.startsWith('http') && !url.startsWith('data:')) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
    const baseUrl = apiUrl.replace(/\/api\/?$/, '');
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    url = `${baseUrl}${normalizedUrl}`;
  }
  return url;
}

const PAYMONGO_MINIMUM_AMOUNT_PHP = 1;

function buildDefaultModifierSelection(groups: ModifierGroup[]): Record<string, string[]> {
  return groups.reduce<Record<string, string[]>>((acc, group) => {
    const defaultOptions = (group.options || []).filter((option) => option.is_default);
    if (defaultOptions.length === 0) return acc;
    if (group.selection_type === 'single') {
      acc[group.id] = [defaultOptions[0].id];
      return acc;
    }
    acc[group.id] = defaultOptions.map((option) => option.id);
    return acc;
  }, {});
}

function mapEffectiveGroups(rawGroups: any[]): ModifierGroup[] {
  return (rawGroups || []).map((group: any) => ({
    id: String(group.id),
    name: group.name,
    selection_type: group.selectionType === 'multiple' ? 'multiple' : 'single',
    is_required: Boolean(group.isRequired),
    min_selections: typeof group.minSelections === 'number' ? group.minSelections : 0,
    max_selections: typeof group.maxSelections === 'number' ? group.maxSelections : undefined,
    sort_order: typeof group.sortOrder === 'number' ? group.sortOrder : 0,
    product_id: String(group.baseGroupId ?? group.id),
    options: (group.options || []).map((option: any) => ({
      id: String(option.id),
      name: option.name,
      price_adjustment: typeof option.priceAdjustment === 'number' ? option.priceAdjustment : 0,
      is_default: Boolean(option.isDefault),
      is_available: option.isAvailable !== false,
      sort_order: typeof option.sortOrder === 'number' ? option.sortOrder : 0,
      modifier_group_id: String(group.id),
    })),
  }));
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
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [priceOverride, setPriceOverride] = useState<number | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [selectedVariationId, setSelectedVariationId] = useState<string | number | null>(null);
  // Grouped-bundle staging (mobile parity: ProductScreen grouped composer).
  // Children come from prod-grouped-items (public read); availability comes
  // from one batched merchant-products lookup below.
  const [groupedItems, setGroupedItems] = useState<GroupedChild[]>([]);
  const [groupedLoading, setGroupedLoading] = useState(false);
  const [stagedGroupedIds, setStagedGroupedIds] = useState<Set<string>>(new Set());
  const [stagingBusy, setStagingBusy] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const wishlistRequestInFlight = useRef(false);
  const queuedWishlistState = useRef<boolean | null>(null);
  const { addToCart, items } = useCart();
  const router = useRouter();
  const isVariableProduct = product?.productType === 'variable';
  const isGroupedProduct = product?.productType === 'grouped';
  const selectedVariation = React.useMemo(() => {
    if (!product || !isVariableProduct || variations.length === 0) return null;
    if (selectedVariationId != null) {
      const matched = variations.find((v) => String(v.id) === String(selectedVariationId));
      if (matched) return matched;
    }
    return variations[0] || null;
  }, [isVariableProduct, product, selectedVariationId, variations]);
  // Mobile parity (services/product.ts): merchant override wins, else selected
  // variation price, else parent basePrice (null for variable parents).
  const basePrice = priceOverride ?? selectedVariation?.base_price ?? product?.basePrice ?? null;
  const compareAtPrice = selectedVariation?.compare_at_price ?? product?.compareAtPrice ?? null;
  const effectiveDescription =
    selectedVariation?.short_description || product?.shortDescription || '';
  const isSelectedVariationOutOfStock =
    !!isVariableProduct &&
    !!selectedVariation &&
    typeof selectedVariation.stock_quantity === 'number' &&
    selectedVariation.stock_quantity <= 0;
  const hasVariationChoices = !!isVariableProduct && variations.length > 0;
  const cannotAddVariableProduct =
    !!isVariableProduct &&
    (!selectedVariation || variations.length === 0 || isSelectedVariationOutOfStock);
  const selectedVariationSummary = selectedVariation
    ? (selectedVariation.attributeItems || [])
        .map((item) => `${item.attributeName}: ${item.termName}`)
        .filter(Boolean)
        .join(' • ')
    : '';
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
      // Optional groups do not block when nothing is selected (mobile parity:
      // ProductScreen hasInvalidModifiers). Only enforce min once selecting.
      if (group.min_selections > 0 && count > 0 && count < group.min_selections) {
        return true;
      }
      if (typeof group.max_selections === 'number' && count > group.max_selections) {
        return true;
      }
    }
    return false;
  }, [product, modifierSelection]);

  const totalPrice = React.useMemo(() => {
    if (!product) return 0;
    let price = basePrice ?? 0;
    for (const group of product.modifierGroups || []) {
      const selectedIds = modifierSelection[group.id] || [];
      for (const opt of group.options || []) {
        if (selectedIds.includes(opt.id)) price += opt.price_adjustment || 0;
      }
    }
    return price * quantity;
  }, [product, modifierSelection, quantity, basePrice]);

  const isBelowPayMongoMinimum = totalPrice < PAYMONGO_MINIMUM_AMOUNT_PHP;
  const isUnavailable = isAvailable === false;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const anyWindow = window as any;
    anyWindow.__kuyaCaresProductDetailHasInvalidModifiers = hasInvalidModifiers;
    // Full gate snapshot for the sticky mobile footer (mobile parity: the
    // footer Add mirrors the desktop button's disabled state + live total).
    // Placed after totalPrice/isUnavailable declarations (hook order + TDZ).
    anyWindow.__kuyaCaresProductDetailGate = {
      hasInvalidModifiers,
      cannotAddVariableProduct,
      isUnavailable: isUnavailable || isSelectedVariationOutOfStock,
      isBelowPayMongoMinimum,
      isAdding: isAddingToCart,
      isGroupedProduct,
      totalPrice,
    };
    window.dispatchEvent(
      new CustomEvent('kuyaCares:productDetail:validation', {
        detail: {
          hasInvalidModifiers,
          cannotAddVariableProduct,
          isUnavailable: isUnavailable || isSelectedVariationOutOfStock,
          isBelowPayMongoMinimum,
          isAdding: isAddingToCart,
          isGroupedProduct,
          totalPrice,
        },
      }),
    );
  }, [hasInvalidModifiers, cannotAddVariableProduct, isUnavailable, isSelectedVariationOutOfStock, isBelowPayMongoMinimum, isAddingToCart, isGroupedProduct, totalPrice]);

  const handleAddToCart = useCallback(
    (quantityOverride?: number) => {
      // Grouped parents are never added directly (mobile parity) — children
      // are staged below and bulk-added instead.
      if (isGroupedProduct) {
        toast.error('Select grouped items below to add them together.');
        return;
      }
      if (isUnavailable) {
        toast.error('This item is currently unavailable from this merchant.');
        return;
      }
      if (hasInvalidModifiers) {
        setModifierError('Please review your selections for required options.');
        return;
      }
      if (isBelowPayMongoMinimum) {
        setModifierError(
          'This item configuration is below the PayMongo minimum of PHP 1.00.',
        );
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

      if (!Number.isFinite(effectiveQuantity) || effectiveQuantity < 1) return;
      if (!product) {
        toast.error('Product not loaded yet.');
        return;
      }
      if (cannotAddVariableProduct) {
        toast.error(
          hasVariationChoices
            ? 'Please choose an available variation before adding this item.'
            : 'This variable product has no available variations yet.',
        );
        return;
      }

      const run = async () => {
        setIsAddingToCart(true);
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
        if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
        try {
          const url = `${API_BASE}/merchant-products?where[merchant_id][equals]=${merchantId}&where[product_id][equals]=${numericProductId}&limit=1`;
          const res = await fetch(url, { headers, cache: 'no-store' });
          if (!res.ok) {
            toast.error('Failed to resolve merchant product.');
            return;
          }
          const data = await res.json();
          const doc = Array.isArray(data?.docs) && data.docs.length > 0 ? data.docs[0] : null;
          const resolvedMerchantProductId =
            (doc && (typeof doc.id === 'number' ? doc.id : Number(doc.id))) || null;
          if (!resolvedMerchantProductId) {
            toast.error('Merchant product details not found.');
            return;
          }
          const override =
            typeof doc.price_override === 'number' ? doc.price_override : null;
          if (doc.is_available === false) {
            setIsAvailable(false);
            toast.error('This item is currently unavailable from this merchant.');
            return;
          }

          await addToCart({
            merchantId,
            productId: numericProductId,
            merchantProductId: resolvedMerchantProductId,
            quantity: effectiveQuantity,
            priceAtAdd: override ?? selectedVariation?.base_price ?? basePrice ?? 0,
            compareAtPrice: selectedVariation?.compare_at_price ?? compareAtPrice ?? null,
            selectedModifiers:
              selectedModifierPayload.length > 0 ? selectedModifierPayload : null,
            selectedVariation: selectedVariation
              ? { relationTo: 'prod-variations', value: selectedVariation.id }
              : null,
          });
          setShowCartBar(true);
          toast.success('Added to cart');
        } catch {
          toast.error('Failed to add to cart.');
        } finally {
          setIsAddingToCart(false);
        }
      };

      run();
    },
    [addToCart, basePrice, cannotAddVariableProduct, compareAtPrice, hasInvalidModifiers, hasVariationChoices, isBelowPayMongoMinimum, isGroupedProduct, isUnavailable, merchantSlugId, product, productId, quantity, selectedVariation],
  );

  // ---------- grouped-bundle staging (mobile parity) ----------
  const isGroupedChildStageable = useCallback(
    (c: GroupedChild): boolean =>
      c.productType === 'simple' && c.merchantProductId != null && c.isAvailable,
    [],
  );

  const stagedGrouped = useMemo(
    () => groupedItems.filter((c) => stagedGroupedIds.has(c.key)),
    [groupedItems, stagedGroupedIds],
  );
  const stagedGroupedCount = stagedGrouped.length;
  const stagedGroupedUnits = useMemo(
    () => stagedGrouped.reduce((s, c) => s + (c.defaultQuantity || 0), 0),
    [stagedGrouped],
  );
  const stagedGroupedSubtotal = useMemo(
    () =>
      stagedGrouped.reduce((s, c) => s + (Number(c.basePrice ?? 0) * (c.defaultQuantity || 1)), 0),
    [stagedGrouped],
  );
  const eligibleGrouped = useMemo(
    () => groupedItems.filter((c) => isGroupedChildStageable(c)),
    [groupedItems, isGroupedChildStageable],
  );
  const needsCustomizationCount = useMemo(
    () => groupedItems.filter((c) => c.isAvailable && !isGroupedChildStageable(c)).length,
    [groupedItems, isGroupedChildStageable],
  );
  const unavailableGroupedCount = useMemo(
    () => groupedItems.filter((c) => !c.isAvailable).length,
    [groupedItems],
  );

  const toggleStagedGrouped = useCallback((key: string) => {
    setStagedGroupedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAllEligibleGrouped = useCallback(() => {
    setStagedGroupedIds(new Set(eligibleGrouped.map((c) => c.key)));
  }, [eligibleGrouped]);

  const resetStagedGrouped = useCallback(() => {
    setStagedGroupedIds(new Set());
  }, []);

  const openGroupedChild = useCallback(
    (c: GroupedChild) => {
      const slug = String(c.name || 'item')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      router.push(`/merchant/${merchantSlugId}/${slug}-${c.productId}` as any);
    },
    [router, merchantSlugId],
  );

  const handleAddGroupedToCart = useCallback(async () => {
    if (stagedGrouped.length === 0 || stagingBusy) return;
    setStagingBusy(true);
    try {
      let added = 0;
      let skipped = 0;
      for (const child of stagedGrouped) {
        if (!Number.isFinite(merchantIdNum) || child.merchantProductId == null) {
          skipped += 1;
          continue;
        }
        try {
          await addToCart({
            merchantId: merchantIdNum,
            productId: Number(child.productId),
            merchantProductId: Number(child.merchantProductId),
            quantity: child.defaultQuantity || 1,
            priceAtAdd: Number(child.basePrice ?? 0),
            compareAtPrice: child.compareAtPrice ?? null,
            selectedModifiers: [],
          });
          added += 1;
        } catch {
          skipped += 1;
        }
      }
      if (added > 0) {
        setStagedGroupedIds(new Set());
        setShowCartBar(true);
        toast.success(
          skipped > 0
            ? `${added} item${added === 1 ? '' : 's'} added, ${skipped} unavailable skipped`
            : `${added} item${added === 1 ? '' : 's'} added to cart`,
        );
      } else {
        toast.error('Could not add grouped items — they may be unavailable.');
      }
    } finally {
      setStagingBusy(false);
    }
  }, [stagedGrouped, stagingBusy, addToCart, merchantIdNum]);

  useEffect(() => {
    setShowCartBar(false);
    setSelectedVariationId(null);
    setVariations([]);
    setGroupedItems([]);
    setStagedGroupedIds(new Set());
  }, [merchantSlugId, productId]);

  // Grouped children (mobile parity: services/product grouped fetch).
  // prod-grouped-items is public-read; one batched merchant-products lookup
  // resolves availability + merchantProductId per child.
  useEffect(() => {
    if (!isGroupedProduct || !product || !Number.isFinite(productIdNum) || !Number.isFinite(merchantIdNum)) {
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setGroupedLoading(true);
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
        if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
        const gUrl = `${API_BASE}/prod-grouped-items?where[parent_product_id][equals]=${productIdNum}&sort=sort_order&limit=100&depth=1`;
        const gRes = await fetch(gUrl, { headers, cache: 'no-store', signal: controller.signal });
        if (!gRes.ok) throw new Error(String(gRes.status));
        const gData = await gRes.json();
        const rows: any[] = Array.isArray(gData?.docs) ? gData.docs : [];
        const childIds = rows
          .map((r: any) => (typeof r?.child_product_id === 'object' ? r.child_product_id?.id : r?.child_product_id))
          .filter((id: any) => id != null);
        const mpByProduct = new Map<string, any>();
        if (childIds.length > 0) {
          try {
            const mpUrl = `${API_BASE}/merchant-products?where[merchant_id][equals]=${merchantIdNum}&where[product_id][in]=${childIds.join(',')}&limit=${childIds.length}&depth=0`;
            const mpRes = await fetch(mpUrl, { headers, cache: 'no-store', signal: controller.signal });
            if (mpRes.ok) {
              const mpData = await mpRes.json();
              for (const mp of (Array.isArray(mpData?.docs) ? mpData.docs : [])) {
                const pid = typeof mp?.product_id === 'object' ? mp.product_id?.id : mp?.product_id;
                if (pid != null) mpByProduct.set(String(pid), mp);
              }
            }
          } catch {
            /* availability unknown — children still list, add resolves later */
          }
        }
        if (cancelled) return;
        const mapped: GroupedChild[] = rows.map((r: any, i: number) => {
          const child = (typeof r?.child_product_id === 'object' && r.child_product_id) || null;
          const cid = child?.id ?? r?.child_product_id;
          const mp = cid != null ? mpByProduct.get(String(cid)) : null;
          const media = child?.media?.primaryImage || null;
          return {
            key: String(cid ?? `row-${i}`),
            productId: cid,
            name: child?.name || 'Item',
            shortDescription: child?.shortDescription || null,
            basePrice: typeof child?.basePrice === 'number' ? child.basePrice : null,
            compareAtPrice: typeof child?.compareAtPrice === 'number' ? child.compareAtPrice : null,
            productType: String(child?.productType || 'simple'),
            imageUrl: media?.cloudinaryURL || media?.url || media?.thumbnailURL || null,
            defaultQuantity: Number(r?.default_quantity) > 0 ? Math.floor(Number(r.default_quantity)) : 1,
            merchantProductId: mp && mp.id != null ? mp.id : null,
            isAvailable: mp ? mp.is_available !== false && mp.is_active !== false : true,
          };
        });
        setGroupedItems(mapped);
      } catch {
        if (!cancelled) setGroupedItems([]);
      } finally {
        if (!cancelled) setGroupedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isGroupedProduct, product?.id, productIdNum, merchantIdNum]);

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
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
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
    anyWindow.__kuyaCaresProductDetailAddToCart = async (q?: number) => {
      await handleAddToCart(q);
    };
    return () => {
      if (typeof window === 'undefined') return;
      const w = window as any;
      if (w.__kuyaCaresProductDetailAddToCart) {
        delete w.__kuyaCaresProductDetailAddToCart;
      }
    };
  }, [handleAddToCart]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
    if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;

    const fetchProduct = async () => {
      try {
        const merchantId = merchantSlugId ? Number(merchantSlugId.split('-').pop() || '') : NaN;

        // 1. Merchant-context fetch (mobile parity: fetchProductWithMerchantContext).
        // Resolves price_override + is_available + merchantProductId in one depth=2 call.
        let productData: Product | null = null;
        let override: number | null = null;
        let available = true;
        let resolvedMpId: number | null = null;

        if (merchantId && !Number.isNaN(merchantId)) {
          const mpRes = await fetch(
            `${API_BASE}/merchant-products?where[product_id][equals]=${productId}&where[merchant_id][equals]=${merchantId}&depth=2&limit=1`,
            { headers, signal: controller.signal },
          );
          if (mpRes.ok) {
            const mpData = await mpRes.json();
            const mpDoc = Array.isArray(mpData?.docs) && mpData.docs.length > 0 ? mpData.docs[0] : null;
            if (mpDoc && mpDoc.product_id && typeof mpDoc.product_id === 'object') {
              productData = mpDoc.product_id as Product;
              override = typeof mpDoc.price_override === 'number' ? mpDoc.price_override : null;
              available = mpDoc.is_available ?? true;
              resolvedMpId = typeof mpDoc.id === 'number' ? mpDoc.id : Number(mpDoc.id);
            }
          }
        }

        // Fallback to direct product fetch (no merchant context).
        if (!productData) {
          const productRes = await fetch(`${API_BASE}/products/${productId}?depth=2`, {
            headers,
            signal: controller.signal,
          });
          if (!productRes.ok) throw new Error('Failed to load product');
          productData = (await productRes.json()) as Product;
        }

        if (!active) return;
        setPriceOverride(override);
        setIsAvailable(available);
        if (resolvedMpId) setMerchantProductId(resolvedMpId);

        // 1b. Variations for variable parents (mobile parity:
        // services/product.ts prod-variations + prod-variation-values).
        let loadedVariations: ProductVariation[] = [];
        let defaultVariationId: string | number | null = null;
        if ((productData as Product).productType === 'variable') {
          try {
            const varRes = await fetch(
              `${API_BASE}/prod-variations?where[product_id][equals]=${productId}&where[is_visible][equals]=true&limit=100&sort=sort_order&depth=1`,
              { headers, signal: controller.signal },
            );
            if (varRes.ok) {
              const varData = await varRes.json();
              const rawVariations: any[] = varData.docs || [];
              const variationIds = rawVariations.map((v: any) => v?.id).filter((id: any) => id !== undefined);
              const valueMap = new Map<string, ProductVariation['attributeItems']>();
              if (variationIds.length > 0) {
                const valuesRes = await fetch(
                  `${API_BASE}/prod-variation-values?where[variation_id][in]=${variationIds.join(',')}&limit=500&depth=2`,
                  { headers, signal: controller.signal },
                );
                if (valuesRes.ok) {
                  const valuesData = await valuesRes.json();
                  for (const item of valuesData.docs || []) {
                    const vKey = item?.variation_id
                      ? String(typeof item.variation_id === 'object' ? item.variation_id.id : item.variation_id)
                      : '';
                    const attribute = item?.attribute_id;
                    const term = item?.term_id;
                    if (!vKey || !attribute || !term) continue;
                    const getId = (v: any) => (typeof v === 'object' && v !== null ? v.id : v);
                    const existing = valueMap.get(vKey) || [];
                    existing.push({
                      attributeId: getId(attribute),
                      attributeName: attribute?.name || 'Option',
                      attributeSlug: attribute?.slug,
                      attributeType: attribute?.type,
                      termId: getId(term),
                      termName: term?.name || '',
                      termSlug: term?.slug,
                      termValue: term?.value,
                    });
                    valueMap.set(vKey, existing);
                  }
                }
              }
              loadedVariations = rawVariations.map((v: any) => {
                const attributeItems = valueMap.get(String(v.id)) || [];
                return {
                  id: v.id,
                  name:
                    v.name ||
                    attributeItems.map((i) => i.termName).filter(Boolean).join(' / ') ||
                    (productData as Product).name,
                  sku: v.sku,
                  base_price: typeof v.base_price === 'number' ? v.base_price : 0,
                  compare_at_price: v.compare_at_price ?? null,
                  stock_quantity: v.stock_quantity,
                  short_description: v.short_description || undefined,
                  image: v.image
                    ? {
                        id: String(v.image.id ?? ''),
                        url: v.image.url,
                        cloudinaryURL: v.image.cloudinaryURL,
                        thumbnailURL: v.image.thumbnailURL,
                        alt: v.image.alt,
                      }
                    : null,
                  attributeItems,
                  attributes: attributeItems.reduce<Record<string, string>>((acc, item) => {
                    if (item.attributeName && item.termName) acc[item.attributeName] = item.termName;
                    return acc;
                  }, {}),
                } as ProductVariation;
              });
              const firstInStock = loadedVariations.find(
                (v) => typeof v.stock_quantity === 'number' && v.stock_quantity > 0,
              );
              defaultVariationId = firstInStock?.id ?? loadedVariations[0]?.id ?? null;
            }
          } catch {}
        }
        if (!active) return;
        setVariations(loadedVariations);
        setSelectedVariationId(defaultVariationId);

        // 2. Effective modifiers first (merchant-aware), fallback to legacy groups/options.
        let modifierGroups: ModifierGroup[] = [];
        const effQuery = new URLSearchParams({ productId: String(productId) });
        if (defaultVariationId != null) effQuery.set('variationId', String(defaultVariationId));
        if (merchantId && !Number.isNaN(merchantId)) effQuery.set('merchantId', String(merchantId));
        try {
          const effRes = await fetch(`${API_BASE}/effective-modifiers?${effQuery.toString()}`, {
            headers,
            signal: controller.signal,
          });
          if (effRes.ok) {
            const effData = await effRes.json();
            modifierGroups = mapEffectiveGroups(effData?.data?.groups || []);
          }
        } catch {}

        // Legacy fallback when effective-modifiers is unavailable/empty.
        if (modifierGroups.length === 0) {
          const groupsRes = await fetch(`${API_BASE}/modifier-groups?where[product_id][equals]=${productId}&limit=100&sort=sort_order`, {
            headers,
            signal: controller.signal,
          });

          if (groupsRes.ok) {
            const groupsData = await groupsRes.json();
            modifierGroups = groupsData.docs || [];
          }

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
        }

        setProduct({
          ...(productData as Product),
          basePrice: override ?? (productData as Product).basePrice ?? 0,
          isAvailable: available,
          merchantProductId: resolvedMpId ?? undefined,
          modifierGroups,
          variations: loadedVariations.length > 0 ? loadedVariations : undefined,
          defaultVariationId: defaultVariationId ?? undefined,
        });
        setModifierSelection(buildDefaultModifierSelection(modifierGroups));
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
  }, [productId, merchantSlugId]);

  // Refetch merchant-aware effective modifiers when the selected variation
  // changes (mobile parity: ProductScreen loadEffectiveModifiers).
  useEffect(() => {
    if (!product || product.productType !== 'variable' || !selectedVariationId) return;
    let cancelled = false;
    const controller = new AbortController();
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
    if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
    const merchantId = merchantSlugId ? Number(merchantSlugId.split('-').pop() || '') : NaN;
    const run = async () => {
      try {
        const effQuery = new URLSearchParams({
          productId: String(productId),
          variationId: String(selectedVariationId),
        });
        if (merchantId && !Number.isNaN(merchantId)) effQuery.set('merchantId', String(merchantId));
        const effRes = await fetch(`${API_BASE}/effective-modifiers?${effQuery.toString()}`, {
          headers,
          signal: controller.signal,
        });
        if (!effRes.ok || cancelled) return;
        const effData = await effRes.json();
        const groups = mapEffectiveGroups(effData?.data?.groups || []);
        setProduct((prev) => (prev ? { ...prev, modifierGroups: groups } : prev));
        setModifierSelection(buildDefaultModifierSelection(groups));
      } catch {}
    };
    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [product?.id, product?.productType, selectedVariationId, merchantSlugId, productId]);

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

  const primaryImage = selectedVariation?.image
    ? getImageUrl(selectedVariation.image)
    : getImageUrl(product.media?.primaryImage);
  const name = product.name || '';
  const shortDescription = effectiveDescription || null;

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
                    disabled={hasInvalidModifiers || isUnavailable || cannotAddVariableProduct || isBelowPayMongoMinimum || isAddingToCart || isGroupedProduct}
                    className="h-11 px-6 rounded-full font-semibold text-white text-sm shadow-md hover:shadow-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#239459' }}
                    onClick={() => {
                      if (isGroupedProduct) {
                        toast.error('Select grouped items below to add them together.');
                        return;
                      }
                      if (!hasInvalidModifiers && !isUnavailable && !cannotAddVariableProduct && !isBelowPayMongoMinimum) {
                        handleAddToCart();
                      } else if (isUnavailable || isSelectedVariationOutOfStock) {
                        toast.error('This item is currently unavailable from this merchant.');
                      } else if (cannotAddVariableProduct) {
                        toast.error('Please choose an available variation before adding this item.');
                      } else {
                        setModifierError('Please review your selections for required options.');
                      }
                    }}
                  >
                    {isAddingToCart
                      ? 'Adding…'
                      : isGroupedProduct
                        ? 'Select items below'
                        : isUnavailable || isSelectedVariationOutOfStock
                          ? 'Unavailable'
                          : `Add to cart${formatPrice(totalPrice) ? ` • ${formatPrice(totalPrice)}` : ''}`}
                  </button>
                </div>
              )}
            </div>
            {modifierError && (
              <p className="mt-2 text-sm text-red-600">{modifierError}</p>
            )}
            {!modifierError && isBelowPayMongoMinimum && (
              <p className="mt-2 text-sm text-red-600">
                Below the PayMongo minimum of PHP 1.00.
              </p>
            )}
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{name}</h1>
            {isUnavailable && (
              <p className="mt-2 text-sm font-medium text-red-600">
                Currently unavailable from this merchant.
              </p>
            )}
            <div className="mt-3 flex items-baseline gap-3">
              {formatPrice(basePrice) ? (
                <span className="text-2xl font-bold text-gray-900">{formatPrice(basePrice)}</span>
              ) : (
                <span className="text-lg font-medium text-gray-500">Price varies</span>
              )}
              {formatPrice(compareAtPrice) && (compareAtPrice as number) > (basePrice ?? 0) && (
                <span className="text-base text-gray-500 line-through">{formatPrice(compareAtPrice)}</span>
              )}
            </div>
            {selectedVariationSummary ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#eba236] bg-[#FFF9F0] border border-[#eba236]/40 rounded-full px-3 py-1">
                {selectedVariationSummary}
              </p>
            ) : null}
            {shortDescription && (
              <p className="mt-4 text-gray-600 leading-relaxed whitespace-pre-line">{shortDescription}</p>
            )}
          </div>

          {isVariableProduct && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Choose variation{' '}
                <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 align-middle">
                  Required
                </span>
              </h2>
              {hasVariationChoices ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {variations.map((variation) => {
                    const isSelected =
                      !!selectedVariation && String(selectedVariation.id) === String(variation.id);
                    const outOfStock =
                      typeof variation.stock_quantity === 'number' && variation.stock_quantity <= 0;
                    const summary = (variation.attributeItems || [])
                      .map((item) => `${item.attributeName}: ${item.termName}`)
                      .filter(Boolean)
                      .join(' • ');
                    return (
                      <button
                        key={String(variation.id)}
                        type="button"
                        disabled={outOfStock}
                        onClick={() => {
                          if (!outOfStock) setSelectedVariationId(variation.id);
                        }}
                        className={`text-left p-4 rounded-xl border transition-colors ${
                          isSelected
                            ? 'border-[#eba236] bg-[#FFF9F0] shadow-sm'
                            : outOfStock
                              ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                              isSelected ? 'border-[#eba236]' : 'border-gray-300'
                            }`}
                            aria-hidden="true"
                          >
                            {isSelected && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#eba236' }} />}
                          </span>
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                            {variation.image ? (
                              <Image
                                src={getImageUrl(variation.image) || ''}
                                alt={variation.name}
                                width={48}
                                height={48}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <span className="text-gray-600 text-xs font-medium">
                                {variation.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`font-semibold line-clamp-1 ${outOfStock ? 'text-gray-400' : 'text-gray-900'}`}>{variation.name}</span>
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                                  outOfStock ? 'text-gray-500 bg-gray-100' : 'text-green-700 bg-green-50'
                                }`}
                              >
                                {outOfStock ? 'Out of stock' : 'Available'}
                              </span>
                            </div>
                            {summary ? (
                              <p className="mt-1 text-xs text-gray-500 line-clamp-2">{summary}</p>
                            ) : null}
                          </div>
                        </div>
                        {variation.short_description ? (
                          <p className="mt-2 text-xs text-gray-500 line-clamp-2">{variation.short_description}</p>
                        ) : null}
                        <p className="mt-2 text-base font-bold text-gray-900">
                          {formatPrice(variation.base_price ?? 0)}
                          {variation.compare_at_price &&
                          variation.compare_at_price > (variation.base_price ?? 0) &&
                          formatPrice(variation.compare_at_price) ? (
                            <span className="ml-2 text-sm font-normal text-gray-500 line-through">
                              {formatPrice(variation.compare_at_price)}
                            </span>
                          ) : null}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Variations are not available for this product yet.
                </p>
              )}
            </div>
          )}

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

          {isGroupedProduct && (
            <div className="mt-6 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="text-base font-extrabold text-gray-900">Build your bundle</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Stage the items you want, review them here, then add everything to your order in one step.
                </p>
                {groupedLoading ? (
                  <div className="mt-4 space-y-2 animate-pulse">
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                    <div className="h-2 bg-gray-100 rounded-full" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                ) : groupedItems.length > 0 ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                      <span>{stagedGroupedCount}/{groupedItems.length} selected</span>
                      <span>{stagedGroupedUnits} units staged • {formatPrice(stagedGroupedSubtotal) ?? ''}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${groupedItems.length > 0 ? Math.round((stagedGroupedCount / groupedItems.length) * 100) : 0}%`,
                          backgroundColor: '#eba236',
                        }}
                      />
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() =>
                          stagedGroupedCount === eligibleGrouped.length && eligibleGrouped.length > 0
                            ? resetStagedGrouped()
                            : selectAllEligibleGrouped()
                        }
                        disabled={eligibleGrouped.length === 0}
                        className="flex-1 py-2 rounded-xl text-[13px] font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {stagedGroupedCount === eligibleGrouped.length && eligibleGrouped.length > 0
                          ? 'Clear all'
                          : 'Select all eligible'}
                      </button>
                      {stagedGroupedCount > 0 && (
                        <button
                          type="button"
                          onClick={resetStagedGrouped}
                          className="px-4 py-2 rounded-xl text-[13px] font-bold text-gray-500 hover:text-gray-700"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    {needsCustomizationCount > 0 && (
                      <p className="text-[11px] text-gray-500 mt-2">
                        {needsCustomizationCount} item{needsCustomizationCount === 1 ? '' : 's'} still need customization or a separate detail view before they can be staged here.
                      </p>
                    )}
                    {unavailableGroupedCount > 0 && (
                      <p className="text-[11px] text-gray-500 mt-1">
                        {unavailableGroupedCount} item{unavailableGroupedCount === 1 ? '' : 's'} are currently unavailable at this merchant.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>

              <div>
                <h3 className="text-base font-extrabold text-gray-900 mb-3">Included items</h3>
                {groupedLoading ? (
                  <div className="space-y-3">
                    {[0, 1].map((i) => (
                      <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse flex gap-3">
                        <div className="w-[72px] h-[72px] rounded-xl bg-gray-200 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-2/3" />
                          <div className="h-3 bg-gray-100 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : groupedItems.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-100 p-5 text-center">
                    Grouped items are not available for this product yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {groupedItems.map((child) => {
                      const staged = stagedGroupedIds.has(child.key);
                      const stageable = isGroupedChildStageable(child);
                      const childPrice = formatPrice(child.basePrice);
                      return (
                        <div
                          key={child.key}
                          className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 ${!child.isAvailable ? 'opacity-70' : ''}`}
                        >
                          <div className="flex gap-3">
                            <div className="w-[72px] h-[72px] rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                              {child.imageUrl ? (
                                <Image
                                  src={child.imageUrl}
                                  alt={child.name}
                                  width={72}
                                  height={72}
                                  className="object-cover w-full h-full"
                                />
                              ) : (
                                <span className="text-gray-600 text-sm font-bold">
                                  {child.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                                  x{child.defaultQuantity}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 uppercase">
                                  {child.productType}
                                </span>
                                {staged && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                                    <i className="fas fa-check-circle" /> Staged
                                  </span>
                                )}
                              </div>
                              <p className="text-[15px] font-bold text-gray-900 mt-1 truncate">{child.name}</p>
                              {child.shortDescription && (
                                <p className="text-xs text-gray-500 line-clamp-2">{child.shortDescription}</p>
                              )}
                              <p className="mt-1 text-sm font-bold text-gray-900">
                                {childPrice ?? <span className="text-gray-400 font-medium">Price varies</span>}
                                {child.compareAtPrice != null &&
                                  child.compareAtPrice > (child.basePrice ?? 0) &&
                                  formatPrice(child.compareAtPrice) && (
                                    <span className="ml-2 text-xs font-normal text-gray-500 line-through">
                                      {formatPrice(child.compareAtPrice)}
                                    </span>
                                  )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <span className={`text-xs ${child.isAvailable ? 'text-gray-500' : 'text-red-600 font-medium'}`}>
                              {!child.isAvailable
                                ? 'Currently unavailable'
                                : staged
                                  ? `Ready to add x${child.defaultQuantity}`
                                  : stageable
                                    ? 'Tap to stage this item'
                                    : 'Open for customization'}
                            </span>
                            {!child.isAvailable ? (
                              <button
                                type="button"
                                disabled
                                className="px-4 py-2 rounded-xl text-[13px] font-bold bg-gray-100 text-gray-400 cursor-not-allowed"
                              >
                                Unavailable
                              </button>
                            ) : staged ? (
                              <button
                                type="button"
                                onClick={() => toggleStagedGrouped(child.key)}
                                className="px-4 py-2 rounded-xl text-[13px] font-bold bg-gray-900 text-white hover:opacity-90"
                              >
                                Remove
                              </button>
                            ) : stageable ? (
                              <button
                                type="button"
                                onClick={() => toggleStagedGrouped(child.key)}
                                className="px-4 py-2 rounded-xl text-[13px] font-bold text-white hover:opacity-90"
                                style={{ backgroundColor: '#eba236' }}
                              >
                                Add
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openGroupedChild(child)}
                                className="px-4 py-2 rounded-xl text-[13px] font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                              >
                                {child.productType === 'variable' ? 'Choose' : child.productType === 'grouped' ? 'Open' : 'Customize'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {stagedGroupedCount > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      {stagedGroupedCount}/{groupedItems.length} items staged
                    </p>
                    <p className="text-xs text-gray-500">
                      {stagedGroupedUnits} units • {formatPrice(stagedGroupedSubtotal) ?? ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddGroupedToCart}
                    disabled={stagingBusy}
                    className="px-6 py-2.5 rounded-full font-semibold text-white text-sm shadow-md hover:shadow-lg transition-colors disabled:opacity-60"
                    style={{ backgroundColor: '#239459' }}
                  >
                    {stagingBusy ? 'Adding…' : `Add to Order • ${formatPrice(stagedGroupedSubtotal) ?? ''}`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
