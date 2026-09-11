import type { CollectionConfig } from 'payload'
import { adminOnly } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'role'],
  },
  auth: {
    tokenExpiration: 30 * 24 * 60 * 60, // 30 days in seconds (2,592,000 seconds)
    maxLoginAttempts: 5,
    lockTime: 600 * 1000, // 10 minutes in milliseconds
    useAPIKey: true, // Enable API key generation for service accounts
    depth: 2,
    cookies: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      domain: process.env.NODE_ENV === 'production' 
        ? process.env.COOKIE_DOMAIN 
        : undefined,
    },
  },
  access: {
    read: () => true, // Allow reading user data
    create: adminOnly, // Only admins can create users
    update: ({ req: { user } }) => {
      // Service accounts, admins, and users can update data
      if (user?.role === 'admin' || user?.role === 'service') return true;
      // Users can update their own data
      return { id: { equals: user?.id } };
    },
    delete: adminOnly, // Only admins can delete users
  },
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        console.log(`🗑️ Attempting to delete user ${id}`);

        // Delete related records first to avoid foreign key constraint errors
        const payload = req.payload;

        try {
          // Delete related customer records
          const customers = await payload.find({
            collection: 'customers',
            where: { user: { equals: id } },
          });

          for (const customer of customers.docs) {
            console.log(`🗑️ Deleting customer record ${customer.id}`);
            await payload.delete({
              collection: 'customers',
              id: customer.id,
            });
          }

          // Delete related emergency contacts
          const emergencyContacts = await payload.find({
            collection: 'emergency-contacts',
            where: { user: { equals: id } },
          });

          for (const contact of emergencyContacts.docs) {
            console.log(`🗑️ Deleting emergency contact ${contact.id}`);
            await payload.delete({
              collection: 'emergency-contacts',
              id: contact.id,
            });
          }

          // Delete related admin records
          const admins = await payload.find({
            collection: 'admins',
            where: { user: { equals: id } },
          });

          for (const admin of admins.docs) {
            console.log(`🗑️ Deleting admin record ${admin.id}`);
            await payload.delete({
              collection: 'admins',
              id: admin.id,
            });
          }

          const drivers = await payload.find({
            collection: 'drivers',
            where: { user: { equals: id } },
          })

          for (const driver of drivers.docs) {
            await payload.delete({
              collection: 'drivers',
              id: driver.id,
            })
          }

          console.log(`✅ Successfully cleaned up related records for user ${id}`);
        } catch (error) {
          console.error(`❌ Error cleaning up related records for user ${id}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new Error(`Failed to delete user: ${errorMessage}`);
        }
      },
    ],
  },

  fields: [
    // Email and password are added automatically by auth: true
    {
      name: 'firstName',
      type: 'text',
      required: true,
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
    },
    {
      name: 'middleName',
      type: 'text',
      admin: {
        description: 'Middle name (optional)',
      },
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        description: 'Contact phone number',
      },
    },
    {
      name: 'nameExtension',
      type: 'text',
      admin: {
        description: 'Name extension (e.g., Jr., Sr., III)',
      },
    },
    {
      name: 'username',
      type: 'text',
      unique: true,
      admin: {
        description: 'Unique username for login',
      },
    },
    {
      name: 'gender',
      type: 'select',
      options: [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
        { label: 'Other', value: 'other' },
        { label: 'Prefer not to say', value: 'prefer_not_to_say' },
      ],
      admin: {
        description: 'Gender identity',
      },
    },
    {
      name: 'civilStatus',
      type: 'select',
      options: [
        { label: 'Single', value: 'single' },
        { label: 'Married', value: 'married' },
        { label: 'Divorced', value: 'divorced' },
        { label: 'Widowed', value: 'widowed' },
        { label: 'Separated', value: 'separated' },
      ],
      admin: {
        description: 'Civil status',
      },
    },
    {
      name: 'nationality',
      type: 'text',
      admin: {
        description: 'Nationality',
      },
    },
    {
      name: 'birthDate',
      type: 'date',
      admin: {
        description: 'Date of birth',
      },
    },
    {
      name: 'placeOfBirth',
      type: 'text',
      admin: {
        description: 'Place of birth',
      },
    },
    {
      name: 'completeAddress',
      type: 'textarea',
      admin: {
        description: 'Complete address',
      },
    },

    {
      name: 'role',
      type: 'select',
      options: [
        {
          label: 'Admin',
          value: 'admin',
        },
        {
              label: 'Customer',
              value: 'customer',
            },
        {
          label: 'Service Account', // Step 2: Add dedicated role for API key users
          value: 'service',
        },
        {
          label: 'Vendor',
          value: 'vendor',
        },
        {
          label: 'Driver',
          value: 'driver',
        },
      ],
      defaultValue: 'customer',
      required: true,
      admin: {
        description: 'User role determines access permissions. Service accounts are for API key authentication.',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Inactive users cannot log in',
      },
    },

    {
      name: 'lastLogin',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Last login timestamp',
      },
    },
    {
      name: 'profilePicture',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'User profile picture',
      },
    },

    {
      name: 'resetPasswordTokens',
      type: 'array',
      fields: [
        { name: 'token', type: 'text', required: true },
        { name: 'expiresAt', type: 'date', required: true },
      ],
    },

  ],
}
