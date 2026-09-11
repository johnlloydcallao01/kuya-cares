import type { CollectionConfig } from 'payload'

export const DeliveryBookings: CollectionConfig = {
  slug: 'delivery-bookings',
  admin: {
    useAsTitle: 'lalamove_order_id',
    defaultColumns: [
      'order',
      'lalamove_order_id',
      'status',
      'driver_name',
      'delivery_fee',
      'service_type',
    ],
    group: 'Ordering System',
    description: 'Lalamove delivery bookings — replaces internal driver-assignment',
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
    create: ({ req: { user } }) => {
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    update: ({ req: { user } }) => {
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    delete: ({ req: { user } }) => {
      return user?.role === 'service' || user?.role === 'admin' || false
    },
  },
  fields: [
    // ─── Order relationship ──────────────────────────────────────────────────
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      required: true,
      unique: true,
      admin: {
        description: 'One-to-one relationship with the order',
      },
    },

    // ─── Lalamove identifiers ────────────────────────────────────────────────
    {
      name: 'lalamove_order_id',
      type: 'text',
      admin: {
        description: 'Lalamove Order ID (returned after placing delivery)',
      },
    },
    {
      name: 'lalamove_quotation_id',
      type: 'text',
      admin: {
        description: 'Quotation ID used to place the delivery',
      },
    },
    {
      name: 'share_link',
      type: 'text',
      admin: {
        description: 'Lalamove public tracking link',
      },
    },

    // ─── Service details ─────────────────────────────────────────────────────
    {
      name: 'service_type',
      type: 'text',
      defaultValue: 'MOTORCYCLE',
      admin: {
        description: 'Vehicle type: MOTORCYCLE, SEDAN, MPV, VAN, etc.',
      },
    },
    {
      name: 'scheduled_at',
      type: 'date',
      admin: {
        description: 'Scheduled pickup time (if not immediate)',
      },
    },
    {
      name: 'expires_at',
      type: 'date',
      admin: {
        description: 'When the Lalamove quotation expires',
      },
    },

    // ─── Delivery status ─────────────────────────────────────────────────────
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Assigning Driver', value: 'assigning_driver' },
        { label: 'Driver Assigned (ON_GOING)', value: 'driver_assigned' },
        { label: 'Picked Up', value: 'picked_up' },
        { label: 'Completed', value: 'completed' },
        { label: 'Canceled', value: 'canceled' },
        { label: 'Rejected (Will Re-match)', value: 'rejected' },
        { label: 'Expired', value: 'expired' },
      ],
      admin: {
        description: 'Mapped from Lalamove order status',
      },
    },
    {
      name: 'lalamove_raw_status',
      type: 'text',
      admin: {
        description: 'Raw status string from Lalamove webhook',
      },
    },

    // ─── Pricing ─────────────────────────────────────────────────────────────
    {
      name: 'delivery_fee',
      type: 'number',
      admin: {
        description: 'Actual delivery cost from Lalamove',
      },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'PHP',
      admin: {
        description: 'Lalamove currency code',
      },
    },
    {
      name: 'priority_fee',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Priority fee / tip added to the delivery',
      },
    },

    // ─── Rider details ───────────────────────────────────────────────────────
    {
      name: 'driver_name',
      type: 'text',
      admin: {
        description: 'Lalamove rider name (populated when assigned)',
      },
    },
    {
      name: 'driver_phone',
      type: 'text',
      admin: {
        description: 'Lalamove rider phone (populated when assigned)',
      },
    },
    {
      name: 'driver_plate_number',
      type: 'text',
      admin: {
        description: 'License plate of the rider\'s vehicle',
      },
    },
    {
      name: 'driver_photo_url',
      type: 'text',
      admin: {
        description: 'Profile photo URL of the rider',
      },
    },
    {
      name: 'driver_lat',
      type: 'number',
      admin: {
        description: 'Rider current latitude (live from Lalamove, updated every 10s)',
        position: 'sidebar',
      },
    },
    {
      name: 'driver_lng',
      type: 'number',
      admin: {
        description: 'Rider current longitude',
        position: 'sidebar',
      },
    },
    {
      name: 'driver_location_updated_at',
      type: 'date',
      admin: {
        description: 'Last time the rider location was refreshed',
        position: 'sidebar',
      },
    },

    // ─── Pickup (merchant) ───────────────────────────────────────────────────
    {
      name: 'pickup_address',
      type: 'text',
      admin: {
        description: 'Merchant / pickup location address',
      },
    },
    {
      name: 'pickup_lat',
      type: 'number',
      admin: { description: 'Pickup latitude' },
    },
    {
      name: 'pickup_lng',
      type: 'number',
      admin: { description: 'Pickup longitude' },
    },

    // ─── Dropoff (customer) ──────────────────────────────────────────────────
    {
      name: 'dropoff_address',
      type: 'text',
      admin: {
        description: 'Customer delivery address',
      },
    },
    {
      name: 'dropoff_lat',
      type: 'number',
      admin: { description: 'Dropoff latitude' },
    },
    {
      name: 'dropoff_lng',
      type: 'number',
      admin: { description: 'Dropoff longitude' },
    },

    // ─── Distance ────────────────────────────────────────────────────────────
    {
      name: 'distance_meters',
      type: 'number',
      admin: {
        description: 'Distance from Lalamove (meters)',
      },
    },
  ],
}
