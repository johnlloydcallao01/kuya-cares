import { NextRequest, NextResponse } from 'next/server';

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');
const AUTH_COOKIE = 'kuyacares-token';

const EMPTY_GROUPS = {
  metrics: {
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
  },
  charts: { revenueChart: [], orderStatusChart: [], topProducts: [] },
  tables: { activeDeliveries: [], pendingOrders: [], recentOrders: [] },
};

export type SellerDashboardGroup = keyof typeof EMPTY_GROUPS;

export async function proxySellerDashboard(
  request: NextRequest,
  group: SellerDashboardGroup,
): Promise<NextResponse> {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const meRes = await fetch(`${CMS_BASE}/users/me?depth=0`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!meRes.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const meData = await meRes.json();
    const user = meData?.user;
    if (!user || user.role !== 'member' || user.id == null) {
      return NextResponse.json({ error: 'Member access required' }, { status: 403 });
    }

    const dashboardRes = await fetch(
      `${CMS_BASE}/merchant/dashboard/${group}?userId=${encodeURIComponent(String(user.id))}`,
      {
        headers: { Authorization: `JWT ${token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!dashboardRes.ok) {
      let errorBody: { error?: string } = {};
      try {
        errorBody = await dashboardRes.json();
      } catch {
        // Forward the CMS status when the response is not JSON.
      }
      const missingVendor =
        dashboardRes.status === 404 &&
        String(errorBody.error || '').toLowerCase().includes('vendor');
      if (missingVendor) return NextResponse.json(EMPTY_GROUPS[group]);
      return NextResponse.json(
        { error: errorBody.error || 'Failed to load dashboard' },
        { status: dashboardRes.status },
      );
    }

    return NextResponse.json(await dashboardRes.json());
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 });
  }
}
