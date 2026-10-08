import { NextRequest, NextResponse } from 'next/server';

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');

export async function proxySellerCatalogMerchantProductModifierOptionOverrides(request: NextRequest): Promise<NextResponse> {
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
    for (const key of [
      'search',
      'sort',
      'merchant_product_id',
      'merchantProductId',
      'base_modifier_option_id',
      'baseModifierOptionId',
      'base_option_id',
      'mode',
      'default_behavior',
      'defaultBehavior',
      'availability_behavior',
      'availabilityBehavior',
      'is_active',
      'page',
      'limit',
    ]) {
      const value = request.nextUrl.searchParams.get(key);
      if (value != null && value !== '') query.set(key, value);
    }

    const response = await fetch(`${CMS_BASE}/vendor/catalog/merchant-product-modifier-option-overrides?${query.toString()}`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || 'CMS returned an invalid merchant product modifier option overrides response' };
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 });
  }
}
