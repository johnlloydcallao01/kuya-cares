import { apiConfig } from '../config/environment';
import { GroupedProductItem, Product, ModifierGroup, ProductVariation } from '../types/product';

const API_BASE = apiConfig.baseUrl;
const API_KEY = apiConfig.payloadApiKey;

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) {
    headers["Authorization"] = `users API-Key ${API_KEY}`;
  }
  return headers;
}

function getRelationId(value: unknown): string | number | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return (value as { id: string | number }).id;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return undefined;
}

function mapMedia(media: any) {
  if (!media) return undefined;
  return {
    id: media.id,
    url: media.url,
    cloudinaryURL: media.cloudinaryURL,
    thumbnailURL: media.thumbnailURL,
    alt: media.alt,
  };
}

function mapEffectiveModifierGroups(rawGroups: any[] = []): ModifierGroup[] {
  return rawGroups.map((group) => ({
    id: String(group.id),
    name: group.name,
    selection_type: group.selectionType === 'multiple' ? 'multiple' : 'single',
    is_required: Boolean(group.isRequired),
    min_selections: typeof group.minSelections === 'number' ? group.minSelections : 0,
    max_selections: typeof group.maxSelections === 'number' ? group.maxSelections : undefined,
    sort_order: typeof group.sortOrder === 'number' ? group.sortOrder : 0,
    source: group.source,
    product_id: String(group.baseGroupId ?? group.id),
    options: (group.options || []).map((option: any) => ({
      id: String(option.id),
      name: option.name,
      price_adjustment: typeof option.priceAdjustment === 'number' ? option.priceAdjustment : 0,
      is_default: Boolean(option.isDefault),
      is_available: option.isAvailable !== false,
      sort_order: typeof option.sortOrder === 'number' ? option.sortOrder : 0,
      source: option.source,
      modifier_group_id: String(group.id),
    })),
  }));
}

export async function fetchEffectiveModifierGroups(
  productId: string | number,
  variationId?: string | number | null,
  merchantId?: string | number | null,
): Promise<ModifierGroup[]> {
  const headers = buildHeaders();
  const query = new URLSearchParams({
    productId: String(productId),
  });

  if (variationId !== null && variationId !== undefined && variationId !== '') {
    query.set('variationId', String(variationId));
  }

  if (merchantId !== null && merchantId !== undefined && merchantId !== '') {
    query.set('merchantId', String(merchantId));
  }

  const response = await fetch(`${API_BASE}/effective-modifiers?${query.toString()}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to load effective modifiers (${response.status})`);
  }

  const data = await response.json();
  return mapEffectiveModifierGroups(data?.data?.groups || []);
}

