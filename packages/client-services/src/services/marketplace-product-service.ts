import { dataCache, CACHE_KEYS, CACHE_TTL } from '../cache/data-cache';
import type { Media } from '../types/merchant';
import { LocationBasedMerchantService, type LocationBasedMerchant } from './location-based-merchant-service';

export interface MarketplaceProductCategory {
  id: number | string;
  name: string;
  slug: string;
  description?: string | null;
  displayOrder?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  productCount?: number;
  media?: {
    icon?: Media | null;
    thumbnailImage?: Media | null;
    bannerImage?: Media | null;
  } | null;
}

export interface MarketplaceProduct {
  /** CMS product id */
  id: string | number;
  merchantProductId: string | number;
  merchantId: string | number;
  merchantName: string;
  merchantSlug: string;
  merchantSlugId: string;
  name: string;
  slug: string;
  productSlugId: string;
  href: string;
  productType: string;
  /** Effective sell price: price_override ?? basePrice */
  price: number | null;
  compareAtPrice: number | null;
  discountPercent: number | null;
  shortDescription: string | null;
  imageUrl: string | null;
  categoryIds: (number | string)[];
  categoryNames: string[];
  merchantCategoryIds: (number | string)[];
  rating: number | null;
  totalOrders?: number | null;
  stockQuantity?: number | null;
  isAvailable: boolean;
  /** Location enrichment — present when fetched with customerId */
  distanceKm?: number | null;
  isWithinDeliveryRadius?: boolean;
  estimatedDeliveryTime?: string | null;
}

export interface MarketplaceProductsResult {
  products: MarketplaceProduct[];
  categories: MarketplaceProductCategory[];
  totalDocs: number;
}

function getApiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env as Record<string, string | undefined>).EXPO_PUBLIC_API_URL ||
    'https://cms.kuyacares.com/api'
  );
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey =
    process.env.NEXT_PUBLIC_PAYLOAD_API_KEY ||
    (process.env as Record<string, string | undefined>).EXPO_PUBLIC_PAYLOAD_API_KEY;
  if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
  return headers;
}

function getMediaUrl(media: unknown): string | null {
  if (!media || typeof media !== 'object') return null;
  const m = media as Record<string, unknown>;
  return (
    (typeof m.cloudinaryURL === 'string' && m.cloudinaryURL) ||
    (typeof m.url === 'string' && m.url) ||
    (typeof m.thumbnailURL === 'string' && m.thumbnailURL) ||
    null
  );
}

export const UNCATEGORIZED_PRODUCT_CATEGORY_ID = 'uncategorized';

export function isUncategorizedId(value: number | string | null | undefined): boolean {
  return value != null && String(value).toLowerCase() === UNCATEGORIZED_PRODUCT_CATEGORY_ID;
}

function interleaveByMerchant<T>(items: T[], merchantIdOf: (item: T) => string): T[] {
  const groups = new Map<string, T[]>();
  const order: string[] = [];
  for (const item of items) {
    const key = merchantIdOf(item);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }
  const out: T[] = [];
  let round = 0;
  let placed = true;
  while (placed) {
    placed = false;
    for (const key of order) {
      const group = groups.get(key)!;
      if (round < group.length) {
        out.push(group[round]);
        placed = true;
      }
    }
    round++;
  }
  return out;
}

export function toSlug(name: string | null | undefined): string {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return base || 'item';
}

let phpFormatter: Intl.NumberFormat | null = null;

function getPhpFormatter(): Intl.NumberFormat {
  if (!phpFormatter) {
    phpFormatter = new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    });
  }
  return phpFormatter;
}

export function formatPHP(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  try {
    return getPhpFormatter().format(Number(value));
  } catch {
    return `₱${Number(value).toFixed(2)}`;
  }
}

export class MarketplaceProductService {
  /**
   * Fetch active product categories (the `product-categories` collection —
   * the true product taxonomy, distinct from `merchant-categories`).
   */
  static async getProductCategories(options: { limit?: number; onlyFeatured?: boolean } = {}): Promise<MarketplaceProductCategory[]> {
    const { limit = 30, onlyFeatured = false } = options;
    const cacheKey = `${CACHE_KEYS.PRODUCT_CATEGORIES}-marketplace-${limit}-${onlyFeatured ? 'featured' : 'all'}`;
    const cached = dataCache.get<MarketplaceProductCategory[]>(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        depth: '1',
        sort: 'displayOrder',
      });
      params.append('where[isActive][equals]', 'true');
      if (onlyFeatured) params.append('where[isFeatured][equals]', 'true');

