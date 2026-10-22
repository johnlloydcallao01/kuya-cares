import { createHmac, timingSafeEqual } from 'crypto'
import type { Payload, PayloadRequest } from 'payload'
import { z } from 'zod'

const locationField = z.string().trim().min(1).max(120)

const shippingAreaSchema = z
  .object({
    region: locationField.optional(),
    province: locationField.optional(),
    city: locationField.optional(),
    barangays: z.array(locationField).max(500).default([]),
    postalCodes: z.array(z.string().trim().regex(/^\d{4}$/)).max(500).default([]),
  })
  .strict()
  .superRefine((area, ctx) => {
    if (
      !area.region &&
      !area.province &&
      !area.city &&
      area.barangays.length === 0 &&
      area.postalCodes.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Each delivery area must include at least one region, province, city, barangay, or postal code.',
      })
    }
  })

const geoPositionSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
])

type GeoPosition = [number, number]

function orientation(a: GeoPosition, b: GeoPosition, c: GeoPosition): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function pointOnSegment(point: GeoPosition, start: GeoPosition, end: GeoPosition): boolean {
  return (
    Math.abs(orientation(start, end, point)) < 1e-12 &&
    point[0] >= Math.min(start[0], end[0]) - 1e-12 &&
    point[0] <= Math.max(start[0], end[0]) + 1e-12 &&
    point[1] >= Math.min(start[1], end[1]) - 1e-12 &&
    point[1] <= Math.max(start[1], end[1]) + 1e-12
  )
}

function segmentsIntersect(
  a: GeoPosition,
  b: GeoPosition,
  c: GeoPosition,
  d: GeoPosition,
): boolean {
  const first = orientation(a, b, c)
  const second = orientation(a, b, d)
  const third = orientation(c, d, a)
  const fourth = orientation(c, d, b)
  if (first * second < 0 && third * fourth < 0) return true

  return (
    (Math.abs(first) < 1e-12 && pointOnSegment(c, a, b)) ||
    (Math.abs(second) < 1e-12 && pointOnSegment(d, a, b)) ||
    (Math.abs(third) < 1e-12 && pointOnSegment(a, c, d)) ||
    (Math.abs(fourth) < 1e-12 && pointOnSegment(b, c, d))
  )
}

const linearRingSchema = z
  .array(geoPositionSchema)
  .min(4)
  .max(101)
  .superRefine((ring, ctx) => {
    const first = ring[0]
    const last = ring[ring.length - 1]
    if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
      ctx.addIssue({
        code: 'custom',
        message: 'Polygon rings must be closed.',
      })
      return
    }

    const vertices = ring.slice(0, -1)
    if (new Set(vertices.map(([longitude, latitude]) => `${longitude},${latitude}`)).size < 3) {
      ctx.addIssue({
        code: 'custom',
        message: 'Polygon rings must contain at least three distinct points.',
      })
    }

    if (
      ring.some(
        (point, index) =>
          index > 0 &&
          point[0] === ring[index - 1][0] &&
          point[1] === ring[index - 1][1],
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Polygon rings cannot contain consecutive duplicate points.',
      })
    }

    let twiceArea = 0
    for (let index = 0; index < vertices.length; index += 1) {
      const current = vertices[index]
      const next = vertices[(index + 1) % vertices.length]
      twiceArea += current[0] * next[1] - next[0] * current[1]
    }
    if (Math.abs(twiceArea) < 1e-12) {
      ctx.addIssue({
        code: 'custom',
        message: 'Polygon rings must enclose an area.',
      })
    }

    const segmentCount = ring.length - 1
    for (let firstSegment = 0; firstSegment < segmentCount; firstSegment += 1) {
      for (let secondSegment = firstSegment + 1; secondSegment < segmentCount; secondSegment += 1) {
        const areAdjacent =
          secondSegment === firstSegment + 1 ||
          (firstSegment === 0 && secondSegment === segmentCount - 1)
        if (areAdjacent) continue

        if (
          segmentsIntersect(
            ring[firstSegment],
            ring[firstSegment + 1],
            ring[secondSegment],
            ring[secondSegment + 1],
          )
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'Polygon rings cannot intersect themselves.',
          })
          return
        }
      }
    }
  })

