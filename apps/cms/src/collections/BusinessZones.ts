import type { CollectionConfig } from 'payload'

export const BusinessZones: CollectionConfig = {
  slug: 'business-zones',
  dbName: 'business_zones',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'isActive', 'displayOrder'],
    group: 'Food Delivery',
    description: 'Manage platform Business Zones - admin-declared operational areas (e.g., Metro Manila, Cebu). Each record is one drawable polygon with kill-switch.',
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
    create: ({ req: { user } }) => user?.role === 'admin' || false,
    update: ({ req: { user } }) => user?.role === 'admin' || false,
    delete: ({ req: { user } }) => user?.role === 'admin' || false,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Zone name (e.g., "Metro Manila", "Cebu City", "Makati")',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Unique URL-friendly identifier (auto-generated from name)',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Optional description of the zone and coverage notes',
      },
    },
    // === BOUNDARY GEOMETRY (ADMIN-DRAWN POLYGON) ===
    {
      name: 'boundary',
      type: 'json',
      admin: {
        description: 'GeoJSON POLYGON or MULTIPOLYGON for zone coverage - drawn on map (editable)',
      },
    },
    {
      name: 'boundary_geometry',
      type: 'json',
      label: 'Boundary Geometry',
      admin: {
        description: 'PostGIS GEOMETRY(POLYGON/MULTIPOLYGON, 4326) for spatial queries - auto-synced from boundary (readOnly)',
        readOnly: true,
      },
    },
    // === OPERATIONAL CONTROL (KILL-SWITCH) ===
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Kill-switch: when OFF, all merchants inside this zone are hidden regardless of merchant isActive',
      },
    },
    {
      name: 'disabledReason',
      type: 'textarea',
      admin: {
        description: 'Reason for disabling zone (e.g., Typhoon, rider shortage) - shown when isActive is false',
        condition: (data) => !data.isActive,
      },
    },
    // === DISPLAY & ORDERING ===
    {
      name: 'displayOrder',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Sort order for admin listing (lower = first)',
      },
    },
    // === TIMEZONE ===
    {
      name: 'timezone',
      type: 'text',
      defaultValue: 'Asia/Manila',
      admin: {
        description: 'IANA timezone for this zone (e.g., Asia/Manila)',
      },
    },
  ],
  indexes: [
    {
      fields: ['isActive'],
    },
    {
      fields: ['displayOrder'],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data.slug && data.name) {
          data.slug = data.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
        }
        // Sync boundary_geometry from boundary for PostGIS readiness (stored as GeoJSON, query converts via ST_GeomFromGeoJSON)
        if (data.boundary && typeof data.boundary === 'object') {
          // Keep boundary_geometry in sync - PostGIS queries use ST_GeomFromGeoJSON(boundary::text) so geometry copy is optional but kept for consistency
          data.boundary_geometry = data.boundary
        } else if (data.boundary === null) {
          data.boundary_geometry = null
        }
        return data
      },
    ],
  },
}
