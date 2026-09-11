"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SearchModal from "@/components/search/SearchModal";
import LocationMerchantCard from "@/components/cards/LocationMerchantCard";
import {
  getCurrentCustomerId,
  getLocationBasedMerchants,
  getLocationBasedMerchantCategories,
  type LocationBasedMerchant,
  type MerchantCategoryDisplay,
} from '@encreasl/client-services';
import {
  getWishlistMerchantIdsForCurrentUser,
  addMerchantToWishlist,
  removeMerchantFromWishlist,
} from "@/lib/client-services/wishlist-service";
import { toast } from "react-hot-toast";

export default function SearchResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [modalInitialQuery, setModalInitialQuery] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [merchants, setMerchants] = useState<LocationBasedMerchant[]>([]);
  const [categories, setCategories] = useState<MerchantCategoryDisplay[]>([]);
  const [matchedCategory, setMatchedCategory] = useState<MerchantCategoryDisplay | null>(null);
  const [categoryMerchants, setCategoryMerchants] = useState<LocationBasedMerchant[]>([]);
  const [productMatchedMerchants, setProductMatchedMerchants] = useState<LocationBasedMerchant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [isProductLoading, setIsProductLoading] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  const toggleWishlist = useCallback((id: string | number) => {
    const idStr = String(id);
    setWishlistIds(prev => {
      const next = new Set(prev);
      const willAdd = !next.has(idStr);
      if (willAdd) {
        next.add(idStr);
      } else {
        next.delete(idStr);
      }
      (async () => {
        try {
          if (willAdd) {
            await addMerchantToWishlist(id);
            toast.success("Added to wishlist", { id: `wishlist-${idStr}` });
          } else {
            await removeMerchantFromWishlist(id);
            toast.success("Removed from wishlist", { id: `wishlist-${idStr}` });
          }
        } catch (err) {
          setWishlistIds(current => {
            const rollback = new Set(current);
            if (willAdd) {
              rollback.delete(idStr);
            } else {
              rollback.add(idStr);
            }
            return rollback;
          });
          const message = err instanceof Error && err.message ? err.message : "Wishlist update failed";
          toast.error(message, { id: `wishlist-${idStr}-error` });
        }
      })();
      return next;
    });
  }, []);

  const normalizeQuery = useCallback((input: string): string => {
    let q = (input || "").toLowerCase().trim();
    if (!q) return "";
    if (q.includes(" near me")) {
      q = q.replace(" near me", "").trim();
    }
    const idx = q.indexOf(" in ");
    if (idx > -1) {
      q = q.slice(0, idx).trim();
    }
    q = q.replace(/\s+/g, " ").trim();
    return q;
  }, []);

  useEffect(() => {
    const initialQuery = searchParams.get("search_query") || "";
    setQuery(initialQuery);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      const cid = await getCurrentCustomerId();
      if (!active) return;
      setCustomerId(cid);
      if (cid) {
        const list = await getLocationBasedMerchants({ customerId: cid, limit: 9999 });
        if (!active) return;
        setMerchants(list || []);
        const cats = await getLocationBasedMerchantCategories({ customerId: cid, limit: 100 });
        if (!active) return;
        setCategories(cats || []);
      } else {
        setMerchants([]);
        setCategories([]);
      }
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const ids = await getWishlistMerchantIdsForCurrentUser();
        if (cancelled) return;
        const setIds = new Set<string>(ids.map((v) => String(v)));
        setWishlistIds(setIds);
      } catch {
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = normalizeQuery(query);
    if (!q) {
      setMatchedCategory(null);
      setCategoryMerchants([]);
      return;
    }
    const score = (c: MerchantCategoryDisplay): number => {
      const name = (c.name || "").toLowerCase();
      const slug = (c.slug || "").toLowerCase();
      if (name === q || slug === q) return 3;
      if (name.startsWith(q) || slug.startsWith(q)) return 2;
      if (name.includes(q) || slug.includes(q)) return 1;
      return 0;
    };
    const best =
      (categories || [])
        .map(c => ({ c, s: score(c) }))
        .filter(({ s }) => s > 0)
        .sort((a, b) => b.s - a.s)[0]?.c || null;
    setMatchedCategory(best);
  }, [query, categories, normalizeQuery]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!matchedCategory || !customerId) {
        setCategoryMerchants([]);
        return;
      }
      setIsCategoryLoading(true);
      const list = await getLocationBasedMerchants({
        customerId,
        limit: 24,
        categoryId: String(matchedCategory.id),
      });
      if (cancel) return;
      setCategoryMerchants(list || []);
      setIsCategoryLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [matchedCategory, customerId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsProductLoading(true);
      const q = normalizeQuery(query);
      if (!q) {
        setProductMatchedMerchants([]);
        setIsProductLoading(false);
        return;
      }
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://cms.tap2goph.com/api";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      if (apiKey) headers["Authorization"] = `users API-Key ${apiKey}`;
      try {
        const pUrl = `${API_BASE}/products?where[name][contains]=${encodeURIComponent(q)}&limit=50&depth=0`;
        const pRes = await fetch(pUrl, { headers });
        if (!pRes.ok) {
          setProductMatchedMerchants([]);
          setIsProductLoading(false);
          return;
        }
        const pData = await pRes.json();
        const pDocs = Array.isArray(pData?.docs) ? pData.docs : Array.isArray(pData) ? pData : [];
        const pIds: (string | number)[] = pDocs
          .map((p: any) => p?.id)
          .filter((id: any) => typeof id === "number" || typeof id === "string");
        if (pIds.length === 0) {
          setProductMatchedMerchants([]);
          setIsProductLoading(false);
          return;
        }

        const mpUrl = `${API_BASE}/merchant-products?where[product_id][in]=${pIds.join(
          ",",
        )}&where[is_active][equals]=true&where[is_available][equals]=true&limit=${Math.max(
          200,
          pIds.length * 10,
        )}&depth=0`;
        const mpRes = await fetch(mpUrl, { headers });
        if (!mpRes.ok) {
          setProductMatchedMerchants([]);
          setIsProductLoading(false);
          return;
        }
        const mpData = await mpRes.json();
        const mpDocs = Array.isArray(mpData?.docs) ? mpData.docs : Array.isArray(mpData) ? mpData : [];
        const mIds = mpDocs
          .map((d: any) => {
            const val = d?.merchant_id;
            if (val && typeof val === "object" && val.id != null) return val.id;
            return val;
          })
          .filter((id: any) => typeof id === "number" || typeof id === "string");
        const idSet = new Set<string>(mIds.map((x: any) => String(x)));
        const matched = (merchants || []).filter(m => idSet.has(String((m as any).id)));
        if (!cancelled) {
          setProductMatchedMerchants(matched);
          setIsProductLoading(false);
        }
      } catch {
        if (!cancelled) {
          setProductMatchedMerchants([]);
          setIsProductLoading(false);
        }
      }
    };
    const t = setTimeout(run, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, merchants, normalizeQuery]);

  const results = useMemo(() => {
    const q = normalizeQuery(query);
    if (!q) return [] as LocationBasedMerchant[];
    const textMatches = (merchants || []).filter(m => {
      const name = (m.outletName || "").toLowerCase();
      const vendor = (m.vendor?.businessName || "").toLowerCase();
      const desc = (m.description || "").toLowerCase();
      const tags = Array.isArray(m.tags) ? m.tags.join(" ").toLowerCase() : "";
      return name.includes(q) || vendor.includes(q) || desc.includes(q) || tags.includes(q);
    });
    const byId = new Map<string, LocationBasedMerchant>();
    for (const m of categoryMerchants || []) byId.set(m.id, m);
    for (const m of productMatchedMerchants || []) if (!byId.has(m.id)) byId.set(m.id, m);
    const combined: LocationBasedMerchant[] = [...(categoryMerchants || []), ...(productMatchedMerchants || [])];
    for (const m of textMatches) if (!byId.has(m.id)) combined.push(m);
    return combined;
  }, [merchants, categoryMerchants, productMatchedMerchants, query, normalizeQuery]);

  const isFetching = isLoading || isCategoryLoading || isProductLoading;

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center py-2 space-x-2">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Back"
          >
            <svg
              className="h-5 w-5 text-gray-800"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <form className="flex-1">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search restaurants and foods"
                value={query}
                readOnly
                onClick={() => {
                  setModalInitialQuery(query);
                  setIsMobileSearchOpen(true);
                }}
                className="w-full h-10 rounded-full bg-gray-100 px-4 pr-8 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#777] cursor-pointer"
              />
              {query.trim().length > 0 && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setModalInitialQuery("");
                    setIsMobileSearchOpen(true);
                  }}
                  className="absolute right-2 text-gray-400 hover:text-gray-600"
                >
                  <i className="fas fa-times" />
                </button>
              )}
            </div>
          </form>
          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="More options"
          >
            <i className="fas fa-ellipsis-v text-gray-800" />
          </button>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-2.5 pt-2 lg:pt-6 pb-6">
        {query.trim().length === 0 ? (
          <div className="text-gray-500 text-sm">
            Use the search bar in the header to find restaurants and foods.
          </div>
        ) : isFetching && results.length === 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="mt-2 h-3 bg-gray-200 rounded w-1/2" />
                  <div className="mt-3 flex gap-2">
                    <div className="h-4 bg-gray-200 rounded w-16" />
                    <div className="h-4 bg-gray-200 rounded w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="text-gray-500 text-sm">No matching merchants found.</div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {results.map(merchant => (
              <LocationMerchantCard
                key={merchant.id}
                merchant={merchant}
                variant="list"
                isWishlisted={wishlistIds.has(String(merchant.id))}
                onToggleWishlist={toggleWishlist}
              />
            ))}
          </div>
        )}
      </div>
      <SearchModal
        isOpen={isMobileSearchOpen}
        onClose={() => setIsMobileSearchOpen(false)}
        initialQuery={modalInitialQuery}
      />
    </div>
  );
}
