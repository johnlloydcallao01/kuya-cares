import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
  ScrollView,
  useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../contexts/ThemeContext';
import { useProduct } from '../hooks/useProduct';
import { useCart } from '../contexts/CartContext';
import ProductModifiers from '../components/ProductModifiers';
import ViewCartBar from '../components/shared/ViewCartBar';
import { formatCurrency } from '../utils/format';
import { PullToRefreshLayout } from '../components/PullToRefreshLayout';
import { useQueryClient } from '@tanstack/react-query';
import { dataCache } from '@encreasl/client-services';

import { useNavigation } from '../navigation/NavigationContext';
import { useLocalSearchParams } from 'expo-router';
import { fetchEffectiveModifierGroups } from '../services/product';
import type { GroupedProductItem, ModifierGroup } from '../types/product';

const PAYMONGO_MINIMUM_AMOUNT_PHP = 1;

function buildDefaultModifierSelection(modifierGroups: ModifierGroup[]): Record<string, string[]> {
  return modifierGroups.reduce<Record<string, string[]>>((acc, group) => {
    const defaultOptions = (group.options || []).filter((option) => option.is_default);

    if (defaultOptions.length === 0) {
      return acc;
    }

    if (group.selection_type === 'single') {
      acc[group.id] = [defaultOptions[0].id];
      return acc;
    }

    acc[group.id] = defaultOptions.map((option) => option.id);
    return acc;
  }, {});
}

function getGroupedItemKey(item: GroupedProductItem): string {
  if (item.merchantProductId != null) {
    return `merchant-${String(item.merchantProductId)}`;
  }

  return `product-${String(item.productId)}`;
}

function canStageGroupedItem(item: GroupedProductItem): boolean {
  return Boolean(
    item.isAvailable &&
    item.merchantProductId != null &&
    item.productType === 'simple' &&
    !item.hasRequiredModifiers
  );
}

