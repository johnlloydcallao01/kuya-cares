import type { CollectionConfig } from 'payload'
import { googleMapsService } from '../services/GoogleMapsService'

export const Addresses: CollectionConfig = {
  slug: 'addresses',
  admin: {
    useAsTitle: 'formatted_address',
    defaultColumns: ['formatted_address', 'user', 'address_type', 'locality', 'is_default', 'is_verified'],
    group: 'User Management',
    description: 'Manage user addresses with Google Maps integration',
  },
  access: {
    // PayloadCMS automatically authenticates API keys and populates req.user
    read: ({ req: { user } }) => {
      // If user exists, they've been authenticated (either via API key or login)
      if (user) {
        // Allow service accounts and admins to read all addresses
        if (user.role === 'service' || user.role === 'admin') {
          return true
        }
        // Allow customers and vendors to read their own addresses
        if (user.role === 'customer' || user.role === 'vendor') {
          return {
            user: {
              equals: user.id,
            },
          }
        }
      }
      
      // Block all unauthenticated requests and other roles
      return false
    },
    create: ({ req: { user } }) => {
      // Allow service accounts, admins, customers, and vendors to create addresses
      return user?.role === 'service' || user?.role === 'admin' || user?.role === 'customer' || user?.role === 'vendor' || false
    },
    update: ({ req: { user } }) => {
      // If user exists, they've been authenticated
      if (user) {
        // Allow service accounts and admins to update all addresses
        if (user.role === 'service' || user.role === 'admin') {
          return true
        }
        // Allow customers and vendors to update their own addresses
        if (user.role === 'customer' || user.role === 'vendor') {
          return {
            user: {
              equals: user.id,
            },
          }
        }
      }
      return false
    },
    delete: ({ req: { user } }) => {
      // If user exists, they've been authenticated
      if (user) {
        // Allow service accounts and admins to delete all addresses
        if (user.role === 'service' || user.role === 'admin') {
          return true
        }
        // Allow customers and vendors to delete their own addresses
        if (user.role === 'customer' || user.role === 'vendor') {
          return {
            user: {
              equals: user.id,
            },
          }
        }
      }
      return false
    },
  },
  fields: [
    // === USER RELATIONSHIP ===
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'User who owns this address',
      },
    },

    // === GOOGLE MAPS RAW DATA (STORE COMPLETE UNEDITED ADDRESS) ===
    {
      name: 'formatted_address',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Complete Google-formatted address (unedited from Google Maps)',
        rows: 3,
      },
    },
    {
      name: 'google_place_id',
      type: 'text',
      admin: {
        description: 'Google Place ID for reference and validation',
      },
    },

    // === PARSED ADDRESS COMPONENTS (FROM GOOGLE PLACES API) ===
    {
      name: 'street_number',
      type: 'text',
      admin: {
        description: 'Street number (from address_components: street_number)',
      },
    },
    {
      name: 'route',
      type: 'text',
      admin: {
        description: 'Street name (from address_components: route)',
      },
    },
    {
      name: 'subpremise',
      type: 'text',
      admin: {
        description: 'Unit/apartment number (from address_components: subpremise)',
      },
    },
    {
      name: 'street',
      type: 'text',
      admin: {
        description: 'Manually entered street name (e.g. Rizal Avenue)',
      },
    },
    {
      name: 'floor_unit_room',
      type: 'text',
      admin: {
        description: 'Floor, unit, or room number (e.g. Unit 3A, 2nd Floor)',
      },
    },
    {
      name: 'delivery_instructions',
      type: 'textarea',
      admin: {
        description: 'Special delivery instructions (e.g. Ring doorbell twice, leave at front desk)',
        rows: 3,
      },
    },
    {
      name: 'label',
      type: 'text',
      admin: {
        description: 'Custom label for this address (e.g. Home, Work, Other)',
      },
    },

    // === LOCALITY COMPONENTS (PHILIPPINES-SPECIFIC) ===
    {
      name: 'barangay',
      type: 'text',
      admin: {
        description: 'Barangay (from address_components: sublocality_level_1)',
      },
    },
    {
      name: 'locality',
      type: 'text',
      admin: {
        description: 'City/municipality (from address_components: locality)',
      },
    },
    {
      name: 'administrative_area_level_2',
      type: 'text',
      admin: {
        description: 'Province subdivision (from address_components: administrative_area_level_2)',
      },
    },
    {
      name: 'administrative_area_level_1',
      type: 'text',
      admin: {
        description: 'Province/state (from address_components: administrative_area_level_1)',
      },
    },
    {
      name: 'country',
      type: 'text',
      defaultValue: 'Philippines',
      admin: {
        description: 'Country (from address_components: country)',
      },
    },
    {
      name: 'postal_code',
      type: 'text',
      admin: {
        description: 'ZIP/postal code (from address_components: postal_code)',
      },
    },

    // === GEOLOCATION DATA ===
    {
      name: 'latitude',
      type: 'number',
      admin: {
        description: 'Latitude coordinate (from geometry.location.lat)',
        step: 0.00000001,
      },
    },
    {
      name: 'longitude',
      type: 'number',
      admin: {
        description: 'Longitude coordinate (from geometry.location.lng)',
        step: 0.00000001,
      },
    },
    {
      name: 'coordinates',
      type: 'json',
      admin: {
        description: 'PostGIS GEOMETRY(POINT, 4326) for spatial queries - stored as GeoJSON',
        readOnly: true,
      },
    },
    {
      name: 'altitude',
      type: 'number',
      admin: {
        description: 'Elevation data in meters (optional)',
        step: 0.001,
      },
    },

    // === GEOCODING QUALITY & VALIDATION ===
    {
      name: 'address_quality_score',
      type: 'number',
      min: 1,
      max: 100,
      admin: {
        description: 'Geocoding confidence score (1-100)',
      },
    },
    {
      name: 'geocoding_accuracy',
      type: 'select',
      options: [
        { label: 'Rooftop', value: 'ROOFTOP' },
        { label: 'Range Interpolated', value: 'RANGE_INTERPOLATED' },
        { label: 'Geometric Center', value: 'GEOMETRIC_CENTER' },
        { label: 'Approximate', value: 'APPROXIMATE' },
      ],
      admin: {
        description: 'Google Maps geocoding accuracy level',
      },
    },
    {
      name: 'coordinate_source',
      type: 'select',
      options: [
        { label: 'GPS', value: 'GPS' },
        { label: 'Google Geocoding', value: 'GOOGLE_GEOCODING' },
        { label: 'Manual Entry', value: 'MANUAL' },
        { label: 'Estimated', value: 'ESTIMATED' },
      ],
      defaultValue: 'GOOGLE_GEOCODING',
      admin: {
        description: 'Source of coordinate data',
      },
    },
    {
      name: 'last_geocoded_at',
      type: 'date',
      admin: {
        description: 'Timestamp of last geocoding update',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'verification_method',
      type: 'select',
      options: [
        { label: 'GPS Confirmed', value: 'GPS_CONFIRMED' },
        { label: 'Delivery Confirmed', value: 'DELIVERY_CONFIRMED' },
        { label: 'User Confirmed', value: 'USER_CONFIRMED' },
        { label: 'Unverified', value: 'UNVERIFIED' },
      ],
      defaultValue: 'UNVERIFIED',
      admin: {
        description: 'Method used to verify address accuracy',
      },
    },

    // === SERVICE AREA & BOUNDARIES ===
    {
      name: 'address_boundary',
      type: 'json',
      admin: {
        description: 'PostGIS POLYGON for property boundaries - stored as GeoJSON',
      },
    },
    {
      name: 'service_radius_meters',
      type: 'number',
      min: 0,
      admin: {
        description: 'Default delivery radius in meters',
      },
    },
    {
      name: 'accessibility_notes',
      type: 'textarea',
      admin: {
        description: 'Delivery instructions and accessibility information',
        rows: 3,
      },
    },
    {
      name: 'landmark_description',
      type: 'textarea',
      admin: {
        description: 'Nearby landmarks for easier location identification',
        rows: 2,
      },
    },

    // === ADDRESS METADATA ===
    {
      name: 'address_type',
      type: 'select',
      options: [
        {
          label: 'Home',
          value: 'home',
        },
          {
            label: 'Work',
            value: 'work',
          },
          {
            label: 'Partner',
            value: 'partner',
          },
          {
          label: 'Billing',
          value: 'billing',
        },
        {
          label: 'Shipping',
          value: 'shipping',
        },
        {
          label: 'Pickup',
          value: 'pickup',
        },
        {
          label: 'Delivery',
          value: 'delivery',
        },
      ],
      defaultValue: 'home',
      required: true,
      admin: {
        description: 'Type of address for categorization',
      },
    },
    {
      name: 'is_default',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Mark as default address for this user',
      },
    },
    {
      name: 'is_verified',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Address has been verified through Google Maps',
      },
    },

    // === AUDIT FIELDS ===
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Additional notes or delivery instructions',
        rows: 2,
      },
    },
  ],
  
  // === INDEXES FOR PERFORMANCE ===
  indexes: [
    {
      fields: ['user'],
    },
    {
      fields: ['latitude', 'longitude'],
    },
    {
      fields: ['locality', 'administrative_area_level_1'],
    },
    {
      fields: ['postal_code'],
    },
    {
      fields: ['google_place_id'],
    },
    // Enhanced geospatial indexes
    {
      fields: ['address_quality_score'],
    },
    {
      fields: ['is_verified'],
    },
    {
      fields: ['geocoding_accuracy'],
    },
    {
      fields: ['coordinate_source'],
    },
    {
      fields: ['verification_method'],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation: _operation }) => {
        // Auto-geocode address if formatted_address is provided but coordinates are missing
        if (data.formatted_address && (data.latitude == null || data.longitude == null)) {
          try {
            console.log('Auto-geocoding address:', data.formatted_address)
            const geocodingResult = await googleMapsService.geocodeAddress(data.formatted_address)
            
            if (geocodingResult) {
              // Update all geocoding fields
              data.google_place_id = geocodingResult.google_place_id
              data.latitude = geocodingResult.latitude
              data.longitude = geocodingResult.longitude
              data.geocoding_accuracy = geocodingResult.geocoding_accuracy
              data.address_quality_score = geocodingResult.address_quality_score
              data.coordinate_source = 'GOOGLE_GEOCODING'
              data.last_geocoded_at = new Date().toISOString()
              data.is_verified = true
              
              // Update address components
              const components = geocodingResult.address_components
              if (components.street_number) data.street_number = components.street_number
              if (components.route) data.route = components.route
              if (components.subpremise) data.subpremise = components.subpremise
              if (components.barangay) data.barangay = components.barangay
              if (components.locality) data.locality = components.locality
              if (components.administrative_area_level_2) data.administrative_area_level_2 = components.administrative_area_level_2
              if (components.administrative_area_level_1) data.administrative_area_level_1 = components.administrative_area_level_1
              if (components.country) data.country = components.country
              if (components.postal_code) data.postal_code = components.postal_code
              
              console.log('Successfully geocoded address with coordinates:', data.latitude, data.longitude)
            } else {
              console.warn('Failed to geocode address:', data.formatted_address)
            }
          } catch (error) {
            console.error('Error during address geocoding:', error)
          }
        }

        // Auto-generate PostGIS coordinates from latitude/longitude
        if (data.latitude && data.longitude) {
          data.coordinates = {
            type: 'Point',
            coordinates: [data.longitude, data.latitude],
          }
          if (!data.last_geocoded_at) {
            data.last_geocoded_at = new Date().toISOString()
          }
        }
        
        return data
      },
    ],
    afterChange: [
      ({ doc, req, operation }) => {
        // Propagate coordinate changes to associated merchants (non-blocking)
        if ((operation === 'update' || operation === 'create') && doc.latitude && doc.longitude) {
          const payload = req.payload
          const docId = doc.id
          const lat = doc.latitude
          const lng = doc.longitude
          // Fire-and-forget: do not block the address save
          ;(async () => {
            try {
              const merchants = await payload.find({
                collection: 'merchants',
                where: { activeAddress: { equals: docId } },
              })
              for (const merchant of merchants.docs) {
                await payload.update({
                  collection: 'merchants',
                  id: merchant.id,
                  data: {
                    merchant_latitude: lat,
                    merchant_longitude: lng,
                  },
                })
              }
            } catch (error) {
              console.error('Error propagating address coordinates to merchants:', error)
            }
          })()
        }
      },
    ],
  },
}