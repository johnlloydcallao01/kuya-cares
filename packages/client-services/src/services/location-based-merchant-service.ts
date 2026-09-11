"use client";

import type { Merchant, Media, MerchantCategoryDisplay } from '../types/merchant';
import { dataCache, CACHE_KEYS, CACHE_TTL } from '../cache/data-cache';

// Extended merchant type with location data (matching API response)
export interface LocationBasedMerchant extends Omit<Merchant, 'operationalStatus'> {
  distance: number;
  distanceKm: number;
  isWithinDeliveryRadius: boolean;
  estimatedDeliveryTime: string;
  operationalStatus: string;
  // Optional fields that may be present from the API or inferred
  activeAddressId?: string | number | null;
  activeFormattedAddress?: string | null;
  merchant_latitude?: number | null;
  merchant_longitude?: number | null;
}

// API Response structure for location-based merchants
export interface LocationBasedMerchantsResponse {
  success: boolean;
  data: {
    customer: {
      id: string;
      user: string;
    };
    address: {
      id: string;
      formatted_address: string;
      latitude: number;
      longitude: number;
    };
    merchants: LocationBasedMerchant[];
    totalCount: number;
  };
}

export interface LocationBasedMerchantServiceOptions {
  customerId: string;
  limit?: number;
  categoryId?: string;
}

export class LocationBasedMerchantService {
  private static readonly API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
  private static readonly PAYLOAD_API_KEY = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || process.env.EXPO_PUBLIC_PAYLOAD_API_KEY || '';
  