      const res = await fetch(`${getApiBase()}/product-categories?${params.toString()}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`product-categories: ${res.status}`);
      const data = await res.json();
      const docs: unknown[] = Array.isArray(data?.docs) ? data.docs : [];
      const cats: MarketplaceProductCategory[] = docs.map((d) => {
        const c = d as Record<string, unknown>;
        const media = (c.media as Record<string, unknown> | undefined) || undefined;
        return {
          id: (c.id as number | string) ?? '',
          name: String(c.name ?? ''),
          slug: String(c.slug ?? ''),
          description: (c.description as string | null) ?? null,
          displayOrder: typeof c.displayOrder === 'number' ? c.displayOrder : 0,
          isActive: c.isActive !== false,
          isFeatured: c.isFeatured === true,
          media: media
            ? {
                icon: (media.icon as Media | null) ?? null,
                thumbnailImage: (media.thumbnailImage as Media | null) ?? null,
                bannerImage: (media.bannerImage as Media | null) ?? null,
              }
            : null,
        };
      });
      dataCache.set(cacheKey, cats, CACHE_TTL.PRODUCT_CATEGORIES);
      return cats;
    } catch (err) {
      console.error('Error fetching marketplace product categories:', err);
      return [];
    }
  }

  /**
   * Fetch marketplace-wide sellable products via the `merchant-products`
   * junction (price/stock-aware — preferred over raw `products`).
   * Filters client-side by product category + merchant category.
   *
   * Location gate (hard rule): `customerId` is REQUIRED. Products are
   * narrowed to merchants within the customer's delivery location and
   * enriched with distance/ETA. No customer (or no qualified merchants)
   * yields zero products — never the global pool.
   */
  static async getMarketplaceProducts(options: {
    limit?: number;
    productCategoryId?: number | string | null;
    merchantCategoryId?: number | string | null;
    search?: string | null;
    customerId?: string | null;
    /** Show-All scope: bypass the location gate entirely (global pool). */
    ignoreLocation?: boolean;
    /** Discovery ceiling applied AFTER the location gate + validity filters.
     *  Tap2go parity default is 40. Pass null for the full window (up to 500)
     *  — used by the /merchant-products listing page. */
    cap?: number | null;
  } = {}): Promise<MarketplaceProduct[]> {
    const { limit = 48, productCategoryId = null, merchantCategoryId = null, search = null, customerId = null, ignoreLocation = false, cap = 40 } = options;
    const cacheKey = `marketplace-products-${limit}-cap${cap ?? 'all'}-${productCategoryId ?? 'all'}-${merchantCategoryId ?? 'all'}-${(search ?? '').slice(0, 40)}-${customerId ?? 'guest'}-${ignoreLocation ? 'all' : 'nearby'}`;
    const cached = dataCache.get<MarketplaceProduct[]>(cacheKey);
    if (cached) return cached;
    // Singleflight: homepage products + flash-deals + header search share one pool build.
    return dataCache.dedupe<MarketplaceProduct[]>(`inflight:${cacheKey}`, async () => {
      const rechecked = dataCache.get<MarketplaceProduct[]>(cacheKey);
      if (rechecked) return rechecked;
    try {
      // HARD RULE (unless Show-All scope): products are ONLY ever the
      // products of location-qualified merchants — the exact same gate as
      // the merchants section (which renders empty on no-customer /
      // no-address / location failure). No customer → []. Location
      // failure → empty set (mirrors merchants). There is deliberately NO
      // silent global fallback: showing the full pool while merchants show
      // none is a lie. Explicit user opt-out via `ignoreLocation` only.
      const gated = !ignoreLocation;
      if (gated && !customerId) return [];
      let nearby: LocationBasedMerchant[] = [];
      if (gated && customerId) {
        try {
          nearby = await LocationBasedMerchantService.getLocationBasedMerchants({
            customerId,
            limit: 9999,
          });
        } catch {
          nearby = [];
        }
      }
      const nearbyIds = new Set(nearby.map((m) => String((m as { id: number | string }).id)));
      const distanceByMerchant = new Map<string, { distanceKm: number | null; isWithinDeliveryRadius: boolean; estimatedDeliveryTime: string | null }>();
      for (const m of nearby) {
        const mm = m as unknown as Record<string, unknown>;
        distanceByMerchant.set(String((m as { id: number | string }).id), {
          distanceKm: typeof mm.distanceKm === 'number' ? (mm.distanceKm as number) : null,
          isWithinDeliveryRadius: (mm.isWithinDeliveryRadius as boolean) !== false,
          estimatedDeliveryTime: typeof mm.estimatedDeliveryTime === 'string' ? (mm.estimatedDeliveryTime as string) : null,
        });
      }
      // Over-fetch then filter client-side so category filtering is exact
      // even though Payload can't join-filter across relationships.
      // Tap2go parity: fixed 500 fetch window scoped to location-eligible
      // merchants, then interleave + 40 discovery ceiling (cap AFTER filter).
      const fetchLimit = 500;
      const params = new URLSearchParams({
        limit: String(fetchLimit),
        depth: '2',
        sort: '-updatedAt',
      });
      params.append('where[is_active][equals]', 'true');
      params.append('where[is_available][equals]', 'true');

      const res = await fetch(`${getApiBase()}/merchant-products?${params.toString()}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`merchant-products: ${res.status}`);
      const data = await res.json();
      const docs: unknown[] = Array.isArray(data?.docs) ? data.docs : [];

