import { NextRequest, NextResponse } from 'next/server'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '')
const AUTH_COOKIE = 'kuyacares-admin-token'

type PayloadDoc = Record<string, unknown>

async function fetchDocs(token: string, collection: string): Promise<PayloadDoc[]> {
  const response = await fetch(`${CMS_BASE}/${collection}?limit=1000&depth=0&sort=name`, {
    headers: { Authorization: `JWT ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`CMS ${collection} lookup failed (${response.status}): ${text.slice(0, 300)}`)
  }
  const result = JSON.parse(text) as { docs?: PayloadDoc[] }
  return result.docs ?? []
}

function option(doc: PayloadDoc, fallbackField: string) {
  const id = doc.id
  const label = doc.name ?? doc.businessName ?? doc.outletName ?? doc[fallbackField] ?? `#${String(id)}`
  return { id: String(id), label: String(label) }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const [vendors, categories, plans, products, productCategories] = await Promise.all([
      fetchDocs(token, 'vendors'),
      fetchDocs(token, 'merchant-categories'),
      fetchDocs(token, 'membership-plans'),
      fetchDocs(token, 'products'),
      fetchDocs(token, 'product-categories'),
    ])
    return NextResponse.json({
      vendors: vendors.map((doc) => option(doc, 'businessName')),
      categories: categories.map((doc) => option(doc, 'name')),
      plans: plans.map((doc) => option(doc, 'name')),
      products: products.map((doc) => option(doc, 'name')),
      productCategories: productCategories.map((doc) => option(doc, 'name')),
    })
  } catch (error) {
    console.error('[web-admin commission options] failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load commission options' }, { status: 502 })
  }
}