export default function ProductScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const productId = typeof params.id === 'string' ? params.id : params.productId as string;
  const merchantId = params.merchantId as string;
  
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  const { data: product, isLoading, isRefetching, error } = useProduct(productId, merchantId);
  const { addToCart, items: cartItems, getMerchantCart } = useCart();

  const [quantity, setQuantity] = useState(1);
  const [modifierSelection, setModifierSelection] = useState<Record<string, string[]>>({});
  const [activeModifierGroups, setActiveModifierGroups] = useState<ModifierGroup[]>([]);
  const [selectedVariationId, setSelectedVariationId] = useState<string | number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stagedGroupedItems, setStagedGroupedItems] = useState<Record<string, number>>({});

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      console.log('🔄 ProductScreen: Pull-to-refresh triggered');
      dataCache.clear();
      await queryClient.resetQueries({ queryKey: ['product', productId, merchantId] });
    } catch (error) {
      console.error('ProductScreen pull-to-refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, productId, merchantId]);
  // Helper function to resolve image URL
  const getImageUrl = (media: any): string | null => {
    if (!media) return null;
    let url = media.cloudinaryURL || media.url || media.thumbnailURL || null;
    if (url && !url.startsWith('http') && !url.startsWith('data:')) {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
      const baseUrl = apiUrl.replace(/\/api\/?$/, '');
      const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
      url = `${baseUrl}${normalizedUrl}`;
    }
    return url;
  };

  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Calculate if product is wishlisted
  // Note: useWishlist hook currently supports merchant wishlist. 
  // We might need to extend it for products if we want product-level wishlist.
  // The web implementation has both. For now, we'll implement the UI but maybe disable if hook doesn't support it yet.
  // Actually, web uses addMerchantProductToWishlist. My mobile hook only has isWishlisted(merchantId).
  // I should check useWishlist hook capabilities.
  // Assuming for now we might need to update useWishlist later for products.
  // Let's stick to the request: "wishlist functionality... on the merchant cards UI". 
  // The product view request is "product view page... implement it... when we click such products".
  // It doesn't explicitly say "wishlist on product view", but web has it. I should probably add it if easy.
  // For now, I'll focus on the main product details and add to cart.

  const hasInvalidModifiers = useMemo(() => {
    if (!product || activeModifierGroups.length === 0) {
      return false;
    }
    for (const group of activeModifierGroups) {
      const selectedIds = modifierSelection[group.id] || [];
      const count = selectedIds.length;
      if (group.is_required && count === 0) {
        return true;
      }

      // Optional groups should not block checkout when nothing is selected.
      // If the user starts selecting within an optional group, we then enforce
      // the group's minimum rule for that in-progress selection.
      if (group.min_selections > 0 && count > 0 && count < group.min_selections) {
        return true;
      }
      if (typeof group.max_selections === 'number' && count > group.max_selections) {
        return true;
      }
    }
    return false;
  }, [product, activeModifierGroups, modifierSelection]);

  const isVariableProduct = product?.productType === 'variable';
  const isGroupedProduct = product?.productType === 'grouped';
  const variations = useMemo(() => product?.variations || [], [product?.variations]);
  const groupedItems = useMemo(() => product?.groupedItems || [], [product?.groupedItems]);
  const variationCardWidth = width * 0.75;
  const variationCardSpacing = 16;
  const variationSnapInterval = variationCardWidth + variationCardSpacing;
  const selectedVariation = useMemo(() => {
    if (!product || !isVariableProduct || variations.length === 0) return null;
    if (selectedVariationId != null) {
      const matchedVariation = variations.find(
        (variation) => String(variation.id) === String(selectedVariationId)
      );
      if (matchedVariation) return matchedVariation;
    }
    return variations[0] || null;
  }, [isVariableProduct, product, selectedVariationId, variations]);

  useEffect(() => {
    if (!product) {
      setActiveModifierGroups([]);
      setModifierSelection({});
      return;
    }

    const initialGroups = product.modifierGroups || [];
    setActiveModifierGroups(initialGroups);
    setModifierSelection(buildDefaultModifierSelection(initialGroups));
  }, [product]);

  useEffect(() => {
    if (!product || !isVariableProduct) {
      setSelectedVariationId(null);
      return;
    }

    const nextVariationId = product.defaultVariationId ?? product.variations?.[0]?.id ?? null;
    setSelectedVariationId((current) => {
      if (current != null && product.variations?.some((variation) => String(variation.id) === String(current))) {
        return current;
      }
      return nextVariationId;
    });
  }, [isVariableProduct, product]);

  useEffect(() => {
    let isCancelled = false;

    const loadEffectiveModifiers = async () => {
      if (!product) {
        return;
      }

      if (isVariableProduct) {
        if (!selectedVariationId) {
          setActiveModifierGroups([]);
          setModifierSelection({});
          return;
        }

        try {
          const groups = await fetchEffectiveModifierGroups(
            product.id,
            selectedVariationId,
            merchantId,
          );
          if (!isCancelled) {
            setActiveModifierGroups(groups);
            setModifierSelection(buildDefaultModifierSelection(groups));
          }
        } catch (modifierError) {
          console.error('Failed to refresh variation modifiers:', modifierError);
          if (!isCancelled) {
            setActiveModifierGroups([]);
            setModifierSelection({});
          }
        }

        return;
      }

      const groups = product.modifierGroups || [];
      setActiveModifierGroups(groups);
      setModifierSelection(buildDefaultModifierSelection(groups));
    };

    loadEffectiveModifiers();

    return () => {
      isCancelled = true;
    };
  }, [isVariableProduct, merchantId, product, selectedVariationId]);

  useEffect(() => {
    setStagedGroupedItems({});
  }, [product?.id]);

  const effectiveBasePrice = selectedVariation?.base_price ?? product?.basePrice ?? 0;
  const effectiveCompareAtPrice = selectedVariation?.compare_at_price ?? product?.compareAtPrice;
  const effectiveDescription =
    selectedVariation?.short_description || product?.shortDescription || '';
  const bottomContentSpacing = insets.bottom + (isGroupedProduct ? 220 : 190);
  const effectiveImageUrl = selectedVariation?.image
    ? getImageUrl(selectedVariation.image)
    : product
      ? getImageUrl(product.media?.primaryImage)
      : null;
  const isSelectedVariationOutOfStock =
    isVariableProduct &&
    !!selectedVariation &&
    typeof selectedVariation.stock_quantity === 'number' &&
    selectedVariation.stock_quantity <= 0;
  const hasVariationChoices = isVariableProduct && variations.length > 0;
  const cannotAddVariableProduct =
    isVariableProduct && (!selectedVariation || variations.length === 0 || isSelectedVariationOutOfStock);
  const hasGroupedItems = isGroupedProduct && groupedItems.length > 0;
  const eligibleGroupedItems = useMemo(
    () => groupedItems.filter((item) => canStageGroupedItem(item)),
    [groupedItems]
  );
  const groupedItemsInCart = useMemo(() => {
    const quantities = new Map<string, number>();

    cartItems.forEach((item) => {
      if (String(item.merchant) !== String(merchantId)) {
        return;
      }

      const key = `merchant-${String(item.merchantProduct)}`;
      quantities.set(key, (quantities.get(key) || 0) + item.quantity);
    });

    return quantities;
  }, [cartItems, merchantId]);
  const selectedGroupedItemCount = useMemo(
    () => eligibleGroupedItems.filter((item) => (stagedGroupedItems[getGroupedItemKey(item)] || 0) > 0).length,
    [eligibleGroupedItems, stagedGroupedItems]
  );
  const selectedGroupedUnits = useMemo(
    () => Object.values(stagedGroupedItems).reduce((sum, quantity) => sum + quantity, 0),
    [stagedGroupedItems]
  );
  const stagedGroupedSubtotal = useMemo(
    () =>
      eligibleGroupedItems.reduce((sum, item) => {
        const quantity = stagedGroupedItems[getGroupedItemKey(item)] || 0;
        return sum + (item.basePrice || 0) * quantity;
      }, 0),
    [eligibleGroupedItems, stagedGroupedItems]
  );
  const allEligibleGroupedItemsSelected =
    eligibleGroupedItems.length > 0 &&
    eligibleGroupedItems.every((item) => (stagedGroupedItems[getGroupedItemKey(item)] || 0) > 0);
  const groupedSelectionProgress = groupedItems.length > 0
    ? selectedGroupedItemCount / groupedItems.length
    : 0;
  const groupedSelectionProgressWidth = `${groupedSelectionProgress * 100}%` as `${number}%`;
  const groupedItemsUnavailableCount = groupedItems.filter((item) => !item.isAvailable).length;
  const groupedItemsRequiringDetailCount = groupedItems.filter(
    (item) => item.isAvailable && !canStageGroupedItem(item)
  ).length;
  const merchantCart = getMerchantCart(String(merchantId));
  const shouldShowViewCartBar = Boolean(merchantCart && merchantCart.items.length > 0);

  const totalPrice = useMemo(() => {
    if (!product) return 0;
    let price = effectiveBasePrice;

    // Add modifiers price
    if (activeModifierGroups.length > 0) {
      activeModifierGroups.forEach(group => {
        const selectedIds = modifierSelection[group.id] || [];
        if (group.options) {
          group.options.forEach(opt => {
            if (selectedIds.includes(opt.id)) {
              price += opt.price_adjustment || 0;
            }
          });
        }
      });
    }

    return price * quantity;
  }, [product, activeModifierGroups, modifierSelection, quantity, effectiveBasePrice]);
  const isBelowPayMongoMinimum = totalPrice < PAYMONGO_MINIMUM_AMOUNT_PHP;

  const handleAddToCart = async () => {
    if (hasInvalidModifiers) {
      Alert.alert('Required Options', 'Please make sure all required options are selected.');
      return;
    }

    if (isBelowPayMongoMinimum) {
      Alert.alert(
        'Configuration total too low',
        'This item configuration is below the PayMongo minimum of PHP 1.00. Choose additional priced options or update the base price in CMS.',
      );
      return;
    }

    if (!product) return;

    if (cannotAddVariableProduct) {
      Alert.alert(
        'Select Variation',
        hasVariationChoices
          ? 'Please choose an available variation before adding this item.'
          : 'This variable product has no available variations yet.'
      );
      return;
    }

    if (!product.merchantProductId) {
      Alert.alert('Error', 'Merchant product details not found.');
      return;
    }

    setIsAddingToCart(true);

    // Prepare selected modifiers for CartContext
    const selectedModifierPayload: any[] = [];
    if (activeModifierGroups.length > 0) {
      for (const group of activeModifierGroups) {
        const selectedIds = modifierSelection[group.id] || [];
        const options = group.options || [];
        selectedIds.forEach((id) => {
          const opt = options.find((o) => o.id === id);
          if (!opt) return;
          selectedModifierPayload.push({
            groupId: group.id,
            groupName: group.name,
            isRequired: group.is_required,
            optionId: opt.id,
            name: opt.name,
            price: opt.price_adjustment || 0,
          });
        });
      }
    }

    try {
      await addToCart({
        merchantId: Number(merchantId),
        productId: Number(product.id),
        merchantProductId: Number(product.merchantProductId),
        quantity,
        priceAtAdd: effectiveBasePrice,
        compareAtPrice: effectiveCompareAtPrice ?? null,
        selectedModifiers: selectedModifierPayload,
        selectedVariation: selectedVariation
          ? { relationTo: 'prod-variations', value: selectedVariation.id }
          : null,
      });
      setIsAddingToCart(false);
      navigation.goBack();
    } catch (e: any) {
      setIsAddingToCart(false);
      Alert.alert('Error', e.message || 'Failed to add to cart');
    }
  };

  const toggleGroupedItemSelection = useCallback((item: GroupedProductItem) => {
    if (!canStageGroupedItem(item)) {
      return;
    }

    const key = getGroupedItemKey(item);

    setStagedGroupedItems((current) => {
      if (current[key]) {
        const next = { ...current };
        delete next[key];
        return next;
      }

      return {
        ...current,
        [key]: item.defaultQuantity || 1,
      };
    });
  }, []);

  const handleSelectAllGroupedItems = useCallback(() => {
    if (allEligibleGroupedItemsSelected) {
      setStagedGroupedItems({});
      return;
    }

    const nextSelections = eligibleGroupedItems.reduce<Record<string, number>>((acc, item) => {
      acc[getGroupedItemKey(item)] = item.defaultQuantity || 1;
      return acc;
    }, {});

    setStagedGroupedItems(nextSelections);
  }, [allEligibleGroupedItemsSelected, eligibleGroupedItems]);

  const handleAddGroupedItemsToCart = useCallback(async () => {
    if (!selectedGroupedItemCount) {
      return;
    }

    try {
      setIsAddingToCart(true);

      for (const item of eligibleGroupedItems) {
        const quantity = stagedGroupedItems[getGroupedItemKey(item)] || 0;

        if (!quantity || !item.merchantProductId) {
          continue;
        }

        await addToCart({
          merchantId: Number(merchantId),
          productId: Number(item.productId),
          merchantProductId: Number(item.merchantProductId),
          quantity,
          priceAtAdd: item.basePrice || 0,
          compareAtPrice: item.compareAtPrice ?? null,
          selectedModifiers: [],
        });
      }

      setStagedGroupedItems({});
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add grouped items');
    } finally {
      setIsAddingToCart(false);
    }
  }, [addToCart, eligibleGroupedItems, merchantId, selectedGroupedItemCount, stagedGroupedItems]);

  const handleGroupedItemPress = (item: GroupedProductItem) => {
    if (!item.isAvailable) {
      Alert.alert('Unavailable', `${item.name} is currently unavailable at this merchant.`);
      return;
    }

    if (canStageGroupedItem(item)) {
      toggleGroupedItemSelection(item);
      return;
    }

    if (!item.merchantProductId) {
      navigation.navigate('Product', {
        productId: String(item.productId),
        merchantId,
      });
      return;
    }

    if (item.productType !== 'simple' || item.hasRequiredModifiers) {
      navigation.navigate('Product', {
        productId: String(item.productId),
        merchantId,
        merchantProductId: item.merchantProductId,
      });
      return;
    }

    navigation.navigate('Product', {
      productId: String(item.productId),
      merchantId,
      merchantProductId: item.merchantProductId,
    });
  };

  const showSkeleton = isLoading || refreshing || isRefetching;

  if (showSkeleton) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="light-content" />
        <PullToRefreshLayout
          isRefreshing={refreshing || isRefetching}
          onRefresh={onRefresh}
          contentContainerStyle={{ paddingBottom: bottomContentSpacing }}
        >
          {/* Skeleton image */}
          <View style={{ width: '100%', height: 300, backgroundColor: '#F3F4F6' }}>
            <TouchableOpacity
              style={[styles.backButton, { top: insets.top + 10 }]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          {/* Skeleton content */}
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ width: '60%', height: 28, borderRadius: 8, backgroundColor: '#E5E7EB' }} />
              <View style={{ width: '25%', height: 24, borderRadius: 8, backgroundColor: '#E5E7EB' }} />
            </View>
            <View style={{ width: '90%', height: 16, borderRadius: 8, backgroundColor: '#F3F4F6', marginBottom: 8 }} />
            <View style={{ width: '70%', height: 16, borderRadius: 8, backgroundColor: '#F3F4F6', marginBottom: 24 }} />
            <View style={{ width: '40%', height: 20, borderRadius: 8, backgroundColor: '#E5E7EB', marginBottom: 16 }} />
            {[1, 2, 3].map(i => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#F3F4F6', marginRight: 12 }} />
                <View style={{ width: '50%', height: 16, borderRadius: 8, backgroundColor: '#F3F4F6' }} />
              </View>
            ))}
          </View>
        </PullToRefreshLayout>
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text }}>Failed to load product details</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.primary }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const selectedVariationSummary = selectedVariation?.attributeItems
    ?.map((item) => `${item.attributeName}: ${item.termName}`)
    .join(' • ');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <PullToRefreshLayout
        onRefresh={onRefresh}
        contentContainerStyle={{ paddingBottom: bottomContentSpacing }}
      >
        {/* Header Image */}
        <View style={styles.imageContainer}>
          {effectiveImageUrl ? (
            <Image
              source={{ uri: effectiveImageUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.image, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="image-outline" size={64} color={colors.border} />
            </View>
          )}

          {/* Back Button */}
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 10 }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>

          {/* Wishlist Button (Optional - for now just placeholder or if we extend wishlist hook) */}
          {/* 
          <TouchableOpacity 
            style={[styles.wishlistButton, { top: insets.top + 10 }]}
            onPress={() => {}}
          >
            <Ionicons name="heart-outline" size={24} color="#000" />
          </TouchableOpacity>
          */}
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>{product.name}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.price, { color: colors.primary }]}>
                {formatCurrency(effectiveBasePrice)}
              </Text>
              {effectiveCompareAtPrice && effectiveCompareAtPrice > effectiveBasePrice && (
                <Text style={[styles.comparePrice, { color: colors.textSecondary }]}>
                  {formatCurrency(effectiveCompareAtPrice)}
                </Text>
              )}
            </View>
          </View>

          {selectedVariationSummary ? (
            <View style={styles.selectedVariationBadge}>
              <Ionicons name="options-outline" size={16} color={colors.primary} />
              <Text style={[styles.selectedVariationText, { color: colors.primary }]}>
                {selectedVariationSummary}
              </Text>
            </View>
          ) : null}

          {effectiveDescription ? (
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {effectiveDescription}
            </Text>
          ) : null}

          {isVariableProduct && (
            <View style={styles.variationsContainer}>
              <Text style={styles.sectionTitle}>Choose variation</Text>
              {hasVariationChoices ? (
                <View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.variationCarouselList}
                    decelerationRate="fast"
                    snapToInterval={variationSnapInterval}
                    snapToAlignment="start"
                    disableIntervalMomentum
                    onMomentumScrollEnd={(event) => {
                      const nextIndex = Math.round(
                        event.nativeEvent.contentOffset.x / variationSnapInterval
                      );
                      const nextVariation = variations[nextIndex];
                      if (nextVariation) {
                        setSelectedVariationId(nextVariation.id);
                      }
                    }}
                  >
                    {variations.map((variation) => {
                      const isSelected = !!selectedVariation && String(selectedVariation.id) === String(variation.id);
                      const isOutOfStock =
                        typeof variation.stock_quantity === 'number' && variation.stock_quantity <= 0;
                      const variationImageUrl = variation.image ? getImageUrl(variation.image) : null;
                      const variationSummary = variation.attributeItems
                        ?.map((item) => `${item.attributeName}: ${item.termName}`)
                        .join(' • ');

                      return (
                        <View
                          key={String(variation.id)}
                          style={{ width: variationCardWidth, marginRight: variationCardSpacing }}
                        >
                          <TouchableOpacity
                            style={[
                              styles.variationCarouselCard,
                              isSelected && styles.variationCarouselCardSelected,
                              isOutOfStock && styles.variationOptionDisabled,
                            ]}
                            onPress={() => {
                              if (!isOutOfStock) {
                                setSelectedVariationId(variation.id);
                              }
                            }}
                            activeOpacity={0.9}
                            disabled={isOutOfStock}
                          >
                            <View style={styles.variationCarouselImageContainer}>
                              {variationImageUrl ? (
                                <Image
                                  source={{ uri: variationImageUrl }}
                                  style={styles.variationCarouselImage}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View style={styles.variationCarouselImagePlaceholder}>
                                  <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                                </View>
                              )}
                              <View style={styles.variationCarouselBadgeRow}>
                                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                                  {isSelected ? <View style={styles.radioInner} /> : null}
                                </View>
                                <View
                                  style={[
                                    styles.variationStatusBadge,
                                    isOutOfStock && styles.variationStatusBadgeDisabled,
                                  ]}
                                >
                                  <Text style={styles.variationStatusBadgeText}>
                                    {isOutOfStock ? 'Out of stock' : 'Available'}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            <View style={styles.variationCarouselInfo}>
                              <Text
                                style={[
                                  styles.variationName,
                                  isSelected && styles.variationNameSelected,
                                  isOutOfStock && styles.variationNameDisabled,
                                ]}
                                numberOfLines={1}
                              >
                                {variation.name}
                              </Text>
                              {variationSummary ? (
                                <Text style={styles.variationSummary} numberOfLines={2}>
                                  {variationSummary}
                                </Text>
                              ) : null}
                              {variation.short_description ? (
                                <Text style={styles.variationDescription} numberOfLines={2}>
                                  {variation.short_description}
                                </Text>
                              ) : null}
                              <View style={styles.variationCarouselFooter}>
                                <View>
                                  <Text style={styles.variationPrice}>
                                    {formatCurrency(variation.base_price || 0)}
                                  </Text>
                                  {variation.compare_at_price && variation.compare_at_price > (variation.base_price || 0) ? (
                                    <Text style={styles.variationComparePrice}>
                                      {formatCurrency(variation.compare_at_price)}
                                    </Text>
                                  ) : null}
                                </View>
                                <Ionicons
                                  name="chevron-forward"
                                  size={18}
                                  color={isSelected ? '#eba236' : '#9CA3AF'}
                                />
                              </View>
                            </View>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.variationEmptyState}>
                  <Text style={styles.variationEmptyStateText}>
                    Variations are not available for this product yet.
                  </Text>
                </View>
              )}
            </View>
          )}

          {isGroupedProduct && (
            <View style={styles.groupedContainer}>
              {hasGroupedItems ? (
                <View style={styles.groupedComposerCard}>
                  <View style={styles.groupedComposerHeader}>
                    <View style={styles.groupedComposerHeaderCopy}>
                      <Text style={styles.sectionTitle}>Build your bundle</Text>
                      <Text style={styles.groupedComposerText}>
                        Stage the items you want, review them here, then add everything to your order in one step.
                      </Text>
                    </View>
                    <View style={styles.groupedProgressBadge}>
                      <Text style={styles.groupedProgressBadgeText}>
                        {selectedGroupedItemCount}/{groupedItems.length} selected
                      </Text>
                    </View>
                  </View>

                  <View style={styles.groupedProgressTrack}>
                    <View style={[styles.groupedProgressFill, { width: groupedSelectionProgressWidth }]} />
                  </View>

                  <View style={styles.groupedComposerStats}>
                    <View style={styles.groupedStatChip}>
                      <Ionicons name="cube-outline" size={14} color="#111827" />
                      <Text style={styles.groupedStatChipText}>
                        {selectedGroupedUnits} units staged
                      </Text>
                    </View>
                    <View style={styles.groupedStatChip}>
                      <Ionicons name="wallet-outline" size={14} color="#111827" />
                      <Text style={styles.groupedStatChipText}>
                        {formatCurrency(stagedGroupedSubtotal)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.groupedComposerActions}>
                    <TouchableOpacity
                      style={[
                        styles.groupedComposerActionButton,
                        eligibleGroupedItems.length === 0 && styles.groupedComposerActionButtonDisabled,
                      ]}
                      onPress={handleSelectAllGroupedItems}
                      disabled={eligibleGroupedItems.length === 0}
                    >
                      <Text style={styles.groupedComposerActionButtonText}>
                        {allEligibleGroupedItemsSelected ? 'Clear all' : 'Select all eligible'}
                      </Text>
                    </TouchableOpacity>

                    {selectedGroupedItemCount > 0 ? (
                      <TouchableOpacity
                        style={styles.groupedComposerGhostButton}
                        onPress={() => setStagedGroupedItems({})}
                      >
                        <Text style={styles.groupedComposerGhostButtonText}>Reset staged items</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {groupedItemsRequiringDetailCount > 0 ? (
                    <Text style={styles.groupedComposerHint}>
                      {groupedItemsRequiringDetailCount} item{groupedItemsRequiringDetailCount === 1 ? '' : 's'} still need customization or a separate detail view before they can be staged here.
                    </Text>
                  ) : null}

                  {groupedItemsUnavailableCount > 0 ? (
                    <Text style={styles.groupedComposerHint}>
                      {groupedItemsUnavailableCount} item{groupedItemsUnavailableCount === 1 ? '' : 's'} are currently unavailable at this merchant.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>Included items</Text>
              {hasGroupedItems ? (
                <View style={styles.groupedList}>
                  {groupedItems.map((item) => {
                    const groupedItemKey = getGroupedItemKey(item);
                    const itemImageUrl = item.image ? getImageUrl(item.image) : null;
                    const isStageable = canStageGroupedItem(item);
                    const isSelected = (stagedGroupedItems[groupedItemKey] || 0) > 0;
                    const stagedQuantity = stagedGroupedItems[groupedItemKey] || 0;
                    const inCartQuantity = groupedItemsInCart.get(groupedItemKey) || 0;
                    const actionLabel = !item.isAvailable
                      ? 'Unavailable'
                      : isStageable && isSelected
                        ? 'Remove'
                        : isStageable
                          ? 'Add'
                        : item.productType === 'variable'
                          ? 'Choose'
                          : item.productType === 'grouped'
                            ? 'Open'
                            : 'Customize';

                    return (
                      <TouchableOpacity
                        key={String(item.id)}
                        style={[
                          styles.groupedCard,
                          isSelected && styles.groupedCardSelected,
                          !item.isAvailable && styles.groupedCardUnavailable,
                        ]}
                        activeOpacity={0.92}
                        onPress={() => handleGroupedItemPress(item)}
                      >
                        <View style={styles.groupedCardTopRow}>
                          <View style={styles.groupedImageWrap}>
                            {itemImageUrl ? (
                              <Image source={{ uri: itemImageUrl }} style={styles.groupedImage} resizeMode="cover" />
                            ) : (
                              <View style={styles.groupedImagePlaceholder}>
                                <Ionicons name="image-outline" size={22} color="#9CA3AF" />
                              </View>
                            )}
                          </View>
                          <View style={styles.groupedInfo}>
                            <View style={styles.groupedMetaRow}>
                              <Text style={styles.groupedQtyBadge}>x{item.defaultQuantity}</Text>
                              <Text style={styles.groupedTypeBadge}>{item.productType}</Text>
                              {isSelected ? (
                                <View style={styles.groupedSelectedBadge}>
                                  <Ionicons name="checkmark-circle" size={14} color="#166534" />
                                  <Text style={styles.groupedSelectedBadgeText}>Staged</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.groupedName}>{item.name}</Text>
                            {item.shortDescription ? (
                              <Text style={styles.groupedDescription} numberOfLines={2}>
                                {item.shortDescription}
                              </Text>
                            ) : null}
                            <View style={styles.groupedPriceRow}>
                              <Text style={styles.groupedPrice}>{formatCurrency(item.basePrice || 0)}</Text>
                              {item.compareAtPrice && item.compareAtPrice > (item.basePrice || 0) ? (
                                <Text style={styles.groupedComparePrice}>{formatCurrency(item.compareAtPrice)}</Text>
                              ) : null}
                            </View>
                          </View>
                        </View>
                        <View style={styles.groupedCardBottomRow}>
                          <Text style={[styles.groupedAvailability, !item.isAvailable && styles.groupedAvailabilityUnavailable]}>
                            {!item.isAvailable
                              ? 'Currently unavailable'
                              : isSelected
                                ? `Ready to add x${stagedQuantity}`
                                : inCartQuantity > 0
                                  ? `Already in cart x${inCartQuantity}`
                                  : isStageable
                                    ? 'Tap to stage this item'
                                    : 'Open for customization'}
                          </Text>
                          <View
                            style={[
                              styles.groupedActionButton,
                              isSelected && styles.groupedActionButtonSelected,
                              !item.isAvailable && styles.groupedActionButtonDisabled,
                            ]}
                          >
                            <Text style={styles.groupedActionButtonText}>{actionLabel}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.groupedEmptyState}>
                  <Text style={styles.groupedEmptyStateText}>
                    Grouped items are not available for this product yet.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Modifiers */}
          {activeModifierGroups.length > 0 && (
            <ProductModifiers
              modifierGroups={activeModifierGroups}
              selected={modifierSelection}
              onChange={setModifierSelection}
            />
          )}
        </View>
      </PullToRefreshLayout>

      {/* Bottom Action Bar */}
      {isGroupedProduct ? (
        selectedGroupedItemCount > 0 ? (
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10, backgroundColor: colors.card }]}>
            <View style={styles.groupedBottomBar}>
              <View style={styles.groupedBottomBarSummary}>
                <Text style={[styles.groupedBottomBarTitle, { color: colors.text }]}>
                  {`${selectedGroupedItemCount}/${groupedItems.length} items staged`}
                </Text>
                <Text style={[styles.groupedBottomBarText, { color: colors.textSecondary }]}>
                  {`${selectedGroupedUnits} units • ${formatCurrency(stagedGroupedSubtotal)}`}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.groupedBottomBarButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleAddGroupedItemsToCart}
                disabled={isAddingToCart}
              >
                {isAddingToCart ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.groupedBottomBarButtonText}>
                    Add to Order • {formatCurrency(stagedGroupedSubtotal)}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : shouldShowViewCartBar ? (
          <ViewCartBar
            itemCount={merchantCart.totalItems}
            subtotal={merchantCart.subtotal}
            paddingBottom={insets.bottom > 0 ? insets.bottom : 20}
            onPress={() => navigation.navigate('MerchantCart', { merchantId })}
          />
        ) : (
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10, backgroundColor: colors.card }]}>
            <View style={styles.groupedBottomBar}>
              <View style={styles.groupedBottomBarSummary}>
                <Text style={[styles.groupedBottomBarTitle, { color: colors.text }]}>
                  Build your grouped order
                </Text>
                <Text style={[styles.groupedBottomBarText, { color: colors.textSecondary }]}>
                  {eligibleGroupedItems.length > 0
                    ? 'Select grouped items first, then add them together.'
                    : 'No eligible grouped items are ready for direct add yet.'}
                </Text>
              </View>
            </View>
          </View>
        )
      ) : shouldShowViewCartBar ? (
        <ViewCartBar
          itemCount={merchantCart.totalItems}
          subtotal={merchantCart.subtotal}
          paddingBottom={insets.bottom > 0 ? insets.bottom : 20}
          onPress={() => navigation.navigate('MerchantCart', { merchantId })}
        />
      ) : (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10, backgroundColor: colors.card }]}>
          <>
            <View style={styles.quantityContainer}>
              <TouchableOpacity
                style={[styles.quantityButton, { borderColor: colors.border }]}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Ionicons name="remove" size={20} color={colors.text} />
              </TouchableOpacity>

              <Text style={[styles.quantityText, { color: colors.text }]}>{quantity}</Text>

              <TouchableOpacity
                style={[styles.quantityButton, { borderColor: colors.border }]}
                onPress={() => setQuantity(quantity + 1)}
              >
                <Ionicons name="add" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.addToCartButton,
                { backgroundColor: hasInvalidModifiers || cannotAddVariableProduct || isBelowPayMongoMinimum ? '#ccc' : colors.primary }
              ]}
              onPress={handleAddToCart}
              disabled={hasInvalidModifiers || cannotAddVariableProduct || isAddingToCart || isBelowPayMongoMinimum}
            >
              {isAddingToCart ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.addToCartText}>
                  Add to Order • {formatCurrency(totalPrice)}
                </Text>
              )}
            </TouchableOpacity>
          </>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  wishlistButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  contentContainer: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
  },
  price: {
    fontSize: 20,
    fontWeight: '600',
  },
  comparePrice: {
    fontSize: 14,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  selectedVariationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF7E8',
    marginBottom: 12,
  },
  selectedVariationText: {
    fontSize: 13,
    fontWeight: '600',
  },
  groupedContainer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  groupedList: {
    gap: 12,
  },
  groupedCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    padding: 14,
  },
  groupedCardSelected: {
    borderColor: '#eba236',
    backgroundColor: '#FFF9F0',
  },
  groupedCardUnavailable: {
    opacity: 0.7,
  },
  groupedComposerCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F3E1C4',
    backgroundColor: '#FFFBF5',
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  groupedComposerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  groupedComposerHeaderCopy: {
    flex: 1,
  },
  groupedComposerText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    marginTop: -2,
  },
  groupedProgressBadge: {
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#F3E1C4',
  },
  groupedProgressBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  groupedProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  groupedProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#eba236',
  },
  groupedComposerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  groupedStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  groupedStatChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  groupedComposerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  groupedComposerActionButton: {
    borderRadius: 999,
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  groupedComposerActionButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  groupedComposerActionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  groupedComposerGhostButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  groupedComposerGhostButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  groupedComposerHint: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  },
  groupedCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  groupedImageWrap: {
    marginRight: 12,
  },
  groupedImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  groupedImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupedInfo: {
    flex: 1,
  },
  groupedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  groupedQtyBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    backgroundColor: '#FFF7E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  groupedTypeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  groupedSelectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
  },
  groupedSelectedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  groupedName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  groupedDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginTop: 6,
  },
  groupedPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  groupedPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  groupedComparePrice: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  groupedCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  groupedAvailability: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  groupedAvailabilityUnavailable: {
    color: '#DC2626',
  },
  groupedActionButton: {
    minWidth: 88,
    borderRadius: 999,
    backgroundColor: '#eba236',
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  groupedActionButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  groupedActionButtonSelected: {
    backgroundColor: '#111827',
  },
  groupedActionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  groupedEmptyState: {
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  groupedEmptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 15,
  },
  addToCartButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToCartText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  groupedBottomBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
  },
  groupedBottomBarSummary: {
    flex: 1,
  },
  groupedBottomBarTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  groupedBottomBarText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  groupedBottomBarButton: {
    minWidth: 168,
    height: 50,
    paddingHorizontal: 18,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupedBottomBarButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111827',
  },
  variationsContainer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  variationsList: {
    gap: 12,
  },
  variationCarouselList: {
    paddingRight: 16,
  },
  variationCarouselCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  variationCarouselCardSelected: {
    borderColor: '#eba236',
    backgroundColor: '#FFF9F0',
  },
  variationCarouselImageContainer: {
    position: 'relative',
    width: '100%',
    height: 150,
    backgroundColor: '#F3F4F6',
  },
  variationCarouselImage: {
    width: '100%',
    height: '100%',
  },
  variationCarouselImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  variationCarouselBadgeRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  variationStatusBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  variationStatusBadgeDisabled: {
    backgroundColor: 'rgba(127,29,29,0.78)',
  },
  variationStatusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  variationCarouselInfo: {
    padding: 12,
  },
  variationCarouselFooter: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  variationOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  variationOptionSelected: {
    borderColor: '#eba236',
    backgroundColor: '#FFF9F0',
  },
  variationOptionDisabled: {
    opacity: 0.55,
  },
  variationOptionContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  variationThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  variationTextBlock: {
    flex: 1,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#eba236',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#eba236',
  },
  variationName: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  variationNameSelected: {
    color: '#111827',
    fontWeight: '600',
  },
  variationNameDisabled: {
    color: '#9CA3AF',
  },
  variationSummary: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  variationDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
    marginTop: 4,
  },
  variationStock: {
    fontSize: 12,
    color: '#059669',
    marginTop: 6,
    fontWeight: '600',
  },
  variationStockDisabled: {
    color: '#DC2626',
  },
  variationPriceBlock: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  variationPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  variationComparePrice: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginTop: 4,
  },
  variationEmptyState: {
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  variationEmptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});
