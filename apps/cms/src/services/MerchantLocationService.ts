import type { Payload } from 'payload'
import type { Merchant } from '../payload-types'
import { GeospatialService } from './GeospatialService'

export interface MerchantLocationRequest {
  customerId: number
  categoryId?: string
}

export interface MerchantLocationResponse {
  customer: {
    id: number
    activeAddressId: number
  }
  address: {
    id: number
    latitude: number
    longitude: number
  }
  merchants: Merchant[]
  totalCount: number
}

/**
 * MerchantLocationService - Pure PostGIS distance calculation service
 * 
 * This service is specifically designed for location-based display functionality
 * Uses PostGIS spatial queries for accurate distance calculations
 */
export class MerchantLocationService {
  private payload: Payload
  private geospatialService: GeospatialService

  constructor(payload: Payload) {
    this.payload = payload
    this.geospatialService = new GeospatialService(payload)
  }

  async getMerchantsForLocationDisplay(request: MerchantLocationRequest): Promise<MerchantLocationResponse> {
    const { customerId, categoryId } = request

    console.log(`🔍 [MerchantLocationService] Getting merchants for customer ${customerId}`)
    
    if (categoryId) {
      console.log(`🏷️ [MerchantLocationService] Category filter: "${categoryId}"`)
    }

    // Step 1: Get customer data
    const customer = await this.payload.findByID({
      collection: 'customers',
      id: customerId,
    })

    if (!customer) {
      throw new Error('Customer not found')
    }

    if (!customer.activeAddress) {
      throw new Error('Customer has no active address')
    }

    // Extract activeAddressId with proper validation
    let activeAddressId: number
    if (typeof customer.activeAddress === 'object' && customer.activeAddress !== null) {
      activeAddressId = customer.activeAddress.id
    } else if (typeof customer.activeAddress === 'number') {
      activeAddressId = customer.activeAddress
    } else if (typeof customer.activeAddress === 'string') {
      activeAddressId = parseInt(customer.activeAddress, 10)
      if (isNaN(activeAddressId)) {
        throw new Error('Invalid activeAddress ID format')
      }
    } else {
      throw new Error('Invalid activeAddress format')
    }

    // Validate the extracted ID
    if (!activeAddressId || isNaN(activeAddressId)) {
      throw new Error('Invalid activeAddress ID')
    }

    // Step 2: Get active address coordinates
    const address = await this.payload.findByID({
      collection: 'addresses',
      id: activeAddressId,
    })

    if (!address) {
      throw new Error('Address not found')
    }

    if (!address.latitude || !address.longitude) {
      throw new Error('Address missing coordinates')
    }

    // Validate coordinates before parsing
    const latStr = address.latitude.toString()
    const lngStr = address.longitude.toString()
    
    if (!latStr || !lngStr || latStr === 'null' || lngStr === 'null') {
      throw new Error('Address has null coordinates')
    }

    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)

    // Validate parsed coordinates
    if (isNaN(lat) || isNaN(lng)) {
      throw new Error('Address has invalid coordinate values')
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error('Address coordinates are out of valid range')
    }

    const parsedCategoryId = categoryId ? parseInt(String(categoryId), 10) : undefined
    const result = await this.geospatialService.findMerchantsWithinRadiusPostGIS({
      latitude: lat,
      longitude: lng,
      radiusMeters: 50000,
      limit: 50,
      offset: 0,
      categoryId: typeof parsedCategoryId === 'number' && !isNaN(parsedCategoryId) ? parsedCategoryId : undefined
    })

    console.log(`📍 [MerchantLocationService] Found ${result.merchants.length} nearby merchants`)

    const filteredMerchants = result.merchants

    return {
      customer: {
        id: customer.id,
        activeAddressId,
      },
      address: {
        id: address.id,
        latitude: lat,
        longitude: lng,
      },
      merchants: filteredMerchants,
      totalCount: filteredMerchants.length,
    }
  }

  /**
   * Get merchant IDs that have products in a specific category (by category ID)
   * 
   * This method filters the nearby merchants to only those that have
   * active products in the specified category.
   * 
   * Uses category ID directly for filtering (integer comparison - fastest)
   * 
   * @param merchantIds - List of nearby merchant IDs from PostGIS query
   * @param categoryId - Category ID to filter by
   * @returns Array of merchant IDs that have products in this category
   */
  private async getMerchantIdsByCategoryId(
    merchantIds: number[],
    categoryId: string
  ): Promise<number[]> {
    console.log(`🔍 [MerchantLocationService] Filtering ${merchantIds.length} merchants by category ID "${categoryId}"`)

    try {
      // Step 1: Find merchant-products for nearby merchants
      const merchantProducts = await this.payload.find({
        collection: 'merchant-products',
        where: {
          and: [
            {
              merchant_id: {
                in: merchantIds
              }
            },
            {
              is_active: { equals: true }
            },
            {
              is_available: { equals: true }
            }
          ]
        },
        depth: 2, // Populate product and its categories
        limit: 10000
      })

      if (merchantProducts.docs.length === 0) {
        console.log(`✅ [MerchantLocationService] No active products found for merchants`)
        return []
      }

      // Step 2: Filter merchants that have products in the specified category
      const filteredMerchantIds = new Set<number>()

      merchantProducts.docs.forEach(mp => {
        // Get the product from the relationship
        const product = mp.product_id
        if (product && typeof product === 'object' && product.categories) {
          // Check if any of the product's categories match our target category
          const categories = Array.isArray(product.categories) ? product.categories : [product.categories]
          
          const hasTargetCategory = categories.some(category => {
            const categoryId_obj = typeof category === 'object' ? category.id : category
            return String(categoryId_obj) === categoryId
          })

          if (hasTargetCategory) {
            // Get the merchant ID
            const merchantId = typeof mp.merchant_id === 'object' ? mp.merchant_id.id : mp.merchant_id
            if (merchantId) {
              filteredMerchantIds.add(parseInt(String(merchantId)))
            }
          }
        }
      })

      const result = Array.from(filteredMerchantIds)
      
      console.log(`✅ [MerchantLocationService] Found ${result.length} merchants with category ID "${categoryId}"`)
      
      return result

    } catch (error) {
      console.error(`🚨 [MerchantLocationService] Error filtering by category:`, error)
      throw new Error('Failed to filter merchants by category')
    }
  }
}
