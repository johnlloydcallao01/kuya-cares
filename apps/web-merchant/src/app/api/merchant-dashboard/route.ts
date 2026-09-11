import { NextRequest, NextResponse } from 'next/server';

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api').replace(/\/+$/, '');
const AUTH_COOKIE = 'tap2go-merchant-token';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Resolve the authenticated user (same as getServerUser in auth actions)
    const meRes = await fetch(`${CMS_BASE}/users/me?depth=2`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
    });
    if (!meRes.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const meData = await meRes.json();
    const user = meData?.user;
    if (!user || user.role !== 'vendor') {
      return NextResponse.json({ error: 'Vendor access required' }, { status: 403 });
    }

    // 2. Fetch dashboard data — CMS endpoint resolves vendor internally with overrideAccess
    const dashboardRes = await fetch(`${CMS_BASE}/merchant/dashboard?userId=${user.id}`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
    });
    if (!dashboardRes.ok) {
      // Gracefully handle vendor-not-found (CMS returns 404 when vendor row missing).
      // Mirrors the empty-state handling in apps/cms/src/app/api/merchant/dashboard/route.ts
      // where merchantIds.size===0 returns 200 empty dashboard — don't forward 404 to client.
      try {
        const errBody = await dashboardRes.json();
        const isVendorNotFound =
          dashboardRes.status === 404 && String(errBody?.error || '').toLowerCase().includes('vendor');
        if (isVendorNotFound) {
          return NextResponse.json({
            metrics: {
              totalRevenue: 0,
              revenueChange: 0,
              todayRevenue: 0,
              totalOrders: 0,
              ordersChange: 0,
              pendingOrders: 0,
              activeOrders: 0,
              totalOutlets: 0,
              openOutlets: 0,
              acceptingOrders: 0,
              averageRating: 0,
              totalReviews: 0,
              ratingChange: 0,
            },
            outlets: [],
            revenueChart: [],
            orderStatusChart: [],
            topProducts: [],
            activeDeliveries: [],
            pendingOrders: [],
            recentOrders: [],
          });
        }
      } catch {
        // fall through to generic error
      }
      return NextResponse.json({ error: 'Failed to load dashboard' }, { status: dashboardRes.status });
    }

    const data = await dashboardRes.json();
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const cacheStatus = dashboardRes.headers.get('X-MerchantDashboard-Cache');
    if (cacheStatus) headers.set('X-MerchantDashboard-Cache', cacheStatus);
    return new NextResponse(JSON.stringify(data), { status: dashboardRes.status, headers });
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 });
  }
}
