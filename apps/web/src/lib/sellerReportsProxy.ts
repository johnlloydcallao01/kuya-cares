import { NextRequest, NextResponse } from 'next/server';

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');
const AUTH_COOKIE = 'kuyacares-token';

export async function proxySellerReports(
  request: NextRequest,
  group: 'summary' | 'financial' | 'catalog',
): Promise<NextResponse> {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const meRes = await fetch(`${CMS_BASE}/users/me?depth=0`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    });
    if (!meRes.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = (await meRes.json())?.user;
    if (!user || user.role !== 'member' || user.id == null) {
      return NextResponse.json({ error: 'Member access required' }, { status: 403 });
    }

    const forward = new URLSearchParams(request.nextUrl.searchParams);
    forward.set('userId', String(user.id));
    if (!forward.has('range')) forward.set('range', '30d');

    const cmsRes = await fetch(`${CMS_BASE}/vendor/reports/${group}?${forward.toString()}`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    });
    if (!cmsRes.ok) {
      const body = await cmsRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: body.error || 'Failed to load reports' },
        { status: cmsRes.status },
      );
    }

    const headers = new Headers({ 'Content-Type': 'application/json' });
    const cacheStatus = cmsRes.headers.get('X-VendorReports-Cache');
    if (cacheStatus) headers.set('X-VendorReports-Cache', cacheStatus);
    return new NextResponse(await cmsRes.text(), { status: cmsRes.status, headers });
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 });
  }
}
