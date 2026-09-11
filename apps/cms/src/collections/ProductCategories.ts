import type { CollectionConfig } from 'payload'

export const ProductCategories: CollectionConfig = {
  slug: 'product-categories',
  dbName: 'prod_categories', // Shortened database table name
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'categoryLevel', 'parentCategory', 'isActive', 'isFeatured'],
    group: 'Food Delivery',
    description: 'Organize products into hierarchical categories for easy browsing',
  },
  access: {
    // PayloadCMS automatically authenticates API keys and populates req.user
    read: ({ req: { user } }) => {
      // If user exists, they've been authenticated (either via API key or login)
      if (user) {
        // Allow service accounts (for website display) and admins
        if (user.role === 'service' || user.role === 'admin') {
          return true
        }
      }
      
      // Block all unauthenticated requests and other roles
      return false
    },
    create: ({ req: { user } }) => {
      // Allow both service accounts and admins to create product categories
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    update: ({ req: { user } }) => {
      // Allow both service accounts and admins to update product categories
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    delete: ({ req: { user } }) => {
      // Allow both service accounts and admins to delete product categories
      return user?.role === 'service' || user?.role === 'admin' || false
    },
  },
  fields: [
    // === BASIC CATEGORY INFORMATION ===
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Category name (e.g., "Main Dishes", "Beverages", "Desserts")',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL-friendly version of the name (auto-generated if empty)',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Category description for customers',
      },
    },

    // === HIERARCHICAL STRUCTURE ===
    {
      name: 'parentCategory',
      type: 'relationship',
      relationTo: 'product-categories',
      admin: {
        description: 'Parent category (leave empty for top-level categories)',
      },
    },
    {
      name: 'categoryLevel',
      type: 'number',
      min: 1,
      max: 5,
      defaultValue: 1,
      admin: {
        description: 'Hierarchy level (1 = top level, 2 = subcategory, etc.)',
      },
    },
    {
      name: 'categoryPath',
      type: 'text',
      admin: {
        description: 'Materialized path for efficient queries (auto-generated)',
        readOnly: true,
      },
    },

    // === DISPLAY AND ORDERING ===
    {
      name: 'displayOrder',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Order for displaying categories (lower numbers appear first)',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether the category is currently active',
      },
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether to feature this category prominently',
      },
    },

    // === VISUAL ELEMENTS ===
    {
      name: 'media',
      type: 'group',
      fields: [
        {
          name: 'icon',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Category icon (SVG preferred)',
          },
        },
        {
          name: 'bannerImage',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Banner image for category pages',
          },
        },
        {
          name: 'thumbnailImage',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Thumbnail for category listings',
          },
        },
      ],
      admin: {
        description: 'Visual elements for the category',
      },
    },

    

    // === CATEGORY ATTRIBUTES ===
    {
      name: 'attributes',
      type: 'group',
      fields: [
        {
          name: 'categoryType',
          type: 'select',
          options: [
            { label: 'Food', value: 'food' },
            { label: 'Beverages', value: 'beverages' },
            { label: 'Desserts', value: 'desserts' },
            { label: 'Snacks', value: 'snacks' },
            { label: 'Groceries', value: 'groceries' },
            { label: 'Pharmacy', value: 'pharmacy' },
            { label: 'Personal Care', value: 'personal_care' },
            { label: 'Household', value: 'household' },
            { label: 'Other', value: 'other' },
          ],
          admin: {
            description: 'Type of products in this category',
          },
        },
        {
          name: 'dietaryTags',
          type: 'json',
          admin: {
            description: 'Dietary attributes commonly found in this category (JSON array of strings)',
          },
        },
        {
          name: 'ageRestriction',
          type: 'select',
          options: [
            { label: 'None', value: 'none' },
            { label: '18+', value: '18_plus' },
            { label: '21+', value: '21_plus' },
          ],
          defaultValue: 'none',
          admin: {
            description: 'Age restriction for products in this category',
          },
        },
        {
          name: 'requiresPrescription',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Whether products in this category require prescription',
          },
        },
      ],
      admin: {
        description: 'Category-specific attributes and restrictions',
      },
    },

    

    // === SEO AND MARKETING ===
    {
      name: 'seo',
      type: 'group',
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          admin: {
            description: 'SEO meta title',
          },
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          admin: {
            description: 'SEO meta description',
          },
        },
        {
          name: 'keywords',
          type: 'json',
          admin: {
            description: 'SEO keywords for this category (JSON array of strings)',
          },
        },
        {
          name: 'canonicalUrl',
          type: 'text',
          admin: {
            description: 'Canonical URL for SEO',
          },
        },
      ],
      admin: {
        description: 'SEO optimization settings',
      },
    },

    

    

    
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Auto-generate slug if not provided
        if (!data.slug && data.name) {
          data.slug = data.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
        }

        // Generate category path for hierarchical queries
        if (data.parentCategory && typeof data.parentCategory === 'object') {
          const parentPath = data.parentCategory.categoryPath || data.parentCategory.slug || ''
          data.categoryPath = parentPath ? `${parentPath}/${data.slug}` : data.slug
          data.categoryLevel = (data.parentCategory.categoryLevel || 0) + 1
        } else {
          data.categoryPath = data.slug
          data.categoryLevel = 1
        }

        return data
      },
    ],
  },
}
