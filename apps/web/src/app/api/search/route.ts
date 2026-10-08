import { NextRequest, NextResponse } from 'next/server';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');
const SERVICE_API_KEY = process.env.PAYLOAD_API_KEY || process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || '';

function getHeaders(request: NextRequest): Record<string, string> {
  const token = request.cookies.get('kuyacares-merchant-token')?.value || request.cookies.get('grandline_auth_token')?.value;
  if (SERVICE_API_KEY) {
    return { Authorization: `users API-Key ${SERVICE_API_KEY}` };
  }
  if (token) {
    return { Authorization: `JWT ${token}` };
  }
  return {};
}

function escapeWhere(value: string): string {
  return value.replace(/[[\]]/g, '\\$&');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], totalCount: 0, query: q ?? '' });
  }

  const headers = getHeaders(request);
  const safeQ = encodeURIComponent(escapeWhere(q));

  try {
    const [merchantsRes, productsRes] = await Promise.all([
      fetch(`${API_BASE}/merchants?where[outletName][contains]=${safeQ}&limit=5&depth=1`, { headers, cache: 'no-store' }),
      fetch(`${API_BASE}/merchant-products?where[display_title][contains]=${safeQ}&limit=5&depth=1`, { headers, cache: 'no-store' }),
    ]);

    const results: Array<{ id: string; title: string; subtitle?: string; type: string; href: string; thumbnail?: string }> = [];

    if (merchantsRes.ok) {
      const data = await merchantsRes.json();
      for (const doc of data.docs || []) {
        results.push({
          id: String(doc.id),
          title: doc.outletName || doc.name || 'Merchant',
          subtitle: doc.description || 'Merchant',
          type: 'merchants',
          href: `/seller/merchants/${doc.id}`,
        });
      }
    }

    if (productsRes.ok) {
      const data = await productsRes.json();
      for (const doc of data.docs || []) {
        results.push({
          id: String(doc.id),
          title: doc.display_title || doc.name || 'Product',
          subtitle: doc.product_name_override || 'Product',
          type: 'products',
          href: `/seller/products/${doc.id}`,
        });
      }
    }

    return NextResponse.json({
      results,
      totalCount: results.length,
      query: q,
    });
  } catch {
    return NextResponse.json({ results: [], totalCount: 0, query: q });
  }
}
