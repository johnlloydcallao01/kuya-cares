import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { createHash } from 'crypto'
import {
    ModifierResolverService,
    type EffectiveModifierGroup,
} from '../services/ModifierResolverService'
import {
    extractRelationshipId,
    extractRelationshipRelationTo,
    toFiniteNumber,
} from '../services/modifierUtils'

type SelectedModifierInput = {
    groupId?: unknown
    group_id?: unknown
    optionId?: unknown
    option_id?: unknown
}

type NormalizedSelectedModifier = {
    groupId: number
    groupName: string
    optionId: number
    name: string
    price: number
    isRequired: boolean
    source: string
}

function normalizeSelectedVariationInput(value: unknown): number | null {
    const relationTo = extractRelationshipRelationTo(value as never)

    if (relationTo && relationTo !== 'prod-variations') {
        throw new Error('selectedVariation must reference prod-variations only')
    }

    return extractRelationshipId(value as never)
}

function normalizeSelectedModifiers(
    rawValue: unknown,
    effectiveGroups: EffectiveModifierGroup[],
): NormalizedSelectedModifier[] {
    if (rawValue === null || rawValue === undefined) {
        rawValue = []
    }

    if (!Array.isArray(rawValue)) {
        throw new Error('selectedModifiers must be an array')
    }

    if (effectiveGroups.length === 0) {
        if (rawValue.length > 0) {
            throw new Error('This product does not support modifier selections')
        }

        return []
    }

    const groupsById = new Map(
        effectiveGroups.map((group) => [group.id, group]),
    )
    const seenSelections = new Set<string>()
    const selectionCounts = new Map<number, number>()
    const normalizedSelections: NormalizedSelectedModifier[] = []

    for (const rawEntry of rawValue as SelectedModifierInput[]) {
        const groupId = extractRelationshipId((rawEntry.groupId ?? rawEntry.group_id) as never)
        const optionId = extractRelationshipId((rawEntry.optionId ?? rawEntry.option_id) as never)

        if (!groupId || !optionId) {
            throw new Error('Each selected modifier must include valid groupId and optionId values')
        }

        const group = groupsById.get(groupId)
        if (!group) {
            throw new Error(`Modifier group ${groupId} is not valid for this selection`)
        }

        const option = group.options.find((candidate) => candidate.id === optionId)
        if (!option || !option.isAvailable) {
            throw new Error(`Modifier option ${optionId} is not available for group "${group.name}"`)
        }

        const uniquenessKey = `${groupId}:${optionId}`
        if (seenSelections.has(uniquenessKey)) {
            throw new Error(`Modifier option "${option.name}" was selected more than once`)
        }
        seenSelections.add(uniquenessKey)

        selectionCounts.set(groupId, (selectionCounts.get(groupId) ?? 0) + 1)
        normalizedSelections.push({
            groupId,
            groupName: group.name,
            optionId,
            name: option.name,
            price: option.priceAdjustment,
            isRequired: group.isRequired,
            source: group.source,
        })
    }

    for (const group of effectiveGroups) {
        const count = selectionCounts.get(group.id) ?? 0
        const requiredMinimum = group.isRequired
            ? Math.max(1, group.minSelections)
            : 0

        if (group.selectionType === 'single' && count > 1) {
            throw new Error(`Modifier group "${group.name}" only allows one selection`)
        }

        if (count < requiredMinimum) {
            throw new Error(`Modifier group "${group.name}" requires at least ${requiredMinimum} selection(s)`)
        }

        if (group.maxSelections !== null && count > group.maxSelections) {
            throw new Error(`Modifier group "${group.name}" allows at most ${group.maxSelections} selection(s)`)
        }
    }

    return normalizedSelections.sort((a, b) => {
        if (a.groupId !== b.groupId) {
            return a.groupId - b.groupId
        }

        return a.optionId - b.optionId
    })
}

