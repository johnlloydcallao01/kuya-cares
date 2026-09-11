"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentCustomerId,
  getLocationBasedMerchants,
  getActiveAddressNamesForMerchants,
  sortMerchantsByRecentlyUpdated,
  type LocationBasedMerchant,
} from "@encreasl/client-services";
import {
  getWishlistMerchantIdsForCurrentUser,
  addMerchantToWishlist,
  removeMerchantFromWishlist,
} from "@/lib/client-services/wishlist-service";
import LocationMerchantCard from "@/components/cards/LocationMerchantCard";
import { toast } from "react-hot-toast";

export default function NewlyUpdatedPage(): React.ReactNode {
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [merchants, setMerchants] = useState<LocationBasedMerchant[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [addressMap, setAddressMap] = useState<Record<string, string>>({});
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  // Always use the production CMS API for address lookups
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://cms.tap2goph.com/api";

  const fetchAndSetActiveAddresses = useCallback(
    async (list: LocationBasedMerchant[]) => {
      if (!list || list.length === 0) return;
      const map = await getActiveAddressNamesForMerchants(list);
      let changed = false;
      const next: Record<string, string> = { ...addressMap };
      for (const id of Object.keys(map)) {
        const name = map[id];
        if (name && (!next[id] || next[id] !== name)) {
          next[id] = name as string;
          changed = true;
        }
      }
      if (changed) setAddressMap(next);
    },
    [addressMap]
  );

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

  // Resolve customer ID and fetch merchants, then sort by updated time (desc)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const id = await getCurrentCustomerId();
        if (!mounted) return;
        setCustomerId(id);
        if (!id) {
          setError("No customer session found");
          setIsLoading(false);
          return;
        }
        setError(null);
        setIsLoading(true);
        const data = await getLocationBasedMerchants({ customerId: id, limit: 50 });
        if (!mounted) return;
        // Sort by updatedAt/createdAt desc to represent "Newly Updated"
        const getUpdatedTimeMs = (m: LocationBasedMerchant): number => {
          const primary = (m as any).updatedAt || (m as any).createdAt || "";
          const t = Date.parse(primary);
          return Number.isFinite(t) ? t : 0;
        };
        const sorted = sortMerchantsByRecentlyUpdated(data || []);
        setMerchants(sorted);
        // Fetch active address names in background
        fetchAndSetActiveAddresses(sorted || []);
        setIsLoading(false);
      } catch (err) {
        console.error("NewlyUpdated: Failed to resolve customer ID", err);
        if (!mounted) return;
        setCustomerId(null);
        setError("Failed to load newly updated merchants");
        setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchAndSetActiveAddresses]);

  return (
    <div className="min-h-screen bg-gray-50" style={{ backgroundColor: "#f9fafb" }}>
      {/* Mobile-only header for Newly Updated page (match global header 56px) */}
      <div className="lg:hidden sticky top-0 z-30 bg-white shadow-sm">
        <div className="h-14 px-2.5 flex items-center gap-2">
          <button
            type="button"
            aria-label="Go back"
            onClick={() => router.back()}
            className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-white text-[#333] shadow-md border border-gray-200"
          >
            <i className="fas fa-arrow-left leading-none text-[0.9rem]"></i>
          </button>
          <h1 className="text-base font-normal text-gray-900">Newly Updated</h1>
        </div>
      </div>

      <section className="py-4 bg-white">
        <div className="w-full px-2.5">
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="animate-pulse">
                  <div className="relative aspect-[2/1] bg-gray-200 rounded-lg overflow-hidden mb-3" />
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="text-center py-12">
              <div className="text-red-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to load newly updated merchants</h3>
              <p className="text-gray-600">{error}</p>
            </div>
          )}

          {!isLoading && !error && merchants.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No newly updated merchants found</h3>
              <p className="text-gray-600">Try checking back later.</p>
            </div>
          )}

          {!isLoading && !error && merchants.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {merchants.map((m) => (
                <LocationMerchantCard
                  key={m.id}
                  merchant={m}
                  addressName={addressMap[m.id] || null}
                  isWishlisted={wishlistIds.has(String(m.id))}
                  onToggleWishlist={toggleWishlist}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// Using shared LocationMerchantCard for DRY consistency.
