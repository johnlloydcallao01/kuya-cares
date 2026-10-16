import type { CollectionConfig, Where } from 'payload'
import { extractRelationshipId } from '../services/modifierUtils'
import { normalizeOrderItemOptionsSnapshot } from '../services/orderItemSnapshot'
import { validateOrderItemSnapshot } from '../services/orderItemValidation'

export const OrderItems: CollectionConfig = {
  slug: 'order-items',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['order', 'merchant_product', 'product_name_snapshot', 'quantity', 'total_price'],
    group: 'Ordering System',
    description: 'Links products to an order with Snapshot Pricing',
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
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      required: true,
      admin: {
        description: 'Parent order',
      },
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      // required: true, // Removed to allow product deletion while keeping order history
      admin: {
        description: 'Reference to the base product (for analytics)',
      },
    },
    {
      name: 'merchant_product',
      type: 'relationship',
      relationTo: 'merchant-products',
      // required: true, // Removed to allow product deletion while keeping order history
      filterOptions: async ({ data, req }): Promise<Where> => {
        if (!data?.order) {
          return {}
        }

        try {
          const orderValue = data.order
          const orderId = typeof orderValue === 'object' ? orderValue.id : orderValue

          if (!orderId) {
            return {}
          }

          const order = await req.payload.findByID({
            collection: 'orders',
            id: orderId,
            depth: 0,
          })

          if (!order?.merchant) {
            return {}
          }

          const merchantValue = order.merchant
          const merchantId = typeof merchantValue === 'object' ? merchantValue.id : merchantValue

          if (!merchantId) {
            return {}
          }

          return {
            merchant_id: {
              equals: merchantId,
            },
          }
        } catch (e) {
          console.error('Error filtering merchant_product options by order merchant', e)
          return {}
        }
      },
      admin: {
        description: 'Reference to the specific merchant listing',
      },
    },
    {
      name: 'product_name_snapshot',
      type: 'text',
      required: true,
      admin: {
        description: 'SNAPSHOT: Name of product at time of purchase',
      },
    },
    {
      name: 'price_at_purchase',
      type: 'number',
      required: true,
      admin: {
        description: 'SNAPSHOT: Customer unit price recorded at checkout before order-level discounts; includes the selected product/variation price.',
      },
    },
    {
      name: 'vendor_cost_at_purchase',
      type: 'number',
      min: 0,
      access: {
        read: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'service',
        create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'service',
        update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'service',
      },
      admin: {
        readOnly: true,
        description:
          'Private immutable unit cost copied from the product when this order item is created; used for commission calculations.',
      },
    },
    {
      name: 'quantity',
      type: 'number',
      required: true,
      admin: {
        description: 'Count of items',
      },
    },
    {
      name: 'options_snapshot',
      type: 'json',
      admin: {
        description:
          'SNAPSHOT: Selected variation and modifier history. Example: [{ "entryType": "variation", "name": "Large", "selectedVariationId": 12, "price": 0 }, { "entryType": "modifier", "groupName": "Add-ons", "optionName": "Java Rice", "price": 20 }]',
      },
    },
    {
      name: 'total_price',
      type: 'number',
      required: true,
      admin: {
        description: 'SNAPSHOT: Pre-discount customer item subtotal, including quantity and modifiers/options. Excludes delivery and order-level discounts; used for pre-discount commission calculations.',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, operation, originalDoc, req }) => {
        if (!data) {
          return data
        }

        const originalCost = originalDoc?.vendor_cost_at_purchase
        if (originalCost !== undefined && originalCost !== null) {
          data.vendor_cost_at_purchase = originalCost
        } else if (req?.payload) {
          const productId = extractRelationshipId(
            (data.product ?? originalDoc?.product) as never,
          )
          if (productId) {
            const product = await req.payload.findByID({
              collection: 'products',
              id: productId as never,
              depth: 0,
              overrideAccess: true,
              req,
            })
            const vendorCost = Number((product as unknown as { vendorCost?: unknown }).vendorCost)
            data.vendor_cost_at_purchase =
              Number.isFinite(vendorCost) && vendorCost >= 0 ? vendorCost : null
          } else {
            data.vendor_cost_at_purchase = null
          }
        } else {
          data.vendor_cost_at_purchase = null
        }

        const optionsSnapshot = data.options_snapshot ?? originalDoc?.options_snapshot
        if (optionsSnapshot !== undefined) {
          const productId = extractRelationshipId(
            (data.product ?? originalDoc?.product) as never,
          )
          const merchantProductId = extractRelationshipId(
            (data.merchant_product ?? originalDoc?.merchant_product) as never,
          )

          if (!req?.payload) {
            data.options_snapshot = normalizeOrderItemOptionsSnapshot(optionsSnapshot)
            return data
          }

          return validateOrderItemSnapshot({
            payload: req.payload,
            productId,
            merchantProductId,
            optionsSnapshot,
            requireStructuredEntries: operation === 'create',
          }).then(() => {
            data.options_snapshot = normalizeOrderItemOptionsSnapshot(optionsSnapshot)
            return data
          })
        }

        return data
      },
    ],
  },
}