const polygonCoordinatesSchema = z.array(linearRingSchema).min(1).max(10)

const shippingZoneGeometrySchema = z
  .discriminatedUnion('type', [
    z
      .object({
        type: z.literal('Polygon'),
        coordinates: polygonCoordinatesSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal('MultiPolygon'),
        coordinates: z.array(polygonCoordinatesSchema).min(1).max(10),
      })
      .strict(),
  ])
  .superRefine((geometry, ctx) => {
    const polygons =
      geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
    const pointCount = polygons.reduce(
      (total, polygon) =>
        total + polygon.reduce((ringTotal, ring) => ringTotal + ring.length, 0),
      0,
    )
    if (pointCount > 1000) {
      ctx.addIssue({
        code: 'custom',
        message: 'A delivery boundary cannot exceed 1,000 coordinates.',
      })
    }
  })

const shippingZoneSchema = z
  .object({
    id: z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/),
    name: z.string().trim().max(100).default(''),
    enabled: z.boolean().default(true),
    areas: z.array(shippingAreaSchema).max(500).default([]),
    geometry: shippingZoneGeometrySchema.nullable().default(null),
    deliveryFee: z.number().finite().min(0).max(100000),
    minimumOrderAmount: z.number().finite().min(0).max(1000000).default(0),
    freeDeliveryThreshold: z.number().finite().min(0).max(1000000).nullable().default(null),
    estimatedDeliveryMinMinutes: z.number().int().min(0).max(10080).default(0),
    estimatedDeliveryMaxMinutes: z.number().int().min(0).max(10080).default(0),
  })
  .strict()
  .superRefine((zone, ctx) => {
    if (zone.areas.length === 0 && !zone.geometry) {
      ctx.addIssue({
        code: 'custom',
        message: 'Each delivery zone must include at least one address area or a map boundary.',
      })
    }
  })
  .superRefine((zone, ctx) => {
    if (
      (zone.estimatedDeliveryMaxMinutes === 0 && zone.estimatedDeliveryMinMinutes > 0) ||
      (zone.estimatedDeliveryMaxMinutes > 0 &&
        zone.estimatedDeliveryMinMinutes > zone.estimatedDeliveryMaxMinutes)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['estimatedDeliveryMaxMinutes'],
        message: 'Maximum estimated delivery time must be greater than or equal to the minimum.',
      })
    }
  })

const sellerShippingSettingsSchema = z
  .object({
    version: z.literal(1).default(1),
    pickup: z
      .object({
        enabled: z.boolean().default(false),
        instructions: z.string().trim().max(1000).nullable().default(null),
      })
      .strict()
      .default({ enabled: false, instructions: null }),
    zones: z.array(shippingZoneSchema).max(1000).default([]),
  })
  .strict()
  .superRefine((settings, ctx) => {
    const zoneIds = new Set<string>()
    for (const [index, zone] of settings.zones.entries()) {
      if (zoneIds.has(zone.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['zones', index, 'id'],
          message: `Duplicate shipping zone id "${zone.id}".`,
        })
      }
      zoneIds.add(zone.id)
    }
  })

export type SellerShippingArea = z.infer<typeof shippingAreaSchema>
export type SellerShippingZoneGeometry = z.infer<typeof shippingZoneGeometrySchema>
export type SellerShippingZone = z.infer<typeof shippingZoneSchema>
export type SellerShippingSettings = z.infer<typeof sellerShippingSettingsSchema>

export type ShippingAddress = {
  country?: unknown
  administrative_area_level_1?: unknown
  administrative_area_level_2?: unknown
  locality?: unknown
  barangay?: unknown
  postal_code?: unknown
  latitude?: unknown
  longitude?: unknown
}

