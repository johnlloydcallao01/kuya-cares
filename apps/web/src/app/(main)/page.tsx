"use client";

import React, { Suspense, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { LocationBasedMerchants } from "@/components/sections/LocationBasedMerchants";
import { LocationBasedProductCategoriesCarousel } from "@/components/carousels/LocationBasedProductCategoriesCarousel";
import { getCurrentCustomerId } from "@encreasl/client-services";

// Below-fold marketplace grid (§docs/performance.md §4b item 3 — code-split
// the heavy 850-line pool + portal filter drawer + cart context out of the
// first-paint bundle; merchants + categories stay eager above the fold).
const HomeMarketplaceProducts = dynamic(
  () =>
    import("@/components/sections/HomeMarketplaceProducts").then(
      (m) => m.HomeMarketplaceProducts,
    ),
  {
    loading: () => (
      <section className="bg-white mt-2 border-y border-gray-200">
        <div className="w-full px-2.5 py-4">
          <div className="h-5 w-44 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200" />
                <div className="p-3 space-y-2">
                  <div className="h-3.5 bg-gray-200 rounded w-full" />
                  <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    ),
  },
);

/**
 * Home page — Lazada/Shopee-style storefront.
 *
 * Performance (§docs/performance.md §14 + §24):
 * - Suspense wrapper: useSearchParams suspends on prerender; without a
 *   boundary Next deopts the whole route to client rendering. The fallback
 *   is an inline-style shell (never blank/null).
 * - Identity resolved once here and passed down (single-resolution);
 *   sections wait on `undefined`, never re-resolve.
 * - Features: URL-based category filtering (?category=slug).
 */
export default function Home() {
  return (
    <Suspense fallback={<HomeShell />}>
      <HomeContent />
    </Suspense>
  );
}

/** First-paint shell (§14): never serve blank — static banner + skeletons. */
function HomeShell() {
  return (
    <div className="min-h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
      <div className="bg-white border-b border-gray-200">
        <div className="px-2.5 py-3">
          <div
            className="relative overflow-hidden rounded-xl text-white"
            style={{ backgroundImage: 'linear-gradient(135deg, #239459 0%, #215035 100%)' }}
          >
            <div className="relative px-5 py-6 sm:px-8 sm:py-10">
              <p className="text-[0.65rem] sm:text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 mb-2">
                Multi-Vendor Marketplace
              </p>
              <h1 className="text-xl sm:text-3xl font-bold leading-tight mb-2 max-w-xl">
                Shop from hundreds of trusted local merchants.
              </h1>
              <p className="text-sm sm:text-base text-emerald-50/90 max-w-xl mb-0">
                Electronics, fashion, home essentials and more &mdash; all in one place.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white border-b border-gray-200">
        <div className="overflow-hidden px-2.5">
          <div className="flex gap-12 py-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-shrink-0">
                <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse" />
                <div className="w-12 h-3 bg-gray-200 rounded mt-2 mx-auto animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <section className="py-4 bg-white">
        <div className="w-full px-2.5">
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="hidden min-[1025px]:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[2/1] bg-gray-200 rounded-lg mb-3" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  // Tri-state (§24 single resolution): undefined = still resolving (sections
  // wait, no fetch), string|null = resolved identity.
  const [customerId, setCustomerId] = useState<string | null | undefined>(undefined);

  // Read category filter from URL on mount and when URL changes
  useEffect(() => {
    const categorySlug = searchParams.get('category');
    setSelectedCategorySlug(categorySlug);
  }, [searchParams]);

  // Resolve customer once for location-based sections (tap2go parity).
  useEffect(() => {
    let active = true;
    getCurrentCustomerId()
      .catch(() => null)
      .then((cid) => {
        if (active) setCustomerId(cid ?? null);
      });
    return () => { active = false; };
  }, []);

  // Handle category selection from carousel
  const handleCategorySelect = (categoryId: string | null, categorySlug: string | null, categoryName?: string) => {
    // Toggle logic: if the same category is clicked, deactivate it
    if (categorySlug && categorySlug === selectedCategorySlug) {
      // Remove category filter (show all)
      router.push('/', { scroll: false });
      return;
    }

    // Update URL with category slug
    if (categorySlug) {
      router.push(`/?category=${categorySlug}`, { scroll: false });
    } else {
      // Remove category filter (show all)
      router.push('/', { scroll: false });
    }
  };

  // Handle category slug to ID conversion from carousel
  const handleCategoryIdResolved = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
      {/* Campaign Banner - displayed above category carousel, preserves 1400x500 resolution */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-2.5 py-3">
          {/* Professional Market Introduction Banner - pure CSS gradient, not image-based */}
          <div
            className="relative overflow-hidden rounded-xl text-white"
            style={{ backgroundImage: 'linear-gradient(135deg, #239459 0%, #215035 100%)' }}
          >
            {/* Decorative soft circles */}
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10"></div>
            <div className="absolute -bottom-24 -right-36 w-80 h-80 rounded-full bg-white/10"></div>
            <div className="absolute right-48 -bottom-20 w-44 h-44 rounded-full bg-white/10"></div>
            <div className="absolute top-6 left-1/3 w-16 h-16 rounded-full bg-white/5"></div>

            <div className="relative px-5 py-6 sm:px-8 sm:py-10">
              <p className="text-[0.65rem] sm:text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 mb-2">
                Multi-Vendor Marketplace
              </p>
              <h1 className="text-xl sm:text-3xl font-bold leading-tight mb-2 max-w-xl">
                Shop from hundreds of trusted local merchants.
              </h1>
              <p className="text-sm sm:text-base text-emerald-50/90 max-w-xl mb-0">
                Electronics, fashion, home essentials and more &mdash; all in one place.
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Product Categories Carousel - 100% CSR */}
      <div id="categories-section" className="bg-white border-b border-gray-200">
        <LocationBasedProductCategoriesCarousel
          limit={12}
          sortBy="popularity"
          selectedCategorySlug={selectedCategorySlug}
          onCategorySelect={handleCategorySelect}
          onCategoryIdResolved={handleCategoryIdResolved}
          customerId={customerId}
        />
      </div>

      {/* Merchants Section */}
      <div id="merchants-section">
        <LocationBasedMerchants
          limit={50}
          categoryId={selectedCategoryId}
          customerId={customerId}
        />
      </div>

      {/* Marketplace Products Section (independent — never narrowed by the merchant-category filter) */}
      <div id="products-section">
        <HomeMarketplaceProducts
          limit={48}
          customerId={customerId}
        />
      </div>
    </div>
  );
}
