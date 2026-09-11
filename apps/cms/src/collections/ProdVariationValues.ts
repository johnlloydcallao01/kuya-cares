import { CollectionConfig } from 'payload'
import type { PayloadRequest } from 'payload'

export const ProdVariationValues: CollectionConfig = {
  slug: 'prod-variation-values',
  labels: {
    singular: 'Product Variation Value',
    plural: 'Product Variation Values',
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['variation_id', 'attribute_id', 'term_id'],
    group: 'Product Management',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'variation_id',
      type: 'relationship',
      relationTo: 'prod-variations',
      required: true,
      label: 'Product Variation',
      admin: {
        description: 'Select the declared variation (dimension) of the parent variable product',
      },
    },
    {
      name: 'attribute_id',
      type: 'relationship',
      relationTo: 'prod-attributes',
      required: true,
      label: 'Product Attribute',
    },
    {
      name: 'term_id',
      type: 'relationship',
      relationTo: 'prod-attribute-terms',
      required: true,
      label: 'Attribute Term',
      admin: {
        description: 'The specific value for this attribute',
      },
      filterOptions: async ({ siblingData }) => {
        const attrRaw = (siblingData as Record<string, unknown> | undefined)?.attribute_id as unknown
        const attrId =
          typeof attrRaw === 'object' && attrRaw !== null && 'id' in (attrRaw as object)
            ? (attrRaw as { id: string | number }).id
            : (attrRaw as string | number | undefined)
        if (!attrId) return { attribute_id: { exists: false } }
        return { attribute_id: { equals: attrId } }
      },
      validate: async (
        value: unknown,
        { req, data }: { req: PayloadRequest; data?: Record<string, unknown> }
      ) => {
        if (!value) return 'Attribute term is required'
        const dataRec = data as Record<string, unknown>
        const attrRaw = dataRec?.attribute_id as unknown
        const selectedAttrId =
          typeof attrRaw === 'object' && attrRaw !== null && 'id' in (attrRaw as object)
            ? (attrRaw as { id: string | number }).id
            : (attrRaw as string | number | undefined)
        if (!selectedAttrId) return 'Select a product attribute first'
        try {
          const termRes = await req.payload.find({
            collection: 'prod-attribute-terms',
            where: { id: { equals: value } },
            limit: 1,
          })
          const term = termRes.docs?.[0]
          if (!term) return 'Selected term does not exist'
          const termAttrId = typeof term.attribute_id === 'object' ? term.attribute_id.id : term.attribute_id
          if (termAttrId !== selectedAttrId) return 'Term does not belong to the selected attribute'
          return true
        } catch {
          return 'Failed to validate selected term'
        }
      },
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req }: { data?: Record<string, unknown>; req: PayloadRequest }) => {
        if (!data) return data
        const d = data as { attribute_id?: string | number | { id: string | number }; term_id?: string | number | { id: string | number } }
        const attrRaw = d.attribute_id as unknown
        const selectedAttrId =
          typeof attrRaw === 'object' && attrRaw !== null && 'id' in (attrRaw as object)
            ? (attrRaw as { id: string | number }).id
            : (attrRaw as string | number | undefined)
        if (!selectedAttrId || !d?.term_id) return data
        const termRes = await req.payload.find({
          collection: 'prod-attribute-terms',
          where: {
            id: {
              equals:
                typeof d.term_id === 'object' && d.term_id !== null && 'id' in (d.term_id as object)
                  ? (d.term_id as { id: string | number }).id
                  : d.term_id,
            },
          },
          limit: 1,
        })
        const term = termRes.docs?.[0]
        const termAttrId = typeof term?.attribute_id === 'object' ? term?.attribute_id?.id : term?.attribute_id
        if (term && termAttrId !== selectedAttrId) throw new Error('Selected term does not belong to the selected attribute')
        return d
      },
    ],
  },
  timestamps: true,
}
