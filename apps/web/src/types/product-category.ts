/**
 * Product Category types for the web application
 * Based on the CMS ProductCategory collection
 */

export interface ProductCategory {
  id: number | string;
  /**
   * Category name (e.g., "Main Dishes", "Beverages", "Desserts")
   */
  name: string;
  /**
   * URL-friendly version of the name (auto-generated if empty)
   */
  slug: string;
  /**
   * Category description for customers
   */
  description?: string | null;
  /**
   * Parent category (leave empty for top-level categories)
   */
  parentCategory?: ProductCategory | null;
  /**
   * Hierarchy level (1 = top level, 2 = subcategory, etc.)
   */
  categoryLevel?: number;
  /**
   * Materialized path for efficient queries (auto-generated)
   */
  categoryPath?: string | null;
  /**
   * Order for displaying categories (lower numbers appear first)
   */
  displayOrder?: number;
  /**
   * Whether the category is currently active
   */
  isActive?: boolean;
  /**
   * Whether to feature this category prominently
   */
  isFeatured?: boolean;
  /**
   * Visual elements for the category
   */
  media?: {
    /**
     * Category icon (SVG preferred)
     */
    icon?: {
      id: number | string;
      url: string;
      cloudinaryURL?: string;
      alt?: string;
    } | null;
    /**
     * Banner image for category pages
     */
    bannerImage?: {
      id: number | string;
      url: string;
      cloudinaryURL?: string;
      alt?: string;
    } | null;
    /**
     * Thumbnail for category listings
     */
    thumbnailImage?: {
      id: number | string;
      url: string;
      cloudinaryURL?: string;
      alt?: string;
    } | null;
  } | null;
  /**
   * Category-specific attributes and restrictions
   */
  attributes?: {
    categoryType?: 'food' | 'beverage' | 'dessert' | 'snack' | 'combo' | 'other';
    dietaryTags?: string[] | null;
    ageRestriction?: 'none' | '18_plus' | '21_plus';
    requiresPrescription?: boolean;
  } | null;
  /**
    * SEO optimization settings
    */
  seo?: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    keywords?: string[] | null;
    canonicalUrl?: string | null;
  } | null;
  updatedAt: string;
  createdAt: string;
}

/**
 * Simplified ProductCategory interface for basic usage
 */
export interface ProductCategoryBasic {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  isActive?: boolean;
  media?: {
    icon?: {
      id: number;
      url: string;
      cloudinaryURL?: string;
      alt?: string;
    } | null;
  } | null;
}
