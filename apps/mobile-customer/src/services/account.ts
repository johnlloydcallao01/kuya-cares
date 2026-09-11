import { apiConfig } from '../config/environment';

const API_BASE = apiConfig.baseUrl;
const API_KEY = apiConfig.payloadApiKey;

export interface AccountStats {
  orderCount: number;
  totalSpent: number;
  favoriteCount: number;
  reviewCount: number;
  addressCount: number;
  unreadNotificationCount: number;
}

export interface AccountOverview {
  customer: any | null;
  stats: AccountStats;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) {
    headers['Authorization'] = `users API-Key ${API_KEY}`;
  }
  return headers;
}

async function fetchDocs(url: string): Promise<{ docs: any[]; totalDocs: number }> {
  const res = await fetch(url, { headers: buildHeaders(), cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return {
    docs: Array.isArray(data?.docs) ? data.docs : [],
    totalDocs: Number(data?.totalDocs) || 0,
  };
}

function toArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function resolveMediaUrl(media: any): string | null {
  if (!media) return null;
  if (typeof media === 'string' || typeof media === 'number') return null;
  return media.cloudinaryURL || media.url || media.thumbnailURL || null;
}

/**
 * Fetches the real account overview for the given CMS user:
 * - Customer record (with active delivery address)
 * - Order count + total amount spent
 * - Favorites (wishlist) count
 * - Reviews written
 * - Saved addresses count
 * - Unread in-app notifications count
 */
export async function fetchAccountOverview(userId: string | number): Promise<AccountOverview> {
  const [
    customerRes,
    ordersRes,
    favoritesRes,
    reviewsRes,
    addressesRes,
    unreadRes,
  ] = await Promise.all([
    fetchDocs(`${API_BASE}/customers?where[user][equals]=${userId}&depth=2&limit=1`),
    fetchDocs(`${API_BASE}/orders?where[customer.user][equals]=${userId}&depth=0&sort=-placed_at&limit=100`),
    fetchDocs(`${API_BASE}/wishlists?where[user][equals]=${userId}&depth=0&limit=1`),
    fetchDocs(`${API_BASE}/reviews?where[customer.user][equals]=${userId}&depth=0&limit=1`),
    fetchDocs(`${API_BASE}/addresses?where[user][equals]=${userId}&depth=0&limit=1`),
    fetchDocs(`${API_BASE}/user-notifications?where[user][equals]=${userId}&where[status][equals]=unread&depth=0&limit=1`),
  ]);

  const totalSpent = ordersRes.docs.reduce((sum: number, order: any) => {
    const total = Number(order.total);
    return Number.isFinite(total) ? sum + total : sum;
  }, 0);

  return {
    customer: customerRes.docs[0] ?? null,
    stats: {
      orderCount: ordersRes.totalDocs,
      totalSpent,
      favoriteCount: favoritesRes.totalDocs,
      reviewCount: reviewsRes.totalDocs,
      addressCount: addressesRes.totalDocs,
      unreadNotificationCount: unreadRes.totalDocs,
    },
  };
}

/**
 * Fetches the full customer record (with active address populated).
 */
export async function fetchCustomer(userId: string | number): Promise<any | null> {
  const { docs } = await fetchDocs(`${API_BASE}/customers?where[user][equals]=${userId}&depth=2&limit=1`);
  return docs[0] ?? null;
}

/**
 * Extracts a usable profile picture URL from a user record (CMS Media shape).
 */
export function getProfilePictureUrl(user: any): string | null {
  if (!user?.profilePicture) return null;
  return resolveMediaUrl(user.profilePicture);
}

export interface PickedImage {
  uri: string;
  name?: string;
  mimeType?: string;
}

/**
 * Uploads a locally picked image to the CMS media collection
 * and returns the created media document (with `id`, `url`, `cloudinaryURL`).
 */
export async function uploadProfileImage(image: PickedImage): Promise<any> {
  const formData = new FormData();
  const file: any = {
    uri: image.uri,
    name: image.name || `profile-${Date.now()}.jpg`,
    type: image.mimeType || 'image/jpeg',
  };
  formData.append('file', file);
  formData.append('alt', 'Profile picture');

  const headers: Record<string, string> = {};
  if (API_KEY) {
    headers['Authorization'] = `users API-Key ${API_KEY}`;
  }

  const res = await fetch(`${API_BASE}/media`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.errors?.[0]?.message ||
        err?.message ||
        `Failed to upload image (${res.status})`,
    );
  }
  const result = await res.json();
  return result.doc || result;
}

/**
 * Resolves a relationship into its object form (when depth is applied).
 */
export function asObject(value: any): any | null {
  if (!value) return null;
  return typeof value === 'object' ? value : null;
}

export { toArray };
