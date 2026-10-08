import { NextRequest, NextResponse } from 'next/server';

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');
const AUTH_COOKIE = 'kuyacares-token';
type OutletPath = 'outlets' | 'addresses';

async function authenticateMember(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return { token: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  try {
    const response = await fetch(`${CMS_BASE}/users/me?depth=0`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) return { token: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    const user = (await response.json())?.user;
    if (!user || user.role !== 'member' || user.id == null) {
      return { token: null, error: NextResponse.json({ error: 'Member access required' }, { status: 403 }) };
    }
    return { token, error: null };
  } catch {
    return { token: null, error: NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 }) };
  }
}

export async function proxySellerOutlets(
  request: NextRequest,
  options: { path: OutletPath; id?: string; status?: boolean },
): Promise<NextResponse> {
  const { token, error } = await authenticateMember(request);
  if (error) return error;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const query = new URLSearchParams(request.nextUrl.searchParams);
  const cmsPath = options.path === 'addresses'
    ? '/vendor/addresses'
    : `/vendor/outlets${options.id ? `/${encodeURIComponent(options.id)}` : ''}${options.status ? '/status' : ''}`;
  const url = new URL(`${CMS_BASE}${cmsPath}`);
  if (options.path === 'outlets' && !options.id) query.delete('userId');
  url.search = query.toString();

  try {
    const headers = new Headers({ Authorization: `JWT ${token}` });
    let body: string | undefined;
    if (request.method !== 'GET' && request.method !== 'DELETE') {
      headers.set('Content-Type', 'application/json');
      body = await request.text();
    }
    const response = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || 'CMS returned an invalid response' };
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 });
  }
}
