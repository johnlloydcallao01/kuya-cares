import type { CollectionConfig } from 'payload'
import { getStoreHoursStatus, validateStoreHoursFields } from '@/utils/storeHours'
import { createAdminNotificationFanout } from '../utils/notificationFanout'

export const Merchants: CollectionConfig = {
  slug: 'merchants',
  admin: {
    useAsTitle: 'outletName',
    defaultColumns: ['outletName', 'vendor', 'isActive', 'isAcceptingOrders'],
    group: 'Food Delivery',
    description: 'Manage individual merchant locations and outlets',
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
      // Allow both service accounts and admins to create merchants
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    update: ({ req: { user } }) => {
      // Allow both service accounts and admins to update merchants
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    delete: ({ req: { user } }) => {
      // Allow both service accounts and admins to delete merchants
      return user?.role === 'service' || user?.role === 'admin' || false
    },
  },
  fields: [
    // === VENDOR RELATIONSHIP ===
    {
      name: 'vendor',
      type: 'relationship',
      relationTo: 'vendors',
      required: true,
      admin: {
        description: 'Parent vendor/business entity',
      },
    },

    // === LOCATION IDENTIFICATION ===
    {
      name: 'outletName',
      type: 'text',
      required: true,
      admin: {
        description: 'Specific outlet name (e.g., "Jollibee Manila", "McDonald\'s Quezon City")',
      },
    },
    {
      name: 'outletCode',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Internal reference code for the outlet (e.g., JB-MNL-001)',
      },
    },



    // === CONTACT INFORMATION ===
    {
      name: 'contactInfo',
      type: 'group',
      fields: [
        {
          name: 'phone',
          type: 'text',
          admin: {
            description: 'Outlet contact phone number',
          },
        },
        {
          name: 'email',
          type: 'email',
          admin: {
            description: 'Outlet contact email',
          },
        },
        {
          name: 'managerName',
          type: 'text',
          admin: {
            description: 'Store manager name',
          },
        },
        {
          name: 'managerPhone',
          type: 'text',
          admin: {
            description: 'Store manager contact number',
          },
        },
      ],
      admin: {
        description: 'Contact information for this specific outlet',
      },
    },

    // === OPERATIONAL STATUS ===
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether the merchant is currently active',
      },
    },
    {
      name: 'isAcceptingOrders',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether the merchant is currently accepting new orders',
      },
    },
    {
      name: 'operationalStatus',
      type: 'select',
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Closed', value: 'closed' },
        { label: 'Busy', value: 'busy' },
        { label: 'Temporarily Closed', value: 'temp_closed' },
        { label: 'Maintenance', value: 'maintenance' },
      ],
      admin: {
        description: 'Current operational status',
      },
    },

    // === OPERATING HOURS ===
    {
      name: 'operatingHours',
      type: 'json',
      admin: {
        description: 'Weekly operating schedule (JSON format)',
      },
    },
    {
      name: 'specialHours',
      type: 'json',
      admin: {
        description: 'Special operating hours for holidays or events (JSON array of objects with date, openTime, closeTime, isClosed, reason)',
      },
    },

    // === DELIVERY SETTINGS ===
    {
      name: 'deliverySettings',
      type: 'group',
      fields: [
        {
          name: 'minimumOrderAmount',
          type: 'number',
          min: 0,
          defaultValue: 0,
          admin: {
            description: 'Minimum order amount (PHP)',
          },
        },
        {
          name: 'deliveryFee',
          type: 'number',
          min: 0,
          defaultValue: 0,
          admin: {
            description: 'Base delivery fee (PHP)',
          },
        },
        {
          name: 'freeDeliveryThreshold',
          type: 'number',
          min: 0,
          admin: {
            description: 'Order amount for free delivery (PHP)',
          },
        },
        {
          name: 'estimatedDeliveryTimeMinutes',
          type: 'number',
          min: 5,
          max: 120,
          defaultValue: 30,
          admin: {
            description: 'Estimated delivery time in minutes',
          },
        },
        {
          name: 'maxDeliveryTimeMinutes',
          type: 'number',
          min: 10,
          max: 180,
          defaultValue: 60,
          admin: {
            description: 'Maximum delivery time promise',
          },
        },
      ],
      admin: {
        description: 'Delivery policies and settings',
      },
    },



    // === MEDIA AND BRANDING ===
    {
      name: 'media',
      type: 'group',
      fields: [
        {
          name: 'thumbnail',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Merchant thumbnail image (original size from Cloudinary)',
          },
        },
        {
          name: 'storeFrontImage',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Store front photo',
          },
        },
        {
          name: 'interiorImages',
          type: 'json',
          admin: {
            description: 'Interior photos of the outlet (JSON array of media IDs)',
          },
        },
        {
          name: 'menuImages',
          type: 'json',
          admin: {
            description: 'Menu board or promotional images (JSON array of media IDs)',
          },
        },
      ],
      admin: {
        description: 'Visual content for the merchant',
      },
    },





    // === ADDITIONAL INFORMATION ===
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Outlet description and special features',
      },
    },
    {
      name: 'specialInstructions',
      type: 'textarea',
      admin: {
        description: 'Special delivery or pickup instructions',
      },
    },
    {
      name: 'tags',
      type: 'json',
      admin: {
        description: 'Tags for search and categorization (JSON array of strings)',
      },
    },
    {
      name: 'merchant_categories',
      type: 'relationship',
      relationTo: 'merchant-categories',
      hasMany: true,
      admin: {
        description: 'Merchant Categories',
      },
    },
    {
      name: 'activeAddress',
      type: 'relationship',
      relationTo: 'addresses',
      filterOptions: async ({ relationTo: _relationTo, data, user: _user, req }) => {
        // If we have merchant data with a vendor relationship
        if (data?.vendor) {
          try {
            let vendorUserId;

            // If vendor is just an ID (string/number), we need to fetch the vendor to get the user
            if (typeof data.vendor === 'string' || typeof data.vendor === 'number') {
              const vendor = await req.payload.findByID({
                collection: 'vendors',
                id: data.vendor,
                depth: 1, // This will populate the user relationship
              });

              if (vendor?.user) {
                vendorUserId = typeof vendor.user === 'object' ? vendor.user.id : vendor.user;
              }
            } else if (data.vendor?.user) {
              // If vendor is populated, get the user ID
              vendorUserId = typeof data.vendor.user === 'object' ? data.vendor.user.id : data.vendor.user;
            }

            if (vendorUserId) {
              return {
                user: {
                  equals: vendorUserId,
                },
              };
            }
          } catch (error) {
            console.error('Error in activeAddress filterOptions:', error);
          }
        }

        // If no vendor data available or error occurred, return false to show no addresses
        return false;
      },
      admin: {
        description: 'Currently active address for this merchant outlet (business location) - only addresses owned by the vendor user',
      },
    },

    // === BUSINESS ZONE RELATIONSHIP (PLATFORM-SCOPE GATING) ===
    {
      name: 'businessZone',
      type: 'relationship',
      // @ts-ignore - business-zones collection will be registered via migration; fallback to string to unblock build
      relationTo: 'business-zones' as any,
      admin: {
        description: 'Platform Business Zone this outlet belongs to (for ops gating/kill-switch). Merchant service_area must be within this zone.',
        position: 'sidebar',
      },
      // Nullable for backfill - existing merchants have no zone yet
      // Enforce via hook/service validation when provided
    },

    // === DENORMALIZED GEOSPATIAL FIELDS ===
    {
      name: 'merchant_latitude',
      type: 'number',
      admin: {
        description: 'Denormalized latitude from active address for performance',
        readOnly: true,
      },
    },
    {
      name: 'merchant_longitude',
      type: 'number',
      admin: {
        description: 'Denormalized longitude from active address for performance',
        readOnly: true,
      },
    },

    {
      name: 'location_accuracy_radius',
      type: 'number',
      min: 0,
      admin: {
        description: 'Location accuracy radius in meters',
      },
    },

    // === DELIVERY CONFIGURATION ===
    {
      name: 'delivery_radius_meters',
      type: 'number',
      min: 0,
      defaultValue: 5000,
      admin: {
        description: 'Current delivery radius in meters',
      },
    },
    {
      name: 'max_delivery_radius_meters',
      type: 'number',
      min: 0,
      defaultValue: 10000,
      admin: {
        description: 'Maximum possible delivery radius in meters',
      },
    },
    {
      name: 'min_order_amount',
      type: 'number',
      min: 0,
      admin: {
        description: 'Minimum order amount for delivery (PHP)',
      },
    },
    {
      name: 'delivery_fee_base',
      type: 'number',
      min: 0,
      admin: {
        description: 'Base delivery fee (PHP)',
      },
    },
    {
      name: 'delivery_fee_per_km',
      type: 'number',
      min: 0,
      admin: {
        description: 'Per-kilometer delivery fee (PHP)',
      },
    },
    {
      name: 'free_delivery_threshold',
      type: 'number',
      min: 0,
      admin: {
        description: 'Order amount for free delivery (PHP)',
      },
    },

    // === POSTGIS GEOMETRY FIELDS ===
    {
      name: 'merchant_coordinates',
      type: 'json',
      label: 'Merchant Coordinates',
      admin: {
        description: 'GeoJSON Point format for spatial queries - auto-populated from lat/lng',
        readOnly: true,
      },
    },
    {
      name: 'service_area_geometry',
      type: 'json',
      label: 'Service Area Geometry',
      admin: {
        description: 'PostGIS GEOMETRY(POLYGON, 4326) for delivery coverage area - for spatial queries',
        readOnly: true,
      },
    },
    {
      name: 'priority_zones_geometry',
      type: 'json',
      label: 'Priority Zones Geometry',
      admin: {
        description: 'PostGIS GEOMETRY(MULTIPOLYGON, 4326) for premium delivery areas - for spatial queries',
        readOnly: true,
      },
    },
    {
      name: 'restricted_areas_geometry',
      type: 'json',
      label: 'Restricted Areas Geometry',
      admin: {
        description: 'PostGIS GEOMETRY(MULTIPOLYGON, 4326) for no-delivery zones - for spatial queries',
        readOnly: true,
      },
    },
    {
      name: 'delivery_zones_geometry',
      type: 'json',
      label: 'Delivery Zones Geometry',
      admin: {
        description: 'PostGIS GEOMETRY(MULTIPOLYGON, 4326) for zone-specific delivery areas - for spatial queries',
        readOnly: true,
      },
    },

    // === SERVICE AREAS & ZONES (GEOJSON) ===
    {
      name: 'service_area',
      type: 'json',
      admin: {
        description: 'PostGIS POLYGON for delivery coverage area - stored as GeoJSON (editable)',
      },
    },
    {
      name: 'priority_zones',
      type: 'json',
      admin: {
        description: 'PostGIS MULTIPOLYGON for premium delivery areas - stored as GeoJSON (editable)',
      },
    },
    {
      name: 'restricted_areas',
      type: 'json',
      admin: {
        description: 'PostGIS MULTIPOLYGON for no-delivery zones - stored as GeoJSON (editable)',
      },
    },
    {
      name: 'delivery_zones',
      type: 'json',
      admin: {
        description: 'Zone-specific pricing configuration (JSONB format)',
      },
    },


    {
      name: 'avg_delivery_time_minutes',
      type: 'number',
      min: 0,
      admin: {
        description: 'Average delivery time in minutes',
      },
    },
    {
      name: 'delivery_success_rate',
      type: 'number',
      min: 0,
      max: 1,
      admin: {
        description: 'Delivery success rate (0.0 to 1.0)',
        step: 0.0001,
      },
    },
    {
      name: 'peak_hours_multiplier',
      type: 'number',
      min: 1,
      defaultValue: 1,
      admin: {
        description: 'Surge pricing multiplier during peak hours',
        step: 0.1,
      },
    },

    // === BUSINESS HOURS & AVAILABILITY ===
    {
      name: 'delivery_hours',
      type: 'json',
      admin: {
        description: 'Delivery-specific operating hours (JSONB format)',
      },
    },
    {
      name: 'is_currently_delivering',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Real-time delivery availability status',
      },
    },
    {
      name: 'next_available_slot',
      type: 'date',
      admin: {
        description: 'Next available delivery time slot',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },

    // === TIMEZONE CONFIGURATION ===
    {
      name: 'timezone',
      type: 'text',
      defaultValue: 'Asia/Manila',
      required: true,
      admin: {
        description: 'IANA timezone identifier (e.g., Asia/Manila, Asia/Singapore, America/New_York)',
      },
    },
  ],
  indexes: [
    {
      fields: ['vendor'],
    },
    {
      fields: ['outletCode'],
    },
    {
      fields: ['isActive', 'isAcceptingOrders'],
    },
    {
      fields: ['operationalStatus'],
    },
    // Enhanced geospatial indexes
    {
      fields: ['delivery_radius_meters'],
    },
    {
      fields: ['is_currently_delivering'],
    },
    {
      fields: ['avg_delivery_time_minutes'],
    },
    {
      fields: ['delivery_success_rate'],
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          await createAdminNotificationFanout(req.payload, {
            typeKey: 'merchant.created',
            domain: 'system',
            title: 'New merchant created',
            body: `${doc.outletName || 'A merchant outlet'} was added to the platform.`,
            sourceEntityType: 'merchant',
            sourceEntityId: doc.id,
            metadata: { merchantId: doc.id, vendor: doc.vendor, outletCode: doc.outletCode },
          })
        }
        return doc
      },
    ],
    afterRead: [
      ({ doc }) => {
        const storeHoursStatus = getStoreHoursStatus(doc as Record<string, unknown>)
        return { ...doc, isOpenNow: storeHoursStatus.isOpen, storeHoursStatus, nextOpeningAt: storeHoursStatus.nextOpeningAt ?? null }
      },
    ],
    beforeValidate: [
      ({ data }) => data ? validateStoreHoursFields(data as Record<string, unknown>) : data,
    ],
    beforeChange: [
      ({ data }) => {
        // Auto-generate outletCode if not provided
        if (!data.outletCode && data.outletName) {
          const sanitized = data.outletName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
          data.outletCode = `${sanitized}-${Date.now()}`
        }

        // Enhanced coordinate synchronization with validation
        if (data.merchant_latitude && data.merchant_longitude) {
          const lat = parseFloat(data.merchant_latitude.toString())
          const lng = parseFloat(data.merchant_longitude.toString())

          // Validate coordinates are within valid ranges
          if (!isNaN(lat) && !isNaN(lng) &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180) {

            data.merchant_coordinates = {
              type: 'Point',
              coordinates: [lng, lat] // GeoJSON format: [longitude, latitude]
            }

            console.log(`🔄 Synchronized coordinates for ${data.outletName}: [${lng}, ${lat}]`)
          } else {
            console.warn(`⚠️ Invalid coordinates for ${data.outletName}: lat=${lat}, lng=${lng}`)
          }
        } else if (data.merchant_latitude === null || data.merchant_longitude === null) {
          // Clear coordinates if lat/lng are explicitly set to null
          data.merchant_coordinates = null
          console.log(`🗑️ Cleared coordinates for ${data.outletName}`)
        }

        return data
      },
    ],
  },
}
