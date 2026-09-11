/**
 * @file apps/cms/src/app/api/vendor/addresses/route.ts
 * @description BFF list endpoint for the web-merchant Active Address picker.
 * GET /api/vendor/addresses?merchantId=16 | ?outletId=16 | ?vendorId=5 -> filtered addresses
 * GET /api/vendor/addresses -> logged-in vendor's addresses
 *
 * EXACT mirror of `Merchants.activeAddress.filterOptions`
 * (apps/cms/src/collections/Merchants.ts:300-336):
 *
 *   merchants.vendor (id | populated) -> vendors.user (id | populated)
 *     -> addresses where { user equals vendorUserId }
 *
 * Admin description: "Currently active address for this merchant outlet
 * (business location) - only addresses owned by the vendor user".
 *
 * When no vendor can be resolved we return an empty list, mirroring the
 * collection's `return false` (Payload shows no options).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

export const dynamic = 'force-dynamic'

function getStr(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  return fallback
}

function getNum(val: unknown, fallback: number | null = null): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function sanitizeAddressDoc(a: Record<string, any>): Record<string, any> {
  return {
    id: Number(a.id),
    formatted_address: getStr(a.formatted_address),
    formattedAddress: getStr(a.formatted_address),
    street: getStr(a.street),
    locality: getStr(a.locality),
    province: getStr(a.administrative_area_level_1 || a.province),
    postal_code: getStr(a.postal_code),
    postalCode: getStr(a.postal_code),
    country: getStr(a.country, 'Philippines'),
    latitude: getNum(a.latitude),
    longitude: getNum(a.longitude),
    barangay: getStr(a.barangay),
    address_type: getStr(a.address_type),
    is_default: !!a.is_default,
    is_verified: !!a.is_verified,
  }
}

/**
 * Extract vendorUserId from a vendors doc, mirroring the collection's branches:
 * - vendor.user as id, or vendor.user as populated { id }.
 */
