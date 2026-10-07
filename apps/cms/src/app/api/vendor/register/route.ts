/**
 * @file apps/cms/src/app/api/vendor/register/route.ts
 * @description Public vendor registration (rate-limited). Creates users(vendor)
 * + vendors(pending/isActive false), optional trial, audit log.
 * POST -> 201 {userId,vendorId,subscriptionId?,trialEndsAt?}, 409 on duplicate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import crypto from 'crypto'
import { z } from 'zod'
import {
  audit,
  checkRateLimit,
  clientIp,
  getIdempotencyKey,
  findByIdempotencyKey,
  isMissingCollection,
  periodEndFor,
  newIdempotencyKey,
  invoiceNumber,
} from '@/utils/membershipApi'

const BUSINESS_TYPES = ['restaurant', 'fast_food', 'grocery', 'pharmacy', 'convenience', 'bakery', 'coffee_shop', 'other'] as const

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(40),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  businessName: z.string().min(2),
  legalName: z.string().min(2),
  businessRegistrationNumber: z.string().min(1),
  primaryContactEmail: z.string().email(),
  primaryContactPhone: z.string().min(1),
  businessType: z.enum(BUSINESS_TYPES).default('restaurant'),
  taxIdentificationNumber: z.string().optional().nullable(),
  kycMediaIds: z
    .object({
      businessLicense: z.union([z.number(), z.string()]).optional(),
      taxCertificate: z.union([z.number(), z.string()]).optional(),
      logo: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
  planSlug: z.string().optional(),
  billingInterval: z.enum(['month', 'year', 'one_time']).optional(),
  role: z.enum(['member', 'vendor']).optional().default('vendor'),
  idempotencyKey: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const limited = checkRateLimit('vendor-register', `ip:${clientIp(request)}`, 10, 60 * 60 * 1000)
    if (limited) return limited

    const payload = await getPayload({ config: configPromise })
    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    const data = parsed.data
    const email = data.email.trim().toLowerCase()
    const idemKey = getIdempotencyKey(request, body) || newIdempotencyKey()

    // Idempotent replay: same key -> return original vendor
    try {
      const prior = await findByIdempotencyKey(payload, 'vendors', idemKey)
      if (prior) {
        return NextResponse.json(
          {
            userId: typeof (prior as any).user === 'object' ? (prior as any).user?.id : (prior as any).user,
            vendorId: (prior as any).id,
            deduplicated: true,
          },
          { status: 200 },
        )
      }
    } catch {
      // lookup best-effort
    }

    // Dup check: users.email + vendors.businessRegistrationNumber
    try {
      const [userDup, vendorDup] = await Promise.all([
        payload.find({
          collection: 'users',
          where: { email: { equals: email } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'vendors',
          where: { businessRegistrationNumber: { equals: data.businessRegistrationNumber.trim() } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        }),
      ])
      if ((userDup?.docs?.length ?? 0) > 0) {
        return NextResponse.json({ error: 'Email already in use', code: 'DUPLICATE_EMAIL' }, { status: 409 })
      }
      if ((vendorDup?.docs?.length ?? 0) > 0) {
        return NextResponse.json(
          { error: 'Duplicate businessRegistrationNumber: already exists', code: 'DUPLICATE_BRN' },
          { status: 409 },
        )
      }
    } catch (err: any) {
      if (!isMissingCollection(err)) throw err
    }

    // Verify KYC media ids exist (link-only; upload via POST /api/media/library)
    const kyc = data.kycMediaIds ?? {}
    for (const key of ['businessLicense', 'taxCertificate', 'logo'] as const) {
      const mid = (kyc as any)?.[key]
      if (mid == null || mid === '') continue
      try {
        await payload.findByID({ collection: 'media', id: Number(mid) as any, depth: 0, overrideAccess: true })
      } catch {
        return NextResponse.json({ error: `Media ${key} id ${mid} not found` }, { status: 400 })
      }
    }

    // Create vendor user (role vendor by default; member allowed to own a vendor record)
    let userDoc: any
    try {
      userDoc = await payload.create({
        collection: 'users',
        data: {
          email,
          password: data.password,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          role: data.role ?? 'vendor',
          isActive: true,
        } as any,
        overrideAccess: true,
      })
    } catch (err: any) {
      const msg = String(err?.message || 'Failed to create user')
      if (/unique|already exists|duplicate/i.test(msg)) {
        return NextResponse.json({ error: 'Email already in use', details: msg }, { status: 409 })
      }
      return NextResponse.json({ error: msg, details: err?.data }, { status: 400 })
    }

    // Create vendor (pending, inactive)
    const vendorData: Record<string, any> = {
      user: userDoc.id,
      businessName: data.businessName.trim(),
      legalName: data.legalName.trim(),
      businessRegistrationNumber: data.businessRegistrationNumber.trim(),
      taxIdentificationNumber: data.taxIdentificationNumber?.trim() || null,
      primaryContactEmail: data.primaryContactEmail.trim().toLowerCase(),
      primaryContactPhone: data.primaryContactPhone.trim(),
      businessType: data.businessType,
      verificationStatus: 'pending',
      isActive: false,
      onboardingDate: new Date().toISOString(),
      idempotencyKey: idemKey,
    }
    if (kyc?.businessLicense != null && kyc.businessLicense !== '') vendorData.businessLicense = Number(kyc.businessLicense)
    if (kyc?.taxCertificate != null && kyc.taxCertificate !== '') vendorData.taxCertificate = Number(kyc.taxCertificate)
    if (kyc?.logo != null && kyc.logo !== '') vendorData.logo = Number(kyc.logo)

    let vendorDoc: any
    try {
      vendorDoc = await payload.create({
        collection: 'vendors',
        data: vendorData as any,
        depth: 0,
        overrideAccess: true,
      })
    } catch (err: any) {
      const msg = String(err?.message || 'Failed to create vendor')
      if (/unique|already exists|duplicate/i.test(msg)) {
        return NextResponse.json({ error: 'Duplicate businessRegistrationNumber: already exists', details: msg }, { status: 409 })
      }
      if (isMissingCollection(err)) {
        return NextResponse.json({ error: msg }, { status: 500 })
      }
      return NextResponse.json({ error: msg, details: err?.data }, { status: 400 })
    }

    // Optional trial start when planSlug has trial_days > 0
    let subscriptionId: string | number | null = null
    let trialEndsAt: string | null = null
    if (data.planSlug) {
      try {
        const plans = await payload.find({
          collection: 'membership-plans' as any,
          where: { slug: { equals: data.planSlug } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const plan = plans?.docs?.[0] as any
        if (plan) {
          const trialDays = Number(plan.trial_days ?? plan.trialDays ?? 0) || 0
          const billingInterval = data.billingInterval || plan.billing_interval || plan.billingInterval || 'month'
          if (trialDays > 0) {
            trialEndsAt = new Date(Date.now() + trialDays * 86400000).toISOString()
            const sub = await payload.create({
              collection: 'vendor-subscriptions' as any,
              data: {
                vendor: vendorDoc.id,
                plan: plan.id,
                plan_version: plan.version ?? 1,
                plan_snapshot: {
                  name: plan.name,
                  price: plan.price,
                  billing_interval: billingInterval,
                  commission_percent: plan.commission_percent ?? 0,
                  transaction_fee: plan.transaction_fee ?? 0,
                  limits: plan.limits ?? null,
                  capabilities: plan.capabilities ?? null,
                },
                status: 'trialing',
                billing_interval: billingInterval,
                current_period_start: new Date().toISOString(),
                current_period_end: periodEndFor(billingInterval),
                trial_ends_at: trialEndsAt,
                auto_renew: true,
                payment_provider: 'paymongo',
                idempotencyKey: `trial:${String(vendorDoc.id)}:${crypto.randomUUID()}`,
              } as any,
              overrideAccess: true,
            })
            subscriptionId = (sub as any).id
            await payload.create({
              collection: 'subscription-invoices' as any,
              data: {
                subscription: (sub as any).id,
                vendor: vendorDoc.id,
                plan: plan.id,
                invoice_number: invoiceNumber(),
                amount: 0,
                currency: 'PHP',
                status: 'paid',
                billingReason: 'initial',
                period_start: new Date().toISOString(),
                period_end: periodEndFor(billingInterval),
                due_at: new Date().toISOString(),
                paid_at: new Date().toISOString(),
                payment_provider: 'paymongo',
                idempotencyKey: `trial-inv:${String(vendorDoc.id)}:${crypto.randomUUID()}`,
                metadata: { trial: true },
              } as any,
              overrideAccess: true,
            }).catch(() => null)
          }
        }
      } catch {
        // trial is best-effort when collections missing
      }
    }

    await audit(payload, {
      vendor: vendorDoc.id,
      subscription: subscriptionId,
      action: 'vendor_registered',
      reason: 'public vendor registration',
      metadata: { planSlug: data.planSlug ?? null, trial: Boolean(subscriptionId) },
    })

    return NextResponse.json(
      {
        userId: userDoc.id,
        vendorId: vendorDoc.id,
        subscriptionId,
        trialEndsAt,
      },
      { status: 201 },
    )
  } catch (err: any) {
    console.error('[vendor/register] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
