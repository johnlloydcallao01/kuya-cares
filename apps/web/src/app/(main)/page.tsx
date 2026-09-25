"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LocationBasedMerchants } from "@/components/sections/LocationBasedMerchants";
import { LocationBasedProductCategoriesCarousel } from "@/components/carousels/LocationBasedProductCategoriesCarousel";

/**
 * Home page component - 100% CSR (Client-Side Rendering)
 * 
 * Lazada/Shopee-style: merchants are displayed directly with no address
 * or location requirement and no complex location-based endpoint.
 * 
 * Features:
 * - URL-based category filtering (?category=slug)
 * - Default view shows all merchants (no filter)
 * - Category clicks update URL and filter merchants
 */
export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Read category filter from URL on mount and when URL changes
  useEffect(() => {
    const categorySlug = searchParams.get('category');
    setSelectedCategorySlug(categorySlug);
  }, [searchParams]);

  // Handle category selection from carousel
  const handleCategorySelect = (categoryId: string | null, categorySlug: string | null, categoryName?: string) => {
    console.log('🏷️ Category selected:', { categoryId, categorySlug, categoryName });
    
    // Toggle logic: if the same category is clicked, deactivate it
    if (categorySlug && categorySlug === selectedCategorySlug) {
      console.log('🔄 Toggling off active category:', categorySlug);
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
        />
      </div>

      {/* Merchants Section */}
      <div id="merchants-section">
        <LocationBasedMerchants 
          limit={50}
          categoryId={selectedCategoryId}
        />
      </div>
    </div>
  );
}
