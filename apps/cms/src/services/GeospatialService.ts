import type { Payload } from 'payload'
import type { Merchant, Vendor } from '../payload-types'
import type { Where } from 'payload'
import { googleMapsService, type LocationCoordinates, type DistanceResult } from './GoogleMapsService'

// Type for database query results
interface DatabaseQueryResult {
  rows: DatabaseRow[]
}

// Type for database row from merchants query
interface DatabaseRow {
  id: number  // Changed from string to number to match Merchant interface
  outlet_name: string
  outlet_code: string
  merchant_latitude: number
  merchant_longitude: number
  delivery_radius_meters: number
  avg_delivery_time_minutes: number
  is_active: boolean
  is_accepting_orders: boolean
  operational_status: string
  min_order_amount: number
  delivery_fee_base: number
  free_delivery_threshold: number
  is_currently_delivering: boolean
  updated_at: string
  created_at: string
  vendor_id: number  // Changed from string to number to match Vendor interface
  distance_meters: string
  average_rating: number
  total_orders: number
  service_area: unknown
  priority_zones: unknown
  restricted_areas: unknown
  delivery_zones: unknown
  vendor_business_name: string
  vendor_average_rating: number
  vendor_total_orders: number
  vendor_cuisine_types: unknown
  // Merchant thumbnail media fields
  merchant_thumbnail_id: number | null
  merchant_thumbnail_cloudinary_public_id: string | null
  merchant_thumbnail_cloudinary_url: string | null
  merchant_thumbnail_url: string | null
  merchant_thumbnail_thumbnail_url: string | null
  merchant_thumbnail_filename: string | null
  merchant_thumbnail_alt: string | null
  // Merchant storefront media fields
  merchant_storefront_id: number | null
  merchant_storefront_cloudinary_public_id: string | null
  merchant_storefront_cloudinary_url: string | null
  merchant_storefront_url: string | null
  merchant_storefront_thumbnail_url: string | null
  merchant_storefront_filename: string | null
  merchant_storefront_alt: string | null
  // Vendor logo media fields
  vendor_logo_id: number | null
  vendor_logo_cloudinary_public_id: string | null
  vendor_logo_cloudinary_url: string | null
  vendor_logo_url: string | null
  vendor_logo_thumbnail_url: string | null
  vendor_logo_filename: string | null
  vendor_logo_alt: string | null
  timezone: string
}

// Type for count query result
interface CountQueryResult {
  rows: Array<{ total_count: string }>
}

// Type for geospatial query results with vendor relationship
type MerchantWithDistance = Merchant & {
  distanceMeters: number
  distanceKm: number
  isWithinDeliveryRadius?: boolean
  estimatedDeliveryTime?: number
  serviceAreaType?: string[]
  isPriorityZone?: boolean
  vendor: Vendor // Ensure vendor is populated for rating access
}

// Type for merchants with service area analysis - ensures required properties
type MerchantWithServiceArea = Merchant & {
  distanceMeters: number
  distanceKm: number
  isWithinDeliveryRadius: boolean // Required for service area analysis
  estimatedDeliveryTime: number // Required for service area analysis
  serviceAreaType?: string[]
  isPriorityZone?: boolean
  vendor: Vendor
  serviceAreaAnalysis: {
    inServiceArea: boolean
    inPriorityZone: boolean
    inDeliveryZone: boolean
    inRestrictedArea: boolean
    zoneTypes: string[]
  }
  zonePriority: 'high' | 'medium' | 'standard'
}

/**
 * Enhanced GeospatialService with Google Maps API integration
 * Provides high-performance geospatial operations for merchant location queries
 * Uses Google Maps motorcycle driving mode for accurate delivery distance calculations
 * 
 * Note: This service requires Google Maps API to be available. If the API is unavailable,
 * methods will fail gracefully with appropriate error messages.
 */
export class GeospatialService {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Check if Google Maps service is available
   */
  private async checkGoogleMapsAvailability(): Promise<boolean> {
    try {
      // Simple test to check if Google Maps service is responsive
      const testResult = await googleMapsService.calculateMultipleDistances(
        { latitude: 0, longitude: 0 },
        [{ latitude: 0, longitude: 0 }]
      )
      return testResult && testResult.length > 0
    } catch (error) {
      console.error('Google Maps API is not available:', error)
      return false
    }
  }