export async function fetchProductWithMerchantContext(productId: string, merchantId: string | number): Promise<Product | null> {
  const headers = buildHeaders();

  try {
    // 1. Fetch Merchant Product by querying with product_id and merchant_id
    // This mirrors apps/web logic which finds the link between merchant and product
    const mpRes = await fetch(
      `${API_BASE}/merchant-products?where[product_id][equals]=${productId}&where[merchant_id][equals]=${merchantId}&depth=2&limit=1`, 
      { headers }
    );

    if (!mpRes.ok) {
      console.error('Failed to load merchant product:', mpRes.status);
      return null;
    }

    const mpData = await mpRes.json();
    const merchantProduct = mpData.docs && mpData.docs.length > 0 ? mpData.docs[0] : null;

    if (!merchantProduct) {
      console.error('Merchant product not found for this merchant');
      // Optionally fallback to fetching product directly if strictly needed, 
      // but for a merchant app, we generally want the merchant context.
      return null;
    }

    const productData = merchantProduct.product_id;

    if (!productData || typeof productData !== 'object') {
      console.error('Product data missing or not populated');
      return null;
    }

    const merchantPriceOverride =
      typeof merchantProduct.price_override === 'number' ? merchantProduct.price_override : null;

    // Use merchant product overrides
    const finalProduct: Product = {
      ...productData,
      id: productData.id, // Ensure we keep original product ID for fetching modifiers
      merchantProductId: merchantProduct.id, // Add merchantProductId reference for cart/wishlist
      name: productData.name,
      basePrice:
        merchantPriceOverride ??
        (typeof productData.basePrice === 'number' ? productData.basePrice : 0),
      compareAtPrice:
        typeof productData.compareAtPrice === 'number' ? productData.compareAtPrice : undefined,
      isAvailable: merchantProduct.is_available ?? productData.isAvailable ?? true,
      merchant: merchantProduct.merchant_id, // Pass the merchant details
    };

    let modifierGroups: ModifierGroup[] = [];

    // 2. Fetch Variations if Product is Variable
    let variations: ProductVariation[] = [];
    let defaultVariationId: string | number | undefined;
    if (finalProduct.productType === 'variable') {
      const variationsRes = await fetch(`${API_BASE}/prod-variations?where[product_id][equals]=${productData.id}&where[is_visible][equals]=true&limit=100&sort=sort_order&depth=1`, {
        headers,
      });

      if (variationsRes.ok) {
        const varData = await variationsRes.json();
        const rawVariations = varData.docs || [];
        const variationIds = rawVariations
          .map((v: any) => getRelationId(v?.id))
          .filter((id: string | number | undefined): id is string | number => id !== undefined);

        let variationValueMap = new Map<string, ProductVariation['attributeItems']>();

        if (variationIds.length > 0) {
          const valuesRes = await fetch(
            `${API_BASE}/prod-variation-values?where[variation_id][in]=${variationIds.join(',')}&limit=500&depth=2`,
            { headers }
          );

          if (valuesRes.ok) {
            const valuesData = await valuesRes.json();
            variationValueMap = (valuesData.docs || []).reduce(
              (map: Map<string, ProductVariation['attributeItems']>, item: any) => {
                const variationKey = String(getRelationId(item?.variation_id));
                const attribute = item?.attribute_id;
                const term = item?.term_id;

                if (!variationKey || !attribute || !term) {
                  return map;
                }

                const existing = map.get(variationKey) || [];
                existing.push({
                  attributeId: getRelationId(attribute),
                  attributeName: attribute?.name || 'Option',
                  attributeSlug: attribute?.slug,
                  attributeType: attribute?.type,
                  termId: getRelationId(term),
                  termName: term?.name || '',
                  termSlug: term?.slug,
                  termValue: term?.value,
                });
                map.set(variationKey, existing);
                return map;
              },
              new Map<string, ProductVariation['attributeItems']>()
            );
          }
        }

        variations = rawVariations.map((v: any) => {
          const image = v.image;
          const attributeItems = variationValueMap.get(String(v.id)) || [];
          return {
            id: v.id,
            name: v.name || attributeItems.map((item) => item.termName).filter(Boolean).join(' / ') || productData.name,
            sku: v.sku,
            base_price: v.base_price || 0,
            compare_at_price: v.compare_at_price,
            stock_quantity: v.stock_quantity,
            short_description: v.short_description || undefined,
            image: mapMedia(image),
            attributeItems,
            attributes: attributeItems.reduce<Record<string, string>>((acc, item) => {
              if (item.attributeName && item.termName) {
                acc[item.attributeName] = item.termName;
              }
              return acc;
            }, {}),
          };
        });

        const firstInStockVariation = variations.find((variation) => (variation.stock_quantity ?? 0) > 0);
        defaultVariationId = firstInStockVariation?.id ?? variations[0]?.id;

        const defaultVariation = variations.find((variation) => String(variation.id) === String(defaultVariationId));
        if (defaultVariation) {
          // Merchant price override takes precedence, matching the simple-product
          // path above so variable products honor the same override.
          finalProduct.basePrice = merchantPriceOverride ?? defaultVariation.base_price ?? finalProduct.basePrice ?? 0;
          finalProduct.compareAtPrice = defaultVariation.compare_at_price ?? finalProduct.compareAtPrice;
          finalProduct.shortDescription = defaultVariation.short_description || finalProduct.shortDescription;
          if (defaultVariation.image) {
            finalProduct.media = {
              ...finalProduct.media,
              primaryImage: defaultVariation.image,
            };
          }
        }
      }
    }

    // 3. Fetch effective modifiers using the default variation for variable products
    try {
      modifierGroups = await fetchEffectiveModifierGroups(productData.id, defaultVariationId ?? null, merchantId);
    } catch (modifierError) {
      console.error('Failed to load effective modifiers:', modifierError);
      modifierGroups = [];
    }

    // 4. Fetch grouped child items if Product is Grouped
    let groupedItems: GroupedProductItem[] = [];
    if (finalProduct.productType === 'grouped') {
      const groupedRes = await fetch(
        `${API_BASE}/prod-grouped-items?where[parent_product_id][equals]=${productData.id}&limit=100&sort=sort_order&depth=2`,
        { headers }
      );

      if (groupedRes.ok) {
        const groupedData = await groupedRes.json();
        const rawGroupedItems = groupedData.docs || [];
        const childIds = rawGroupedItems
          .map((item: any) => getRelationId(item?.child_product_id))
          .filter((id: string | number | undefined): id is string | number => id !== undefined);

        const uniqueChildIds = Array.from(new Set(childIds.map(String)));

        let merchantProductMap = new Map<string, any>();
        if (uniqueChildIds.length > 0) {
          const childMerchantProductsRes = await fetch(
            `${API_BASE}/merchant-products?where[merchant_id][equals]=${merchantId}&where[product_id][in]=${uniqueChildIds.join(',')}&limit=200&depth=2`,
            { headers }
          );

          if (childMerchantProductsRes.ok) {
            const childMerchantProductsData = await childMerchantProductsRes.json();
            merchantProductMap = (childMerchantProductsData.docs || []).reduce((map: Map<string, any>, doc: any) => {
              const childId = getRelationId(doc?.product_id);
              if (childId !== undefined) {
                map.set(String(childId), doc);
              }
              return map;
            }, new Map<string, any>());
          }
        }

        const requiredModifierProductIds = new Set<string>();
        if (uniqueChildIds.length > 0) {
          const modifierGroupsRes = await fetch(
            `${API_BASE}/modifier-groups?where[product_id][in]=${uniqueChildIds.join(',')}&where[or][0][is_required][equals]=true&where[or][1][min_selections][greater_than]=0&limit=500&depth=0`,
            { headers }
          );

          if (modifierGroupsRes.ok) {
            const modifierGroupsData = await modifierGroupsRes.json();
            (modifierGroupsData.docs || []).forEach((group: any) => {
              const childId = getRelationId(group?.product_id);
              if (childId !== undefined) {
                requiredModifierProductIds.add(String(childId));
              }
            });
          }
        }

        groupedItems = rawGroupedItems
          .map((item: any) => {
            const childProduct = item?.child_product_id;
            if (!childProduct || typeof childProduct !== 'object') {
              return null;
            }

            const childProductId = getRelationId(childProduct?.id);
            if (childProductId === undefined) {
              return null;
            }

            const childMerchantProduct = merchantProductMap.get(String(childProductId));
            const priceOverride =
              typeof childMerchantProduct?.price_override === 'number' ? childMerchantProduct.price_override : null;

            return {
              id: item.id,
              productId: childProductId,
              merchantProductId: childMerchantProduct?.id,
              name: childProduct.name || '',
              productType: childProduct.productType || 'simple',
              shortDescription: childProduct.shortDescription || undefined,
              basePrice: priceOverride ?? childProduct.basePrice ?? 0,
              compareAtPrice: childProduct.compareAtPrice ?? undefined,
              image: mapMedia(childProduct?.media?.primaryImage),
              defaultQuantity: typeof item.default_quantity === 'number' && item.default_quantity > 0 ? item.default_quantity : 1,
              sortOrder: item.sort_order ?? 0,
              isAvailable: childMerchantProduct?.is_available ?? true,
              hasRequiredModifiers: requiredModifierProductIds.has(String(childProductId)),
            } satisfies GroupedProductItem;
          })
          .filter((item: GroupedProductItem | null): item is GroupedProductItem => item !== null);

        if (groupedItems.length > 0) {
          finalProduct.basePrice = groupedItems.reduce(
            (sum, item) => sum + (item.basePrice || 0) * (item.defaultQuantity || 1),
            0
          );
        }
      }
    }

    return {
      ...finalProduct,
      modifierGroups,
      variations: variations.length > 0 ? variations : undefined,
      groupedItems: groupedItems.length > 0 ? groupedItems : undefined,
      defaultVariationId,
    };
  } catch (error) {
    console.error('Error fetching merchant product details:', error);
    return null;
  }
}
