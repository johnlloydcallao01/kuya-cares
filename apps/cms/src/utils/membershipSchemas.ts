/**
 * @file apps/cms/src/utils/membershipSchemas.ts
 * @description zod v4 request schemas for vendor membership + admin
 * membership endpoints. Money is in PHP pesos; validated handlers convert
 * to centavos only at the provider boundary.
 */

import { z } from 'zod'

const billingIntervalSchema = z.enum(['month', 'year', 'one_time'])

const idempotencyKeySchema = z.string().min(8).max(128)

const planSlugSchema = z.string().min(1).max(120)

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
  businessName: z.string().min(2).max(200),
  legalName: z.string().max(200).optional(),
  businessRegistrationNumber: z.string().min(3).max(100),
  primaryContactEmail: z.email().optional(),
  primaryContactPhone: z.string().min(7).max(20).optional(),
  businessType: z
    .enum([
      'restaurant',
      'fast_food',
      'grocery',
      'pharmacy',
      'convenience',
      'bakery',
      'coffee_shop',
      'other',
    ])
    .optional(),
  kycMediaIds: z
    .object({
      businessLicense: z.union([z.string(), z.number()]).optional(),
      taxCertificate: z.union([z.string(), z.number()]).optional(),
      logo: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
  planSlug: planSlugSchema.optional(),
  billingInterval: billingIntervalSchema.optional(),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const checkoutSchema = z.object({
  planSlug: planSlugSchema,
  billingInterval: billingIntervalSchema,
  couponCode: z.string().min(1).max(60).optional(),
  idempotencyKey: idempotencyKeySchema,
})

export const switchPlanSchema = z.object({
  toPlanSlug: planSlugSchema,
  billingInterval: billingIntervalSchema.optional(),
  idempotencyKey: idempotencyKeySchema,
})

export const renewSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
})

export const cancelSchema = z.object({
  cancelAtPeriodEnd: z.boolean().default(true),
  reason: z.string().max(500).optional(),
})

export const trialSchema = z.object({
  planSlug: planSlugSchema,
})

export const couponAttachSchema = z.object({
  code: z.string().min(1).max(60),
  invoiceId: z.union([z.string(), z.number()]).optional(),
})

export const waiveSchema = z.object({
  until: z.string().min(1),
  reason: z.string().min(10).max(2000),
})

export const commissionOverrideSchema = z.object({
  pct: z.number().min(0).max(30).nullable(),
  reason: z.string().min(1).max(2000),
})

export const approveSchema = z.object({
  approve: z.boolean(),
  reason: z.string().max(2000).optional(),
  waive: z
    .object({
      until: z.string().min(1),
      reason: z.string().min(10).max(2000),
    })
    .optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type CheckoutInput = z.infer<typeof checkoutSchema>
export type SwitchPlanInput = z.infer<typeof switchPlanSchema>
export type RenewInput = z.infer<typeof renewSchema>
export type CancelInput = z.infer<typeof cancelSchema>
export type TrialInput = z.infer<typeof trialSchema>
export type CouponAttachInput = z.infer<typeof couponAttachSchema>
export type WaiveInput = z.infer<typeof waiveSchema>
export type CommissionOverrideInput = z.infer<typeof commissionOverrideSchema>
export type ApproveInput = z.infer<typeof approveSchema>
