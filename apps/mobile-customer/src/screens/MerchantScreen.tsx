import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  SectionList,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Alert,
  useWindowDimensions,
  ImageBackground,
  Animated,
  Platform,
  ViewToken,
  RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '../navigation/NavigationContext';
import { useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import {
  getMerchantByIdClient,
  getMerchantMenuClient,
  MerchantProductDisplay,
  MerchantCategoryDisplay,
  dataCache
} from '@encreasl/client-services';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCart } from '../contexts/CartContext';
import { formatCurrency } from '../utils/format';
import MerchantSearchModal from '../components/MerchantSearchModal';
import ViewCartBar from '../components/shared/ViewCartBar';
import { useWishlist } from '../hooks/useWishlist';
import { PullToRefreshLayout } from '../components/PullToRefreshLayout';
import { apiConfig } from '../config/environment';

const MerchantSkeleton = () => {
  const { width } = useWindowDimensions();

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ height: 200, backgroundColor: '#F3F4F6' }} />

      <View style={{ alignItems: 'center', marginTop: -30 }}>
        <View style={{
          width: 80, height: 80, borderRadius: 12,
          backgroundColor: '#E5E7EB',
          borderWidth: 4, borderColor: '#fff'
        }} />
      </View>

      <View style={{ alignItems: 'center', padding: 16 }}>
        <View style={{ width: '60%', height: 24, backgroundColor: '#F3F4F6', borderRadius: 4, marginBottom: 8 }} />
        <View style={{ width: '40%', height: 16, backgroundColor: '#F3F4F6', borderRadius: 4 }} />
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={{ width: 80, height: 32, backgroundColor: '#F3F4F6', borderRadius: 16 }} />
          ))}
        </View>
      </View>

      <View style={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={{
            width: (width - 32 - 12) / 2,
            marginBottom: 16
          }}>
            <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#F3F4F6', borderRadius: 12, marginBottom: 8 }} />
            <View style={{ width: '80%', height: 16, backgroundColor: '#F3F4F6', borderRadius: 4 }} />
          </View>
        ))}
      </View>
    </View>
  );
};

interface Section {
  title: string;
  data: MerchantProductDisplay[][]; // Array of rows (each row is array of 1 or 2 products)
  id: number | string;
}

