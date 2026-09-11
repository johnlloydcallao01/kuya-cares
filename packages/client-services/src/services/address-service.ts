
import { dataCache, CACHE_KEYS, CACHE_TTL } from '../cache/data-cache';

// Interface matching Google Maps Place Result (minimal subset needed for parsing)
export interface GooglePlaceLike {
  formatted_address?: string;
  place_id?: string;
  geometry?: {
    location?: {
      lat: (() => number) | number;
      lng: (() => number) | number;
    };
  };
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

export interface AddressData {
  formatted_address: string;
  google_place_id: string;
  street_number?: string;
  route?: string;
  street?: string;
  floor_unit_room?: string;
  delivery_instructions?: string;
  label?: string;
  barangay?: string;
  locality?: string;
  administrative_area_level_1?: string;
  country?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  address_type?: 'home' | 'work' | 'partner' | 'other';
  is_default?: boolean;
  notes?: string;
  user?: string | number;
}

export interface AddressCreateRequest {
  place: GooglePlaceLike;
  address_type?: 'home' | 'work' | 'partner' | 'other';
  is_default?: boolean;
  notes?: string;
  userId: string | number;
  street?: string;
  floor_unit_room?: string;
  delivery_instructions?: string;
  label?: string;
}

export interface AddressResponse {
  success: boolean;
  address?: any;
  addresses?: any[];
  total?: number;
  message?: string;
  error?: string;
  details?: any;
}

export class AddressService {
  // Cross-platform API URL handling
  private static readonly API_BASE = 
    process.env.NEXT_PUBLIC_API_URL || 
    process.env.EXPO_PUBLIC_API_URL || 
    'https://cms.tap2goph.com/api';

  private static readonly COLLECTION_SLUG = 'addresses';

  private static readonly PAYLOAD_API_KEY =
    process.env.NEXT_PUBLIC_PAYLOAD_API_KEY ||
    process.env.EXPO_PUBLIC_PAYLOAD_API_KEY ||
    '';

