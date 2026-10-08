export type SearchCategory = 'merchants' | 'products' | 'orders';

export interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: SearchCategory;
  href: string;
  thumbnail?: string;
}

export interface SearchSuggestion {
  id: string;
  label: string;
  subtitle?: string;
  type: SearchCategory;
  href: string;
  thumbnail?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  query: string;
}

export interface SuggestionsResponse {
  suggestions: SearchSuggestion[];
  query: string;
}

export const SEARCH_CATEGORY_LABELS: Record<SearchCategory, string> = {
  merchants: 'Merchants',
  products: 'Products',
  orders: 'Orders',
};

export const SEARCH_CATEGORY_COLORS: Record<SearchCategory, string> = {
  merchants: 'bg-blue-100 text-blue-800',
  products: 'bg-green-100 text-green-800',
  orders: 'bg-purple-100 text-purple-800',
};
