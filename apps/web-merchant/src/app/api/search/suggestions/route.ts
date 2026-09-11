import { NextRequest, NextResponse } from 'next/server';
import type { SearchCategory } from '@/lib/search-types';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api').replace(/\/+$/, '');
const AUTH_COOKIE = 'tap2go-merchant-token';
// Service API key (same pattern as apps/web storefront). Production CMS blocks
// vendor JWTs from reading `products`, so `merchant-products?depth=N` returns
// `product_id` as a bare number (live repro: Biscoff latte (small) -> 562).
// A service key authenticates as `service` role and populates the join.
const SERVICE_API_KEY = process.env.PAYLOAD_API_KEY || process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || '';

function cmsHeadersForProducts(vendorToken: string): Record<string, string> {
  if (SERVICE_API_KEY) return { Authorization: `users API-Key ${SERVICE_API_KEY}` };
  return { Authorization: `JWT ${vendorToken}` };
}

function vendorHeaders(vendorToken: string): Record<string, string> {
  return { Authorization: `JWT ${vendorToken}` };
}

async function fetchCmsWithFallback(url: string, vendorToken: string, forProducts: boolean): Promise<Response> {
  const primary = forProducts ? cmsHeadersForProducts(vendorToken) : vendorHeaders(vendorToken);
  const res = await fetch(url, { headers: primary, cache: 'no-store' });
  // If the service key is misconfigured, retry once with the vendor JWT.
  if (!res.ok && forProducts && SERVICE_API_KEY) {
    return fetch(url, { headers: vendorHeaders(vendorToken), cache: 'no-store' });
  }
  return res;
}

interface PayloadDoc {
  id: string | number;
  [key: string]: unknown;
}

interface SuggestionCollection {
  slug: string;
  titleField: string;
  subtitleField?: string;
  category: SearchCategory;
  hrefPrefix: string;
  depth?: number;
}

const SUGGESTION_COLLECTIONS: SuggestionCollection[] = [
  {
    slug: 'merchants',
    titleField: 'outletName',
    subtitleField: 'description',
    category: 'merchants',
    hrefPrefix: '/merchants',
    // depth 2 => merchants -> vendor (1) -> logo (2), for the vendor logo thumbnail.
    depth: 2,
  },
  {
    slug: 'merchant-products',
    titleField: 'display_title',
    subtitleField: 'product_name_override',
    category: 'products',
    hrefPrefix: '/products',
    // depth 3 => merchant-products -> product_id (1) -> media.primaryImage (2).
    // Extra level guards against Payload counting the `media` group as a level.
    depth: 3,
  },
  {
    slug: 'orders',
    titleField: 'id',
    category: 'orders',
    hrefPrefix: '/orders',
  },
];

function getStringValue(val: unknown): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (val && typeof val === 'object' && 'outletName' in val) return String((val as { outletName: unknown }).outletName);
  if (val && typeof val === 'object' && 'name' in val) return String((val as { name: unknown }).name);
  if (val && typeof val === 'object' && 'display_title' in val) return String((val as { display_title: unknown }).display_title);
  if (val && typeof val === 'object' && 'product_name_override' in val) return String((val as { product_name_override: unknown }).product_name_override);
  return '';
}

function escapeWhere(value: string): string {
  return value.replace(/[[\]]/g, '\\$&');
}

/**
 * Resolve a displayable URL from a populated Media doc (or raw string).
 * Mirrors apps/web-admin search + apps/web storefront fallbacks:
 * cloudinaryURL -> url -> thumbnailURL.
 * Numeric IDs (unpopulated) return undefined and are resolved via fetch below.
 */
function getMediaUrl(media: unknown): string | undefined {
  if (!media) return undefined;
  if (typeof media === 'string') return absolutizeUrl(media) || undefined;
  if (typeof media === 'number') return undefined;
  if (typeof media === 'object') {
    const m = media as { cloudinaryURL?: unknown; url?: unknown; thumbnailURL?: unknown };
    if (typeof m.cloudinaryURL === 'string' && m.cloudinaryURL) return absolutizeUrl(m.cloudinaryURL);
    if (typeof m.url === 'string' && m.url) return absolutizeUrl(m.url);
    if (typeof m.thumbnailURL === 'string' && m.thumbnailURL) return absolutizeUrl(m.thumbnailURL);
  }
  return undefined;
}