export type SellerShippingOption = {
  id: string
  type: 'seller_delivery' | 'pickup'
  name: string
  fee: number
  zoneId: string | null
  zoneName: string | null
  estimatedDeliveryMinMinutes: number | null
  estimatedDeliveryMaxMinutes: number | null
  pickupInstructions: string | null
}

export type SignedShippingQuote = {
  version: 1
  customerId: string
  merchantId: string
  addressId: string | null
  cartSubtotal: number
  selectedOption: SellerShippingOption
  settingsDigest: string
  expiresAt: number
}

const signedShippingQuoteSchema = z.object({
  version: z.literal(1),
  customerId: z.string().min(1),
  merchantId: z.string().min(1),
  addressId: z.string().nullable(),
  cartSubtotal: z.number().finite().min(0),
  selectedOption: z.object({
    id: z.string().min(1),
    type: z.enum(['seller_delivery', 'pickup']),
    name: z.string().min(1),
    fee: z.number().finite().min(0),
    zoneId: z.string().nullable(),
    zoneName: z.string().nullable(),
    estimatedDeliveryMinMinutes: z.number().int().nullable(),
    estimatedDeliveryMaxMinutes: z.number().int().nullable(),
    pickupInstructions: z.string().nullable(),
  }),
  settingsDigest: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.number().int().positive(),
}).strict()

export function parseSellerShippingSettings(value: unknown): SellerShippingSettings {
  const parsed = sellerShippingSettingsSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join(' '))
  }
  return parsed.data
}

export function emptySellerShippingSettings(): SellerShippingSettings {
  return sellerShippingSettingsSchema.parse({})
}

export async function loadSellerShippingSettings(
  payload: Payload,
  merchant: Record<string, unknown>,
  req?: Partial<PayloadRequest>,
): Promise<SellerShippingSettings> {
  const result = await payload.find({
    collection: 'seller-shipping-zones',
    where: { merchant: { equals: merchant.id } },
    limit: 1000,
    pagination: false,
    sort: 'displayOrder',
    depth: 0,
    overrideAccess: true,
    req,
  })

  return parseSellerShippingSettings({
    pickup: {
      enabled: merchant.seller_pickup_enabled === true,
      instructions:
        typeof merchant.seller_pickup_instructions === 'string'
          ? merchant.seller_pickup_instructions
          : null,
    },
    zones: [...result.docs]
      .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
      .map((doc) => ({
        id: doc.zoneId,
        name: doc.name ?? '',
        enabled: doc.enabled,
        areas: doc.areas,
        geometry: doc.geometry ?? null,
        deliveryFee: doc.deliveryFee,
        minimumOrderAmount: doc.minimumOrderAmount,
        freeDeliveryThreshold: doc.freeDeliveryThreshold ?? null,
        estimatedDeliveryMinMinutes: doc.estimatedDeliveryMinMinutes,
        estimatedDeliveryMaxMinutes: doc.estimatedDeliveryMaxMinutes,
      }))
  })
}

