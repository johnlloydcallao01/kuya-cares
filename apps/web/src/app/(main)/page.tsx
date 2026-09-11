"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "@/components/ui/ImageWrapper";
import { LocationBasedMerchants } from "@/components/sections/LocationBasedMerchants";
import { LocationBasedProductCategoriesCarousel } from "@/components/carousels/LocationBasedProductCategoriesCarousel";
import { getCurrentCustomerId } from "@encreasl/client-services";

/**
 * Home page component - 100% CSR (Client-Side Rendering)
 * 
 * Location Based Product Categories: 100% CSR (Client-Side Rendering)
 * Location Based Merchants: 100% CSR (Client-Side Rendering)
 * 
 * Features:
 * - URL-based category filtering (?categoryId=burger)
 * - Default view shows all merchants (no filter)
 * - Category clicks update URL and filter merchants
 */
export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // Read category filter from URL on mount and when URL changes
  useEffect(() => {
    const categorySlug = searchParams.get('category');
    setSelectedCategorySlug(categorySlug);
  }, [searchParams]);

  // Resolve customer ID once at the page level to ensure consistency across sections
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const currentCustomerId = await getCurrentCustomerId();
        if (!mounted) return;
        setCustomerId(currentCustomerId);
      } catch (err) {
        // Resolution errors are handled by child components if customerId is undefined
        console.error('Home: Failed to resolve customer ID', err);
        if (!mounted) return;
        setCustomerId(null);
      }
    })();
    return () => { mounted = false; };
  }, []);

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
          <Image
            src="/tap2go-first-campaign (1).png"
            alt="Tap2Go First Campaign"
            width={1400}
            height={500}
            sizes="100vw"
            priority
            className="w-full h-auto rounded-xl"
          />
        </div>
      </div>
      {/* Location Based Product Categories Carousel - 100% CSR */}
      <div className="bg-white border-b border-gray-200">
        <LocationBasedProductCategoriesCarousel 
          customerId={customerId ?? undefined} 
          limit={12} 
          sortBy="popularity"
          selectedCategorySlug={selectedCategorySlug}
          onCategorySelect={handleCategorySelect}
          onCategoryIdResolved={handleCategoryIdResolved}
        />
      </div>

      {/* Location Based Merchants Section */}
      <LocationBasedMerchants 
        customerId={customerId ?? undefined} 
        limit={8}
        categoryId={selectedCategoryId}
      />
    </div>
  );
}
