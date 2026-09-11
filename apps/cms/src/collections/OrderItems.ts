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
        description: 'SNAPSHOT: The price/unit paid (overrides current catalog price)',
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
        description: 'price_at_purchase * quantity + modifiers',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, operation, originalDoc, req }) => {
        if (!data) {
          return data
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