export default function MerchantScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const merchantId = typeof params.id === 'string' ? params.id : params.merchantId as string;
  const distanceKm = params.distanceKm ? Number(params.distanceKm) : undefined;
  const distanceInMeters = params.distanceInMeters ? Number(params.distanceInMeters) : undefined;
  
  const queryClient = useQueryClient();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const isHearted = isWishlisted(merchantId);
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | string | null>(null);
  const sectionListRef = useRef<SectionList>(null);
  const stickyCategoryListRef = useRef<FlatList>(null);
  const headerCategoryListRef = useRef<FlatList>(null);
  const isManualScroll = useRef(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const { addToCart, getMerchantCart, updateQuantity } = useCart();
  const merchantCart = getMerchantCart(String(merchantId));
  // Store threshold in state to trigger re-render for interpolation update
  const [headerThreshold, setHeaderThreshold] = useState(200);
  const [categoriesThreshold, setCategoriesThreshold] = useState(1000);
  const searchBarOffset = useRef(0);
  const categoriesListOffset = useRef(0);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isScrolledPastThreshold, setIsScrolledPastThreshold] = useState(false);

  // Update threshold when search bar layout is measured
  const updateThreshold = useCallback(() => {
    if (searchBarOffset.current > 0) {
      const headerHeight = insets.top + 45;
      const newThreshold = searchBarOffset.current - headerHeight;
      if (Math.abs(newThreshold - headerThreshold) > 5) {
        setHeaderThreshold(newThreshold);
      }
    }
  }, [insets.top, headerThreshold]);

  const updateCategoriesThreshold = useCallback(() => {
    if (categoriesListOffset.current > 0) {
      const headerHeight = insets.top + 45;
      const newThreshold = categoriesListOffset.current - headerHeight;
      if (Math.abs(newThreshold - categoriesThreshold) > 5) {
        setCategoriesThreshold(newThreshold);
      }
    }
  }, [insets.top, categoriesThreshold]);

  // Header Animation Interpolations
  const headerBackgroundColor = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,1)'],
    extrapolate: 'clamp',
  });

  // Search Bar Visibility Interpolation (Instant Switch)
  const searchBarOpacity = scrollY.interpolate({
    inputRange: [headerThreshold - 1, headerThreshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const searchBarTranslateY = scrollY.interpolate({
    inputRange: [headerThreshold - 1, headerThreshold],
    outputRange: [-20, 0], // Slight slide in
    extrapolate: 'clamp',
  });

  // Default Icons Visibility Interpolation (Instant Switch)
  const defaultIconsOpacity = scrollY.interpolate({
    inputRange: [headerThreshold - 1, headerThreshold],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const defaultIconsTranslateY = scrollY.interpolate({
    inputRange: [headerThreshold - 1, headerThreshold],
    outputRange: [0, -20], // Slide out
    extrapolate: 'clamp',
  });

  // Sticky Categories Interpolations
  const stickyCategoriesOpacity = scrollY.interpolate({
    inputRange: [categoriesThreshold - 1, categoriesThreshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const stickyCategoriesTranslateY = scrollY.interpolate({
    inputRange: [categoriesThreshold - 1, categoriesThreshold],
    outputRange: [-10, 0], // Slide in slightly
    extrapolate: 'clamp',
  });

  // 1. Fetch Merchant Details
  const { data: merchant, isLoading: isLoadingMerchant, isRefetching: isRefetchingMerchant } = useQuery({
    queryKey: ['merchant', merchantId],
    queryFn: () => getMerchantByIdClient(String(merchantId)),
    enabled: !!merchantId,
  });

  // 2. Fetch Merchant Menu with Infinite Scroll
  const {
    data: menuData,
    isLoading: isLoadingMenu,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching: isRefetchingMenu
  } = useInfiniteQuery({
    queryKey: ['merchant-menu', merchantId],
    queryFn: ({ pageParam = 1 }) => getMerchantMenuClient(String(merchantId), pageParam, 20),
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination?.hasNextPage) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: !!merchantId,
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      console.log('🔄 MerchantScreen: Pull-to-refresh triggered');

      // Clear internal service memory cache to ensure fresh data fetch
      dataCache.clear();

      // Reset queries to clear cache and force fresh fetch (same pattern as HomeScreen)
      await Promise.all([
        queryClient.resetQueries({ queryKey: ['merchant', merchantId] }),
        queryClient.resetQueries({ queryKey: ['merchant-menu', merchantId] }),
      ]);
    } catch (error) {
      console.error('MerchantScreen pull-to-refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, merchantId]);

  const isRefreshing = refreshing || isRefetchingMerchant || isRefetchingMenu;
  const isLoading = isLoadingMerchant || isLoadingMenu;

  // 3. Group Products by Category and Chunk for Grid
  const { sections, categories, allProducts } = useMemo(() => {
    if (!menuData) return { sections: [], categories: [], allProducts: [] };

    // Flatten products and categories from all pages
    const products = menuData.pages.flatMap(page => page.products);

    // Merge categories (avoid duplicates)
    const categoryMap = new Map<number | string, MerchantCategoryDisplay>();
    menuData.pages.forEach(page => {
      page.categories.forEach(c => categoryMap.set(c.id, c));
    });
    const allCategories = Array.from(categoryMap.values());

    // Products without categories
    const others = products.filter(p => !p.categoryIds || p.categoryIds.length === 0);

    const result: Section[] = [];

    // Add sections for each category
    allCategories.forEach(cat => {
      // Filter products that belong to this category
      const items = products.filter(p => (p.categoryIds || []).includes(cat.id));

      if (items.length > 0) {
        // Chunk items into pairs for grid layout
        const chunkedItems: MerchantProductDisplay[][] = [];
        for (let i = 0; i < items.length; i += 2) {
          chunkedItems.push(items.slice(i, i + 2));
        }

        result.push({
          title: cat.name,
          data: chunkedItems,
          id: cat.id
        });
      }
    });

    // Add "Others" section if any
    if (others.length > 0) {
      const chunkedOthers: MerchantProductDisplay[][] = [];
      for (let i = 0; i < others.length; i += 2) {
        chunkedOthers.push(others.slice(i, i + 2));
      }

      const othersId = 'others';
      result.push({
        title: 'Others',
        data: chunkedOthers,
        id: othersId
      });
      // Add "Others" to categories list for navigation pill
      allCategories.push({ id: othersId, name: 'Others', slug: 'others' });
    }

    // Deduplicate products for search
    const uniqueProducts = Array.from(new Map(products.map(p => [p.id, p])).values());

    return { sections: result, categories: allCategories, allProducts: uniqueProducts };
  }, [menuData]);

  // Sync Category Tabs with Selection
  useEffect(() => {
    if (isManualScroll.current || !selectedCategoryId || categories.length === 0) return;

    const index = categories.findIndex(c => String(c.id) === String(selectedCategoryId));
    if (index !== -1) {
      // Scroll both lists
      [stickyCategoryListRef, headerCategoryListRef].forEach(ref => {
        ref.current?.scrollToIndex({
          index,
          viewPosition: 0.5,
          animated: true
        });
      });
    }
  }, [selectedCategoryId, categories]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 10,
    waitForInteraction: true,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (isManualScroll.current || viewableItems.length === 0) return;

    // Find the first viewable item that belongs to a section
    const firstItem = viewableItems[0];

    // Check if we have a section and it's different from current
    if (firstItem && firstItem.section) {
      const section = firstItem.section as Section;
      const newId = section.id;

      if (newId !== selectedCategoryId) {
        setSelectedCategoryId(newId);
        // Scrolling is now handled by the useEffect above to ensure consistency
      }
    }
  }).current;

  // Handle Category Selection (Scroll to Section)
  const handleCategoryPress = (categoryId: number | string) => {
    isManualScroll.current = true;
    setSelectedCategoryId(categoryId);

    // Scroll SectionList
    const sectionIndex = sections.findIndex(s => s.id === categoryId);
    if (sectionIndex !== -1 && sectionListRef.current) {
      sectionListRef.current.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        viewOffset: 160,
        animated: true
      });
    }

    // Scroll Tabs Immediately (better responsiveness for tap)
    const categoryIndex = categories.findIndex(c => String(c.id) === String(categoryId));
    if (categoryIndex !== -1) {
      [stickyCategoryListRef, headerCategoryListRef].forEach(ref => {
        ref.current?.scrollToIndex({
          index: categoryIndex,
          viewPosition: 0.5,
          animated: true
        });
      });
    }

    // Reset lock
    setTimeout(() => {
      isManualScroll.current = false;
    }, 1000);
  };

  const handleAddToCart = async (product: MerchantProductDisplay) => {
    // Basic Add to Cart implementation
    // Check productType (simple vs variable)
    if (product.productType === 'variable' || product.productType === 'grouped') {
      // Navigate to product details
      // Pass productId and merchantId so ProductScreen can fetch details
      navigation.navigate('Product', { productId: product.id, merchantId, merchantProductId: product.merchantProductId });
    } else {
      try {
        let merchantProductId = product.merchantProductId;

        // Fetch Merchant Product ID if missing (backward compatibility)
        if (!merchantProductId) {
          const response = await fetch(`${apiConfig.baseUrl}/merchant-products?where[merchant_id][equals]=${merchantId}&where[product_id][equals]=${product.id}&depth=0`, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `users API-Key ${apiConfig.payloadApiKey}`
            }
          });

          if (!response.ok) {
            throw new Error('Failed to fetch merchant product details');
          }

          const data = await response.json();
          const merchantProduct = data.docs?.[0];

          if (!merchantProduct) {
            Alert.alert('Error', 'Product not available at this merchant.');
            return;
          }
          merchantProductId = merchantProduct.id;
        }

        // Check if item already exists in cart for this merchant
        const existingItem = merchantCart?.items.find(item =>
          Number(item.merchantProduct) === Number(merchantProductId) &&
          (!item.selectedModifiers || item.selectedModifiers.length === 0)
        );

        if (existingItem) {
          await updateQuantity(existingItem.id, existingItem.quantity + 1);
          Alert.alert('Cart Updated', `${product.name} quantity increased.`);
          return;
        }

        // Web AddToCartPayload
        const payload = {
          merchantId: Number(merchantId),
          productId: Number(product.id),
          merchantProductId: Number(merchantProductId),
          quantity: 1,
          priceAtAdd: product.basePrice || 0,
          compareAtPrice: product.compareAtPrice || null,
          selectedModifiers: [],
        };

        await addToCart(payload);
        Alert.alert('Added to Cart', `${product.name} added to your cart.`);
      } catch (error) {
        console.error('Error adding to cart:', error);
        Alert.alert('Error', 'Failed to add item to cart. Please try again.');
      }
    }
  };

  const onScrollToIndexFailed = (info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
    // Fallback: wait a bit and try again
    const wait = new Promise(resolve => setTimeout(resolve, 500));
    wait.then(() => {
      try {
        stickyCategoryListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
      } catch { }
      try {
        headerCategoryListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
      } catch { }
    }).catch(() => { });
  };

  // Helper to get image URL with fallbacks (Cloudinary > URL > Thumbnail)
  // And handle relative URLs by prepending API base
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
  const BASE_URL = API_URL.replace(/\/api\/?$/, ''); // Strip trailing /api or /api/

  function formatDistanceKm(distanceKm?: number): string | null {
    if (typeof distanceKm !== "number") return null;
    if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m`;
    return `${distanceKm.toFixed(1)}km`;
  }

  const getImageUrl = (media: any): string | null => {
    if (!media) return null;
    let url = media.cloudinaryURL || media.url || media.thumbnailURL || null;

    if (url && !url.startsWith('http') && !url.startsWith('data:')) {
      // It's a relative path, prepend BASE_URL
      const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
      const cleanBase = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
      url = `${cleanBase}${cleanUrl}`;
    }

    return url;
  };

  // Render Header (Cover, Info, Search, Categories)
  const renderHeader = () => {
    if (!merchant) return null;

    const coverImage = getImageUrl(merchant.media?.storeFrontImage) || getImageUrl(merchant.media?.thumbnail);
    const logoImage = getImageUrl(merchant.vendor?.logo) || getImageUrl(merchant.media?.thumbnail);

    // Construct address string
    const address = merchant.activeAddress?.formatted_address ||
      [merchant.activeAddress?.street, merchant.activeAddress?.city].filter(Boolean).join(', ');

    return (
      <View style={{ backgroundColor: '#fff', paddingBottom: 10 }}>
        {/* Cover Image */}
        <ImageBackground
          source={{ uri: coverImage || 'https://via.placeholder.com/800x400' }}
          style={{ width: '100%', height: 200 }}
          resizeMode="cover"
        />

        {/* Merchant Logo (Overlapping) */}
        <View style={{ alignItems: 'center', marginTop: -30 }}>
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: logoImage || 'https://via.placeholder.com/100' }}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Merchant Info */}
        <View style={{ paddingHorizontal: 16, alignItems: 'center', marginTop: 10 }}>
          <Text style={styles.merchantName}>{merchant.outletName}</Text>

          {/* Distance */}
          {(typeof distanceKm === 'number' || typeof distanceInMeters === 'number') && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
              <Ionicons name="location-outline" size={14} color="#666" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#666' }}>
                {typeof distanceKm === 'number'
                  ? formatDistanceKm(distanceKm)
                  : formatDistanceKm((distanceInMeters || 0) / 1000)}
              </Text>
            </View>
          )}

          {address && (
            <Text style={styles.merchantAddress} numberOfLines={2}>
              {address}
            </Text>
          )}
        </View>

        {/* Search Bar */}
        <View
          style={{ paddingHorizontal: 16, marginTop: 16 }}
          onLayout={(event) => {
            // Get the Y position of the bottom of the search bar relative to the scroll view
            searchBarOffset.current = event.nativeEvent.layout.y + event.nativeEvent.layout.height;
            updateThreshold();
          }}
        >
          <TouchableOpacity
            style={styles.searchContainer}
            onPress={() => setIsSearchVisible(true)}
            activeOpacity={0.9}
          >
            <Ionicons name="search" size={20} color="#999" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 15, color: '#999' }}>Search menu</Text>
          </TouchableOpacity>
        </View>

        {/* Categories Horizontal List */}
        <View onLayout={(event) => {
          categoriesListOffset.current = event.nativeEvent.layout.y;
          updateCategoriesThreshold();
        }}>
          <FlatList
            ref={headerCategoryListRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 16, marginTop: 16, paddingBottom: 8 }}
            onScrollToIndexFailed={onScrollToIndexFailed}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleCategoryPress(item.id)}
                style={[
                  styles.categoryPill,
                  selectedCategoryId === item.id && styles.categoryPillActive
                ]}
              >
                <Text style={[
                  styles.categoryPillText,
                  selectedCategoryId === item.id && styles.categoryPillTextActive
                ]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    );
  };

  const renderSectionHeader = ({ section: { title } }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const renderItem = ({ item }: { item: MerchantProductDisplay[] }) => {
    // Calculate item width based on screen width and margins
    // Screen padding: 16px (left) + 16px (right)
    // Gap between items: 12px
    // (Screen - 32 - 12) / 2
    const itemWidth = (width - 32 - 12) / 2;

    return (
      <View style={styles.row}>
        {item.map((product) => (
          <TouchableOpacity
            key={product.id}
            style={[styles.productCard, { width: itemWidth }]}
            onPress={() => {
              // Navigate to product details
              navigation.navigate('Product', { productId: product.id, merchantId, merchantProductId: product.merchantProductId });
            }}
          >
            {/* Image Container */}
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: product.imageUrl || 'https://via.placeholder.com/150' }}
                style={styles.productImage}
                resizeMode="cover"
              />
              {/* Add Button Overlay */}
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  if (product.hasRequiredModifiers) {
                    navigation.navigate('Product', { productId: product.id, merchantId, merchantProductId: product.merchantProductId });
                  } else {
                    handleAddToCart(product);
                  }
                }}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color="#333"
                />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.productContent}>
              <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>

              <View style={{ marginTop: 4 }}>
                {product.productType === 'simple' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    {product.basePrice !== null && (
                      <Text style={styles.price}>{formatCurrency(product.basePrice)}</Text>
                    )}
                    {product.compareAtPrice && product.compareAtPrice > (product.basePrice || 0) && (
                      <Text style={styles.comparePrice}>
                        {formatCurrency(product.compareAtPrice)}
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.variableText}>
                    {product.productType === 'grouped' ? 'Show Grouped Items' : 'Show Variations'}
                  </Text>
                )}
              </View>

              {product.shortDescription ? (
                <Text style={styles.shortDescription} numberOfLines={2}>
                  {product.shortDescription}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const showSkeleton = isLoading || isRefreshing;

  if (showSkeleton) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <StatusBar barStyle="light-content" />
        <PullToRefreshLayout
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        >
          <MerchantSkeleton />
        </PullToRefreshLayout>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="light-content" />

      {/* Sticky Header Overlay */}
      <Animated.View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: headerBackgroundColor,
        height: insets.top + 45,
        paddingTop: insets.top,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        // Shadow only when opaque
        ...Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: scrollY.interpolate({
              inputRange: [0, 100],
              outputRange: [0, 0.1],
              extrapolate: 'clamp',
            }),
            shadowRadius: 4,
          },
          android: {
            elevation: scrollY.interpolate({
              inputRange: [0, 100],
              outputRange: [0, 4],
              extrapolate: 'clamp',
            }),
          },
        }),
      }}>
        {/* Back Button (Always Visible, fixed width container) */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.iconButton, { marginRight: 10, zIndex: 200 }]}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>

        {/* Right Side Content Container */}
        <View style={{ flex: 1, height: '100%', justifyContent: 'center' }}>

          {/* Default State Icons */}
          <Animated.View style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            opacity: defaultIconsOpacity,
            transform: [{ translateY: defaultIconsTranslateY }],
            zIndex: 10
          }}>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="information-circle-outline" size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => toggleWishlist(merchantId)}
            >
              <Ionicons
                name={isHearted ? "heart" : "heart-outline"}
                size={24}
                color={isHearted ? "#f3a823" : "#000"}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="share-outline" size={24} color="#000" />
            </TouchableOpacity>
          </Animated.View>

          {/* Scrolled State Search Bar & Ellipsis */}
          <Animated.View
            pointerEvents={isScrolledPastThreshold ? 'auto' : 'none'}
            style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            flexDirection: 'row',
            alignItems: 'center',
            opacity: searchBarOpacity,
            transform: [{ translateY: searchBarTranslateY }],
            zIndex: 20
          }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <TouchableOpacity
                style={[styles.searchContainer, { height: 36, backgroundColor: '#f5f5f5', borderWidth: 0 }]}
                onPress={() => setIsSearchVisible(true)}
                activeOpacity={0.9}
              >
                <Ionicons name="search" size={18} color="#999" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 14, color: '#999' }}>Search menu</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="ellipsis-vertical" size={24} color="#000" />
            </TouchableOpacity>
          </Animated.View>

        </View>
      </Animated.View>

      {/* Sticky Categories Header */}
      <Animated.View style={{
        position: 'absolute',
        top: insets.top + 45,
        left: 0,
        right: 0,
        zIndex: 90,
        backgroundColor: '#fff',
        opacity: stickyCategoriesOpacity,
        transform: [{ translateY: stickyCategoriesTranslateY }],
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        // Shadow
        ...Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
          },
          android: {
            elevation: 2,
          },
        }),
      }}>
        <FlatList
          ref={stickyCategoryListRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          onScrollToIndexFailed={onScrollToIndexFailed}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleCategoryPress(item.id)}
              style={[
                styles.categoryPill,
                selectedCategoryId === item.id && styles.categoryPillActive
              ]}
            >
              <Text style={[
                styles.categoryPillText,
                selectedCategoryId === item.id && styles.categoryPillTextActive
              ]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </Animated.View>

      <Animated.SectionList
        ref={sectionListRef}
        sections={sections}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingBottom: 120 }}
        stickySectionHeadersEnabled={false} // Disable sticky headers for now as per design
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={{ margin: 20 }} color="#eba236" />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.background}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: false,
            listener: (event: any) => {
              const y = event.nativeEvent.contentOffset.y;
              const isPast = y >= headerThreshold;
              setIsScrolledPastThreshold(prev => prev !== isPast ? isPast : prev);
            }
          }
        )}
        scrollEventThrottle={16}
      />

      {/* Search Modal */}
      <MerchantSearchModal
        visible={isSearchVisible}
        onClose={() => setIsSearchVisible(false)}
        products={allProducts}
        categories={categories}
        onAddToCart={handleAddToCart}
      />

      {/* View Cart Floating Bar */}
      {merchantCart && (
        <ViewCartBar
          itemCount={merchantCart.totalItems}
          subtotal={merchantCart.subtotal}
          paddingBottom={insets.bottom > 0 ? insets.bottom : 20}
          onPress={() => navigation.navigate('MerchantCart', { merchantId })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 12, // Rounded square as per screenshot
    backgroundColor: '#fff',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f0f0f0'
  },
  merchantName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 4,
  },
  merchantAddress: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#eee'
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: '#eba236', // Orange bg
    borderColor: '#eba236',
  },
  categoryPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  categoryPillTextActive: {
    color: '#fff',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  productCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  imageContainer: {
    position: 'relative',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f0f0f0',
  },
  addButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  productContent: {
    padding: 10,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    height: 36, // 2 lines roughly
  },
  price: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  comparePrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginLeft: 6,
  },
  variableText: {
    fontSize: 12,
    color: '#eba236',
    fontWeight: '500',
  },
  shortDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    lineHeight: 16,
  },
});
