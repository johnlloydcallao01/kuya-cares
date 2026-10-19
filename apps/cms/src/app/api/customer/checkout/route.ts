import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import {
  emptySellerShippingSettings,
  getSellerShippingOptions,
  getSellerShippingSettingsDigest,
  verifyShippingQuote,
  parseSellerShippingSettings,
  type ShippingAddress,
} from '@/services/SellerShippingService'
import {
  loadActiveMerchantCart,
  loadCustomerAddress,
  relationId,
  repriceActiveMerchantCart,
  resolveAuthenticatedCustomer,
} from '@/services/sellerShippingCheckout'
import { authenticateCustomerOrMember } from '@/utils/mediaLibrary'

export const dynamic = 'force-dynamic'

type JsonRecord = Record<string, unknown>

function addressSnapshot(address: JsonRecord | null): JsonRecord | null {
  if (!address) return null
  return {
    formattedAddress: address.formatted_address ?? null,
    street: address.street ?? address.route ?? null,
    locality: address.locality ?? null,
    province: address.administrative_area_level_1 ?? null,
    administrativeArea: address.administrative_area_level_2 ?? null,
    barangay: address.barangay ?? null,
    postalCode: address.postal_code ?? null,
    country: address.country ?? null,
    latitude: address.latitude ?? null,
    longitude: address.longitude ?? null,
    deliveryInstructions: address.delivery_instructions ?? null,
    landmarkDescription: address.landmark_description ?? null,
  }
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  try {
    const user = await authenticateCustomerOrMember(payload, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: JsonRecord
    try {
      const parsed: unknown = await request.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 })
      }
      body = parsed as JsonRecord
    } catch {
      return NextResponse.json({ error: 'The request body is not valid JSON.' }, { status: 400 })
    }

    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey) || typeof body.quoteToken !== 'string') {
      return NextResponse.json({ error: 'A valid idempotency key and shipping quote are required.' }, { status: 400 })
    }
    if (
      (body.notes !== undefined && typeof body.notes !== 'string') ||
      (typeof body.notes === 'string' && body.notes.trim().length > 2000)
    ) {
      return NextResponse.json({ error: 'Order notes must be text no longer than 2000 characters.' }, { status: 400 })
    }
    const customer = await resolveAuthenticatedCustomer(payload, user.id)
    if (!customer) return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 })

    const existing = await payload.find({
      collection: 'orders',
      where: { checkout_idempotency_key: { equals: idempotencyKey } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs[0]) {
      const order = existing.docs[0] as unknown as JsonRecord
      if (relationId(order.customer) !== String(customer.id)) {
        return NextResponse.json({ error: 'This checkout key is already in use.' }, { status: 409 })
      }
      return NextResponse.json({
        orderId: String(order.id),
        status: order.status,
        total: order.total,
        reused: true,
      })
    }

    const secret = process.env.PAYLOAD_SECRET
    if (!secret) throw new Error('PAYLOAD_SECRET is required to verify seller shipping quotes.')
    const quote = verifyShippingQuote(body.quoteToken, secret)
    if (quote.customerId !== String(customer.id)) {
      return NextResponse.json({ error: 'The shipping quote belongs to another customer.' }, { status: 403 })
    }

    const [merchant, items, address] = await Promise.all([
      payload.findByID({
        collection: 'merchants',
        id: Number(quote.merchantId) as never,
        depth: 0,
        overrideAccess: true,
      }) as Promise<unknown>,
      loadActiveMerchantCart(payload, String(customer.id), quote.merchantId),
      loadCustomerAddress(payload, quote.addressId, user.id),
    ]) as unknown as [JsonRecord, JsonRecord[], JsonRecord | null]
    if (merchant.isActive === false || merchant.isAcceptingOrders === false) {
      return NextResponse.json({ error: 'This seller is not accepting orders right now.' }, { status: 409 })
    }
    if (!items.length) return NextResponse.json({ error: 'Your cart is empty.' }, { status: 409 })
    if (quote.addressId && !address) {
      return NextResponse.json({ error: 'The quoted address is no longer available to this account.' }, { status: 403 })
    }
    const linkedOrderIds = [...new Set(items.map((item) => relationId(item.order_id)).filter((id): id is string => id !== null))]
    for (const linkedOrderId of linkedOrderIds) {
      const linkedOrder = await payload.findByID({
        collection: 'orders',
        id: Number(linkedOrderId) as never,
        depth: 0,
        overrideAccess: true,
      }) as unknown as JsonRecord
      if (linkedOrder.status !== 'cancelled') {
        return NextResponse.json({ error: 'This cart already has a checkout in progress.' }, { status: 409 })
      }
    }

    const { lines, subtotal } = await repriceActiveMerchantCart(payload, items, quote.merchantId)
    const settings = merchant.seller_shipping_settings == null
      ? emptySellerShippingSettings()
      : parseSellerShippingSettings(merchant.seller_shipping_settings)
    if (
      subtotal !== quote.cartSubtotal ||
      getSellerShippingSettingsDigest(settings) !== quote.settingsDigest
    ) {
      return NextResponse.json({ error: 'Your cart or the seller shipping settings changed. Please refresh checkout.' }, { status: 409 })
    }
    const options = getSellerShippingOptions({
      settings,
      address: address as ShippingAddress | null,
      cartSubtotal: subtotal,
    })
    const selectedOption = options.find((option) => option.id === quote.selectedOption.id)
    if (!selectedOption || JSON.stringify(selectedOption) !== JSON.stringify(quote.selectedOption)) {
      return NextResponse.json({ error: 'The selected shipping option is no longer available. Please refresh checkout.' }, { status: 409 })
    }

    const total = Math.round((subtotal + selectedOption.fee + Number.EPSILON) * 100) / 100
    const order = await payload.create({
      collection: 'orders',
      data: {
        customer: Number(customer.id),
        merchant: Number(quote.merchantId),
        status: 'pending',
        fulfillment_type: selectedOption.type === 'pickup' ? 'pickup' : 'delivery',
        total,
        subtotal,
        delivery_fee: selectedOption.fee,
        platform_fee: 0,
        priority_fee: 0,
        discount_total: 0,
        wallet_amount_used: 0,
        paid_with_wallet: false,
        commission_status: 'pending',
        checkout_idempotency_key: idempotencyKey,
        seller_shipping_snapshot: {
          version: 1,
          type: selectedOption.type,
          optionId: selectedOption.id,
          optionName: selectedOption.name,
          zoneId: selectedOption.zoneId,
          zoneName: selectedOption.zoneName,
          fee: selectedOption.fee,
          estimatedDeliveryMinMinutes: selectedOption.estimatedDeliveryMinMinutes,
          estimatedDeliveryMaxMinutes: selectedOption.estimatedDeliveryMaxMinutes,
          pickupInstructions: selectedOption.pickupInstructions,
          address: addressSnapshot(address),
        },
        notes: typeof body.notes === 'string' ? body.notes.trim() : undefined,
        placed_at: new Date().toISOString(),
      } as never,
      overrideAccess: true,
      context: { sellerShippingCheckout: true },
    })

    const createdItemIds: Array<string | number> = []
    const originalOrderLinks = new Map(
      items.map((item) => {
        const linkedOrderId = relationId(item.order_id)
        return [String(item.id), linkedOrderId ? Number(linkedOrderId) : null] as const
      }),
    )
    try {
      for (const line of lines) {
        const createdItem = await payload.create({
          collection: 'order-items',
          data: {
            order: order.id,
            product: Number(line.productId),
            merchant_product: Number(line.merchantProductId),
            product_name_snapshot: line.productName,
            price_at_purchase: line.unitPrice,
            quantity: line.quantity,
            options_snapshot: line.optionsSnapshot,
            total_price: line.totalPrice,
          } as never,
          overrideAccess: true,
        })
        createdItemIds.push(createdItem.id)
      }

      for (const item of items) {
        if (relationId(item.order_id)) {
          await payload.update({
            collection: 'cart-items',
            id: item.id as never,
            data: { order_id: null },
            overrideAccess: true,
          })
        }
        await payload.update({
          collection: 'cart-items',
          id: item.id as never,
          data: { order_id: order.id },
          overrideAccess: true,
        })
      }
    } catch (error) {
      for (const item of items) {
        try {
          await payload.update({
            collection: 'cart-items',
            id: item.id as never,
            data: { order_id: originalOrderLinks.get(String(item.id)) ?? null },
            overrideAccess: true,
          })
        } catch (cleanupError) {
          console.error('[customer/checkout] cart-link rollback error:', cleanupError)
        }
      }
      for (const itemId of createdItemIds) {
        try {
          await payload.delete({
            collection: 'order-items',
            id: itemId as never,
            overrideAccess: true,
          })
        } catch (cleanupError) {
          console.error('[customer/checkout] order-item rollback error:', cleanupError)
        }
      }
      try {
        await payload.delete({
          collection: 'orders',
          id: order.id,
          overrideAccess: true,
        })
      } catch (cleanupError) {
        console.error('[customer/checkout] order rollback error:', cleanupError)
      }
      throw error
    }

    return NextResponse.json({
      orderId: String(order.id),
      status: order.status,
      subtotal,
      deliveryFee: selectedOption.fee,
      total,
      reused: false,
    }, { status: 201 })
  } catch (error) {
    console.error('[customer/checkout] POST error:', error)
    const existingKey = error && typeof error === 'object' && 'code' in error &&
      String((error as { code?: unknown }).code).toLowerCase().includes('unique')
    if (existingKey) {
      return NextResponse.json({ error: 'This checkout is already being processed. Retry with the same idempotency key.' }, { status: 409 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create the checkout order.' },
      { status: 500 },
    )
  }
}
