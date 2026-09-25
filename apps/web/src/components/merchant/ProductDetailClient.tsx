'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from '@/components/ui/ImageWrapper';
import ProductStickyHeader from '@/components/merchant/ProductStickyHeader';
import ProductModifiers from '@/components/merchant/ProductModifiers';
import { Skeleton } from '@/components/ui/Skeleton';
import { Product, ModifierGroup, ModifierOption, ProductVariation } from '@/types/product';
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
  const [isWishlisted, setIsWishlisted] = useState(false);
  const wishlistRequestInFlight = useRef(false);
  const queuedWishlistState = useRef<boolean | null>(null);
  const { addToCart, items } = useCart();
  const router = useRouter();
  const isVariableProduct = product?.productType === 'variable';
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const anyWindow = window as any;
    anyWindow.__kuyaCaresProductDetailHasInvalidModifiers = hasInvalidModifiers;
    window.dispatchEvent(
      new CustomEvent('kuyaCares:productDetail:validation', {
        detail: { hasInvalidModifiers },
      }),
    );
  }, [hasInvalidModifiers]);

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

  const handleAddToCart = useCallback(
    (quantityOverride?: number) => {
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
    [addToCart, basePrice, cannotAddVariableProduct, compareAtPrice, hasInvalidModifiers, hasVariationChoices, isBelowPayMongoMinimum, isUnavailable, merchantSlugId, product, productId, quantity, selectedVariation],
  );

  useEffect(() => {
    setShowCartBar(false);
    setSelectedVariationId(null);
    setVariations([]);
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
                    disabled={hasInvalidModifiers || isUnavailable || cannotAddVariableProduct || isBelowPayMongoMinimum || isAddingToCart}
                    className="h-11 px-6 rounded-full font-semibold text-white text-sm shadow-md hover:shadow-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#239459' }}
                    onClick={() => {
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
              {formatPrice(basePrice) && (
                <span className="text-2xl font-bold text-gray-900">{formatPrice(basePrice)}</span>
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
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Choose variation</h2>
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
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-gray-900 line-clamp-1">{variation.name}</span>
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
        </div>
      </div>
    </div>
  );
}
