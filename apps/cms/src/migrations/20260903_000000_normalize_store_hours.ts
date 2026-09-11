import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { normalizeWeeklyHours } from '@/utils/storeHours'

function changed(source: unknown, normalized: unknown): boolean {
  return JSON.stringify(source) !== JSON.stringify(normalized)
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const merchants = await payload.find({ collection: 'merchants', limit: 0, pagination: false, depth: 0, overrideAccess: true } as any)
  for (const merchant of merchants.docs as any[]) {
    const operatingHours = normalizeWeeklyHours(merchant.operatingHours)
    const deliveryHours = normalizeWeeklyHours(merchant.delivery_hours)
    const data: Record<string, unknown> = {}
    if (operatingHours && changed(merchant.operatingHours, operatingHours)) data.operatingHours = operatingHours
    if (deliveryHours && changed(merchant.delivery_hours, deliveryHours)) data.delivery_hours = deliveryHours
    if (Object.keys(data).length) await payload.update({ collection: 'merchants', id: merchant.id, data, overrideAccess: true })
  }

  const vendors = await payload.find({ collection: 'vendors', limit: 0, pagination: false, depth: 0, overrideAccess: true } as any)
  for (const vendor of vendors.docs as any[]) {
    const operatingHours = normalizeWeeklyHours(vendor.operatingHours)
    if (operatingHours && changed(vendor.operatingHours, operatingHours)) {
      await payload.update({ collection: 'vendors', id: vendor.id, data: { operatingHours }, overrideAccess: true })
    }
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // The canonical array format cannot be safely converted back without losing split shifts.
}