      const q = (search || '').trim().toLowerCase();
      const out: MarketplaceProduct[] = [];

      for (const raw of docs) {
        const mp = raw as Record<string, unknown>;
        const product = (mp.product_id as Record<string, unknown> | null) || null;
        const merchant = (mp.merchant_id as Record<string, unknown> | null) || null;
        if (!product || typeof product !== 'object') continue;

        // Skip inactive / hidden catalogue items
        if (product.isActive === false) continue;
        const visibility = product.catalogVisibility as string | undefined;
        if (visibility === 'hidden') continue;

        const rawCats = Array.isArray(product.categories) ? (product.categories as unknown[]) : [];
        const categoryIds: (number | string)[] = [];
        const categoryNames: string[] = [];
        for (const c of rawCats) {
          if (typeof c === 'number' || typeof c === 'string') {
            categoryIds.push(c);
          } else if (c && typeof c === 'object') {
            const co = c as Record<string, unknown>;
            if (co.id != null) {
              categoryIds.push(co.id as number | string);
              if (typeof co.name === 'string') categoryNames.push(co.name);
            }
          }
        }

        // Product-category filter — mirrors the Merchants "Uncategorized"
        // principle (MerchantProductGrid): the pseudo id "uncategorized"
        // isolates products with zero categories.
        if (productCategoryId != null && productCategoryId !== '') {
          if (isUncategorizedId(productCategoryId)) {
            if (categoryIds.length !== 0) continue;
          } else if (!categoryIds.map(String).includes(String(productCategoryId))) {
            continue;
          }
        }

        // Merchant-side info
        const merchantRawCats = merchant && Array.isArray((merchant as Record<string, unknown>).merchant_categories)
          ? ((merchant as Record<string, unknown>).merchant_categories as unknown[])
          : [];
        const merchantCategoryIds: (number | string)[] = merchantRawCats
          .map((c) => {
            if (typeof c === 'number' || typeof c === 'string') return c;
            if (c && typeof c === 'object') return (c as Record<string, unknown>).id as number | string;
            return null;
          })
          .filter((v): v is number | string => v != null);

        // Merchant-category filter — same "Uncategorized" principle as the
        // merchants rail: the pseudo id isolates products of merchants with
        // zero merchant-categories.
        if (merchantCategoryId != null && merchantCategoryId !== '') {
          if (isUncategorizedId(merchantCategoryId)) {
            if (merchantCategoryIds.length !== 0) continue;
          } else if (!merchantCategoryIds.map(String).includes(String(merchantCategoryId))) {
            continue;
          }
        }

        const name = String(product.name ?? '');
        if (!name) continue;
        if (q && !name.toLowerCase().includes(q)) continue;

        const priceOverride =
          typeof mp.price_override === 'number' ? (mp.price_override as number) : null;
        const basePrice = typeof product.basePrice === 'number' ? (product.basePrice as number) : null;
        const price = priceOverride ?? basePrice;
        const compareAtPrice =
          typeof product.compareAtPrice === 'number' ? (product.compareAtPrice as number) : null;
        const discountPercent =
          price != null && compareAtPrice != null && compareAtPrice > price && compareAtPrice > 0
            ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
            : null;

        const primaryImage = (product.media as Record<string, unknown> | undefined)?.primaryImage ?? null;
        const imageUrl = getMediaUrl(primaryImage);

        const outletName =
          merchant && typeof merchant.outletName === 'string' && merchant.outletName
            ? (merchant.outletName as string)
            : 'Merchant';
        const mId = (merchant?.id as number | string | undefined) ?? (mp.merchant_id as number | string);
        // Location gate: drop every product whose merchant is not qualified
        // (skipped entirely in Show-All scope).
        if (gated && !nearbyIds.has(String(mId))) continue;
        const geo = distanceByMerchant.get(String(mId));
        const merchantSlug = toSlug(outletName);
        const merchantSlugId = `${merchantSlug}-${String(mId)}`;
        const pId = (product.id as number | string | undefined) ?? (mp.id as number | string);
        const productSlug = toSlug(String(product.slug || name));
        const productSlugId = `${productSlug}-${String(pId)}`;

        const metrics = (merchant?.metrics as Record<string, unknown> | undefined) || undefined;
        const rating = typeof metrics?.averageRating === 'number' ? (metrics.averageRating as number) : null;

        out.push({
          id: pId,
          merchantProductId: (mp.id as number | string) ?? '',
          merchantId: (mId as number | string) ?? '',
          merchantName: outletName,
          merchantSlug,
          merchantSlugId,
          name,
          slug: String(product.slug || productSlug),
          productSlugId,
          href: `/merchant/${merchantSlugId}/${productSlugId}`,
          productType: String(product.productType ?? 'simple'),
          price,
          compareAtPrice,
          discountPercent,
          shortDescription: (product.shortDescription as string | null) ?? null,
          imageUrl,
          categoryIds,
          categoryNames,
          merchantCategoryIds,
          rating,
          totalOrders: typeof metrics?.totalOrders === 'number' ? (metrics.totalOrders as number) : null,
          stockQuantity: typeof mp.stock_quantity === 'number' ? (mp.stock_quantity as number) : null,
          isAvailable: mp.is_available !== false && mp.is_active !== false,
          distanceKm: geo?.distanceKm ?? null,
          isWithinDeliveryRadius: geo ? geo.isWithinDeliveryRadius : undefined,
          estimatedDeliveryTime: geo?.estimatedDeliveryTime ?? null,
        });

      }