function vendorUserIdFromVendorDoc(vendor: Record<string, any> | null | undefined): number | null {
  if (!vendor?.user) return null
  const u = vendor.user as unknown
  if (typeof u === 'object' && u !== null && 'id' in (u as Record<string, unknown>)) {
    const id = Number((u as Record<string, unknown>).id)
    return Number.isFinite(id) ? id : null
  }
  const id = Number(u as string | number)
  return Number.isFinite(id) ? id : null
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const merchantParam = searchParams.get('merchantId') || searchParams.get('outletId')
    const vendorParam = searchParams.get('vendorId')
    const limitRaw = searchParams.get('limit')
    const limit = limitRaw ? Math.max(1, Math.min(500, Number(limitRaw) || 100)) : 200

    let vendorId: number | null = null
    let vendorUserId: number | null = null
    let merchantId: number | string | null = null

    // ── Branch 1: merchant/outlet context (mirrors filterOptions `data.vendor`) ──
    // data.vendor (id) -> vendors.findByID depth:1 -> vendors.user
    // data.vendor (populated with .user) -> direct extract
    if (merchantParam) {
      const numericMerchant = Number(merchantParam)
      merchantId = Number.isFinite(numericMerchant) ? numericMerchant : merchantParam
      let merchant: Record<string, any> | null = null
      try {
        merchant = (await payload.findByID({
          collection: 'merchants',
          id: merchantId as number,
          depth: 2,
          overrideAccess: true,
        })) as unknown as Record<string, any>
      } catch {
        return NextResponse.json({ error: 'Merchant outlet not found' }, { status: 404 })
      }
      if (!merchant) return NextResponse.json({ error: 'Merchant outlet not found' }, { status: 404 })

      // Ownership: outlet must belong to the logged-in vendor (same guard as outlets/[id])
      const vendorRes = await payload.find({
        collection: 'vendors',
        where: { user: { equals: authUser.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const ownVendor = vendorRes.docs[0] as Record<string, any> | undefined
      const merchantVendorId =
        typeof merchant.vendor === 'object' && merchant.vendor !== null
          ? (merchant.vendor as Record<string, unknown>).id
          : merchant.vendor
      if (!ownVendor || String(merchantVendorId) !== String(ownVendor.id)) {
        return NextResponse.json({ error: 'Forbidden: outlet does not belong to vendor' }, { status: 403 })
      }

      // Mirror collection: vendor as id -> fetch depth:1; vendor as object with .user -> extract
      if (typeof merchant.vendor === 'string' || typeof merchant.vendor === 'number') {
        try {
          const vendor = (await payload.findByID({
            collection: 'vendors',
            id: merchant.vendor as number,
            depth: 1,
            overrideAccess: true,
          })) as unknown as Record<string, any>
          vendorId = Number(vendor.id)
          vendorUserId = vendorUserIdFromVendorDoc(vendor)
        } catch (e) {
          console.error('[vendor/addresses] vendor lookup failed:', e)
        }
      } else if (merchant.vendor && typeof merchant.vendor === 'object') {
        const v = merchant.vendor as Record<string, any>
        vendorId = Number(v.id)
        if ((v as Record<string, unknown>).user) {
          vendorUserId = vendorUserIdFromVendorDoc(v)
        } else if (Number.isFinite(Number(v.id))) {
          // Populated without user (depth cut) — re-fetch depth:1 like the collection does
          try {
            const vendor = (await payload.findByID({
              collection: 'vendors',
              id: Number(v.id),
              depth: 1,
              overrideAccess: true,
            })) as unknown as Record<string, any>
            vendorUserId = vendorUserIdFromVendorDoc(vendor)
          } catch (e) {
            console.error('[vendor/addresses] vendor re-fetch failed:', e)
          }
        }
      }
    } else if (vendorParam) {
      // ── Branch 2: explicit vendor context ──
      const n = Number(vendorParam)
      if (!Number.isFinite(n)) return NextResponse.json({ error: 'vendorId must be numeric' }, { status: 400 })
      try {
        const vendor = (await payload.findByID({
          collection: 'vendors',
          id: n,
          depth: 1,
          overrideAccess: true,
        })) as unknown as Record<string, any>
        // Vendor must belong to the logged-in user (no cross-vendor listing)
        if (String(vendorUserIdFromVendorDoc(vendor)) !== String(authUser.id)) {
          return NextResponse.json({ error: 'Forbidden: vendor does not belong to user' }, { status: 403 })
        }
        vendorId = Number(vendor.id)
        vendorUserId = vendorUserIdFromVendorDoc(vendor)
      } catch {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
      }
    } else {
      // ── Branch 3: logged-in vendor (create-page case: no merchant yet) ──
      // Same resolution the outlets BFF uses: vendors where user == authUser.id.
      const vendorRes = await payload.find({
        collection: 'vendors',
        where: { user: { equals: authUser.id } },
        limit: 1,
        depth: 1,
        overrideAccess: true,
      })
      const vendor = (vendorRes.docs[0] as Record<string, any> | undefined) || null
      if (vendor) {
        vendorId = Number(vendor.id)
        vendorUserId = vendorUserIdFromVendorDoc(vendor)
      }
    }

    // Mirror collection `return false`: no vendor -> no options.
    if (vendorUserId == null) {
      return NextResponse.json({
        addresses: [],
        total: 0,
        vendorId,
        vendorUserId: null,
        merchantId,
        note: 'No vendor resolved — no Active Address options (mirrors Merchants.filterOptions returning false).',
      })
    }

    // The actual filterOptions where-clause: { user: { equals: vendorUserId } }
    const res = await payload.find({
      collection: 'addresses',
      where: { user: { equals: vendorUserId } },
      limit,
      depth: 0,
      sort: '-updatedAt',
      overrideAccess: true,
    })

    const addresses = (res.docs as Record<string, any>[]).map(sanitizeAddressDoc)

    return NextResponse.json({
      addresses,
      total: typeof res.totalDocs === 'number' ? res.totalDocs : addresses.length,
      vendorId,
      vendorUserId,
      merchantId,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch addresses'
    console.error('[vendor/addresses] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
