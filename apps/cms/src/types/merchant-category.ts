import type { ProductCategory } from '../payload-types'

/**
 * TypeScript interfaces for Merchant Location-Based Product Categories endpoint
 * These types define the structure of requests and responses for the derived endpoint
 */

export interface MerchantCategoryRequest {
  customerId: number
  sortBy?: 'displayOrder' | 'name' | 'productCount' | 'merchantCount'
  limit?: number
  includeInactive?: boolean
}

export interface CategoryWithMetadata extends ProductCategory {
  /** Number of products in this category from nearby merchants */
  productCount: number
  /** Number of nearby merchants that have products in this category */
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
  /** Product categories available from nearby merchants */
  categories: CategoryWithMetadata[]
  /** Total number of categories returned */
  totalCategories: number
  /** Number of merchants analyzed for categories */
  merchantsAnalyzed: number
  /** Search radius used in meters */
  searchRadius: number
}

export interface MerchantCategoryApiResponse {
  success: boolean
  data?: MerchantCategoryResponse
  error?: string
  code?: string
  message?: string
  timestamp: string
  requestId: string
  responseTime: number
  debug?: {
    originalError?: string
    stack?: string
    context?: {
      customerId?: string
      userId?: string
    }
  }
}

/**
 * Query parameters for the API endpoint
 */
export interface MerchantCategoryQueryParams {
  customerId: string
  sortBy?: string
  limit?: string
  includeInactive?: string
}