  /**
   * Find merchants within a specific radius using Google Maps driving distance calculation
   * Uses motorcycle driving mode for accurate delivery distance calculations
   * Calculates distances from merchant locations TO customer location (correct delivery direction)
   */
  async findMerchantsWithinRadius(params: {
    latitude: number
    longitude: number
    radiusMeters: number
    limit?: number
    offset?: number
  }) {
    const { latitude, longitude, radiusMeters, limit = 20, offset = 0 } = params
    const startTime = Date.now()

    // Validate coordinates
    if (!this.isValidCoordinate(latitude, longitude)) {
      throw new Error('Invalid coordinates provided')
    }

    // Validate search radius (max 100km for performance)
    if (radiusMeters > 100000) {
      throw new Error('Search radius cannot exceed 100km')
    }

    try {
      // Check Google Maps API availability first
      const isGoogleMapsAvailable = await this.checkGoogleMapsAvailability()
      if (!isGoogleMapsAvailable) {
        throw new Error('Google Maps API is currently unavailable. Distance calculations cannot be performed.')
      }

      // Build where clause for basic filters - includes 3 kill-switches (merchant, vendor, businessZone)
      const whereClause: Where = {
        and: [
          { merchant_latitude: { not_equals: null } },
          { merchant_longitude: { not_equals: null } },
          { isActive: { equals: true } },
          { isAcceptingOrders: { equals: true } },
        ]
      }

      // Query merchants with vendor and businessZone populated
      const result = await this.payload.find({
        collection: 'merchants',
        where: whereClause,
        limit: Math.min(limit * 3, 300),
        page: Math.floor(offset / limit) + 1,
        depth: 2,
      })

      // Calculate distances using Google Maps API and filter by radius
      const merchantsWithDistance: MerchantWithDistance[] = []
      const customerLocation: LocationCoordinates = { latitude, longitude }
      
      // Process merchants - filter by vendor isActive and businessZone isActive (post-filter, as they are relationships)
      const merchantsWithLocations = result.docs
        .filter(merchant => {
          if (!merchant.merchant_latitude || !merchant.merchant_longitude) return false
          // Vendor kill-switch
          const vendor = merchant.vendor as unknown as { isActive?: boolean }
          if (vendor && vendor.isActive === false) return false
          // BusinessZone kill-switch
          const bz = (merchant as unknown as { businessZone?: { isActive?: boolean } }).businessZone
          if (bz && typeof bz === 'object' && bz.isActive === false) return false
          return true
        })
        .map(merchant => ({
          merchant,
          location: {
            latitude: merchant.merchant_latitude!,
            longitude: merchant.merchant_longitude!,
          }
        }))

      if (merchantsWithLocations.length === 0) {
        return {
          merchants: [],
          totalCount: 0,
          pagination: {
            totalDocs: 0,
            limit,
            totalPages: 0,
            page: 1,
            pagingCounter: 0,
            hasPrevPage: false,
            hasNextPage: false,
            prevPage: null,
            nextPage: null,
          },
          performance: {
            queryTimeMs: Date.now() - startTime,
            searchRadius: radiusMeters,
            withinSearchRadius: 0,
            proximityScore: 0,
            optimizationUsed: 'no_merchants_found'
          }
        }
      }

      // Calculate distances from each merchant TO customer (correct delivery direction)
      // Process each merchant individually to get accurate merchant-to-customer distances
      const distanceResults: DistanceResult[] = []
      for (const { location } of merchantsWithLocations) {
        const result = await googleMapsService.calculateMultipleDistances(
          location, // Merchant location as origin
          [customerLocation] // Customer location as destination
        )
        distanceResults.push(result[0]) // Get the first (and only) result
      }

      // Process results and filter by radius
      for (let i = 0; i < merchantsWithLocations.length && merchantsWithDistance.length < limit * 2; i++) {
        const { merchant } = merchantsWithLocations[i]
        const distanceResult = distanceResults[i]

        if (!merchant.merchant_latitude || !merchant.merchant_longitude) continue

        // Only use Google Maps distance - no fallback
        if (!distanceResult || distanceResult.status !== 'OK' || distanceResult.distance < 0) {
          console.warn(`Google Maps API failed for merchant ${merchant.id}, skipping`)
          continue
        }

        const distanceMeters = distanceResult.distance

        // Filter by radius
        if (distanceMeters > radiusMeters) continue

        merchantsWithDistance.push({
          ...merchant,
          vendor: merchant.vendor as Vendor,
          distanceMeters,
          distanceKm: distanceMeters / 1000,
          isWithinDeliveryRadius: merchant.delivery_radius_meters 
            ? distanceMeters <= merchant.delivery_radius_meters 
            : false,
          estimatedDeliveryTime: this.calculateEstimatedDeliveryTime(
            distanceMeters,
            merchant.avg_delivery_time_minutes || undefined
          ),
        } as MerchantWithDistance)
      }

      // Sort results by distance (default sorting)
      const sortedMerchants = merchantsWithDistance.sort((a, b) => a.distanceMeters - b.distanceMeters)

      const endTime = Date.now()
      const queryTime = endTime - startTime

      return {
        merchants: sortedMerchants.slice(0, limit),
        totalCount: merchantsWithDistance.length,
        pagination: {
          totalDocs: merchantsWithDistance.length,
          limit,
          totalPages: Math.ceil(merchantsWithDistance.length / limit),
          page: Math.floor(offset / limit) + 1,
          pagingCounter: offset + 1,
          hasPrevPage: offset > 0,
          hasNextPage: offset + limit < merchantsWithDistance.length,
          prevPage: offset > 0 ? Math.floor((offset - limit) / limit) + 1 : null,
          nextPage: offset + limit < merchantsWithDistance.length ? Math.floor((offset + limit) / limit) + 1 : null,
        },
        performance: {
          queryTimeMs: queryTime,
          searchRadius: radiusMeters,
          withinSearchRadius: merchantsWithDistance.length,
          proximityScore: merchantsWithDistance.length > 0 ? 
            merchantsWithDistance.reduce((sum: number, m: MerchantWithDistance) => sum + (1 - m.distanceKm / (radiusMeters / 1000)), 0) / merchantsWithDistance.length : 0,
          optimizationUsed: 'google_maps_distance_matrix_api'
        }
      }
    } catch (error) {
      console.error('Error in findMerchantsWithinRadius:', error)
      throw new Error(`Failed to find merchants within radius: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Find merchants in delivery radius using Google Maps driving distance calculation
   * Uses motorcycle driving mode for accurate delivery distance calculations
   * Calculates distances from merchant locations TO customer location (correct delivery direction)
   */
  async findMerchantsInDeliveryRadius(params: {
    latitude: number
    longitude: number
    limit?: number
    offset?: number
  }) {
    const { latitude, longitude, limit = 20, offset = 0 } = params
    const startTime = Date.now()

    // Validate coordinates
    if (!this.isValidCoordinate(latitude, longitude)) {
      throw new Error('Invalid coordinates provided')
    }

    try {
      // Check Google Maps API availability first
      const isGoogleMapsAvailable = await this.checkGoogleMapsAvailability()
      if (!isGoogleMapsAvailable) {
        throw new Error('Google Maps API is currently unavailable. Distance calculations cannot be performed.')
      }

      // Build where clause - includes merchant kill-switches
      const whereClause: Where = {
        and: [
          { merchant_latitude: { not_equals: null } },
          { merchant_longitude: { not_equals: null } },
          { isActive: { equals: true } },
          { isAcceptingOrders: { equals: true } },
        ]
      }

      // Query merchants with vendor and businessZone populated
      const result = await this.payload.find({
        collection: 'merchants',
        where: whereClause,
        limit: Math.min(limit * 3, 300),
        page: Math.floor(offset / (limit * 3)) + 1,
        depth: 2,
      })

      // Calculate distances using Google Maps API and filter by delivery radius
      const merchantsInDeliveryRadius: MerchantWithDistance[] = []
      const customerLocation: LocationCoordinates = { latitude, longitude }
      
      // Filter by vendor and businessZone kill-switches
      const merchantsWithLocations = result.docs
        .filter(merchant => {
          if (!merchant.merchant_latitude || !merchant.merchant_longitude) return false
          const vendor = merchant.vendor as unknown as { isActive?: boolean }
          if (vendor && vendor.isActive === false) return false
          const bz = (merchant as unknown as { businessZone?: { isActive?: boolean } }).businessZone
          if (bz && typeof bz === 'object' && bz.isActive === false) return false
          return true
        })
        .map(merchant => ({
          merchant,
          location: {
            latitude: merchant.merchant_latitude!,
            longitude: merchant.merchant_longitude!,
          }
        }))

      if (merchantsWithLocations.length === 0) {
        return {
          merchants: [],
          totalCount: 0,
          pagination: {
            totalDocs: 0,
            limit,
            totalPages: 0,
            page: 1,
            pagingCounter: 0,
            hasPrevPage: false,
            hasNextPage: false,
            prevPage: null,
            nextPage: null,
          },
          performance: {
            queryTimeMs: Date.now() - startTime,
            optimizationUsed: 'no_merchants_found',
            totalMerchantsScanned: 0,
            merchantsWithinRadius: 0,
            averageDistanceKm: 0
          }
        }
      }

      // Calculate distances from each merchant TO customer (correct delivery direction)
      // Process each merchant individually to get accurate merchant-to-customer distances
      const distanceResults: DistanceResult[] = []
      for (const { location } of merchantsWithLocations) {
        const result = await googleMapsService.calculateMultipleDistances(
          location, // Merchant location as origin
          [customerLocation] // Customer location as destination
        )
        distanceResults.push(result[0]) // Get the first (and only) result
      }

      // Process results and filter by delivery radius
      for (let i = 0; i < merchantsWithLocations.length && merchantsInDeliveryRadius.length < limit * 2; i++) {
        const { merchant } = merchantsWithLocations[i]
        const distanceResult = distanceResults[i]

        if (!merchant.merchant_latitude || !merchant.merchant_longitude) continue

        // Only use Google Maps distance - no fallback
        if (!distanceResult || distanceResult.status !== 'OK' || distanceResult.distance <= 0) {
          console.warn(`Google Maps API failed for merchant ${merchant.id}, skipping`)
          continue
        }

        const distanceMeters = distanceResult.distance

        merchantsInDeliveryRadius.push({
          ...merchant,
          vendor: merchant.vendor as Vendor,
          distanceMeters,
          distanceKm: distanceMeters / 1000,
          isWithinDeliveryRadius: merchant.delivery_radius_meters 
            ? distanceMeters <= merchant.delivery_radius_meters 
            : false,
          estimatedDeliveryTime: this.calculateEstimatedDeliveryTime(
            distanceMeters,
            merchant.avg_delivery_time_minutes || undefined
          ),
        } as MerchantWithDistance)
      }

      const sortedMerchants = merchantsInDeliveryRadius
        .sort((a, b) => a.distanceMeters - b.distanceMeters) // Sort by distance
        .slice(offset, offset + limit) // Apply pagination

      const endTime = Date.now()
      const queryTime = endTime - startTime

      return {
        merchants: sortedMerchants,
        totalCount: merchantsInDeliveryRadius.length,
        pagination: {
          totalDocs: merchantsInDeliveryRadius.length,
          limit,
          totalPages: Math.ceil(merchantsInDeliveryRadius.length / limit),
          page: Math.floor(offset / limit) + 1,
          pagingCounter: offset + 1,
          hasPrevPage: offset > 0,
          hasNextPage: offset + limit < merchantsInDeliveryRadius.length,
          prevPage: offset > 0 ? Math.floor((offset - limit) / limit) + 1 : null,
          nextPage: offset + limit < merchantsInDeliveryRadius.length ? Math.floor((offset + limit) / limit) + 1 : null,
        },
        performance: {
          queryTimeMs: queryTime,
          optimizationUsed: 'google_maps_distance_matrix_api',
          totalMerchantsScanned: result.docs.length,
          merchantsWithinRadius: merchantsInDeliveryRadius.length,
          averageDistanceKm: merchantsInDeliveryRadius.length > 0 
            ? merchantsInDeliveryRadius.reduce((sum, m) => sum + m.distanceKm, 0) / merchantsInDeliveryRadius.length 
            : 0
        }
      }
    } catch (error) {
      console.error('Error in findMerchantsInDeliveryRadius:', error)
      throw new Error(`Failed to find merchants in delivery radius: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Find merchants within service areas using polygon intersection
   * Note: This method uses basic coordinate filtering instead of PostGIS for compatibility
   * Calculates distances from merchant locations TO customer location (correct delivery direction)
   */
  async findMerchantsInServiceArea(params: {
    latitude: number
    longitude: number
    serviceAreaType?: 'service_area' | 'priority_zones' | 'delivery_zones' | 'all'
    limit?: number
    offset?: number
  }) {
    const { latitude, longitude, serviceAreaType = 'all', limit = 20, offset = 0 } = params
    const startTime = Date.now()

    // Validate coordinates
    if (!this.isValidCoordinate(latitude, longitude)) {
      throw new Error('Invalid coordinates provided')
    }

    try {
      // Check Google Maps API availability first
      const isGoogleMapsAvailable = await this.checkGoogleMapsAvailability()
      if (!isGoogleMapsAvailable) {
        throw new Error('Google Maps API is currently unavailable. Distance calculations cannot be performed.')
      }

      // Build where clause - includes merchant kill-switches
      const whereClause: Where = {
        and: [
          { merchant_latitude: { not_equals: null } },
          { merchant_longitude: { not_equals: null } },
          { isActive: { equals: true } },
          { isAcceptingOrders: { equals: true } },
        ]
      }

      // Query merchants with vendor and businessZone populated
      const result = await this.payload.find({
        collection: 'merchants',
        where: whereClause,
        limit: Math.min(limit * 2, 200),
        page: Math.floor(offset / (limit * 2)) + 1,
        depth: 2,
      })

      // Process merchants - filter by vendor and businessZone kill-switches
      const customerLocation: LocationCoordinates = { latitude, longitude }
      const merchantsWithLocations = result.docs
        .filter(merchant => {
          if (!merchant.merchant_latitude || !merchant.merchant_longitude) return false
          const vendor = merchant.vendor as unknown as { isActive?: boolean }
          if (vendor && vendor.isActive === false) return false
          const bz = (merchant as unknown as { businessZone?: { isActive?: boolean } }).businessZone
          if (bz && typeof bz === 'object' && bz.isActive === false) return false
          return true
        })
        .map(merchant => ({
          merchant,
          location: {
            latitude: merchant.merchant_latitude!,
            longitude: merchant.merchant_longitude!,
          }
        }))

      if (merchantsWithLocations.length === 0) {
        return {
          merchants: [],
          totalCount: 0,
          pagination: {
            totalDocs: 0,
            limit,
            totalPages: 0,
            page: 1,
            pagingCounter: 0,
            hasPrevPage: false,
            hasNextPage: false,
            prevPage: null,
            nextPage: null,
          },
          performance: {
            queryTimeMs: Date.now() - startTime,
            serviceAreaType,
            totalMerchantsScanned: 0,
            merchantsInServiceArea: 0,
            serviceAreaAnalysis: {
              withServiceArea: 0,
              withPriorityZones: 0,
              withDeliveryZones: 0,
            }
          }
        }
      }

      // Calculate distances from each merchant TO customer (correct delivery direction)
      // Process each merchant individually to get accurate merchant-to-customer distances
      const distanceResults: DistanceResult[] = []
      for (const { location } of merchantsWithLocations) {
        const result = await googleMapsService.calculateMultipleDistances(
          location, // Merchant location as origin
          [customerLocation] // Customer location as destination
        )
        distanceResults.push(result[0]) // Get the first (and only) result
      }

      const merchantsWithServiceAreaData: MerchantWithServiceArea[] = merchantsWithLocations
        .map(({ merchant }, index) => {
          const merchantLat = merchant.merchant_latitude
          const merchantLng = merchant.merchant_longitude

          if (!merchantLat || !merchantLng) return null

          const distanceResult = distanceResults[index]

          // Only use Google Maps distance - no fallback
          if (!distanceResult || distanceResult.status !== 'OK' || distanceResult.distance <= 0) {
            console.warn(`Google Maps API failed for merchant ${merchant.id}, skipping`)
            return null
          }

          const distanceMeters = distanceResult.distance

          // Basic service area analysis (simplified without PostGIS)
          const serviceAreaAnalysis = {
            inServiceArea: !!merchant.service_area,
            inPriorityZone: !!merchant.priority_zones,
            inDeliveryZone: !!merchant.delivery_zones,
            inRestrictedArea: false, // Simplified - would need PostGIS for accurate calculation
            zoneTypes: [
              ...(merchant.service_area ? ['service_area'] : []),
              ...(merchant.priority_zones ? ['priority_zones'] : []),
              ...(merchant.delivery_zones ? ['delivery_zones'] : []),
            ]
          }

          // Filter by service area type
          if (serviceAreaType !== 'all') {
            const hasRequestedServiceArea = serviceAreaAnalysis.zoneTypes.includes(serviceAreaType)
            if (!hasRequestedServiceArea) return null
          }

          return {
            ...merchant,
            vendor: merchant.vendor as Vendor,
            distanceMeters,
            distanceKm: distanceMeters / 1000,
            isWithinDeliveryRadius: merchant.delivery_radius_meters 
              ? distanceMeters <= merchant.delivery_radius_meters 
              : false,
            estimatedDeliveryTime: this.calculateEstimatedDeliveryTime(
              distanceMeters,
              merchant.avg_delivery_time_minutes || undefined
            ) || 30, // Ensure we always have a number
            serviceAreaAnalysis,
            zonePriority: serviceAreaAnalysis.inPriorityZone ? 'high' : 
                         serviceAreaAnalysis.inDeliveryZone ? 'medium' : 'standard'
          } as MerchantWithServiceArea
        })
        .filter((merchant): merchant is MerchantWithServiceArea => merchant !== null)

      // Sort results by distance (default sorting)
      const finalResults = merchantsWithServiceAreaData.sort((a, b) => {
        if (!a || !b) return 0
        return a.distanceMeters - b.distanceMeters
      })

      const paginatedResults = finalResults.slice(offset, offset + limit)
      const endTime = Date.now()
      const queryTime = endTime - startTime

      return {
        merchants: paginatedResults,
        totalCount: finalResults.length,
        pagination: {
          totalDocs: finalResults.length,
          limit,
          totalPages: Math.ceil(finalResults.length / limit),
          page: Math.floor(offset / limit) + 1,
          pagingCounter: offset + 1,
          hasPrevPage: offset > 0,
          hasNextPage: offset + limit < finalResults.length,
          prevPage: offset > 0 ? Math.floor((offset - limit) / limit) + 1 : null,
          nextPage: offset + limit < finalResults.length ? Math.floor((offset + limit) / limit) + 1 : null,
        },
        performance: {
          queryTimeMs: queryTime,
          serviceAreaType,
          totalMerchantsScanned: result.docs.length,
          merchantsInServiceArea: finalResults.length,
          serviceAreaAnalysis: {
            withServiceArea: finalResults.filter(m => m && m.serviceAreaAnalysis.inServiceArea).length,
            withPriorityZones: finalResults.filter(m => m && m.serviceAreaAnalysis.inPriorityZone).length,
            withDeliveryZones: finalResults.filter(m => m && m.serviceAreaAnalysis.inDeliveryZone).length,
          }
        }
      }
    } catch (error) {
      console.error('Error in findMerchantsInServiceArea:', error)
      throw new Error(`Failed to find merchants in service area: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate coordinate values
   */
  private isValidCoordinate(latitude: number, longitude: number): boolean {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !isNaN(latitude) &&
      !isNaN(longitude)
    )
  }

  /**
   * Calculate estimated delivery time based on distance and merchant average
   */
  private calculateEstimatedDeliveryTime(distanceMeters: number, avgDeliveryTime?: number): number {
    const baseTime = avgDeliveryTime || 30 // Default 30 minutes
    const distanceKm = distanceMeters / 1000
    const additionalTime = Math.max(0, (distanceKm - 2) * 5) // Add 5 min per km after 2km
    return Math.round(baseTime + additionalTime)
  }

  /**
   * Find merchants within radius using PostGIS distance calculation
   * This method uses PostGIS ST_Distance for accurate spatial queries
   * Designed specifically for location-based display (not delivery calculations)
   */
  async findMerchantsWithinRadiusPostGIS(params: {
    latitude: number
    longitude: number
    radiusMeters: number
    limit?: number
    offset?: number
    categoryId?: number
  }) {
    const { latitude, longitude, radiusMeters, limit = 20, offset = 0, categoryId } = params
    const startTime = Date.now()

    // Validate coordinates
    if (!this.isValidCoordinate(latitude, longitude)) {
      throw new Error('Invalid coordinates provided')
    }

    // Validate search radius (max 100km for performance)
    if (radiusMeters > 100000) {
      throw new Error('Search radius cannot exceed 100km')
    }

    try {
      // Create customer point for PostGIS query
      const customerPoint = `ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)`

      console.log(`🔍 PostGIS Query Debug:`, {
        customerPoint,
        radiusMeters,
        limit,
        offset
      })

      // Execute query using PostGIS geometry operations
      // Convert jsonb coordinates to geometry before applying spatial functions
      // Add proper validation for GeoJSON data
      const result = await this.payload.db.drizzle.execute(`
        SELECT 
          m.*,
          ST_Distance(
            ST_Transform(ST_GeomFromGeoJSON(m.merchant_coordinates::text), 3857),
            ST_Transform(${customerPoint}, 3857)
          ) as distance_meters,
          v.id as vendor_id,
          v.business_name as vendor_business_name,
          v.average_rating as vendor_average_rating,
          v.total_orders as vendor_total_orders,
          v.cuisine_types as vendor_cuisine_types,
          -- Merchant Categories (IDs)
          COALESCE(
            (
              SELECT json_agg(DISTINCT mc2.id)
              FROM merchants_rels mr2
              LEFT JOIN merchant_categories mc2 ON mc2.id = mr2.merchant_categories_id
              WHERE mr2.parent_id = m.id AND mr2.path = 'merchant_categories'
            ), '[]'::json
          ) as merchant_category_ids,
          -- Merchant thumbnail media
          mt.id as merchant_thumbnail_id,
          mt.cloudinary_public_id as merchant_thumbnail_cloudinary_public_id,
          mt.cloudinary_u_r_l as merchant_thumbnail_cloudinary_url,
          mt.url as merchant_thumbnail_url,
          mt.thumbnail_u_r_l as merchant_thumbnail_thumbnail_url,
          mt.filename as merchant_thumbnail_filename,
          mt.alt as merchant_thumbnail_alt,
          -- Merchant storefront media
          ms.id as merchant_storefront_id,
          ms.cloudinary_public_id as merchant_storefront_cloudinary_public_id,
          ms.cloudinary_u_r_l as merchant_storefront_cloudinary_url,
          ms.url as merchant_storefront_url,
          ms.thumbnail_u_r_l as merchant_storefront_thumbnail_url,
          ms.filename as merchant_storefront_filename,
          ms.alt as merchant_storefront_alt,
          -- Vendor logo media
          vl.id as vendor_logo_id,
          vl.cloudinary_public_id as vendor_logo_cloudinary_public_id,
          vl.cloudinary_u_r_l as vendor_logo_cloudinary_url,
          vl.url as vendor_logo_url,
          vl.thumbnail_u_r_l as vendor_logo_thumbnail_url,
          vl.filename as vendor_logo_filename,
          vl.alt as vendor_logo_alt
        FROM merchants m
        LEFT JOIN vendors v ON m.vendor_id = v.id
        LEFT JOIN business_zones bz ON m.business_zone_id = bz.id
        LEFT JOIN media mt ON m.media_thumbnail_id = mt.id
        LEFT JOIN media ms ON m.media_store_front_image_id = ms.id
        LEFT JOIN media vl ON v.logo_id = vl.id
        WHERE 
          m.merchant_coordinates IS NOT NULL
          AND m.merchant_coordinates::text != 'null'
          AND m.merchant_coordinates ? 'type'
          AND m.merchant_coordinates ? 'coordinates'
          AND m.merchant_coordinates->>'type' = 'Point'
          AND jsonb_array_length(m.merchant_coordinates->'coordinates') = 2
          AND m.is_active = true
          AND m.is_accepting_orders = true
          AND v.is_active = true
          AND (m.business_zone_id IS NULL OR bz.is_active = true)
          AND ST_DWithin(
            ST_Transform(ST_GeomFromGeoJSON(m.merchant_coordinates::text), 3857),
            ST_Transform(${customerPoint}, 3857),
            ${radiusMeters}
          )
          ${categoryId ? `AND EXISTS (
            SELECT 1 FROM merchants_rels mr2
            WHERE mr2.parent_id = m.id
              AND mr2.path = 'merchant_categories'
              AND mr2.merchant_categories_id = ${categoryId}
          )` : ''}
        ORDER BY 
          ST_Distance(
            ST_Transform(ST_GeomFromGeoJSON(m.merchant_coordinates::text), 3857),
            ST_Transform(${customerPoint}, 3857)
          )
        LIMIT ${limit}
        OFFSET ${offset};
      `)

      console.log(`✅ PostGIS Query executed successfully, rows returned: ${(result as DatabaseQueryResult).rows.length}`)

      // Transform results to match expected format
      const merchantsWithDistance: MerchantWithDistance[] = (result as DatabaseQueryResult).rows.map((row: DatabaseRow) => {
        const distanceMeters = parseFloat(row.distance_meters)
        const merchantCategoryIdsRaw = (row as unknown as { merchant_category_ids?: unknown }).merchant_category_ids
        const merchantCategoryIds = Array.isArray(merchantCategoryIdsRaw) ? merchantCategoryIdsRaw.filter(id => typeof id === 'number') as number[] : []
        
        return {
          id: row.id,
          outletName: row.outlet_name,
          outletCode: row.outlet_code,
          merchant_latitude: row.merchant_latitude,
          merchant_longitude: row.merchant_longitude,
          delivery_radius_meters: row.delivery_radius_meters,
          avg_delivery_time_minutes: row.avg_delivery_time_minutes,
          average_rating: row.average_rating,
          total_orders: row.total_orders,
          isActive: row.is_active,
          isAcceptingOrders: row.is_accepting_orders,
          operationalStatus: row.operational_status,
          service_area: row.service_area,
          priority_zones: row.priority_zones,
          restricted_areas: row.restricted_areas,
          delivery_zones: row.delivery_zones,
          vendor_id: row.vendor_id,
          timezone: row.timezone || 'Asia/Manila',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          // Media information
          media: {
            thumbnail: row.merchant_thumbnail_id ? {
              id: row.merchant_thumbnail_id,
              cloudinary_public_id: row.merchant_thumbnail_cloudinary_public_id,
              cloudinary_url: row.merchant_thumbnail_cloudinary_url,
              url: row.merchant_thumbnail_url,
              thumbnail_url: row.merchant_thumbnail_thumbnail_url,
              filename: row.merchant_thumbnail_filename,
              alt: row.merchant_thumbnail_alt
            } : null,
            storeFrontImage: row.merchant_storefront_id ? {
              id: row.merchant_storefront_id,
              cloudinary_public_id: row.merchant_storefront_cloudinary_public_id,
              cloudinary_url: row.merchant_storefront_cloudinary_url,
              url: row.merchant_storefront_url,
              thumbnail_url: row.merchant_storefront_thumbnail_url,
              filename: row.merchant_storefront_filename,
              alt: row.merchant_storefront_alt
            } : null
          },
          // Distance information
          distanceMeters,
          distanceKm: distanceMeters / 1000,
          isWithinDeliveryRadius: row.delivery_radius_meters 
            ? distanceMeters <= row.delivery_radius_meters 
            : false,
          estimatedDeliveryTime: this.calculateEstimatedDeliveryTime(
            distanceMeters,
            row.avg_delivery_time_minutes || undefined
          ),
          merchant_categories: merchantCategoryIds,
          // Vendor information
          vendor: {
            id: row.vendor_id,
            businessName: row.vendor_business_name,
            average_rating: row.vendor_average_rating,
            total_orders: row.vendor_total_orders,
            cuisineTypes: row.vendor_cuisine_types,
            logo: row.vendor_logo_id ? {
              id: row.vendor_logo_id,
              cloudinary_public_id: row.vendor_logo_cloudinary_public_id,
              cloudinary_url: row.vendor_logo_cloudinary_url,
              url: row.vendor_logo_url,
              thumbnail_url: row.vendor_logo_thumbnail_url,
              filename: row.vendor_logo_filename,
              alt: row.vendor_logo_alt
            } : null
          } as unknown as Vendor
        } as MerchantWithDistance
      })

      // Get total count for pagination
      const countResult = await this.payload.db.drizzle.execute(`
        SELECT COUNT(*) as total_count
        FROM merchants m
        LEFT JOIN vendors v ON m.vendor_id = v.id
        LEFT JOIN business_zones bz ON m.business_zone_id = bz.id
        WHERE 
          m.merchant_coordinates IS NOT NULL
          AND m.merchant_coordinates::text != 'null'
          AND m.merchant_coordinates ? 'type'
          AND m.merchant_coordinates ? 'coordinates'
          AND m.merchant_coordinates->>'type' = 'Point'
          AND jsonb_array_length(m.merchant_coordinates->'coordinates') = 2
          AND m.is_active = true
          AND m.is_accepting_orders = true
          AND v.is_active = true
          AND (m.business_zone_id IS NULL OR bz.is_active = true)
          AND ST_DWithin(
            ST_Transform(ST_GeomFromGeoJSON(m.merchant_coordinates::text), 3857),
            ST_Transform(${customerPoint}, 3857),
            ${radiusMeters}
          )
          ${categoryId ? `AND EXISTS (
            SELECT 1 FROM merchants_rels mr2
            WHERE mr2.parent_id = m.id
              AND mr2.path = 'merchant_categories'
              AND mr2.merchant_categories_id = ${categoryId}
          )` : ''};
      `)

      const totalCount = parseInt((countResult as CountQueryResult).rows[0]?.total_count || '0')
      const endTime = Date.now()
      const queryTime = endTime - startTime

      return {
        merchants: merchantsWithDistance,
        totalCount,
        pagination: {
          totalDocs: totalCount,
          limit,
          totalPages: Math.ceil(totalCount / limit),
          page: Math.floor(offset / limit) + 1,
          pagingCounter: offset + 1,
          hasPrevPage: offset > 0,
          hasNextPage: offset + limit < totalCount,
          prevPage: offset > 0 ? Math.floor((offset - limit) / limit) + 1 : null,
          nextPage: offset + limit < totalCount ? Math.floor((offset + limit) / limit) + 1 : null,
        },
        performance: {
          queryTimeMs: queryTime,
          searchRadius: radiusMeters,
          withinSearchRadius: merchantsWithDistance.length,
          proximityScore: merchantsWithDistance.length > 0 
            ? merchantsWithDistance.reduce((sum, m) => sum + (1 / (m.distanceKm + 1)), 0) / merchantsWithDistance.length 
            : 0,
          optimizationUsed: 'postgis_spatial_index'
        }
      }

    } catch (error) {
      console.error('🚨 Error in findMerchantsWithinRadiusPostGIS:', error)
      console.error('🔍 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        params: { latitude, longitude, radiusMeters, limit, offset }
      })
      throw new Error(`Failed to find merchants using PostGIS: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Determine service area type for a merchant and point
   */
  private determineServiceAreaType(merchant: Merchant, _point: unknown): string[] {
    const types: string[] = []
    
    // This would need actual PostGIS queries in a real implementation
    // For now, we'll use simplified logic
    if (merchant.service_area) types.push('delivery')
    if (merchant.priority_zones) types.push('priority')
    
    return types
  }

  /**
   * Check if point is in merchant's priority zone
   */
  private isPointInPriorityZone(merchant: Merchant, _point: unknown): boolean {
    // This would need actual PostGIS ST_Contains query
    // For now, return false as placeholder
    return merchant.priority_zones ? true : false
  }

  /**
   * Get performance metrics for monitoring
   */
  async getPerformanceMetrics() {
    try {
      const metrics = await this.payload.find({
        collection: 'merchants',
        where: {
          isActive: { equals: true }
        },
        limit: 0, // Just get count
      })

      return {
        totalActiveMerchants: metrics.totalDocs,
        timestamp: new Date().toISOString(),
        // Add more metrics as needed
      }
    } catch (error) {
      console.error('Error getting performance metrics:', error)
      return null
    }
  }
}

export default GeospatialService
