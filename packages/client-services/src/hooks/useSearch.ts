import { useQuery } from '@tanstack/react-query';
import { SearchService } from '../services/search-service';

export const SEARCH_KEYS = {
  all: ['search'] as const,
  recent: (userId: string) => [...SEARCH_KEYS.all, 'recent', userId] as const,
  suggestions: (query: string) => [...SEARCH_KEYS.all, 'suggestions', query] as const,
  merchantsByProduct: (query: string) => [...SEARCH_KEYS.all, 'merchants-by-product', query] as const,
};

/**
 * Hook to fetch recent searches for a user
 */
export function useRecentSearches(userId: string | null | undefined) {
  return useQuery({
    queryKey: SEARCH_KEYS.recent(userId || ''),
    queryFn: () => userId ? SearchService.getRecentSearches(userId) : Promise.resolve([]),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get product suggestions based on query
 * Note: Debouncing should be handled by the consumer of this hook
 */
export function useProductSuggestions(query: string) {
  const q = query?.trim() || '';
  return useQuery({
    queryKey: SEARCH_KEYS.suggestions(q),
    queryFn: () => SearchService.getProductSuggestions(q),
    enabled: q.length > 0,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to find merchant IDs that have products matching the query
 * Note: Debouncing should be handled by the consumer of this hook
 */
export function useMerchantsByProductSearch(query: string) {
  const q = query?.trim() || '';
  return useQuery({
    queryKey: SEARCH_KEYS.merchantsByProduct(q),
    queryFn: () => SearchService.getMerchantIdsByProductSearch(q),
    enabled: q.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
