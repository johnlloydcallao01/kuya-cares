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
    read: ({ req: { user } }) => {
      // PII lockdown: service/admin see all, everyone else only themselves.
      if (!user) return false
      if (user.role === 'admin' || user.role === 'service') return true
      return { id: { equals: user.id } }
    },
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
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        try {
          // Security-activity feed: PASSWORD_CHANGED / PROFILE_UPDATED.
          // Skip pure auth bookkeeping (lastLogin, attempts, lock) to avoid noise.
          if (operation === 'update' && previousDoc && doc) {
            const prev = previousDoc as Record<string, any>
            const next = doc as Record<string, any>
            if (prev.hash !== next.hash) {
              // Perf: audit must never block the profile PUT response (was an
              // awaited INSERT on the critical path). Fire-and-forget like
              // Addresses.afterChange.
              void req.payload
                .create({
                  collection: 'user-events',
                  data: {
                    user: next.id,
                    eventType: 'PASSWORD_CHANGED',
                    eventData: { reason: 'password_update' },
                    triggeredBy: (req.user as any)?.id,
                    timestamp: new Date().toISOString(),
                  },
                  overrideAccess: true,
                })
                .catch(() => {})
              return doc
            }
            const watched = [
              'firstName',
              'lastName',
              'middleName',
              'phone',
              'username',
              'gender',
              'civilStatus',
              'nationality',
              'birthDate',
              'placeOfBirth',
              'completeAddress',
              'profilePicture',
              'preferredLanguage',
              'timezone',
              'currency',
              'email',
            ]
            const changed = watched.filter((f) => JSON.stringify(prev[f] ?? null) !== JSON.stringify(next[f] ?? null))
            if (changed.length > 0) {
              // Perf: same — audit off the critical path. Response no longer
              // waits for the user-events INSERT (address-save pattern).
              void req.payload
                .create({
                  collection: 'user-events',
                  data: {
                    user: next.id,
                    eventType: 'PROFILE_UPDATED',
                    eventData: { changedFields: changed },
                    triggeredBy: (req.user as any)?.id,
                    timestamp: new Date().toISOString(),
                  },
                  overrideAccess: true,
                })
                .catch(() => {})
            }
          }
        } catch {
          // Never block auth writes on audit failures.
        }
        return doc
      },
    ],
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
            overrideAccess: true,
            depth: 0,
          });

          for (const customer of customers.docs) {
            console.log(`🗑️ Deleting customer record ${customer.id}`);
            await payload.delete({
              collection: 'customers',
              id: customer.id,
              overrideAccess: true,
            }).catch(() => {});
          }

          // Delete related emergency contacts
          const emergencyContacts = await payload.find({
            collection: 'emergency-contacts',
            where: { user: { equals: id } },
            overrideAccess: true,
            depth: 0,
          });

          for (const contact of emergencyContacts.docs) {
            console.log(`🗑️ Deleting emergency contact ${contact.id}`);
            await payload.delete({
              collection: 'emergency-contacts',
              id: contact.id,
              overrideAccess: true,
            }).catch(() => {});
          }

          // Delete related admin records
          const admins = await payload.find({
            collection: 'admins',
            where: { user: { equals: id } },
            overrideAccess: true,
            depth: 0,
          });

          for (const admin of admins.docs) {
            console.log(`🗑️ Deleting admin record ${admin.id}`);
            await payload.delete({
              collection: 'admins',
              id: admin.id,
              overrideAccess: true,
            }).catch(() => {});
          }

          const drivers = await payload.find({
            collection: 'drivers',
            where: { user: { equals: id } },
            overrideAccess: true,
            depth: 0,
          });

          for (const driver of drivers.docs) {
            await payload.delete({
              collection: 'drivers',
              id: driver.id,
              overrideAccess: true,
            }).catch(() => {});
          }

          // Private members-only marketplace cleanup: remove invites, listings,
          // and orders tied to this user. Unified member accounts buy+sell, so
          // all three must be purged. Never throw — best-effort cleanup only.
          const memberInvitesInvitedBy = await payload.find({
            collection: 'member-invites',
            where: { invitedBy: { equals: id } },
            overrideAccess: true,
            depth: 0,
          }).catch(() => ({ docs: [] as { id: string | number }[] }));

          for (const invite of memberInvitesInvitedBy.docs) {
            await payload.delete({
              collection: 'member-invites',
              id: invite.id,
              overrideAccess: true,
            }).catch(() => {});
          }

          const memberInvitesClaimedBy = await payload.find({
            collection: 'member-invites',
            where: { claimedBy: { equals: id } },
            overrideAccess: true,
            depth: 0,
          }).catch(() => ({ docs: [] as { id: string | number }[] }));

          for (const invite of memberInvitesClaimedBy.docs) {
            await payload.delete({
              collection: 'member-invites',
              id: invite.id,
              overrideAccess: true,
            }).catch(() => {});
          }

          const memberListings = await payload.find({
            collection: 'member-listings',
            where: { seller: { equals: id } },
            overrideAccess: true,
            depth: 0,
          }).catch(() => ({ docs: [] as { id: string | number }[] }));

          for (const listing of memberListings.docs) {
            await payload.delete({
              collection: 'member-listings',
              id: listing.id,
              overrideAccess: true,
            }).catch(() => {});
          }

          const memberOrdersBuyer = await payload.find({
            collection: 'member-orders',
            where: { buyer: { equals: id } },
            overrideAccess: true,
            depth: 0,
          }).catch(() => ({ docs: [] as { id: string | number }[] }));

          for (const order of memberOrdersBuyer.docs) {
            await payload.delete({
              collection: 'member-orders',
              id: order.id,
              overrideAccess: true,
            }).catch(() => {});
          }

          const memberOrdersSeller = await payload.find({
            collection: 'member-orders',
            where: { seller: { equals: id } },
            overrideAccess: true,
            depth: 0,
          }).catch(() => ({ docs: [] as { id: string | number }[] }));

          for (const order of memberOrdersSeller.docs) {
            await payload.delete({
              collection: 'member-orders',
              id: order.id,
              overrideAccess: true,
            }).catch(() => {});
          }

          console.log(`✅ Successfully cleaned up related records for user ${id}`);
        } catch (error) {
          console.warn(`⚠️ Warning cleaning up related records for user ${id}:`, error);
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
          label: 'Member',
          value: 'member',
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
      // NOTE: DB default stays 'customer' to avoid an existing-data migration
      // risk. The app layer must set role:'member' explicitly when creating
      // private-marketplace signups (unified buy+sell account).
      defaultValue: 'customer',
      required: true,
      admin: {
        description:
          'User role determines access permissions. Member = unified private-marketplace account (buys+sells same account); Admin supervises all. Service accounts are for API key authentication.',
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
    {
      name: 'emailChangeTokens',
      type: 'array',
      admin: {
        description: 'Pending email change/verification tokens (sha256, single-use)',
      },
      fields: [
        { name: 'token', type: 'text', required: true },
        { name: 'expiresAt', type: 'date', required: true },
        { name: 'newEmail', type: 'text', required: true },
      ],
    },
    {
      name: 'emailVerifiedAt',
      type: 'date',
      admin: {
        description: 'When the login email was last verified',
      },
    },
    {
      name: 'phoneVerifiedAt',
      type: 'date',
      admin: {
        description: 'When the phone number was last verified (OTP vendor pending)',
      },
    },
    {
      name: 'preferredLanguage',
      type: 'select',
      defaultValue: 'en',
      options: [
        { label: 'English', value: 'en' },
        { label: 'Filipino', value: 'fil' },
      ],
      admin: {
        description: 'Account display language',
      },
    },
    {
      name: 'timezone',
      type: 'text',
      defaultValue: 'Asia/Manila',
      admin: {
        description: 'IANA timezone for account display',
      },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'PHP',
      admin: {
        description: 'Display currency (ISO code)',
      },
    },
    {
      name: 'marketingOptIn',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Consented to marketing notifications at signup (mirrored to notification-preferences)',
      },
    },
    {
      name: 'dataConsentAt',
      type: 'date',
      admin: {
        description: 'When data-processing consent was last recorded',
      },
    },
    {
      name: 'deactivatedAt',
      type: 'date',
      admin: {
        description: 'Self-serve deactivation timestamp (isActive=false)',
      },
    },
    {
      name: 'deleteRequestedAt',
      type: 'date',
      admin: {
        description: 'Account deletion request timestamp (cooling-off, purge is manual)',
      },
    },

  ],
}