  /**
   * Fetch location-based merchants from CMS (Client-side) with caching
   * Uses NEXT_PUBLIC_PAYLOAD_API_KEY for client-side access
   */
  static async getLocationBasedMerchants(options: LocationBasedMerchantServiceOptions): Promise<LocationBasedMerchant[]> {
    const { customerId, limit = 10, categoryId } = options;

    if (!customerId) {
      console.warn('❌ Customer ID is required for location-based merchants');
      return [];
    }

    // Debug API Key availability (masked)
    const apiKey = LocationBasedMerchantService.PAYLOAD_API_KEY;
    if (!apiKey) {
      console.error('❌ PAYLOAD_API_KEY is missing in LocationBasedMerchantService!');
    } else {
      // console.log('✅ PAYLOAD_API_KEY is available:', apiKey.substring(0, 4) + '...');
    }

    // Create cache key based on options
    const cacheKey = `${CACHE_KEYS.MERCHANTS}-location-${customerId}-${limit}-${categoryId || 'all'}`;
    
    // Check cache first
    const cachedData = dataCache.get<LocationBasedMerchant[]>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Build query parameters
      const params = new URLSearchParams({
        customerId: customerId.toString(),
      });

      if (limit) {
        params.append('limit', limit.toString());
      }

      if (categoryId) {
        params.append('categoryId', categoryId.toString());
      }

      // Add API key authentication using client-side key
      if (apiKey) {
        headers['Authorization'] = `users API-Key ${apiKey}`;
      } else {
        console.error('❌ NEXT_PUBLIC_PAYLOAD_API_KEY not found in environment');
      }

      const url = `${LocationBasedMerchantService.API_BASE}/merchant/location-based-display?${params}`;

      // IMPORTANT: Explicitly set credentials to 'omit' to prevent sending cookies that might override the API Key
      const response = await fetch(url, {
        headers,
        credentials: 'omit', 
      });
      
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`Failed to fetch location-based merchants: ${response.status}`);
      }
      
      const data: LocationBasedMerchantsResponse = await response.json();
      
      if (!data.success || !data.data?.merchants) {
        console.warn('❌ Invalid response format for location-based merchants');
        return [];
      }
      
      const merchants = data.data.merchants || [];
      
      // Cache the result
      dataCache.set(cacheKey, merchants, CACHE_TTL.MERCHANTS);
      
      return merchants;
    } catch (error) {
      console.error('❌ Error fetching location-based merchants:', error);
      return []; // Graceful fallback
    }
  }

  static async getLocationBasedMerchantCategories(options: { customerId: string; includeInactive?: boolean; limit?: number }): Promise<MerchantCategoryDisplay[]> {
    const { customerId, includeInactive = false, limit } = options;
    if (!customerId) return [];
    const cacheKey = `${CACHE_KEYS.MERCHANTS}-location-categories-${customerId}-${includeInactive ? 'all' : 'active'}-${limit ?? 'all'}`;
    const cached = dataCache.get<MerchantCategoryDisplay[]>(cacheKey);
    if (cached) return cached;
    const list = await LocationBasedMerchantService.getLocationBasedMerchants({ customerId, limit: 9999 });
    const ids = Array.from(new Set(
      (list || []).flatMap((m: any) => {
        const raw = (m as any).merchant_categories;
        if (!raw) return [] as number[];
        if (Array.isArray(raw)) {
          return raw
            .map((v: any) => typeof v === 'number' ? v : (typeof v?.id === 'number' ? v.id : null))
            .filter((v: any) => typeof v === 'number') as number[];
        }
        return [] as number[];
      })
    ));
    if (ids.length === 0) { dataCache.set(cacheKey, [], CACHE_TTL.MERCHANTS); return []; }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    
    // Use class-level constants to ensure cross-platform compatibility (supports EXPO_PUBLIC_)
    const apiKey = LocationBasedMerchantService.PAYLOAD_API_KEY;
    if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
    
    const base = LocationBasedMerchantService.API_BASE;
    const params = new URLSearchParams();
    params.append('where[id][in]', ids.join(','));
    if (!includeInactive) params.append('where[isActive][equals]', 'true');
    params.append('limit', String(ids.length));
    const url = `${base}/merchant-categories?${params.toString()}`;
    const res = await fetch(url, { headers, credentials: 'omit' });
    if (!res.ok) { dataCache.set(cacheKey, [], CACHE_TTL.MERCHANTS); return []; }
    const json = await res.json();
    const docs: any[] = json.docs || json.data?.docs || [];
    let mapped: MerchantCategoryDisplay[] = docs.map((c: any) => ({
      id: typeof c.id === 'number' ? c.id : Number(c.id),
      name: c.name,
      slug: c.slug,
      description: c.description || undefined,
      displayOrder: c.displayOrder ?? undefined,
      isActive: c.isActive ?? undefined,
      isFeatured: c.isFeatured ?? undefined,
      media: { icon: c.icon || null },
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
    }));
    if (typeof limit === 'number') mapped = mapped.slice(0, limit);
    dataCache.set(cacheKey, mapped, CACHE_TTL.MERCHANTS);
    return mapped;
  }

  static sortByRecentlyUpdated(list: LocationBasedMerchant[]): LocationBasedMerchant[] {
    const getKey = (m: LocationBasedMerchant): string | number => {
      const primary = (m as any).updatedAt || (m as any).createdAt || 0;
      if (typeof primary === 'number' && Number.isFinite(primary)) return primary;
      if (typeof primary === 'string') return primary;
      return 0;
    };
    return [...(list || [])].sort((a, b) => {
      const ka = getKey(a);
      const kb = getKey(b);
      if (typeof ka === 'number' && typeof kb === 'number') {
        return kb - ka;
      }
      return String(kb).localeCompare(String(ka));
    });
  }

  static async getActiveAddressNamesForMerchants(list: LocationBasedMerchant[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    if (!list || list.length === 0) return out;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (LocationBasedMerchantService.PAYLOAD_API_KEY) {
      headers['Authorization'] = `users API-Key ${LocationBasedMerchantService.PAYLOAD_API_KEY}`;
    }
    const base = LocationBasedMerchantService.API_BASE;
    const jobs = list.map((m) => async () => {
      const cacheKey = `${CACHE_KEYS.MERCHANTS}-active-address-${m.id}`;
      const cached = dataCache.get<string>(cacheKey);
      if (cached) { out[m.id] = cached; return; }
      try {
        const res = await fetch(`${base}/merchants/${m.id}?depth=1`, { headers });
        if (res.ok) {
          const data = await res.json();
          const addr = data?.activeAddress;
          const name = addr?.formatted_address;
          if (name && typeof name === 'string') {
            out[m.id] = name;
            dataCache.set(cacheKey, name, CACHE_TTL.ACTIVE_ADDRESS);
            return;
          }
        }
      } catch {}
      const lat = (m as any).merchant_latitude ?? (m as any).latitude ?? null;
      const lng = (m as any).merchant_longitude ?? (m as any).longitude ?? null;
      if (lat != null && lng != null) {
        try {
          const res2 = await fetch(`${base}/addresses?where[latitude][equals]=${lat}&where[longitude][equals]=${lng}&limit=1`, { headers });
          if (res2.ok) {
            const j = await res2.json();
            const doc = j?.docs?.[0];
            const name = doc?.formatted_address;
            if (name && typeof name === 'string') {
              out[m.id] = name;
              dataCache.set(cacheKey, name, CACHE_TTL.ACTIVE_ADDRESS);
              return;
            }
          }
        } catch {}
      }
    });
    const limit = 5;
    let idx = 0;
    const runNext = async (): Promise<void> => {
      if (idx >= jobs.length) return;
      const current = idx++;
      await jobs[current]();
      await runNext();
    };
    const runners = Array.from({ length: Math.min(limit, jobs.length) }).map(() => runNext());
    await Promise.all(runners);
    return out;
  }


  /**
   * Get customer ID from current user session
   * This integrates with the authentication system to get the customer ID
   */
  static async getCurrentCustomerId(): Promise<string | null> {
    try {
      // Check if we have a cached customer ID
      const cachedCustomerId = dataCache.get<string>('current-customer-id');
      if (cachedCustomerId) {
        return cachedCustomerId;
      }

      // Get current user from localStorage (where auth context stores it)
      const userDataStr = typeof window !== 'undefined' ? localStorage.getItem('grandline_auth_user') : null;
      if (!userDataStr) {
        return null;
      }

      let userData;
      try {
        userData = JSON.parse(userDataStr);
      } catch (parseError) {
        console.error('❌ Failed to parse user data from localStorage:', parseError);
        return null;
      }

      const userId = userData?.id;
      if (!userId) {
        return null;
      }

      // Get customer ID from user ID using the same pattern as address-service
      const customerId = await LocationBasedMerchantService.getCustomerIdFromUserId(userId);
      
      if (customerId) {
        // Cache the customer ID for future use
        dataCache.set('current-customer-id', customerId, CACHE_TTL.MERCHANTS);
      } else {
      }
      
      return customerId;
    } catch (error) {
      console.error('❌ Error getting current customer ID:', error);
      return null;
    }
  }

  /**
   * Get customer ID from user ID
   * Uses the same pattern as address-service.ts
   */
  static async getCustomerIdFromUserId(userId: string | number): Promise<string | null> {
    try {
      
      // Use proper authentication headers for PayloadCMS API
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `users API-Key ${LocationBasedMerchantService.PAYLOAD_API_KEY}`,
      };

      const url = `${this.API_BASE}/customers?where[user][equals]=${userId}&limit=1`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'omit',
      });


      if (!response.ok) {
        console.error('❌ Failed to fetch customer by user ID:', response.status);
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        return null;
      }

      const data = await response.json();
      
      if (data.docs && data.docs.length > 0) {
        const customerId = data.docs[0].id;
        return customerId;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting customer ID from user ID:', error);
      return null;
    }
  }

  /**
   * Clear location-based merchants cache
   */
  static clearCache(customerId?: string): void {
    if (customerId) {
      // Clear specific customer's cache
      const stats = dataCache.getStats();
      stats.keys.forEach(key => {
        // Match both merchant list keys and merchant categories keys
        // Merchant list: ...-location-${customerId}-...
        // Categories: ...-location-categories-${customerId}-...
        if (key.includes(`location-${customerId}`) || key.includes(`location-categories-${customerId}`)) {
          dataCache.delete(key);
        }
      });
    } else {
      // Clear all location-based merchant cache entries
      const stats = dataCache.getStats();
      stats.keys.forEach(key => {
        if (key.includes('location-')) {
          dataCache.delete(key);
        }
      });
    }
  }
}

// Export convenience functions
export const getLocationBasedMerchants = LocationBasedMerchantService.getLocationBasedMerchants;
export const getCurrentCustomerId = LocationBasedMerchantService.getCurrentCustomerId;
export const clearLocationBasedMerchantsCache = LocationBasedMerchantService.clearCache;
export const getLocationBasedMerchantCategories = LocationBasedMerchantService.getLocationBasedMerchantCategories;
export const getActiveAddressNamesForMerchants = LocationBasedMerchantService.getActiveAddressNamesForMerchants;
export const sortMerchantsByRecentlyUpdated = LocationBasedMerchantService.sortByRecentlyUpdated;
