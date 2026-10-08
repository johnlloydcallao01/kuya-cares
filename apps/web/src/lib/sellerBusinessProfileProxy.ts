import { NextRequest, NextResponse } from 'next/server';

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');

export async function proxySellerBusinessProfile(request: NextRequest): Promise<NextResponse> {
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

    const profileResponse = await fetch(
      `${CMS_BASE}/vendor/profile?userId=${encodeURIComponent(String(user.id))}`,
      {
        headers: { Authorization: `JWT ${token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(25000),
      },
    );
    const text = await profileResponse.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || 'CMS returned an invalid profile response' };
    }
    return NextResponse.json(data, { status: profileResponse.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 });
  }
}
