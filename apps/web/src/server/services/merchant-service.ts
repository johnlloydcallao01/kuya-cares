import 'server-only';
import type { Merchant } from '@encreasl/client-services';

// Re-export types for backward compatibility
export type { Merchant };

export interface MerchantsResponse {
  docs: Merchant[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface MerchantsResponseLegacy {
  docs: Merchant[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface MerchantServiceOptions {
  isActive?: boolean;
  limit?: number;
  page?: number;
}

export class MerchantService {
  private static readonly API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
  
  /**
   * Fetch merchants from CMS with ISR optimization
   * Optimized for server-side rendering with error handling
   */
  static async getMerchants(options: MerchantServiceOptions = {}): Promise<Merchant[]> {
    const {
      isActive = true,
      limit = 8,
      page = 1
    } = options;

    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Build query parameters
      const params = new URLSearchParams({
        limit: limit.toString(),
        page: page.toString(),
      });

      // Add isActive filter if specified
      if (isActive !== undefined) {
        params.append('where[isActive][equals]', isActive.toString());
      }

      // Add API key authentication
      // Prefer server-side key; fallback to NEXT_PUBLIC key if not set
      const apiKey = process.env.PAYLOAD_API_KEY || process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      if (apiKey) {
        headers['Authorization'] = `users API-Key ${apiKey}`;
      }

      const response = await fetch(`${MerchantService.API_BASE}/merchants?${params}&depth=2`, {
        next: { revalidate: 300 }, // 5 minutes cache for ISR
        headers,
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Failed to fetch merchants: ${response.status}${errorText ? ` - ${errorText}` : ''}`);
      }
      
      const data: MerchantsResponse = await response.json();
      return data.docs || [];
    } catch (error) {
      console.error('Error fetching merchants:', error);
      return []; // Graceful fallback
    }
  }

  /**
   * Fetch individual merchant by ID from CMS with ISR optimization
   * Optimized for server-side rendering with error handling
   */
  static async getMerchantById(id: string): Promise<Merchant | null> {
    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add API key authentication
      // Prefer server-side key; fallback to NEXT_PUBLIC key if not set
      const apiKey = process.env.PAYLOAD_API_KEY || process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      if (apiKey) {
        headers['Authorization'] = `users API-Key ${apiKey}`;
      }

      const response = await fetch(`${MerchantService.API_BASE}/merchants/${id}?depth=3`, {
        next: { revalidate: 300 }, // 5 minutes cache for ISR
        headers,
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // Merchant not found
        }
        const errorText = await response.text().catch(() => '');
        throw new Error(`Failed to fetch merchant: ${response.status}${errorText ? ` - ${errorText}` : ''}`);
      }
      
      const merchant: Merchant = await response.json();
      return merchant;
    } catch (error) {
      console.error('Error fetching merchant by ID:', error);
      return null; // Graceful fallback
    }
  }

  static async getActiveAddressNameByMerchantId(id: string): Promise<string | null> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = process.env.PAYLOAD_API_KEY || process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
      const res = await fetch(`${MerchantService.API_BASE}/merchants/${id}?depth=1`, { next: { revalidate: 120 }, headers });
      if (!res.ok) return null;
      const data = await res.json();
      const addr = data?.activeAddress;
      const name: string | null = addr?.formatted_address ?? null;
      return name;
    } catch {
      return null;
    }
  }

  /**
   * Get merchant count for pagination/display purposes
   */
  static async getMerchantCount(isActive: boolean = true): Promise<number> {
    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      const params = new URLSearchParams({
        limit: '1', // Minimal fetch for count
        page: '1',
      });

      // Add isActive filter if specified
      if (isActive !== undefined) {
        params.append('where[isActive][equals]', isActive.toString());
      }

      // Add API key authentication
      // Prefer server-side key; fallback to NEXT_PUBLIC key if not set
      const apiKey = process.env.PAYLOAD_API_KEY || process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      if (apiKey) {
        headers['Authorization'] = `users API-Key ${apiKey}`;
      }

      const response = await fetch(`${MerchantService.API_BASE}/merchants?${params}`, {
        next: { revalidate: 300 },
        headers,
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Failed to fetch merchant count: ${response.status}${errorText ? ` - ${errorText}` : ''}`);
      }
      
      const data: MerchantsResponse = await response.json();
      return data.totalDocs || 0;
    } catch (error) {
      console.error('Error fetching merchant count:', error);
      return 0;
    }
  }
}

// Export specific functions for convenience
export const getMerchants = MerchantService.getMerchants;
export const getMerchantCount = MerchantService.getMerchantCount;
export const getMerchantById = MerchantService.getMerchantById;
export const getActiveAddressNameByMerchantId = MerchantService.getActiveAddressNameByMerchantId;
