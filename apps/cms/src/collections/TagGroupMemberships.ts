import { CollectionConfig } from 'payload'

export const TagGroupMemberships: CollectionConfig = {
  slug: 'tag-group-memberships',
  labels: {
    singular: 'Tag Group Membership',
    plural: 'Tag Group Memberships',
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['tag_group_id', 'tag_id', 'sort_order'],
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
      name: 'tag_group_id',
      type: 'relationship',
      relationTo: 'tag-groups',
      required: true,
      label: 'Tag Group',
    },
    {
      name: 'tag_id',
      type: 'relationship',
      relationTo: 'prod-tags',
      required: true,
      label: 'Tag',
    },
    {
      name: 'sort_order',
      type: 'number',
      defaultValue: 0,
      label: 'Sort Order',
    },
  ],
  timestamps: true,
}