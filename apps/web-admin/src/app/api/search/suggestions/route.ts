import { NextRequest, NextResponse } from 'next/server';
import type { SearchCategory } from '@/lib/search-types';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api').replace(/\/+$/, '');
const AUTH_COOKIE = 'tap2go-admin-token';

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
    depth: 2,
  },
  {
    slug: 'products',
    titleField: 'name',
    subtitleField: 'description',
    category: 'products',
    hrefPrefix: '/products',
    depth: 1,
  },
  {
    slug: 'orders',
    titleField: 'id',
    category: 'orders',
    hrefPrefix: '/orders',
  },
  {
    slug: 'vendors',
    titleField: 'businessName',
    subtitleField: 'businessEmail',
    category: 'vendors',
    hrefPrefix: '/vendors',
    depth: 1,
  },
  {
    slug: 'customers',
    titleField: 'id',
    category: 'customers',
    hrefPrefix: '/customers',
    depth: 1,
  },
  {
    slug: 'drivers',
    titleField: 'id',
    category: 'drivers',
    hrefPrefix: '/drivers',
    depth: 1,
  },
];

function getStringValue(val: unknown): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (val && typeof val === 'object' && 'name' in val) return String((val as { name: unknown }).name);
  if (val && typeof val === 'object' && 'email' in val) return String((val as { email: unknown }).email);
  if (val && typeof val === 'object' && 'outletName' in val) return String((val as { outletName: unknown }).outletName);
  if (val && typeof val === 'object' && 'firstName' in val) {
    const obj = val as { firstName?: string; lastName?: string };
    return [obj.firstName, obj.lastName].filter(Boolean).join(' ');
  }
  return '';
}

function escapeWhere(value: string): string {
  return value.replace(/[[\]]/g, '\\$&');
}

function absolutizeUrl(u: string): string {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  // CMS `url` is often relative (e.g. "/api/media/file/...") — resolve vs CMS host.
  if (u.startsWith('/')) return `${API_BASE.replace(/\/api$/, '')}${u}`;
  return u;
}

/**
 * Resolve a displayable URL from a populated Media doc (or raw string).
 * CMS Media (apps/cms/src/collections/Media.ts + cloudinary adapter) exposes
 * cloudinaryURL / url / thumbnailURL — prefer in that order.
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

function getThumbnailUrl(doc: PayloadDoc, category: SearchCategory): string | undefined {
  if (category === 'products') {
    // CMS shape (apps/cms/src/collections/Products.ts):
    // products.media = group { primaryImage: upload->media, images: [{ image: upload->media }] }
    const media = (doc.media ?? null) as { primaryImage?: unknown; images?: unknown; image?: unknown } | null;
    if (media && typeof media === 'object') {
      const primaryUrl = getMediaUrl(media.primaryImage);
      if (primaryUrl) return primaryUrl;
      if (Array.isArray(media.images)) {
        for (const entry of media.images as Array<{ image?: unknown } | unknown>) {
          const url = getMediaUrl((entry as { image?: unknown })?.image ?? entry);
          if (url) return url;
        }
      }
      const legacy = getMediaUrl(media.image);
      if (legacy) return legacy;
    }
    return getMediaUrl((doc as { primaryImage?: unknown }).primaryImage);
  }

  if (category === 'vendors') {
    // CMS shape (apps/cms/src/collections/Vendors.ts): vendors.logo upload->media
    return getMediaUrl((doc as { logo?: unknown }).logo);
  }

  if (category === 'merchants') {
    // CMS shape (apps/cms/src/collections/Merchants.ts): outlet's own
    // media.thumbnail / media.storeFrontImage, then vendor logo via
    // merchants.vendor -> vendors.logo.
    const media = (doc.media ?? null) as { thumbnail?: unknown; storeFrontImage?: unknown } | null;
    if (media && typeof media === 'object') {
      const thumb = getMediaUrl(media.thumbnail);
      if (thumb) return thumb;
      const front = getMediaUrl(media.storeFrontImage);
      if (front) return front;
    }
    const vendor = (doc.vendor ?? null) as { logo?: unknown } | null;
    if (!vendor || typeof vendor !== 'object') return undefined;
    return getMediaUrl(vendor.logo);
  }

  return undefined;
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

    const res = await fetch(url, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const data = await res.json();
    const docs: PayloadDoc[] = data.docs ?? [];

    return docs.map((doc) => {
      const label = getStringValue(doc[config.titleField]) || `#${doc.id}`;
      const subtitle = config.subtitleField
        ? getStringValue(doc[config.subtitleField]) || config.category
        : config.category;
      const href =
        config.slug === 'orders'
          ? `${config.hrefPrefix}?id=${doc.id}`
          : `${config.hrefPrefix}/${doc.id}`;

      const thumbnail = getThumbnailUrl(doc, config.category);

      return {
        id: String(doc.id),
        label,
        subtitle,
        type: config.category,
        href,
        thumbnail,
      };
    });
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

  const flat = results.flat().slice(0, 8);
  return NextResponse.json({ suggestions: flat, query: q });
}
