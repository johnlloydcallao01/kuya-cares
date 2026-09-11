import { CollectionConfig, type Where } from 'payload'
import config from '@payload-config'
import { getPayload } from 'payload'
import { ModifierResolverService } from '../services/ModifierResolverService'

export const ProdVariations: CollectionConfig = {
  slug: 'prod-variations',
  labels: {
    singular: 'Product Variation',
    plural: 'Product Variations',
  },
  admin: {
    useAsTitle: 'sku',
    defaultColumns: ['name', 'sku', 'product_id', 'base_price', 'compare_at_price', 'stock_quantity'],
    group: 'Product Management',
    description: 'Sellable variations for variable products, including variation-specific and hybrid modifier behavior.',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'product_id',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      label: 'Variable Product',
      admin: {
        description: 'The variable product this variation belongs to',
      },
    },
    {
      name: 'modifier_behavior_mode',
      type: 'select',
      required: true,
      defaultValue: 'inherit_product',
      label: 'Modifier Behavior Mode',
      options: [
        { label: 'Inherit Product', value: 'inherit_product' },
        { label: 'Variation Specific', value: 'variation_specific' },
        { label: 'Hybrid', value: 'hybrid' },
      ],
      admin: {
        description:
          'Inherit Product = use only product-level modifiers. Variation Specific = use only variation-owned groups. Hybrid = combine product groups with overrides and variation-only groups.',
      },
    },
    {
      name: 'name',
      type: 'text',
      label: 'Variation Name',
    },
    {
      name: 'short_description',
      type: 'textarea',
      label: 'Short Description',
      admin: {
        description: 'Brief variation description (max 500 characters)'
      },
      maxLength: 500,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Image',
      admin: { description: 'Variation image' },
    },
    {
      name: 'sku',
      type: 'text',
      label: 'SKU',
    },
    {
      name: 'base_price',
      type: 'number',
      label: 'Base Price',
      admin: { step: 0.01 },
    },
    {
      name: 'compare_at_price',
      type: 'number',
      label: 'Compare At Price',
      admin: { step: 0.01 },
    },
    {
      name: 'stock_quantity',
      type: 'number',
      label: 'Stock Quantity',
      defaultValue: 0,
    },
    {
      name: 'is_used_for_variations',
      type: 'checkbox',
      defaultValue: true,
      label: 'Used for Variations',
      admin: {
        description: 'Whether this attribute is used to create variations',
      },
    },
    {
      name: 'is_visible',
      type: 'checkbox',
      defaultValue: true,
      label: 'Visible',
      admin: {
        description: 'Whether shown on product page',
      },
    },
    {
      name: 'sort_order',
      type: 'number',
      defaultValue: 0,
      label: 'Sort Order',
    },
    {
      name: 'modifier_configuration_hint',
      type: 'textarea',
      label: 'Modifier Configuration Guide',
      admin: {
        readOnly: true,
        description:
          'Read-only guidance for admins. Use variation-modifier-groups for variation-specific groups, and variation-modifier-group-overrides / variation-modifier-option-overrides for hybrid inheritance rules.',
      },
      defaultValue:
        'Choose a Modifier Behavior Mode first. Then manage the related records in Variation Modifier Groups / Options and Variation Modifier Overrides.',
    },
    {
      name: 'effective_modifier_preview',
      type: 'json',
      label: 'Effective Modifier Preview',
      admin: {
        readOnly: true,
        description:
          'Read-only preview of the final effective modifier configuration for this variation after inheritance, variation-specific ownership, and hybrid overrides are applied.',
      },
    },
  ],
  hooks: {
    beforeDelete: [
      async ({ id, req }) => {
        const payload = req?.payload ?? (await getPayload({ config }))

        const cleanupCollections: Array<{
          collection:
            | 'prod-variation-values'
            | 'variation-modifier-groups'
            | 'variation-modifier-group-overrides'
            | 'variation-modifier-option-overrides'
            | 'merchant-variation-modifier-group-overrides'
            | 'merchant-variation-modifier-option-overrides'
          where: Where
        }> = [
          {
            collection: 'prod-variation-values',
            where: { variation_id: { equals: id } },
          },
          {
            collection: 'variation-modifier-groups',
            where: { variation_id: { equals: id } },
          },
          {
            collection: 'variation-modifier-group-overrides',
            where: { variation_id: { equals: id } },
          },
          {
            collection: 'variation-modifier-option-overrides',
            where: { variation_id: { equals: id } },
          },
          {
            collection: 'merchant-variation-modifier-group-overrides',
            where: { variation_id: { equals: id } },
          },
          {
            collection: 'merchant-variation-modifier-option-overrides',
            where: { variation_id: { equals: id } },
          },
        ]

        for (const item of cleanupCollections) {
          const result = await payload.find({
            collection: item.collection,
            where: item.where,
            limit: 1000,
          })

          for (const doc of result.docs) {
            await payload.delete({
              collection: item.collection,
              id: doc.id,
            })
          }
        }
      },
    ],
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        const op = operation
        if (op !== 'create' && op !== 'update') return
        if (data && 'effective_modifier_preview' in data) {
          delete (data as Record<string, unknown>).effective_modifier_preview
        }
        const raw = (data?.product_id ?? undefined) as unknown
        const productId =
          typeof raw === 'object' && raw !== null && 'id' in (raw as object)
            ? (raw as { id: number | string }).id
            : (raw as number | string | undefined)
        if (!productId) return
        try {
          const payload = req?.payload ?? (await getPayload({ config }))
          const res = await payload.find({ collection: 'products', where: { id: { equals: productId } }, limit: 1 })
          const p = res.docs?.[0]
          const slug = (p?.slug ?? '') as string
          if (!slug) return
          const idForSku = op === 'update' ? (originalDoc?.id as number | string | undefined) : (data?.id as number | string | undefined)
          const expected = `${slug}-${String(productId)}-VAR-${String(idForSku ?? '')}`.toUpperCase()
          ;(data as Record<string, unknown>).sku = expected
        } catch {}
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        if (req?.context?.skipSkuUpdate) return
        if (operation !== 'create') return
        const productRaw = doc?.product_id as unknown
        const productId =
          typeof productRaw === 'object' && productRaw !== null && 'id' in (productRaw as object)
            ? (productRaw as { id: number | string }).id
            : (productRaw as number | string | undefined)
        if (!productId || !doc?.id) return
        try {
          const payload = req?.payload ?? (await getPayload({ config }))
          const res = await payload.find({ collection: 'products', where: { id: { equals: productId } }, limit: 1 })
          const p = res.docs?.[0]
          const slug = (p?.slug ?? '') as string
          if (!slug) return
          const expected = `${slug}-${String(productId)}-VAR-${String(doc.id)}`.toUpperCase()
          doc.sku = expected as unknown as string
          await payload.update({
            collection: 'prod-variations',
            id: String(doc.id),
            data: { sku: expected },
            context: { skipSkuUpdate: true },
          })
        } catch {}
      },
    ],
    afterRead: [
      async ({ doc, req }) => {
        const productRaw = doc?.product_id as unknown
        const productId =
          typeof productRaw === 'object' && productRaw !== null && 'id' in (productRaw as object)
            ? (productRaw as { id: number | string }).id
            : (productRaw as number | string | undefined)
        if (!productId || !doc?.id) return
        try {
          const payload = req?.payload ?? (await getPayload({ config }))
          const res = await payload.find({ collection: 'products', where: { id: { equals: productId } }, limit: 1 })
          const p = res.docs?.[0]
          const slug = (p?.slug ?? '') as string
          if (!slug) return
          const expected = `${slug}-${String(productId)}-VAR-${String(doc.id)}`.toUpperCase()
          doc.sku = expected as unknown as string
          const resolver = new ModifierResolverService(payload)
          const effectiveModifiers = await resolver.resolveEffectiveGroups({
            productId: Number(productId),
            variationId: Number(doc.id),
            variationDoc: {
              id: doc.id,
              product_id: productId,
              modifier_behavior_mode: doc.modifier_behavior_mode as 'inherit_product' | 'variation_specific' | 'hybrid' | null,
            },
          })
          ;(doc as Record<string, unknown>).effective_modifier_preview = effectiveModifiers
        } catch {}
      },
    ],
  },
  timestamps: true,
}
