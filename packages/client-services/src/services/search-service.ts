"use client";

import { dataCache, CACHE_KEYS } from '../cache/data-cache';

export class SearchService {
  private static readonly API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
  private static readonly PAYLOAD_API_KEY = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || process.env.EXPO_PUBLIC_PAYLOAD_API_KEY || '';

  private static getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.PAYLOAD_API_KEY) {
      headers['Authorization'] = `users API-Key ${this.PAYLOAD_API_KEY}`;
    }
    return headers;
  }

  /**
   * Fetch recent searches for a user
   */
  static async getRecentSearches(userId: string): Promise<string[]> {
    if (!userId) return [];
    
    try {
      const url = `${this.API_BASE}/recent-searches?where[user][equals]=${encodeURIComponent(userId)}&where[scope][equals]=restaurants&sort=-updatedAt&limit=10`;
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) return [];
      
      const data = await res.json();
      const docs = Array.isArray(data?.docs) ? data.docs : [];
      return docs
        .map((d: any) => d?.query || '')
        .filter((v: any) => typeof v === 'string' && v.trim().length > 0);
    } catch (error) {
      console.error('Error fetching recent searches:', error);
      return [];
    }
  }

  /**
   * Get product name suggestions based on partial query
   */
  static async getProductSuggestions(query: string): Promise<string[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    try {
      const url = `${this.API_BASE}/products?where[name][contains]=${encodeURIComponent(q)}&limit=12&depth=0`;
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) return [];

      const data = await res.json();
      const docs = Array.isArray(data?.docs) ? data.docs : Array.isArray(data) ? data : [];
      
      const names: string[] = docs
        .map((p: any) => p?.name)
        .filter((n: any) => typeof n === 'string' && n.trim().length > 0);
      
      // Return unique names
      return Array.from(new Set(names.map((n) => n.trim()))).slice(0, 12);
    } catch (error) {
      console.error('Error fetching product suggestions:', error);
      return [];
    }
  }

  /**
   * Find merchant IDs that sell products matching the query
   * Returns a list of merchant IDs
   */
  static async getMerchantIdsByProductSearch(query: string): Promise<string[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    try {
      // 1. Fetch matching products
      const pUrl = `${this.API_BASE}/products?where[name][contains]=${encodeURIComponent(q)}&limit=50&depth=0`;
      const pRes = await fetch(pUrl, { headers: this.getHeaders() });
      if (!pRes.ok) return [];
      
      const pData = await pRes.json();
      const pDocs = Array.isArray(pData?.docs) ? pData.docs : Array.isArray(pData) ? pData : [];
      const pIds: (string | number)[] = pDocs
        .map((p: any) => p?.id)
        .filter((id: any) => typeof id === 'number' || typeof id === 'string');

      if (pIds.length === 0) return [];

      // 2. Fetch merchant-products for these products
      // We limit to a reasonable number to avoid huge URLs or payload
      const mpUrl = `${this.API_BASE}/merchant-products?where[product_id][in]=${pIds.join(',')}&where[is_active][equals]=true&where[is_available][equals]=true&limit=${Math.max(200, pIds.length * 10)}&depth=0`;
      const mpRes = await fetch(mpUrl, { headers: this.getHeaders() });
      if (!mpRes.ok) return [];

      const mpData = await mpRes.json();
      const mpDocs = Array.isArray(mpData?.docs) ? mpData.docs : Array.isArray(mpData) ? mpData : [];

      // 3. Extract unique merchant IDs
      const mIds = mpDocs.map((d: any) => {
        const val = d?.merchant_id;
        if (val && typeof val === 'object' && val.id != null) return val.id;
        return val;
      }).filter((id: any) => typeof id === 'number' || typeof id === 'string');

      return Array.from(new Set(mIds.map((x: any) => String(x))));
    } catch (error) {
      console.error('Error searching merchants by product:', error);
      return [];
    }
  }
}
