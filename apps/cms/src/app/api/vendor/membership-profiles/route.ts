import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendorOrMember } from '@/utils/mediaLibrary'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const user = await authenticateVendorOrMember(payload, request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: seller authentication required' }, { status: 401 })
    }

    const result = await payload.find({
      collection: 'vendors',
      where: { user: { equals: user.id } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json({
      docs: result.docs.map((vendor) => ({
        id: String(vendor.id),
        businessName: vendor.businessName,
      })),
    })
  } catch (error) {
    console.error('[vendor/membership-profiles] GET error:', error)
    return NextResponse.json({ error: 'Failed to load vendor profiles' }, { status: 500 })
  }
}
