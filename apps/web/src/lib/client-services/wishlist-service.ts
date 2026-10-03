"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://cms.kuyacares.com/api";
const API_KEY = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || "";

export function getCurrentUserIdFromStorage(): string | number | null {
  if (typeof window === "undefined") return null;
  const userDataStr = window.localStorage.getItem("grandline_auth_user");
  if (!userDataStr) return null;
  try {
    const parsed = JSON.parse(userDataStr);
    const id = parsed?.id;
    if (typeof id === "number" || typeof id === "string") {
      return id;
    }
    return null;
  } catch {
    return null;
  }
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) {
    headers["Authorization"] = `users API-Key ${API_KEY}`;
  }
  return headers;
}

// Heart-state cache (§docs/performance.md §24 wishlist split): header +
// homepage sections mount concurrently and each asked for the same 200
// depth-0 IDs. Coalesce onto one promise + 5-min TTL instead of N fetches.
const WISHLIST_IDS_TTL_MS = 5 * 60 * 1000;
const wishlistIdsCache = new Map<string, { data: string[]; ts: number }>();
const wishlistIdsInflight = new Map<string, Promise<string[]>>();

function getCachedWishlistIds(userId: string): string[] | null {
  const e = wishlistIdsCache.get(String(userId));
  if (!e) return null;
  if (Date.now() - e.ts > WISHLIST_IDS_TTL_MS) {
    wishlistIdsCache.delete(String(userId));
    return null;
  }
  return e.data;
}

function bustWishlistIds(userId: string | number | null): void {
  if (userId == null) return;
  wishlistIdsCache.delete(String(userId));
}

export async function getWishlistMerchantIdsForCurrentUser(): Promise<string[]> {
  const currentUserId = getCurrentUserIdFromStorage();
  if (currentUserId == null) return [];
  const key = String(currentUserId);
  const hit = getCachedWishlistIds(key);
  if (hit) return hit;
  const running = wishlistIdsInflight.get(key);
  if (running) return running;
  const p = (async (): Promise<string[]> => {
  const headers = buildHeaders();
  const params = new URLSearchParams();
  params.append("where[user][equals]", String(currentUserId));
  params.append("limit", "200");
  params.append("depth", "0");
  const url = `${API_BASE}/wishlists?${params.toString()}`;
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    const docs: any[] = Array.isArray(data?.docs) ? data.docs : [];
    const ids = docs
      .map((doc) => {
        const m = (doc as any).merchant;
        if (!m) return null;
        if (typeof m === "number") return String(m);
        if (typeof m === "string") return m;
        const mid = (m as any).id;
        return mid ? String(mid) : null;
      })
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    const out = Array.from(new Set(ids));
    wishlistIdsCache.set(key, { data: out, ts: Date.now() });
    return out;
  } catch {
    return [];
  } finally {
    wishlistIdsInflight.delete(key);
  }
  })();
  wishlistIdsInflight.set(key, p);
  return p;
}

export async function getWishlistMerchantProductIdsForCurrentUser(): Promise<string[]> {
  const currentUserId = getCurrentUserIdFromStorage();
  if (currentUserId == null) return [];
  const headers = buildHeaders();
  const params = new URLSearchParams();
  params.append("where[user][equals]", String(currentUserId));
  params.append("where[itemType][equals]", "merchantProduct");
  params.append("limit", "200");
  params.append("depth", "0");
  const url = `${API_BASE}/wishlists?${params.toString()}`;
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    const docs: any[] = Array.isArray(data?.docs) ? data.docs : [];
    const ids = docs
      .map((doc) => {
        const mp = (doc as any).merchantProduct;
        if (!mp) return null;
        if (typeof mp === "number") return String(mp);
        if (typeof mp === "string") return mp;
        const mpId = (mp as any).id;
        return mpId ? String(mpId) : null;
      })
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    return Array.from(new Set(ids));
  } catch {
    return [];
  }
}

export async function addMerchantToWishlist(merchantId: string | number): Promise<"added" | "exists"> {
  const userId = getCurrentUserIdFromStorage();
  if (!userId) {
    throw new Error("Please sign in to use wishlist");
  }
  bustWishlistIds(userId);
  const headers = buildHeaders();
  const body = JSON.stringify({
    user: userId,
    merchant: merchantId,
  });
  const url = `${API_BASE}/wishlists`;
  const res = await fetch(url, { method: "POST", headers, body });
  if (res.ok) return "added";
  const params = new URLSearchParams();
  params.append("where[user][equals]", String(userId));
  params.append("where[merchant][equals]", String(merchantId));
  params.append("limit", "1");
  const existsUrl = `${API_BASE}/wishlists?${params.toString()}`;
  const getRes = await fetch(existsUrl, { headers });
  if (!getRes.ok) {
    throw new Error("Failed to add to wishlist");
  }
  const data = await getRes.json();
  const doc = Array.isArray(data?.docs) ? data.docs[0] : null;
  if (doc && doc.id) return "exists";
  throw new Error("Failed to add to wishlist");
}

