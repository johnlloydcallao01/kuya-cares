import type { CollectionConfig } from 'payload'

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export const RecentSearches: CollectionConfig = {
  slug: 'recent-searches',
  admin: {
    useAsTitle: 'query',
    defaultColumns: ['user', 'query', 'scope', 'frequency', 'updatedAt'],
    group: 'Search',
  },
  timestamps: true,
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if ((user.role as string) === 'service' || (user.role as string) === 'admin') return true
      return { user: { equals: user.id } }
    },
    create: ({ req: { user } }) => {
      return !!user
    },
    update: ({ req: { user } }) => {
      if ((user?.role as string) === 'service' || (user?.role as string) === 'admin') return true
      return { user: { equals: user?.id || '' } }
    },
    delete: ({ req: { user } }) => {
      if ((user?.role as string) === 'service' || (user?.role as string) === 'admin') return true
      return { user: { equals: user?.id || '' } }
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: { description: 'Owning user account (actor-agnostic across roles)' },
    },
    {
      name: 'query',
      type: 'text',
      required: true,
      admin: { description: 'Raw query as entered/clicked by the user' },
    },
    {
      name: 'normalizedQuery',
      type: 'text',
      required: true,
      admin: { readOnly: true, description: 'Canonical lowercase, trimmed, single-spaced form' },
    },
    {
      name: 'scope',
      type: 'select',
      required: true,
      defaultValue: 'restaurants',
      options: [
        { label: 'Restaurants', value: 'restaurants' },
        { label: 'Merchant Menu', value: 'merchant_menu' },
        { label: 'Global', value: 'global' },
      ],
      admin: { description: 'Search context to drive suggestion/result relevance' },
    },
    {
      name: 'compositeKey',
      type: 'text',
      unique: true,
      admin: { readOnly: true, description: 'Unique per user + scope + normalizedQuery' },
    },
    {
      name: 'frequency',
      type: 'number',
      required: true,
      defaultValue: 1,
      admin: { description: 'Number of times this query has been used' },
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'unknown',
      options: [
        { label: 'Web', value: 'web' },
        { label: 'Mobile', value: 'mobile' },
        { label: 'Unknown', value: 'unknown' },
      ],
      admin: { description: 'Platform source for analytics' },
    },
    {
      name: 'deviceId',
      type: 'text',
      admin: { description: 'Optional device identifier to merge anon history after login' },
    },
    {
      name: 'addressText',
      type: 'text',
      admin: { description: 'Snapshot of active address when the query was made' },
    },
  ],
  hooks: {
    beforeValidate: [({ data }) => {
      if (!data) return
      type MutableData = {
        user?: string | number | { id?: string | number }
        query?: string
        scope?: string
        normalizedQuery?: string
        compositeKey?: string
        frequency?: number
      }
      const d = data as MutableData
      const query = typeof d.query === 'string' ? d.query : ''
      const normalized = normalize(query)
      d.normalizedQuery = normalized
      const scope = typeof d.scope === 'string' && d.scope ? d.scope : 'restaurants'
      const u = d.user
      let userId = ''
      if (typeof u === 'string' || typeof u === 'number') userId = String(u)
      else if (u && typeof (u as { id?: string | number }).id !== 'undefined') userId = String((u as { id?: string | number }).id)
      d.compositeKey = `${userId}:${scope}:${normalized}`
    }],
    beforeChange: [({ data, operation, originalDoc }) => {
      if (!data) return
      type MutableData = { frequency?: number }
      type Original = { frequency?: number }
      const d = data as MutableData
      const prev = (originalDoc as Original)?.frequency ?? 0
      if (operation === 'update') {
        const next = typeof d.frequency === 'number' ? d.frequency : prev + 1
        d.frequency = next
      }
    }],
  },
}
