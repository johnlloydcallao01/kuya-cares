/**
 * Reusable Field Configurations for Payload CMS
 * 
 * This file contains common field patterns that can be reused across collections
 * to maintain consistency and reduce duplication.
 */

import type { Field } from 'payload'

// ========================================
// CONTENT FIELDS
// ========================================

/**
 * Standard title field for content
 */
export const titleField: Field = {
  name: 'title',
  type: 'text',
  required: true,
  admin: {
    description: 'The main title/heading for this content',
  },
}

/**
 * URL-friendly slug field
 */
export const slugField: Field = {
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  admin: {
    description: 'URL-friendly version of the title (used in web addresses)',
  },
}

/**
 * Rich text content field
 */
export const contentField: Field = {
  name: 'content',
  type: 'richText',
  required: true,
  admin: {
    description: 'Main content body with rich text formatting',
  },
}

/**
 * Brief excerpt/description field
 */
export const excerptField: Field = {
  name: 'excerpt',
  type: 'textarea',
  admin: {
    description: 'Brief description for previews and SEO (recommended 150-160 characters)',
  },
}

/**
 * Featured image relationship
 */
export const featuredImageField: Field = {
  name: 'featuredImage',
  type: 'relationship',
  relationTo: 'media',
  admin: {
    description: 'Main image displayed with this content',
  },
}

// ========================================
// PUBLISHING FIELDS
// ========================================

/**
 * Standard draft/published status field
 */
export const statusField: Field = {
  name: 'status',
  type: 'select',
  options: [
    {
      label: 'Draft',
      value: 'draft',
    },
    {
      label: 'Published',
      value: 'published',
    },
  ],
  defaultValue: 'draft',
  required: true,
  admin: {
    description: 'Publication status - only published content is visible to the public',
  },
}

/**
 * Published date field
 */
export const publishedAtField: Field = {
  name: 'publishedAt',
  type: 'date',
  admin: {
    date: {
      pickerAppearance: 'dayAndTime',
    },
    description: 'When this content was/will be published',
  },
}

/**
 * Author relationship field
 */
export const authorField: Field = {
  name: 'author',
  type: 'relationship',
  relationTo: 'users',
  required: true,
  admin: {
    description: 'The user who created this content',
  },
}

// ========================================
// ORGANIZATION FIELDS
// ========================================

/**
 * Tags array field
 */
export const tagsField: Field = {
  name: 'tags',
  type: 'array',
  fields: [
    {
      name: 'tag',
      type: 'text',
      required: true,
      admin: {
        description: 'Tag name (e.g., "web development", "tutorial")',
      },
    },
  ],
  admin: {
    description: 'Keywords and categories for organizing content',
  },
}

// ========================================
// SEO FIELDS
// ========================================

/**
 * Complete SEO field group with focus keyword
 */
export const seoFields: Field = {
  name: 'seo',
  type: 'group',
  label: 'SEO Settings',
  admin: {
    description: 'Search engine optimization settings (all optional)',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      admin: {
        description: 'SEO title for search engines (leave empty to use main title) - Max 60 characters recommended',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'SEO description for search engines (leave empty to use excerpt) - Max 160 characters recommended',
      },
    },
    {
      name: 'focusKeyword',
      type: 'text',
      admin: {
        description: 'Primary keyword you want this content to rank for',
      },
    },
  ],
}

// ========================================
// FIELD COMBINATIONS
// ========================================

/**
 * Basic content fields (title, slug, content, excerpt)
 */
export const basicContentFields: Field[] = [
  titleField,
  slugField,
  contentField,
  excerptField,
]

/**
 * Publishing workflow fields (status, publishedAt, author)
 */
export const publishingFields: Field[] = [
  statusField,
  publishedAtField,
  authorField,
]

/**
 * Content organization fields (featuredImage, tags)
 */
export const organizationFields: Field[] = [
  featuredImageField,
  tagsField,
]

/**
 * Complete blog-style content fields
 */
export const blogContentFields: Field[] = [
  ...basicContentFields,
  ...organizationFields,
  ...publishingFields,
  seoFields,
]

/**
 * Service/product content fields (similar to blog but with different naming)
 */
export const serviceContentFields: Field[] = [
  {
    ...titleField,
    name: 'name',
    admin: {
      description: 'The name of this service or product',
    },
  },
  slugField,
  {
    ...contentField,
    name: 'description',
    admin: {
      description: 'Detailed description of the service or product',
    },
  },
  {
    ...excerptField,
    name: 'shortDescription',
    admin: {
      description: 'Brief description for cards and previews',
    },
  },
  featuredImageField,
]
