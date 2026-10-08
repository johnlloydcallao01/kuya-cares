import { NextRequest, NextResponse } from 'next/server';

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');
const QUERY_KEYS = [
  'search',
  'sort',
  'page',
  'limit',
  'status',
  'payment_method',
  'paymentMethod',
  'currency',
  'order',
  'orderId',
];

export async function proxySellerTransactions(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get('kuyacares-token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const userResponse = await fetch(`${CMS_BASE}/users/me?depth=0`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    });
    if (!userResponse.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = (await userResponse.json())?.user;
    if (!user || user.role !== 'member' || user.id == null) {
      return NextResponse.json({ error: 'Member access required' }, { status: 403 });
    }

    const query = new URLSearchParams({ userId: String(user.id) });
    for (const key of QUERY_KEYS) {
      const value = request.nextUrl.searchParams.get(key);
      if (value != null && value !== '') query.set(key, value);
    }

    const response = await fetch(`${CMS_BASE}/vendor/transactions?${query.toString()}`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: text || 'CMS returned an invalid transactions response' }, { status: 502 });
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 });
  }
}