function absolutizeUrl(u: string): string {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  // CMS `url` is often relative (e.g. "/api/media/file/...") — resolve vs CMS host.
  if (u.startsWith('/')) return `${API_BASE.replace(/\/api$/, '')}${u}`;
  return u;
}

/**
 * Extract the product primary image from a merchant-products doc.
 * CMS shape (apps/cms/src/collections/Products.ts):
 *   products.media = group { primaryImage: upload->media, images: [{ image: upload->media }] }
 *   merchant-products.product_id -> products
 * So the image lives at doc.product_id.media.primaryImage (populated via depth).
 * Falls back to the gallery (media.images[0].image) just like the storefront.
 */
function getProductImageUrl(doc: PayloadDoc): string | undefined {
  const rawProduct = (doc.product_id ?? doc.product) as unknown;
  if (!rawProduct || typeof rawProduct !== 'object') return undefined;
  const product = rawProduct as Record<string, unknown>;

  const media = (product.media ?? null) as Record<string, unknown> | null;
  if (media && typeof media === 'object') {
    const primaryUrl = getMediaUrl((media as { primaryImage?: unknown }).primaryImage);
    if (primaryUrl) return primaryUrl;

    const images = (media as { images?: unknown }).images;
    if (Array.isArray(images)) {
      for (const entry of images) {
        const img = (entry as { image?: unknown } | null)?.image ?? entry;
        const url = getMediaUrl(img);
        if (url) return url;
      }
    }

    const legacyUrl = getMediaUrl((media as { image?: unknown }).image);
    if (legacyUrl) return legacyUrl;
  }

  // Defensive: product may carry primaryImage at top level in some projections.
  const directUrl = getMediaUrl((product as { primaryImage?: unknown }).primaryImage);
  if (directUrl) return directUrl;

  return undefined;
}

/**
 * Merchant thumbnail: prefer the outlet's own images, fall back to the parent vendor logo.
 * CMS shape (apps/cms/src/collections/Merchants.ts): media.thumbnail,
 * media.storeFrontImage; merchants.vendor -> vendors.logo (upload->media).
 */
function getMerchantThumbnail(doc: PayloadDoc): string | undefined {
  const media = (doc.media ?? null) as { thumbnail?: unknown; storeFrontImage?: unknown } | null;
  if (media && typeof media === 'object') {
    const thumb = getMediaUrl(media.thumbnail);
    if (thumb) return thumb;
    const front = getMediaUrl(media.storeFrontImage);
    if (front) return front;
  }
  const vendor = (doc.vendor ?? null) as unknown;
  if (!vendor || typeof vendor !== 'object') return undefined;
  return getMediaUrl((vendor as { logo?: unknown }).logo);
}

function getUnpopulatedProductId(doc: PayloadDoc): string | number | null {  const raw = (doc.product_id ?? doc.product) as unknown;
  if (typeof raw === 'string' || typeof raw === 'number') return raw;
  return null;
}

function getUnpopulatedMediaId(doc: PayloadDoc): string | number | null {
  const rawProduct = (doc.product_id ?? doc.product) as unknown;
  if (!rawProduct || typeof rawProduct !== 'object') return null;
  const media = (rawProduct as { media?: unknown }).media as { primaryImage?: unknown } | null | undefined;
  const primary = media?.primaryImage;
  if (typeof primary === 'string' || typeof primary === 'number') {
    // Numeric/string IDs need a /media fetch. If it's already a URL string,
    // getMediaUrl would have resolved it, so only IDs reach here.
    // Heuristic: pure numeric strings or numbers are IDs; URLs contain '/' or '.'.
    if (typeof primary === 'number') return primary;
    if (/^\d+$/.test(primary)) return primary;
  }
  return null;
}

async function fetchMediaUrlById(mediaId: string | number, token: string): Promise<string | undefined> {
  try {
    const res = await fetchCmsWithFallback(`${API_BASE}/media/${mediaId}?depth=0`, token, true);
    if (!res.ok) return undefined;
    const doc = await res.json();
    return getMediaUrl(doc);
  } catch {
    return undefined;
  }
}

