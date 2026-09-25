export interface ModifierOption {
  id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
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
  product_id: string;
  options?: ModifierOption[]; // Enriched field
}

export interface ProductMedia {
  id: string;
  url?: string;
  cloudinaryURL?: string;
  thumbnailURL?: string;
  alt?: string;
}

export interface AttributeItem {
  attributeId: string | number | undefined;
  attributeName: string;
  attributeSlug?: string;
  attributeType?: string;
  termId: string | number | undefined;
  termName: string;
  termSlug?: string;
  termValue?: string;
}

export interface ProductVariation {
  id: string | number;
  name: string;
  sku?: string;
  base_price: number;
  compare_at_price?: number | null;
  stock_quantity?: number;
  short_description?: string;
  image?: ProductMedia | null;
  attributeItems: AttributeItem[];
  attributes: Record<string, string>;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: any;
  shortDescription?: string;
  basePrice: number;
  compareAtPrice?: number;
  productType: 'simple' | 'variable' | 'grouped';
  sku?: string;
  merchantProductId?: number;
  isAvailable?: boolean;
  media?: {
    primaryImage?: ProductMedia;
    images?: { image: ProductMedia }[];
  };
  modifierGroups?: ModifierGroup[]; // Enriched field
  variations?: ProductVariation[];
  defaultVariationId?: string | number;
}
