'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type ProductCategoryDoc = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parentCategory: { id: number; name: string; slug: string; categoryPath: string | null } | null;
  categoryLevel: number | null;
  categoryPath: string | null;
  displayOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  media: {
    icon: { id: number; url: string | null } | null;
    bannerImage: { id: number; url: string | null } | null;
    thumbnailImage: { id: number; url: string | null } | null;
  };
  attributes: {
    categoryType: string | null;
    dietaryTags: unknown;
    ageRestriction: string | null;
    requiresPrescription: boolean | null;
  };
  seo: { metaTitle: string | null; metaDescription: string | null; keywords: unknown; canonicalUrl: string | null };
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductCategoryPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type ProductCategoryStats = {
  total: number;
  activeCount: number;
  featuredCount: number;
  inactiveCount: number;
  topLevelCount: number;
  filteredCount: number;
  levelBreakdown: Record<string, number>;
  categoryTypeBreakdown: Record<string, number>;
};

export type ProductCategoriesResponse = {
  docs: ProductCategoryDoc[];
  pagination: ProductCategoryPagination | null;
  stats: ProductCategoryStats | null;
};

async function fetchProductCategories(qs: string, signal?: AbortSignal): Promise<ProductCategoriesResponse> {
  const res = await fetch(`/api/product-categories?${qs}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load product categories');
    } catch {
      throw new Error(text || 'Failed to load product categories');
    }
  }
  return res.json() as Promise<ProductCategoriesResponse>;
}

/**
 * Product categories list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useProductCategories(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminProductCategories(qs),
    queryFn: ({ signal }) => fetchProductCategories(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}