  /**
   * Get the authorization token from localStorage (Web only)
   */
  private static getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem('grandline_auth_token');
    } catch {
      return null;
    }
  }

  private static getHeaders(token?: string): HeadersInit {
    const activeToken = token || this.getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.PAYLOAD_API_KEY) {
      headers['Authorization'] = `users API-Key ${this.PAYLOAD_API_KEY}`;
    } else if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }
    return headers;
  }

  // Helper to ensure cookies are omitted when using API Key
  private static getFetchOptions(method: string = 'GET', body?: any): RequestInit {
    const options: RequestInit = {
      method,
      credentials: this.PAYLOAD_API_KEY ? 'omit' : 'include', // Only omit if we have an API Key
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    return options;
  }

  /**
   * Parse Google Place data into PayloadCMS AddressData structure
   * Replicates logic from apps/web/src/app/api/addresses/route.ts
   */
  private static parsePlaceData(
    place: GooglePlaceLike, 
    extras: { address_type?: 'home' | 'work' | 'partner' | 'other'; is_default?: boolean; notes?: string; userId: string | number; street?: string; floor_unit_room?: string; delivery_instructions?: string; label?: string }
  ): AddressData {
    const { address_type = 'other', is_default = false, notes, userId, street, floor_unit_room, delivery_instructions, label } = extras;

    const addressData: AddressData = {
      formatted_address: place.formatted_address || '',
      google_place_id: place.place_id || '',
      
      // Handle both function-based (Google Maps JS API) and direct property access (React Native / serialized)
      latitude: typeof place.geometry?.location?.lat === 'function' 
        ? place.geometry.location.lat() 
        : (place.geometry?.location?.lat as number | undefined),
      longitude: typeof place.geometry?.location?.lng === 'function' 
        ? place.geometry.location.lng() 
        : (place.geometry?.location?.lng as number | undefined),
      
      address_type,
      is_default,
      notes,
      country: 'Philippines', // Default
      user: userId,
      street,
      floor_unit_room,
      delivery_instructions,
      label,
    };

    if (place.address_components) {
      for (const component of place.address_components) {
        const types = component.types;
        
        if (types.includes('street_number')) {
          addressData.street_number = component.long_name;
        } else if (types.includes('route')) {
          addressData.route = component.long_name;
        } else if (types.includes('sublocality_level_1') || types.includes('neighborhood')) {
          addressData.barangay = component.long_name;
        } else if (types.includes('locality') || types.includes('administrative_area_level_2')) {
          addressData.locality = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
          addressData.administrative_area_level_1 = component.long_name;
        } else if (types.includes('country')) {
          addressData.country = component.long_name;
        } else if (types.includes('postal_code')) {
          addressData.postal_code = component.long_name;
        }
      }
    }

    return addressData;
  }

  /**
   * Save a new address directly to CMS
   */
  static async saveAddress(request: AddressCreateRequest, token?: string): Promise<AddressResponse> {
    try {
      // Parse the place data client-side
      const addressData = this.parsePlaceData(request.place, {
        address_type: request.address_type,
        is_default: request.is_default,
        notes: request.notes,
        userId: request.userId,
        street: request.street,
        floor_unit_room: request.floor_unit_room,
        delivery_instructions: request.delivery_instructions,
        label: request.label,
      });

      // If default, we might need to unset other defaults. 
      // This is complex to do in one request without a custom endpoint.
      // For now, we'll just create the address. The backend hook or separate call should handle default toggling.
      // Ideally, we replicate the "unset others" logic if possible, but that requires multiple calls.
      if (request.is_default) {
        try {
          // Unset other defaults for this user
          await fetch(`${this.API_BASE}/${this.COLLECTION_SLUG}?where[user][equals]=${request.userId}&where[is_default][equals]=true`, {
            method: 'PATCH',
            headers: this.getHeaders(token),
            body: JSON.stringify({ is_default: false })
          });
        } catch (e) {
          console.warn('Failed to unset default addresses', e);
        }
      }

      const response = await fetch(`${this.API_BASE}/${this.COLLECTION_SLUG}`, {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify(addressData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.errors?.[0]?.message || 'Failed to create address');
      }

      // Update cache
      this.clearCache();

      return {
        success: true,
        address: data.doc || data, // Payload response structure
        message: 'Address created successfully'
      };
    } catch (error) {
      console.error('Error saving address:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user addresses
   */
  static async getUserAddresses(userId: string | number, token?: string, useCache: boolean = true): Promise<AddressResponse> {
    try {
      if (useCache) {
        const cached = this.getCachedAddresses();
        if (cached) return { success: true, addresses: cached };
      }

      const response = await fetch(`${this.API_BASE}/${this.COLLECTION_SLUG}?where[user][equals]=${userId}&sort=-createdAt`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.errors?.[0]?.message || 'Failed to fetch addresses');
      }

      const addresses = data.docs || [];
      this.updateCache(addresses);

      return {
        success: true,
        addresses,
        total: data.totalDocs
      };
    } catch (error) {
      console.error('Error fetching addresses:', error);
      
      if (error instanceof Error && (
        error.message.includes('fetch') || 
        error.message.includes('network') || 
        error.message.includes('Server error')
      )) {
        const cachedAddresses = this.getCachedAddresses();
        if (cachedAddresses) {
          console.log('🔄 Using cached addresses as fallback due to network error');
          return { success: true, addresses: cachedAddresses };
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete address
   */
  static async deleteAddress(addressId: string, token?: string): Promise<AddressResponse> {
    try {
      const response = await fetch(`${this.API_BASE}/${this.COLLECTION_SLUG}/${addressId}`, {
        method: 'DELETE',
        headers: this.getHeaders(token),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.errors?.[0]?.message || 'Failed to delete address');
      }

      this.removeAddressFromCache(addressId);

      return {
        success: true,
        message: 'Address deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update an address
   */
  static async updateAddress(addressId: string, updates: Partial<AddressCreateRequest>, token?: string): Promise<AddressResponse> {
    try {
      const response = await fetch(`${this.API_BASE}/${this.COLLECTION_SLUG}/${addressId}`, {
        method: 'PATCH',
        headers: this.getHeaders(token),
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.errors?.[0]?.message || `HTTP error! status: ${response.status}`);
      }

      // Clear cache to force refresh since address was updated
      if (data.success || data.doc) {
        this.clearCache();
      }

      return {
        success: true,
        address: data.doc || data,
        message: 'Address updated successfully'
      };
    } catch (error) {
      console.error('Error updating address:', error);
      throw error;
    }
  }

  /**
   * Set an address as default
   * Note: You may need a custom endpoint if you want to automatically unset other defaults.
   * If you just PATCH this to true, others might remain true unless handled by Payload hooks.
   */
  static async setDefaultAddress(addressId: string, token?: string): Promise<AddressResponse> {
    try {
      // Assuming you have a custom endpoint or hook handling this. If not, this just sets is_default: true
      const response = await fetch(`${this.API_BASE}/${this.COLLECTION_SLUG}/${addressId}`, {
        method: 'PATCH',
        headers: this.getHeaders(token),
        body: JSON.stringify({ is_default: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.errors?.[0]?.message || `HTTP error! status: ${response.status}`);
      }

      if (data.doc || data.success) {
        this.clearCache();
      }

      return {
        success: true,
        address: data.doc || data,
        message: 'Default address updated'
      };
    } catch (error) {
      console.error('Error setting default address:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to set default address' 
      };
    }
  }

  /**
   * Get active address for a user (via Customer relation)
   */
  static async getActiveAddress(userId: string | number, token?: string, useCache: boolean = true): Promise<AddressResponse> {
    try {
      if (useCache) {
        const cachedAddress = this.getCachedActiveAddress(userId);
        if (cachedAddress) {
          return { success: true, address: cachedAddress };
        }
      }

      // 1. Fetch customer for this user
      const customerRes = await fetch(`${this.API_BASE}/customers?where[user][equals]=${userId}&depth=1`, {
        ...this.getFetchOptions('GET'),
        headers: this.getHeaders(token),
      });

      const customerData = await customerRes.json();
      
      if (!customerRes.ok) {
        throw new Error('Failed to fetch customer profile');
      }

      const customer = customerData.docs?.[0];
      
      if (!customer) {
        // No customer profile yet
        return { success: false, message: 'Customer profile not found' };
      }

      // 2. Return active address if exists
      if (customer.activeAddress && typeof customer.activeAddress === 'object') {
        this.updateActiveAddressInCache(userId, customer.activeAddress);
        return {
          success: true,
          address: customer.activeAddress
        };
      } else if (customer.activeAddress) {
        // If it's just an ID (shouldn't be with depth=1, but safety check)
         // Fetch the address details
         const addressRes = await fetch(`${this.API_BASE}/${this.COLLECTION_SLUG}/${customer.activeAddress}`, {
           ...this.getFetchOptions('GET'),
           headers: this.getHeaders(token)
         });
         const addressData = await addressRes.json();
         if (addressRes.ok) {
           this.updateActiveAddressInCache(userId, addressData);
           return { success: true, address: addressData };
         }
      }

      return { success: false, message: 'No active address set' };
    } catch (error) {
      console.error('Error fetching active address:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Set active address for a user (Look up customer first)
   */
  static async setActiveAddressForUser(userId: string | number, addressId: string | number, token?: string): Promise<AddressResponse> {
    try {
      // 1. Fetch customer for this user to get ID
      const customerRes = await fetch(`${this.API_BASE}/customers?where[user][equals]=${userId}&depth=0`, {
        ...this.getFetchOptions('GET'),
        headers: this.getHeaders(token),
      });

      const customerData = await customerRes.json();
      
      if (!customerRes.ok) {
        throw new Error('Failed to fetch customer profile');
      }

      const customer = customerData.docs?.[0];
      
      if (!customer) {
        return { success: false, message: 'Customer profile not found' };
      }

      // 2. Set active address
      const result = await this.setActiveAddress(customer.id, addressId, token);
      if (result.success && result.address) {
        this.updateActiveAddressInCache(userId, result.address);
      } else if (result.success) {
        // If addressId was null/cleared
        const cacheKey = CACHE_KEYS.ACTIVE_ADDRESS(userId);
        dataCache.delete(cacheKey);
      }
      return result;
    } catch (error) {
      console.error('Error setting active address for user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Set active address (Customer level)
   * Note: This interacts with the 'customers' collection, matching logic in apps/web/src/lib/services/address-service.ts
   * But here we call CMS directly.
   */
  static async setActiveAddress(customerId: string | number, addressId: string | number, token?: string): Promise<AddressResponse> {
    try {
      const response = await fetch(`${this.API_BASE}/customers/${customerId}`, {
        ...this.getFetchOptions('PATCH', { activeAddress: addressId }),
        headers: this.getHeaders(token),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.errors?.[0]?.message || 'Failed to set active address');
      }

      return {
        success: true,
        address: data.doc?.activeAddress || data.activeAddress,
        message: 'Active address updated'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // === Cache Helpers ===

  private static isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < (CACHE_TTL.ADDRESSES * 60 * 1000);
  }

  static getCachedAddresses(): any[] | null {
    const cached = dataCache.get<{ addresses: any[], timestamp: number }>(CACHE_KEYS.ADDRESSES);
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.addresses;
    }
    return null;
  }

  static getCachedActiveAddress(userId: string | number): any | null {
    const cacheKey = CACHE_KEYS.ACTIVE_ADDRESS(userId);
    const cached = dataCache.get<{ address: any; timestamp: number }>(cacheKey);
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.address;
    }
    return null;
  }

  static updateCache(addresses: any[], userId?: string | number): void {
    dataCache.set(CACHE_KEYS.ADDRESSES, {
      addresses,
      timestamp: Date.now(),
      userId
    }, CACHE_TTL.ADDRESSES);
  }

  static updateCacheOptimized(newAddress: any, userId?: string | number): void {
    const cached = dataCache.get<{ addresses: any[], timestamp: number, userId?: string | number }>(CACHE_KEYS.ADDRESSES);
    if (cached && this.isCacheValid(cached.timestamp)) {
      if (newAddress && newAddress.formatted_address && newAddress.id) {
        const updatedAddresses = [...cached.addresses, newAddress];
        this.updateCache(updatedAddresses, userId);
      } else {
        this.clearCache();
      }
    }
  }

  static clearCache(): void {
    dataCache.delete(CACHE_KEYS.ADDRESSES);
    // Clear all active address caches
    const cacheKeys = Array.from((dataCache as any).cache.keys()) as string[];
    cacheKeys.forEach(key => {
      if (key.startsWith('active-address-')) {
        dataCache.delete(key);
      }
    });
  }

  static removeAddressFromCache(addressId: string): void {
    const cached = dataCache.get<{ addresses: any[], timestamp: number, userId?: string | number }>(CACHE_KEYS.ADDRESSES);
    if (cached && this.isCacheValid(cached.timestamp)) {
      const updated = cached.addresses.filter(a => a.id !== addressId);
      this.updateCache(updated, cached.userId);
    }
  }

  static updateActiveAddressInCache(userId: string | number, address: any): void {
    const cacheKey = CACHE_KEYS.ACTIVE_ADDRESS(userId);
    const cacheData = {
      address,
      timestamp: Date.now()
    };
    dataCache.set(cacheKey, cacheData, CACHE_TTL.ACTIVE_ADDRESS);
  }
}
