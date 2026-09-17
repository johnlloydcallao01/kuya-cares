import { NextRequest, NextResponse } from 'next/server';

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');
const AUTH_COOKIE = 'kuyacares-merchant-token';

const EMPTY_BODY = {
  revenueChart: [],
  orderStatusChart: [],
  topProducts: [],
};

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const meRes = await fetch(`${CMS_BASE}/users/me?depth=2`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!meRes.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const meData = await meRes.json();
    const user = meData?.user;
    if (!user || user.role !== 'vendor') {
      return NextResponse.json({ error: 'Vendor access required' }, { status: 403 });
    }

    const dashboardRes = await fetch(`${CMS_BASE}/merchant/dashboard?userId=${user.id}`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!dashboardRes.ok) {
      try {
        const errBody = await dashboardRes.json();
        const isVendorNotFound =
          dashboardRes.status === 404 && String(errBody?.error || '').toLowerCase().includes('vendor');
        if (isVendorNotFound) {
          return NextResponse.json(EMPTY_BODY);
        }
      } catch {
        // fall through to generic error
      }
      return NextResponse.json({ error: 'Failed to load dashboard' }, { status: dashboardRes.status });
    }

    const data = await dashboardRes.json();
    return NextResponse.json({
      revenueChart: data.revenueChart ?? EMPTY_BODY.revenueChart,
      orderStatusChart: data.orderStatusChart ?? EMPTY_BODY.orderStatusChart,
      topProducts: data.topProducts ?? EMPTY_BODY.topProducts,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 });
  }
}