export async function addMerchantProductToWishlist(input: {
  merchantId: string | number;
  productId: string | number;
  merchantProductId: string | number;
}): Promise<"added" | "exists"> {
  const userId = getCurrentUserIdFromStorage();
  if (!userId) {
    throw new Error("Please sign in to use wishlist");
  }
  const headers = buildHeaders();
  const body = JSON.stringify({
    user: userId,
    itemType: "merchantProduct",
    merchantProduct: input.merchantProductId,
  });
  const url = `${API_BASE}/wishlists`;
  const res = await fetch(url, { method: "POST", headers, body });
  if (res.ok) return "added";
  const params = new URLSearchParams();
  params.append("where[user][equals]", String(userId));
  params.append("where[merchantProduct][equals]", String(input.merchantProductId));
  params.append("limit", "1");
  const existsUrl = `${API_BASE}/wishlists?${params.toString()}`;
  const getRes = await fetch(existsUrl, { headers });
  if (!getRes.ok) {
    throw new Error("Failed to add to wishlist");
  }
  const data = await getRes.json();
  const doc = Array.isArray(data?.docs) ? data.docs[0] : null;
  if (doc && doc.id) return "exists";
  throw new Error("Failed to add to wishlist");
}

export async function removeMerchantFromWishlist(merchantId: string | number): Promise<"removed" | "missing"> {
  const userId = getCurrentUserIdFromStorage();
  if (!userId) {
    throw new Error("Please sign in to use wishlist");
  }
  bustWishlistIds(userId);
  const headers = buildHeaders();
  const params = new URLSearchParams();
  params.append("where[user][equals]", String(userId));
  params.append("where[merchant][equals]", String(merchantId));
  params.append("limit", "1");
  const listUrl = `${API_BASE}/wishlists?${params.toString()}`;
  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) {
    throw new Error("Failed to update wishlist");
  }
  const data = await listRes.json();
  const doc = Array.isArray(data?.docs) ? data.docs[0] : null;
  if (!doc || !doc.id) return "missing";
  const delUrl = `${API_BASE}/wishlists/${encodeURIComponent(String(doc.id))}`;
  const delRes = await fetch(delUrl, { method: "DELETE", headers });
  if (!delRes.ok) {
    throw new Error("Failed to update wishlist");
  }
  return "removed";
}

export async function removeMerchantProductFromWishlist(merchantProductId: string | number): Promise<"removed" | "missing"> {
  const userId = getCurrentUserIdFromStorage();
  if (!userId) {
    throw new Error("Please sign in to use wishlist");
  }
  const headers = buildHeaders();
  const params = new URLSearchParams();
  params.append("where[user][equals]", String(userId));
  params.append("where[merchantProduct][equals]", String(merchantProductId));
  params.append("limit", "1");
  const listUrl = `${API_BASE}/wishlists?${params.toString()}`;
  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) {
    throw new Error("Failed to update wishlist");
  }
  const data = await listRes.json();
  const doc = Array.isArray(data?.docs) ? data.docs[0] : null;
  if (!doc || !doc.id) return "missing";
  const delUrl = `${API_BASE}/wishlists/${encodeURIComponent(String(doc.id))}`;
  const delRes = await fetch(delUrl, { method: "DELETE", headers });
  if (!delRes.ok) {
    throw new Error("Failed to update wishlist");
  }
  return "removed";
}

export async function removeWishlistDocById(docId: string | number): Promise<void> {
  const userId = getCurrentUserIdFromStorage();
  if (!userId) {
    throw new Error("Please sign in to use wishlist");
  }
  const headers = buildHeaders();
  const delUrl = `${API_BASE}/wishlists/${encodeURIComponent(String(docId))}`;
  const delRes = await fetch(delUrl, { method: "DELETE", headers });
  if (!delRes.ok) {
    throw new Error("Failed to clear wishlist");
  }
}

export async function clearWishlistForCurrentUser(): Promise<void> {
  const userId = getCurrentUserIdFromStorage();
  if (!userId) {
    throw new Error("Please sign in to use wishlist");
  }
  const headers = buildHeaders();
  const params = new URLSearchParams();
  params.append("where[user][equals]", String(userId));
  const url = `${API_BASE}/wishlists?${params.toString()}`;
  const res = await fetch(url, { method: "DELETE", headers });
  if (!res.ok) {
    throw new Error("Failed to clear wishlist");
  }
}

export async function getWishlistDocsForCurrentUser(): Promise<any[]> {
  const currentUserId = getCurrentUserIdFromStorage();
  if (currentUserId == null) return [];
  const headers = buildHeaders();
  const params = new URLSearchParams();
  params.append("where[user][equals]", String(currentUserId));
  params.append("sort", "-createdAt");
  params.append("limit", "200");
  params.append("depth", "3");
  const url = `${API_BASE}/wishlists?${params.toString()}`;
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    const docs: any[] = Array.isArray(data?.docs) ? data.docs : [];
    return docs;
  } catch {
    return [];
  }
}
