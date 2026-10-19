import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendorOrMember } from '@/utils/mediaLibrary'

export const dynamic = 'force-dynamic'

const BUSINESS_TYPES = new Set([
  'restaurant',
  'fast_food',
  'grocery',
  'pharmacy',
  'convenience',
  'bakery',
  'coffee_shop',
  'other',
])
const SOCIAL_LINK_FIELDS = ['facebook', 'instagram', 'twitter', 'website'] as const

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function optionalText(value: unknown, label: string, maxLength: number): string | null {
  if (value === null || value === '') return null
  if (typeof value !== 'string') throw new Error(`${label} must be a string`)
  const text = value.trim()
  if (text.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer`)
  return text || null
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendorOrMember(payload, request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
      const parsed: unknown = await request.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return badRequest('Request body must be an object')
      }
      body = parsed as Record<string, unknown>
    } catch {
      return badRequest('Invalid JSON body')
    }

    const vendorId = Number(body.vendorId)
    if (!Number.isSafeInteger(vendorId) || vendorId < 1) return badRequest('vendorId must be a positive integer')

    const ownedVendors = await payload.find({
      collection: 'vendors',
      where: {
        and: [
          { id: { equals: vendorId } },
          { user: { equals: authUser.id } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const ownedVendor = ownedVendors.docs[0]
    if (!ownedVendor) {
      return NextResponse.json({ error: 'Business profile not found' }, { status: 404 })
    }

    const patch: Record<string, unknown> = {}
    try {
      if (hasOwn(body, 'businessName')) {
        const businessName = optionalText(body.businessName, 'businessName', 160)
        if (!businessName || businessName.length < 2) throw new Error('businessName must be at least 2 characters')
        patch.businessName = businessName
      }
      if (hasOwn(body, 'legalName')) {
        const legalName = optionalText(body.legalName, 'legalName', 160)
        if (!legalName || legalName.length < 2) throw new Error('legalName must be at least 2 characters')
        patch.legalName = legalName
      }
      if (hasOwn(body, 'primaryContactEmail')) {
        const email = optionalText(body.primaryContactEmail, 'primaryContactEmail', 254)
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid primaryContactEmail is required')
        patch.primaryContactEmail = email.toLowerCase()
      }
      if (hasOwn(body, 'primaryContactPhone')) {
        const phone = optionalText(body.primaryContactPhone, 'primaryContactPhone', 40)
        if (!phone) throw new Error('primaryContactPhone is required')
        patch.primaryContactPhone = phone
      }
      if (hasOwn(body, 'websiteUrl')) {
        const website = optionalText(body.websiteUrl, 'websiteUrl', 500)
        if (website) {
          let parsedUrl: URL
          try {
            parsedUrl = new URL(website)
          } catch {
            throw new Error('websiteUrl must be a valid URL')
          }
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('websiteUrl must use http or https')
          patch.websiteUrl = parsedUrl.toString()
        } else {
          patch.websiteUrl = null
        }
      }
      if (hasOwn(body, 'businessType')) {
        if (typeof body.businessType !== 'string' || !BUSINESS_TYPES.has(body.businessType)) {
          throw new Error('businessType is not supported')
        }
        patch.businessType = body.businessType
      }
      if (hasOwn(body, 'cuisineTypes')) {
        if (body.cuisineTypes !== null && !Array.isArray(body.cuisineTypes)) {
          throw new Error('cuisineTypes must be an array of strings')
        }
        const cuisineTypes = (body.cuisineTypes ?? []) as unknown[]
        if (cuisineTypes.some((value) => typeof value !== 'string')) {
          throw new Error('cuisineTypes must be an array of strings')
        }
        patch.cuisineTypes = [...new Set(cuisineTypes.map((value) => (value as string).trim()).filter(Boolean))].slice(0, 30)
      }
      if (hasOwn(body, 'description')) {
        patch.description = optionalText(body.description, 'description', 2000)
      }
      if (hasOwn(body, 'socialMediaLinks')) {
        const socials = body.socialMediaLinks
        if (!socials || typeof socials !== 'object' || Array.isArray(socials)) {
          throw new Error('socialMediaLinks must be an object')
        }
        const input = socials as Record<string, unknown>
        const updatedSocials: Record<string, string | null> = {}
        for (const field of SOCIAL_LINK_FIELDS) {
          if (hasOwn(input, field)) updatedSocials[field] = optionalText(input[field], `socialMediaLinks.${field}`, 500)
        }
        patch.socialMediaLinks = updatedSocials
      }
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : 'Invalid business profile data')
    }

    if (Object.keys(patch).length === 0) return badRequest('No editable business profile fields were provided')

    const updated = await payload.update({
      collection: 'vendors',
      id: ownedVendor.id,
      data: patch,
      depth: 1,
      overrideAccess: true,
    })

    return NextResponse.json({
      success: true,
      vendor: {
        id: updated.id,
        businessName: updated.businessName,
        legalName: updated.legalName,
        primaryContactEmail: updated.primaryContactEmail,
        primaryContactPhone: updated.primaryContactPhone,
        websiteUrl: updated.websiteUrl,
        businessType: updated.businessType,
        cuisineTypes: updated.cuisineTypes,
        description: updated.description,
        socialMediaLinks: updated.socialMediaLinks,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (error) {
    console.error('[vendor/business-profile] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update business profile' }, { status: 500 })
  }
}
