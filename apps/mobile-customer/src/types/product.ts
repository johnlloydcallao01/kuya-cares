export interface ProductMedia {
  id: string;
  url?: string;
  cloudinaryURL?: string;
  thumbnailURL?: string;
  alt?: string;
}

export interface ModifierOption {
  id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
  source?:
    | 'product-base'
    | 'variation-added'
    | 'variation-overridden'
    | 'merchant-product-overridden'
    | 'merchant-variation-overridden';
  modifier_group_id: string | ModifierGroup;
}

export interface ModifierGroup {
  id: string;
  name: string;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  min_selections: number;
  max_selections?: number;
  sort_order: number;
  source?:
    | 'product-base'
    | 'variation-added'
    | 'variation-overridden'
    | 'merchant-product-overridden'
    | 'merchant-variation-overridden';
  product_id: string;
  options?: ModifierOption[]; // Enriched field
}

export interface ProductVariation {
  id: string | number;
  name: string;
  sku?: string;
  base_price: number;
  compare_at_price?: number;
  stock_quantity?: number;
  image?: ProductMedia;
  short_description?: string;
  attributes?: Record<string, string>;
  attributeItems?: {
    attributeId?: string | number;
    attributeName: string;
    attributeSlug?: string;
    attributeType?: 'select' | 'color' | 'button' | 'radio' | string;
    termId?: string | number;
    termName: string;
    termSlug?: string;
    termValue?: string;
  }[];
}

export interface GroupedProductItem {
  id: string | number;
  productId: string | number;
  merchantProductId?: string | number;
  name: string;
  productType: 'simple' | 'variable' | 'grouped';
  shortDescription?: string;
  basePrice: number;
  compareAtPrice?: number;
  image?: ProductMedia;
  defaultQuantity: number;
  sortOrder?: number;
  isAvailable?: boolean;
  hasRequiredModifiers?: boolean;
}

export interface Product {
  id: string;
  merchantProductId?: string; // Added from fetch logic
  name: string;
  slug: string;
  description?: any; // Rich Text or HTML
  shortDescription?: string;
  basePrice: number;
  compareAtPrice?: number;
  productType: 'simple' | 'variable' | 'grouped';
  sku?: string;
  media?: {
    primaryImage?: ProductMedia;
    images?: { image: ProductMedia }[];
  };
  modifierGroups?: ModifierGroup[]; // Enriched field
  variations?: ProductVariation[]; // Enriched field for variable products
  groupedItems?: GroupedProductItem[]; // Enriched field for grouped products
  defaultVariationId?: string | number;
  isAvailable?: boolean; // Added from fetch logic
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  merchant?: {
    id: string;
    name: string;
    outletName?: string;
  };
}
