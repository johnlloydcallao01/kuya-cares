import type { CollectionConfig } from 'payload'
import { blogContentFields } from '../fields'
import { adminOnly } from '../access'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'publishedAt', 'updatedAt'],
    group: 'Content',
  },
  access: {
    read: () => true, // Public can read published posts
    create: adminOnly, // Only admins can create posts
    update: adminOnly, // Only admins can update posts
    delete: adminOnly, // Only admins can delete posts
  },
  fields: blogContentFields,
  versions: {
    drafts: true,
  },
}