export async function replaceSellerShippingZones(
  payload: Payload,
  merchantId: number,
  settings: SellerShippingSettings,
  req?: Partial<PayloadRequest>,
): Promise<void> {
  const existingResult = await payload.find({
    collection: 'seller-shipping-zones',
    where: { merchant: { equals: merchantId } },
    limit: 1000,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const existingByZoneId = new Map(
    existingResult.docs.map((doc) => [String(doc.zoneId), doc]),
  )
  const submittedIds = new Set(settings.zones.map((zone) => zone.id))

  for (const [displayOrder, zone] of settings.zones.entries()) {
    const data = {
      merchant: merchantId,
      zoneId: zone.id,
      name: zone.name,
      enabled: zone.enabled,
      displayOrder,
      areas: zone.areas,
      geometry: zone.geometry,
      deliveryFee: zone.deliveryFee,
      minimumOrderAmount: zone.minimumOrderAmount,
      freeDeliveryThreshold: zone.freeDeliveryThreshold,
      estimatedDeliveryMinMinutes: zone.estimatedDeliveryMinMinutes,
      estimatedDeliveryMaxMinutes: zone.estimatedDeliveryMaxMinutes,
    }
    const existing = existingByZoneId.get(zone.id)
    if (existing) {
      await payload.update({
        collection: 'seller-shipping-zones',
        id: existing.id,
        data,
        overrideAccess: true,
        req,
      })
    } else {
      await payload.create({
        collection: 'seller-shipping-zones',
        data,
        overrideAccess: true,
        req,
      })
    }
  }

  for (const doc of existingResult.docs) {
    if (!submittedIds.has(String(doc.zoneId))) {
      await payload.delete({
        collection: 'seller-shipping-zones',
        id: doc.id,
        overrideAccess: true,
        req,
      })
    }
  }
}

export function normalizeLocation(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
}

function normalizePostalCode(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  return String(value).replace(/\D/g, '')
}

function addressValues(address: ShippingAddress) {
  return {
    country: normalizeLocation(address.country),
    region: normalizeLocation(address.administrative_area_level_1),
    province: normalizeLocation(
      address.administrative_area_level_2 ?? address.administrative_area_level_1,
    ),
    city: normalizeLocation(address.locality),
    barangay: normalizeLocation(address.barangay),
    postalCode: normalizePostalCode(address.postal_code),
  }
}

function areaMatches(area: SellerShippingArea, address: ShippingAddress): boolean {
  const values = addressValues(address)
  if (values.country !== 'ph' && values.country !== 'philippines') return false

  if (area.region && normalizeLocation(area.region) !== values.region) return false
  if (area.province && normalizeLocation(area.province) !== values.province) return false
  if (area.city && normalizeLocation(area.city) !== values.city) return false
  if (
    area.barangays.length > 0 &&
    !area.barangays.some((barangay) => normalizeLocation(barangay) === values.barangay)
  ) {
    return false
  }
  if (
    area.postalCodes.length > 0 &&
    !area.postalCodes.some((postalCode) => normalizePostalCode(postalCode) === values.postalCode)
  ) {
    return false
  }

  return true
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function getSellerShippingOptions(args: {
  settings: SellerShippingSettings
  address?: ShippingAddress | null
  cartSubtotal: number
}): SellerShippingOption[] {
  const subtotal = money(args.cartSubtotal)
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new Error('Cart subtotal must be a non-negative finite amount.')
  }

  const options: SellerShippingOption[] = []
  if (args.address) {
    function pointInRing(point: [number, number], ring: [number, number][]): boolean {
      const [longitude, latitude] = point
      let isInside = false

      for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
        const [currentLongitude, currentLatitude] = ring[current]
        const [previousLongitude, previousLatitude] = ring[previous]
        const cross =
          (longitude - currentLongitude) * (previousLatitude - currentLatitude) -
          (latitude - currentLatitude) * (previousLongitude - currentLongitude)
        const onSegment =
          Math.abs(cross) < 1e-10 &&
          longitude >= Math.min(currentLongitude, previousLongitude) - 1e-10 &&
          longitude <= Math.max(currentLongitude, previousLongitude) + 1e-10 &&
          latitude >= Math.min(currentLatitude, previousLatitude) - 1e-10 &&
          latitude <= Math.max(currentLatitude, previousLatitude) + 1e-10

        if (onSegment) return true

        const crossesLatitude =
          (currentLatitude > latitude) !== (previousLatitude > latitude)
        if (
          crossesLatitude &&
          longitude <
            ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
              (previousLatitude - currentLatitude) +
              currentLongitude
        ) {
          isInside = !isInside
        }
      }

      return isInside
    }

    function polygonContainsPoint(point: [number, number], rings: [number, number][][]): boolean {
      const [outerRing, ...holes] = rings
      return Boolean(
        outerRing &&
          pointInRing(point, outerRing) &&
          !holes.some((hole) => pointInRing(point, hole)),
      )
    }

    function geometryMatches(
      geometry: SellerShippingZoneGeometry,
      address: ShippingAddress,
    ): boolean {
      const values = addressValues(address)
      if (values.country !== 'ph' && values.country !== 'philippines') return false
      if (
        typeof address.latitude !== 'number' ||
        !Number.isFinite(address.latitude) ||
        typeof address.longitude !== 'number' ||
        !Number.isFinite(address.longitude)
      ) {
        return false
      }

      const point: [number, number] = [address.longitude, address.latitude]
      const polygons =
        geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates

      return polygons.some((rings) => polygonContainsPoint(point, rings))
    }

    const matchedZone = args.address
      ? args.settings.zones.find(
          (zone) =>
            zone.enabled &&
            (zone.areas.some((area) => areaMatches(area, args.address!)) ||
              (zone.geometry !== null && geometryMatches(zone.geometry, args.address!))),
        )
      : undefined
    if (matchedZone && subtotal >= matchedZone.minimumOrderAmount) {
      const freeByThreshold =
        matchedZone.freeDeliveryThreshold != null &&
        matchedZone.freeDeliveryThreshold > 0 &&
        subtotal >= matchedZone.freeDeliveryThreshold
      const displayName = matchedZone.name || 'Seller delivery'
      options.push({
        id: `delivery:${matchedZone.id}`,
        type: 'seller_delivery',
        name: displayName,
        fee: freeByThreshold ? 0 : money(matchedZone.deliveryFee),
        zoneId: matchedZone.id,
        zoneName: matchedZone.name || null,
        estimatedDeliveryMinMinutes: matchedZone.estimatedDeliveryMinMinutes || null,
        estimatedDeliveryMaxMinutes: matchedZone.estimatedDeliveryMaxMinutes || null,
        pickupInstructions: null,
      })
    }
  }

  if (args.settings.pickup.enabled) {
    options.push({
      id: 'pickup',
      type: 'pickup',
      name: 'Seller pickup',
      fee: 0,
      zoneId: null,
      zoneName: null,
      estimatedDeliveryMinMinutes: null,
      estimatedDeliveryMaxMinutes: null,
      pickupInstructions: args.settings.pickup.instructions,
    })
  }

  return options
}

export function getSellerShippingSettingsDigest(settings: SellerShippingSettings): string {
  return createHmac('sha256', 'seller-shipping-settings-v1')
    .update(JSON.stringify(settings))
    .digest('hex')
}

export function signShippingQuote(
  quote: Omit<SignedShippingQuote, 'expiresAt'>,
  secret: string,
  ttlMs = 5 * 60 * 1000,
  now = Date.now(),
): string {
  if (!secret) throw new Error('PAYLOAD_SECRET is required to sign a shipping quote.')
  const payload = Buffer.from(
    JSON.stringify({ ...quote, expiresAt: now + ttlMs } satisfies SignedShippingQuote),
  ).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifyShippingQuote(
  token: unknown,
  secret: string,
  now = Date.now(),
): SignedShippingQuote {
  if (!secret) throw new Error('PAYLOAD_SECRET is required to verify a shipping quote.')
  if (typeof token !== 'string' || token.length > 8192) {
    throw new Error('A valid shipping quote token is required.')
  }
  const [payload, signature, ...extra] = token.split('.')
  if (!payload || !signature || extra.length > 0) {
    throw new Error('The shipping quote is invalid. Please refresh checkout.')
  }

  const expected = createHmac('sha256', secret).update(payload).digest()
  let actual: Buffer
  try {
    actual = Buffer.from(signature, 'base64url')
  } catch {
    throw new Error('The shipping quote is invalid. Please refresh checkout.')
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error('The shipping quote is invalid. Please refresh checkout.')
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    throw new Error('The shipping quote is invalid. Please refresh checkout.')
  }
  const parsed = signedShippingQuoteSchema.safeParse(decoded)
  if (!parsed.success) {
    throw new Error('The shipping quote is invalid. Please refresh checkout.')
  }
  if (parsed.data.expiresAt <= now) {
    throw new Error('The shipping quote has expired. Please refresh checkout.')
  }
  return parsed.data
}