      // Mix owners round-robin by merchant (kills first-merchant bias).
      // Deterministic: merchant first-seen order decides rotation,
      // in-merchant order kept. Capped at the discovery ceiling (default 40,
      // same as tap2go mobile-customer Recommended For You). Cap is applied
      // AFTER the location gate + validity filters, never before. Pass
      // cap:null for the full window (up to 500) — /merchant-products page.
      const interleaved = interleaveByMerchant(out, (p) => String(p.merchantId));
      const finalOut = cap == null ? interleaved : interleaved.slice(0, Math.max(0, cap));
      dataCache.set(cacheKey, finalOut, CACHE_TTL.MERCHANTS);
      return finalOut;
    } catch (err) {
      console.error('Error fetching marketplace products:', err);
      return [];
    }
    });
  }

  /** Top discounted products for a Shopee-style "Flash Deals" rail. */
  static async getFlashDeals(limit = 10, customerId?: string | null, ignoreLocation = false): Promise<MarketplaceProduct[]> {
    const all = await MarketplaceProductService.getMarketplaceProducts({ limit: 200, cap: 200, customerId: customerId ?? null, ignoreLocation });
    return all
      .filter((p) => (p.discountPercent ?? 0) > 0 && p.price != null)
      .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
      .slice(0, limit);
  }

  static clearCache(): void {
    const stats = dataCache.getStats();
    stats.keys.forEach((key) => {
      if (key.startsWith('marketplace-products') || key.startsWith(CACHE_KEYS.PRODUCT_CATEGORIES)) {
        dataCache.delete(key);
      }
    });
  }
}

export const getMarketplaceProductCategories = MarketplaceProductService.getProductCategories;
export const getMarketplaceProducts = MarketplaceProductService.getMarketplaceProducts;
export const getFlashDeals = MarketplaceProductService.getFlashDeals;