async function fetchProductImageById(productId: string | number, token: string): Promise<string | undefined> {
  try {
    const res = await fetchCmsWithFallback(`${API_BASE}/products/${productId}?depth=2`, token, true);
    if (!res.ok) return undefined;
    const product = await res.json();
    const media = (product?.media ?? null) as { primaryImage?: unknown; images?: unknown; image?: unknown } | null;
    if (media && typeof media === 'object') {
      const primaryUrl = getMediaUrl(media.primaryImage);
      if (primaryUrl) return primaryUrl;
      if (Array.isArray(media.images)) {
        for (const entry of media.images as Array<{ image?: unknown } | unknown>) {
          const img = (entry as { image?: unknown })?.image ?? entry;
          const url = getMediaUrl(img);
          if (url) return url;
        }
      }
      const legacy = getMediaUrl(media.image);
      if (legacy) return legacy;
    }
    return getMediaUrl((product as { primaryImage?: unknown })?.primaryImage);
  } catch {
    return undefined;
  }
}

async function fetchSuggestions(
  config: SuggestionCollection,
  query: string,
  token: string,
): Promise<{ id: string; label: string; subtitle: string; type: SearchCategory; href: string; thumbnail?: string }[]> {
  try {
    const q = encodeURIComponent(escapeWhere(query));
    let url: string;

    if (config.slug === 'orders' && /^\d+$/.test(query)) {
      url = `${API_BASE}/${config.slug}?where[id][equals]=${q}&limit=2&depth=0&select=id,status`;
    } else if (config.slug === 'orders') {
      url = `${API_BASE}/${config.slug}?where[status][contains]=${q}&limit=2&depth=0&select=id,status`;
    } else {
      url = `${API_BASE}/${config.slug}?where[${config.titleField}][contains]=${q}&limit=2&depth=${config.depth ?? 0}`;
    }

    const res = await fetchCmsWithFallback(url, token, config.slug !== 'orders');

    if (!res.ok) return [];

    const data = await res.json();
    const docs: PayloadDoc[] = data.docs ?? [];

    const mapped = docs.map((doc) => {
      const label = getStringValue(doc[config.titleField]) || `#${doc.id}`;
      const subtitle = config.subtitleField
        ? getStringValue(doc[config.subtitleField]) || config.category
        : config.category;
      const href =
        config.slug === 'orders'
          ? `${config.hrefPrefix}?id=${doc.id}`
          : `${config.hrefPrefix}/${doc.id}`;

      return {
        doc,
        id: String(doc.id),
        label,
        subtitle,
        type: config.category,
        href,
        thumbnail:
          config.category === 'products'
            ? getProductImageUrl(doc)
            : config.category === 'merchants'
              ? getMerchantThumbnail(doc)
              : undefined,
      };
    });

    // Enrich products whose image wasn't populated (numeric product/media IDs).
    // Media is public-read in CMS, products require vendor read (see Products.ts).
    if (config.category === 'products') {
      await Promise.all(
        mapped.map(async (item) => {
          if (item.thumbnail) return;
          const mediaId = getUnpopulatedMediaId(item.doc);
          if (mediaId !== null) {
            const urlByMedia = await fetchMediaUrlById(mediaId, token);
            if (urlByMedia) {
              item.thumbnail = urlByMedia;
              return;
            }
          }
          const productId = getUnpopulatedProductId(item.doc);
          if (productId !== null) {
            const urlByProduct = await fetchProductImageById(productId, token);
            if (urlByProduct) item.thumbnail = urlByProduct;
          }
        }),
      );
    }

    return mapped.map(({ doc: _doc, ...rest }) => rest);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [], query: q ?? '' });
  }

  const cookieStore = request.cookies;
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await Promise.all(
    SUGGESTION_COLLECTIONS.map((c) => fetchSuggestions(c, q, token)),
  );

  const flat = results.flat().slice(0, 6);
  return NextResponse.json({ suggestions: flat, query: q });
}
