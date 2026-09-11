import type { Payload } from 'payload'
import type { ProductCategory } from '../payload-types'
import { MerchantLocationService } from './MerchantLocationService'

export interface MerchantCategoryRequest {
  customerId: number
  sortBy?: string
  limit?: number
  includeInactive?: boolean
}

export interface CategoryWithMetadata extends ProductCategory {
  productCount: number
  merchantCount: number
}

export interface MerchantCategoryResponse {
  customer: {
    id: number
    activeAddressId: number
  }
  address: {
    id: number
    latitude: number
    longitude: number
  }
  categories: CategoryWithMetadata[]
  totalCategories: number
  merchantsAnalyzed: number
  searchRadius: number
}

/**
 * MerchantCategoryService - Derives product categories from location-based merchants
 * 
 * This service uses the same merchant filtering logic as MerchantLocationService
 * but returns only the product categories available from those merchants.
 * 
 * Logic Flow: Customer Location → Nearby Merchants → merchant_products → products → categories
 */
export class MerchantCategoryService {
  private payload: Payload
  private merchantLocationService: MerchantLocationService

  constructor(payload: Payload) {
    this.payload = payload
    this.merchantLocationService = new MerchantLocationService(payload)
  }

  async getCategoriesForLocationBasedMerchants(request: MerchantCategoryRequest): Promise<MerchantCategoryResponse> {
    const { customerId, sortBy = 'displayOrder', limit = 50, includeInactive = false } = request

    // Step 1: Get nearby merchants using the same logic as location-based display
    const merchantLocationResult = await this.merchantLocationService.getMerchantsForLocationDisplay({ customerId })

    // Extract merchant IDs from the location result
    const merchantIds = merchantLocationResult.merchants.map(merchant => merchant.id)

    if (merchantIds.length === 0) {
      return {
        customer: merchantLocationResult.customer,
        address: merchantLocationResult.address,
        categories: [],
        totalCategories: 0,
        merchantsAnalyzed: 0,
        searchRadius: 50000 // Same as MerchantLocationService
      }
    }

    // Step 2: Get categories for these merchants
    const categories = await this.getCategoriesForMerchants(merchantIds, { sortBy, limit, includeInactive })

    return {
      customer: merchantLocationResult.customer,
      address: merchantLocationResult.address,
      categories,
      totalCategories: categories.length,
      merchantsAnalyzed: merchantIds.length,
      searchRadius: 50000 // Same as MerchantLocationService
    }
  }

  /**
   * Core logic: Get product categories for specific merchants
   * Logic Flow: merchantIds → merchant_products → products → categories
   */
  private async getCategoriesForMerchants(
    merchantIds: number[], 
    options: { sortBy: string; limit: number; includeInactive: boolean }
  ): Promise<CategoryWithMetadata[]> {
    const { sortBy, limit, includeInactive } = options

    // Step 1: Find all products associated with these merchants via merchant_products junction table
    const merchantProducts = await this.payload.find({
      collection: 'merchant-products',
      where: {
        and: [
          {
            merchant_id: {
              in: merchantIds  // Filter by our nearby merchants
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
      limit: 10000  // Get all merchant-product relationships
    })

    if (merchantProducts.docs.length === 0) {
      return []
    }

    // Step 2: Extract unique product IDs
    const productIdsSet = new Set<string>()
    merchantProducts.docs.forEach(mp => {
      const productId = typeof mp.product_id === 'object' && mp.product_id !== null
        ? mp.product_id.id
        : mp.product_id
      if (productId) {
        productIdsSet.add(String(productId))
      }
    })
    const productIds = Array.from(productIdsSet)

    if (productIds.length === 0) {
      return []
    }

    // Step 3: Find products and populate their categories
    const products = await this.payload.find({
      collection: 'products',
      where: {
        and: [
          {
            id: {
              in: productIds
            }
          },
          {
            isActive: { equals: true }
          }
        ]
      },
      depth: 2  // This populates the category relationship
    })

    if (products.docs.length === 0) {
      return []
    }

    // Step 4: Extract unique categories with metadata
    const categoriesMap = new Map<string, CategoryWithMetadata>()

    products.docs.forEach(product => {
      // Handle categories relationship (now hasMany)
      if (product.categories && Array.isArray(product.categories)) {
        product.categories.forEach(categoryRef => {
          const category = typeof categoryRef === 'object' && categoryRef !== null
            ? categoryRef
            : null

          if (category && !categoriesMap.has(String(category.id))) {
            categoriesMap.set(String(category.id), {
              ...category,
              productCount: 0,
              merchantCount: 0
            })
          }

          // Increment product count
          if (category) {
            const cat = categoriesMap.get(String(category.id))
            if (cat) {
              cat.productCount++
            }
          }
        })
      }
    })

    // Step 5: Count how many merchants have each category
    const merchantCategoryCount = new Map<string, Set<number>>()

    merchantProducts.docs.forEach(mp => {
      const product = products.docs.find(p => {
        const productId = typeof mp.product_id === 'object' && mp.product_id !== null 
          ? mp.product_id.id 
          : mp.product_id
        return p.id === productId
      })

      if (product?.categories && Array.isArray(product.categories)) {
        product.categories.forEach(categoryRef => {
          const categoryId = typeof categoryRef === 'object' && categoryRef !== null
            ? String(categoryRef.id)
            : String(categoryRef)

          const merchantId = typeof mp.merchant_id === 'object' && mp.merchant_id !== null
            ? mp.merchant_id.id
            : mp.merchant_id

          if (categoryId && merchantId) {
            if (!merchantCategoryCount.has(categoryId)) {
              merchantCategoryCount.set(categoryId, new Set())
            }
            merchantCategoryCount.get(categoryId)?.add(Number(merchantId))
          }
        })
      }
    })

    // Update merchant counts
    merchantCategoryCount.forEach((merchantSet, categoryId) => {
      const cat = categoriesMap.get(categoryId)
      if (cat) {
        cat.merchantCount = merchantSet.size
      }
    })

    // Step 6: Convert to array, filter, and sort
    let categoriesArray = Array.from(categoriesMap.values())

    // Filter by active status
    if (!includeInactive) {
      categoriesArray = categoriesArray.filter(cat => cat.isActive)
    }

    // Sort categories
    categoriesArray.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '')
        case 'productCount':
          return b.productCount - a.productCount
        case 'merchantCount':
          return b.merchantCount - a.merchantCount
        case 'displayOrder':
        default:
          return (a.displayOrder || 999) - (b.displayOrder || 999)
      }
    })

    // Apply limit
    return categoriesArray.slice(0, limit)
  }
}