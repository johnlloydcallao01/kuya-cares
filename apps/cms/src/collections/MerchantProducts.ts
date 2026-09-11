import { CollectionConfig } from 'payload'
import { ModifierResolverService } from '../services/ModifierResolverService'

export const MerchantProducts: CollectionConfig = {
  slug: 'merchant-products',
  labels: {
    singular: 'Merchant Product',
    plural: 'Merchant Products',
  },
  admin: {
    useAsTitle: 'display_title',
    defaultColumns: ['display_title', 'merchant_id', 'product_id', 'is_active', 'is_available'],
    group: 'Product Management',
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create' || operation === 'update') {
          try {
            const payload = req.payload
            let productName = ''
            let merchantName = ''

            if (data.product_id) {
              const pId = typeof data.product_id === 'object' ? data.product_id.id : data.product_id
              const product = await payload.findByID({
                collection: 'products',
                id: pId,
              })
              if (product) productName = product.name
            }

            if (data.merchant_id) {
              const mId = typeof data.merchant_id === 'object' ? data.merchant_id.id : data.merchant_id
              const merchant = await payload.findByID({
                collection: 'merchants',
                id: mId,
              })
              if (merchant) merchantName = merchant.outletName
            }

            data.display_title = `${productName} (${merchantName})`
          } catch (e) {
            console.error('Error populating display_title for MerchantProduct', e)
          }
        }
        return data
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        const payload = req.payload
        console.log(`🗑️ Cleaning up cart items before deleting merchant-product ${id}`)
        try {
          const cartItems = await payload.find({
            collection: 'cart-items',
            where: { merchantProduct: { equals: id } },
            limit: 1000,
          })
          for (const ci of cartItems.docs) {
            await payload.delete({ collection: 'cart-items', id: ci.id })
          }

          const cleanupCollections = [
            'merchant-product-modifier-group-overrides',
            'merchant-product-modifier-option-overrides',
            'merchant-variation-modifier-group-overrides',
            'merchant-variation-modifier-option-overrides',
          ] as const

          for (const collection of cleanupCollections) {
            const docs = await payload.find({
              collection,
              where: { merchant_product_id: { equals: id } },
              limit: 1000,
              depth: 0,
            })

            for (const doc of docs.docs) {
              await payload.delete({ collection, id: doc.id })
            }
          }

          console.log(`✅ Cart items cleanup complete for merchant-product ${id}`)
        } catch (e) {
          console.error('❌ Error cleaning up cart items for merchant-product', e)
          throw e
        }
      },
    ],
    afterRead: [
      async ({ doc, req }) => {
        if (req.context?.skipEffectiveModifierPreview) return doc

        const productId = typeof doc?.product_id === 'object' ? doc.product_id?.id : doc?.product_id
        if (!productId || !doc?.id) {
          return doc
        }

        try {
          const resolver = new ModifierResolverService(req.payload)
          const effectiveModifiers = await resolver.resolveEffectiveGroups({
            productId: Number(productId),
            merchantProductId: Number(doc.id),
          })

          ;(doc as Record<string, unknown>).effective_modifier_preview = effectiveModifiers
        } catch {}

        return doc
      },
    ],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'display_title',
      type: 'text',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'merchant_id',
      type: 'relationship',
      relationTo: 'merchants',
      required: true,
      label: 'Merchant',
    },
    {
      name: 'product_id',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      label: 'Product',
      filterOptions: async ({ relationTo: _relationTo, data, user: _user, req }) => {
        // Only show products that belong to the same vendor as the selected merchant
        if (data?.merchant_id) {
          try {
            // Get the merchant to find its vendor
            const merchant = await req.payload.findByID({
              collection: 'merchants',
              id: data.merchant_id,
              depth: 1, // Populate the vendor relationship
            })

            // Validate that merchant exists and has a valid vendor
            if (merchant?.vendor) {
              let vendorId;
              
              // Handle both populated vendor object and vendor ID
              if (typeof merchant.vendor === 'object' && merchant.vendor.id) {
                vendorId = merchant.vendor.id;
              } else if (typeof merchant.vendor === 'string' || typeof merchant.vendor === 'number') {
                vendorId = merchant.vendor;
              }

              // Ensure vendorId is valid and not NaN
              if (vendorId && !isNaN(Number(vendorId))) {
                return {
                  createdByVendor: {
                    equals: vendorId,
                  },
                }
              }
            }
          } catch (error) {
            console.error('Error filtering products by merchant vendor:', error)
          }
        }

        // If no merchant selected, invalid vendor, or error occurred, show no products
        return false
      },
      admin: {
        description: 'Product (filtered to show only products owned by the merchant\'s vendor)',
      },
    },
    {
      name: 'added_by',
      type: 'select',
      options: [
        { label: 'Vendor', value: 'vendor' },
        { label: 'Merchant', value: 'merchant' },
      ],
      label: 'Added By',
      admin: {
        description: 'Who assigned this product to the merchant',
      },
    },
    {
      name: 'price_override',
      type: 'number',
      label: 'Price Override',
      admin: {
        description: 'Override product price (null = use product default)',
        step: 0.01,
      },
    },
    {
      name: 'stock_quantity',
      type: 'number',
      label: 'Stock Quantity',
      defaultValue: 0,
      admin: {
        description: 'Per-merchant available units',
      },
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Is Active',
    },
    {
      name: 'is_available',
      type: 'checkbox',
      defaultValue: true,
      label: 'Is Available',
      admin: {
        description: 'Quick toggle on/off',
      },
    },
    {
      name: 'merchant_modifier_configuration_hint',
      type: 'textarea',
      label: 'Merchant Modifier Configuration Guide',
      admin: {
        readOnly: true,
        description:
          'Read-only guidance for admins. Use Merchant Product Modifier Overrides for merchant-wide base changes, and Merchant Variation Modifier Overrides when one merchant needs different rules for one selected variation.',
      },
      defaultValue:
        'Use Merchant Product Modifier Overrides for merchant-wide base rules. Use Merchant Variation Modifier Overrides for variation-specific merchant customization.',
    },
    {
      name: 'effective_modifier_preview',
      type: 'json',
      label: 'Effective Modifier Preview',
      admin: {
        readOnly: true,
        description:
          'Read-only preview of the merchant-level effective modifiers for the base product context. Variation-specific merchant overrides are applied when a variation is selected through merchant-aware reads.',
      },
    },
  ],
  timestamps: true,
}
