import type { CollectionConfig } from 'payload'

export const Drivers: CollectionConfig = {
  slug: 'drivers',
  admin: {
    useAsTitle: 'user',
    defaultColumns: ['user', 'status', 'vehicleType', 'totalDeliveries', 'isActive'],
    group: 'Food Delivery',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user) {
        if (user.role === 'service' || user.role === 'admin') return true
        if (user.role === 'driver') {
          return { user: { equals: user.id } }
        }
      }
      return false
    },
    create: ({ req: { user } }) => {
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    update: ({ req: { user } }) => {
      if (user) {
        if (user.role === 'service' || user.role === 'admin') return true
        if (user.role === 'driver') {
          return { user: { equals: user.id } }
        }
      }
      return false
    },
    delete: ({ req: { user } }) => {
      return user?.role === 'service' || user?.role === 'admin' || false
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      filterOptions: () => ({
        role: { equals: 'driver' },
      }),
    },

    {
      name: 'status',
      type: 'select',
      defaultValue: 'offline',
      options: [
        { label: 'Offline', value: 'offline' },
        { label: 'Online', value: 'online' },
        { label: 'On Delivery', value: 'on_delivery' },
        { label: 'Paused', value: 'paused' },
      ],
    },

    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },

    {
      name: 'onboardingDate',
      type: 'date',
    },

    {
      name: 'licenseNumber',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'licenseExpiry',
      type: 'date',
    },

    {
      name: 'vehicleType',
      type: 'select',
      options: [
        { label: 'Bicycle', value: 'bicycle' },
        { label: 'Motorcycle', value: 'motorcycle' },
        { label: 'Scooter', value: 'scooter' },
        { label: 'Car', value: 'car' },
      ],
    },
    { name: 'vehicleModel', type: 'text' },
    { name: 'vehiclePlateNumber', type: 'text', unique: true },
    { name: 'vehicleColor', type: 'text' },

    {
      name: 'ratingAverage',
      type: 'number',
      min: 0,
      max: 5,
      defaultValue: 0,
    },
    {
      name: 'totalDeliveries',
      type: 'number',
      min: 0,
      defaultValue: 0,
    },

    { name: 'current_latitude', type: 'number' },
    { name: 'current_longitude', type: 'number' },
    { name: 'current_coordinates', type: 'json' },

    {
      name: 'preferred_service_radius_meters',
      type: 'number',
      min: 0,
    },

    { name: 'service_area', type: 'json' },

    {
      name: 'activeAddress',
      type: 'relationship',
      relationTo: 'addresses',
      filterOptions: async ({ data, req: _req }) => {
        if (data?.user) {
          const userId = typeof data.user === 'object' ? data.user.id : data.user
          if (userId) {
            return { user: { equals: userId } }
          }
        }
        return false
      },
    },

    { name: 'driving_license_image', type: 'upload', relationTo: 'media' },
    { name: 'vehicle_registration_image', type: 'upload', relationTo: 'media' },
  ],
  indexes: [
    { fields: ['user'] },
    { fields: ['status'] },
    { fields: ['isActive'] },
    { fields: ['current_latitude', 'current_longitude'] },
    { fields: ['vehiclePlateNumber'] },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data.current_latitude && data.current_longitude) {
          const lat = parseFloat(data.current_latitude.toString())
          const lng = parseFloat(data.current_longitude.toString())
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            data.current_coordinates = { type: 'Point', coordinates: [lng, lat] }
          }
        } else if (data.current_latitude === null || data.current_longitude === null) {
          data.current_coordinates = null
        }
        return data
      },
    ],
  },
}
