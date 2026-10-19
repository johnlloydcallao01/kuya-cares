import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import {
  emptySellerShippingSettings,
  getSellerShippingOptions,
  getSellerShippingSettingsDigest,
  signShippingQuote,
  parseSellerShippingSettings,
  type ShippingAddress,
} from '@/services/SellerShippingService'
import {
  loadActiveMerchantCart,
  loadCustomerAddress,
  repriceActiveMerchantCart,
  resolveAuthenticatedCustomer,
} from '@/services/sellerShippingCheckout'
import { authenticateCustomerOrMember } from '@/utils/mediaLibrary'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const user = await authenticateCustomerOrMember(payload, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: Record<string, unknown>
    try {
      const parsed: unknown = await request.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 })
      }
      body = parsed as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'The request body is not valid JSON.' }, { status: 400 })
    }

    const merchantId = typeof body.merchantId === 'string' || typeof body.merchantId === 'number'
      ? String(body.merchantId)
      : ''
    const addressId = body.addressId == null ? null : String(body.addressId)
    if (!/^\d+$/.test(merchantId) || (addressId !== null && !/^\d+$/.test(addressId))) {
      return NextResponse.json({ error: 'A valid merchant and optional address are required.' }, { status: 400 })
    }

    const customer = await resolveAuthenticatedCustomer(payload, user.id)
    if (!customer) return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 })

    const merchant = await payload.findByID({
      collection: 'merchants',
      id: Number(merchantId) as never,
      depth: 0,
      overrideAccess: true,
    }) as unknown as Record<string, unknown>
    if (merchant.isActive === false || merchant.isAcceptingOrders === false) {
      return NextResponse.json({ error: 'This seller is not accepting orders right now.' }, { status: 409 })
    }

    const [items, address] = await Promise.all([
      loadActiveMerchantCart(payload, String(customer.id), merchantId),
      loadCustomerAddress(payload, addressId, user.id),
    ])
    if (!items.length) return NextResponse.json({ error: 'Your cart is empty.' }, { status: 409 })
    if (addressId && !address) {
      return NextResponse.json({ error: 'The selected address does not belong to this account.' }, { status: 403 })
    }

    const settings = merchant.seller_shipping_settings == null
      ? emptySellerShippingSettings()
      : parseSellerShippingSettings(merchant.seller_shipping_settings)
    const { subtotal } = await repriceActiveMerchantCart(payload, items, merchantId)
    const options = getSellerShippingOptions({
      settings,
      address: address as ShippingAddress | null,
      cartSubtotal: subtotal,
    })
    if (options.length === 0) {
      return NextResponse.json({ error: 'This seller does not deliver to the selected address and pickup is unavailable.' }, { status: 422 })
    }

    const secret = process.env.PAYLOAD_SECRET
    if (!secret) throw new Error('PAYLOAD_SECRET is required to sign seller shipping quotes.')
    const customerId = String(customer.id)
    const settingsDigest = getSellerShippingSettingsDigest(settings)
    const quotedOptions = options.map((option) => ({
      ...option,
      quoteToken: signShippingQuote({
        version: 1,
        customerId,
        merchantId,
        addressId,
        cartSubtotal: subtotal,
        selectedOption: option,
        settingsDigest,
      }, secret),
    }))

    return NextResponse.json({
      merchantId,
      addressId,
      cartSubtotal: subtotal,
      options: quotedOptions,
    })
  } catch (error) {
    console.error('[customer/checkout/shipping/quote] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to calculate seller shipping options.' },
      { status: 500 },
    )
  }
}