export const CartItems: CollectionConfig = {
    slug: 'cart-items',
    admin: {
        useAsTitle: 'id',
        defaultColumns: ['customer', 'merchant', 'product', 'quantity', 'updatedAt'],
        group: 'Food Delivery',
        description: 'Customer shopping cart items'
    },
    access: {
        read: ({ req: { user } }) => {
            if (user) {
                if (user.role === 'service' || user.role === 'admin') {
                    return true
                }
            }
            return false
        },
        create: ({ req: { user } }) => {
            return user?.role === 'service' || user?.role === 'admin' || false
        },
        update: ({ req: { user } }) => {
            return user?.role === 'service' || user?.role === 'admin' || false
        },
        delete: ({ req: { user } }) => {
            return user?.role === 'service' || user?.role === 'admin' || false
        },
    },
    fields: [
        // === RELATIONSHIPS ===
        {
            name: 'customer',
            type: 'relationship',
            relationTo: 'customers',
            required: true,
            admin: {
                description: 'Customer who owns this cart item'
            }
        },
        {
            name: 'merchant',
            type: 'relationship',
            relationTo: 'merchants',
            required: true,
            admin: {
                description: 'Merchant from which product is being ordered'
            }
        },
        {
            name: 'product',
            type: 'relationship',
            relationTo: 'products',
            required: true,
            admin: {
                description: 'Product being added to cart'
            }
        },
        {
            name: 'merchantProduct',
            type: 'relationship',
            relationTo: 'merchant-products',
            required: true,
            admin: {
                description: 'Merchant-product junction record for price and availability'
            }
        },

        // === LIFECYCLE & SOFT DELETE ===
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'active',
            options: [
                { label: 'Active', value: 'active' },
                { label: 'Checked Out', value: 'checked_out' },
                { label: 'Ordered', value: 'ordered' },
                { label: 'Abandoned', value: 'abandoned' },
                { label: 'Removed', value: 'removed' }
            ],
            admin: {
                description: 'Core state of the cart item. Used for soft clearing instead of hard deletion.'
            }
        },
        {
            name: 'order_id',
            type: 'relationship',
            relationTo: 'orders',
            admin: {
                description: 'Links the cart item to the order it became (if status is ordered or checked_out)'
            }
        },
        {
            name: 'ordered_at',
            type: 'date',
            admin: {
                description: 'Timestamp of when the item was converted to an order'
            }
        },
        {
            name: 'deleted_at',
            type: 'date',
            admin: {
                description: 'Timestamp for soft deletion. If set, item is treated as deleted.'
            }
        },

        // === QUANTITY & PRICING ===
        {
            name: 'quantity',
            type: 'number',
            required: true,
            min: 1,
            max: 999,
            defaultValue: 1,
            admin: {
                description: 'Quantity of this product'
            }
        },
        {
            name: 'priceAtAdd',
            type: 'number',
            required: true,
            min: 0,
            admin: {
                description: 'Price snapshot when added to cart (from merchant-products or product basePrice)',
                step: 0.01
            }
        },
        {
            name: 'compareAtPrice',
            type: 'number',
            min: 0,
            admin: {
                description: 'Original price before discount. Shows strike-through price in UI when item is on sale. E.g., ₱150 (crossed out) → ₱120',
                step: 0.01
            }
        },
        {
            name: 'subtotal',
            type: 'number',
            required: true,
            min: 0,
            admin: {
                description: 'Calculated: (priceAtAdd + modifier costs + addon costs) * quantity',
                readOnly: true,
                step: 0.01
            }
        },

        // === PRODUCT CUSTOMIZATION ===
        {
            name: 'productSize',
            type: 'select',
            options: [
                { label: 'Small', value: 'small' },
                { label: 'Medium', value: 'medium' },
                { label: 'Large', value: 'large' },
                { label: 'Extra Large', value: 'extra_large' }
            ],
            admin: {
                description: 'Product size variant if applicable'
            }
        },
        {
            name: 'selectedVariation',
            type: 'relationship',
            relationTo: 'prod-variations',
            admin: {
                description: 'Selected product variation (if product type is variable)'
            }
        },
        {
            name: 'selectedModifiers',
            type: 'json',
            admin: {
                description: 'Modifiers/options: [{ groupId, optionId, name, price }]. E.g., spice level, cooking preference'
            }
        },
        {
            name: 'selectedAddons',
            type: 'json',
            admin: {
                description: 'Add-ons/extras: [{ id, name, price, quantity }]. E.g., extra cheese, drinks, sides'
            }
        },

        // === INSTRUCTIONS ===
        {
            name: 'specialInstructions',
            type: 'textarea',
            maxLength: 500,
            admin: {
                description: 'Cooking/preparation instructions. E.g., "No onions", "Extra spicy", "Well done"'
            }
        },
        {
            name: 'notesForRider',
            type: 'textarea',
            maxLength: 300,
            admin: {
                description: 'Delivery instructions for driver. E.g., "Ring doorbell twice", "Leave at gate"'
            }
        },

        // === DUPLICATE DETECTION ===
        {
            name: 'itemHash',
            type: 'text',
            admin: {
                description: 'MD5 hash of product+size+modifiers+addons+variation+instructions for duplicate detection',
                readOnly: true
            }
        },

        // === AVAILABILITY STATUS ===
        {
            name: 'isAvailable',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'Whether item is currently available (merchant-product availability, NOT price changes)'
            }
        },
        {
            name: 'unavailableReason',
            type: 'text',
            admin: {
                description: 'Reason if unavailable. E.g., "Out of stock", "Merchant closed"'
            }
        },

        // === EXPIRATION & CLEANUP ===
        {
            name: 'expiresAt',
            type: 'date',
            admin: {
                description: 'Cart item expiration date (30 days from last update). For automated cleanup jobs.',
                readOnly: true
            }
        },

        // === SESSION (FOR FUTURE) ===
        {
            name: 'sessionId',
            type: 'text',
            admin: {
                description: 'Session identifier for guest checkout (future feature)'
            }
        },
    ],

    indexes: [
        {
            fields: ['customer', 'merchant']
        },
        {
            fields: ['customer', 'itemHash']
        },
        {
            fields: ['itemHash'] // Faster hash lookups during duplicate check
        },
        {
            fields: ['updatedAt']
        },
        {
            fields: ['expiresAt'] // For cleanup jobs
        }
    ],

    timestamps: true,

    hooks: {
        beforeChange: [
            async ({ data, operation, req, originalDoc }) => {
                const currentProductId = extractRelationshipId(
                    (data.product ?? originalDoc?.product) as never,
                )
                const currentMerchantProductId = extractRelationshipId(
                    (data.merchantProduct ?? originalDoc?.merchantProduct) as never,
                )
                const rawSelectedVariation = data.selectedVariation ?? originalDoc?.selectedVariation
                const currentVariationId = normalizeSelectedVariationInput(rawSelectedVariation)

                if (data.selectedVariation !== undefined) {
                    data.selectedVariation = currentVariationId
                }

                let effectiveModifierGroups: EffectiveModifierGroup[] = []

                if (currentProductId) {
                    const product = await req.payload.findByID({
                        collection: 'products',
                        id: currentProductId,
                        depth: 0,
                    })

                    if (product.productType === 'variable' && !currentVariationId) {
                        throw new Error('Variable products require a selectedVariation')
                    }

                    if (product.productType !== 'variable' && currentVariationId) {
                        throw new Error('selectedVariation can only be used for variable products')
                    }

                    if (currentVariationId) {
                        const variation = await req.payload.findByID({
                            collection: 'prod-variations',
                            id: currentVariationId,
                            depth: 0,
                        })

                        const variationProductId = extractRelationshipId(variation.product_id as never)
                        if (variationProductId !== currentProductId) {
                            throw new Error('Selected variation does not belong to the requested product')
                        }
                    }

                    const modifierResolver = new ModifierResolverService(req.payload)
                    effectiveModifierGroups = await modifierResolver.resolveEffectiveGroups({
                        productId: currentProductId,
                        variationId: currentVariationId,
                        merchantProductId: currentMerchantProductId,
                    })
                }

                const currentModifiersRaw = data.selectedModifiers ?? originalDoc?.selectedModifiers
                const normalizedModifiers = normalizeSelectedModifiers(
                    currentModifiersRaw,
                    effectiveModifierGroups,
                )
                data.selectedModifiers = normalizedModifiers

                // === VALIDATION: Quantity ===
                if (data.quantity !== undefined) {
                    if (data.quantity < 1 || data.quantity > 999) {
                        throw new Error('Quantity must be between 1 and 999')
                    }
                }

                // === VALIDATION: Price ===
                if (data.priceAtAdd !== undefined && data.priceAtAdd < 0) {
                    throw new Error('Price cannot be negative')
                }

                // === AUTO-UPDATE: Expiration Date ===
                const expiryDate = new Date()
                expiryDate.setDate(expiryDate.getDate() + 30) // 30 days from now
                data.expiresAt = expiryDate

                // === GENERATE: Item Hash (MD5) ===
                const hashComponents = {
                    product: currentProductId,
                    merchantProduct: extractRelationshipId(
                        (data.merchantProduct ?? originalDoc?.merchantProduct) as never,
                    ),
                    productSize: data.productSize || null,
                    selectedModifiers: normalizedModifiers,
                    selectedAddons: data.selectedAddons || [],
                    selectedVariation: currentVariationId,
                    specialInstructions: (data.specialInstructions || '').trim().toLowerCase()
                }

                // Sort keys for deterministic hashing
                const hashString = JSON.stringify(hashComponents, Object.keys(hashComponents).sort())
                data.itemHash = createHash('md5').update(hashString).digest('hex')

                // === DUPLICATE CHECK: Merge if identical customization ===
                if (operation === 'create') {
                    const existingItem = await req.payload.find({
                        collection: 'cart-items',
                        where: {
                            and: [
                                { customer: { equals: data.customer } },
                                { merchant: { equals: data.merchant } },
                                { itemHash: { equals: data.itemHash } },
                                { status: { equals: 'active' } }
                            ]
                        },
                        limit: 1
                    })

                    if (existingItem.docs.length > 0) {
                        const existing = existingItem.docs[0]
                        await req.payload.update({
                            collection: 'cart-items',
                            id: existing.id,
                            data: {
                                quantity: existing.quantity + data.quantity
                            }
                        })
                        // Throw special error that API can catch
                        throw new APIError(`CART_ITEM_MERGED:${existing.id}`, 400, undefined, true)
                    }
                }

                // === CALCULATE: Subtotal ===
                const currentPriceAtAdd = data.priceAtAdd ?? originalDoc?.priceAtAdd;
                const currentQuantity = data.quantity ?? originalDoc?.quantity;
                const currentModifiers = normalizedModifiers;
                const currentAddons = data.selectedAddons ?? originalDoc?.selectedAddons;

                if (currentPriceAtAdd !== undefined && currentQuantity !== undefined) {
                    let modifierTotal = 0
                    let addonTotal = 0

                    if (currentModifiers && Array.isArray(currentModifiers)) {
                        modifierTotal = currentModifiers.reduce((sum: number, mod: NormalizedSelectedModifier) => sum + toFiniteNumber(mod.price), 0)
                    }

                    if (currentAddons && Array.isArray(currentAddons)) {
                        addonTotal = currentAddons.reduce((sum: number, addon: any) => {
                            return sum + ((addon.price || 0) * (addon.quantity || 1))
                        }, 0)
                    }

                    data.subtotal = (currentPriceAtAdd + modifierTotal + addonTotal) * currentQuantity
                }

                // === VALIDATE: Merchant-Vendor Relationship ===
                if (operation === 'create' && data.merchant && data.product) {
                    const merchant = await req.payload.findByID({
                        collection: 'merchants',
                        id: data.merchant,
                        depth: 1
                    })

                    const product = await req.payload.findByID({
                        collection: 'products',
                        id: data.product,
                        depth: 0
                    })

                    const merchantVendorId = typeof merchant.vendor === 'object' ? merchant.vendor?.id : merchant.vendor

                    const productVendorId = typeof product.createdByVendor === 'object' ? product.createdByVendor?.id : product.createdByVendor;
                    const productMerchantId = typeof product.createdByMerchant === 'object' ? product.createdByMerchant?.id : product.createdByMerchant;

                    // A product is valid if:
                    // 1. It was created by the same vendor as the merchant
                    // 2. Or it was created by the specific merchant itself
                    // 3. Or if it has no vendor/merchant (e.g. global admin product) - optional, but let's be strict for now and require match if set
                    if (productVendorId && String(merchantVendorId) !== String(productVendorId)) {
                        throw new Error(
                            `Cannot add product "${product.name}" (vendor ${productVendorId}) ` +
                            `to cart for merchant "${merchant.outletName}" (vendor ${merchantVendorId}). ` +
                            `Product must belong to merchant's vendor.`
                        )
                    }

                    if (productMerchantId && String(merchant.id) !== String(productMerchantId)) {
                        throw new Error(
                            `Cannot add product "${product.name}" to cart for merchant "${merchant.outletName}". ` +
                            `Product is exclusive to a different merchant.`
                        )
                    }
                }

                return data
            }
        ],

        beforeDelete: [
            async ({ req: _req, id }) => {
                console.log(`🗑️ Removing cart item ${id}`)
            }
        ]
    }
}
