export type BusinessZoneDoc = {
  id: number
  name: string
  slug: string
  description: string | null
  boundary: any | null
  boundary_geometry: any | null
  isActive: boolean
  disabledReason: string | null
  displayOrder: number
  timezone: string
  merchantCount?: number
  createdAt: string
  updatedAt: string
}

export type MerchantZoneDoc = {
  id: number
  outletName: string
  outletCode: string
  vendor: { id: number; businessName: string; logo?: { id: number; url: string | null } | null } | null
  media?: { thumbnail?: { id: number; url: string | null } | null; storeFrontImage?: { id: number; url: string | null } | null } | null
  businessZone: { id: number; name: string; isActive: boolean } | null
  businessZoneId: number | null
  isActive: boolean
  isAcceptingOrders: boolean
  operationalStatus: string
  merchant_latitude: number | null
  merchant_longitude: number | null
  service_area: any | null
  delivery_radius_meters: number | null
  timezone: string
}

export type Pagination = { page: number; limit: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }
export type Stats = {
  totalZones: number
  activeZones: number
  inactiveZones: number
  totalMerchants: number
  assignedMerchants: number
  unassignedMerchants: number
  merchantCountByZone: Record<string, number>
}

export function initials(n: string){ return n.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('')||'Z' }
export function fmtDate(iso: string | null){ if(!iso) return '—'; try{return new Date(iso).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric'})}catch{return String(iso).slice(0,10)} }

export function isValidGeoJSON(v: any): boolean {
  if (!v) return true
  if (typeof v !== 'object' || Array.isArray(v)) return false
  if (v.type !== 'Polygon' && v.type !== 'MultiPolygon') return false
  return Array.isArray(v.coordinates)
}
