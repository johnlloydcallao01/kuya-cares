import React, { useState } from 'react';
import { View, Image, useWindowDimensions, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useThemeColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import MobileHeader from '../components/MobileHeader';
import {
  MERCHANT_KEYS,
  CATEGORY_KEYS,
  ADDRESS_KEYS,
  MERCHANT_ADDRESS_KEYS,
  dataCache
} from '@encreasl/client-services';
import LocationBasedProductCategoriesCarousel from '../components/LocationBasedProductCategoriesCarousel';
import { PullToRefreshLayout } from '../components/PullToRefreshLayout';
import { useNavigation } from '../navigation/NavigationContext';
import LocationBasedMerchants from '../components/LocationBasedMerchants';

export default function HomeScreen() {
  // console.log('🏠 HomeScreen: Component initializing...');
  
  const navigation = useNavigation();

  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const { customerId } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const { width } = useWindowDimensions();

  // State for location-based features
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // No need for local customerId fetching logic anymore as it's handled in AuthContext

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 Pull-to-refresh triggered (TanStack Query)');

      // Clear internal service memory cache to ensure fresh data fetch
      dataCache.clear();

      // Reset queries to clear cache and force fresh fetch
      await Promise.all([
        queryClient.resetQueries({ queryKey: MERCHANT_KEYS.all }),
        queryClient.resetQueries({ queryKey: CATEGORY_KEYS.all }),
        queryClient.resetQueries({ queryKey: ADDRESS_KEYS.all }),
        queryClient.resetQueries({ queryKey: MERCHANT_ADDRESS_KEYS.all }),
        // Customer ID is now managed by AuthContext and is stable
      ]);

    } catch (error) {
      console.error('Pull-to-refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCategorySelect = (categoryId: string | null, categorySlug: string | null) => {
    setSelectedCategoryId(categoryId);
    setSelectedCategorySlug(categorySlug);
  };

  const handleMerchantPress = (merchant: any) => {
    // Navigate to Merchant Details
    console.log('Merchant pressed:', merchant.id);
    navigation.navigate('Merchant', {
      merchantId: merchant.id,
      distanceKm: merchant.distanceKm,
      distanceInMeters: merchant.distanceInMeters
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top safe area above header - brand color */}
      <SafeAreaView style={{ backgroundColor: '#eba236' }} edges={['top']} />

      {/* Mobile Header - Now responsive for tablets */}
      <MobileHeader
        navigation={navigation}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchPress={() => {
          // TODO: Implement search modal or toggle search bar
          console.log('Search pressed');
        }}
        onNotificationPress={() => {
          navigation.navigate('Notifications');
        }}
        onWishlistPress={() => {
          navigation.navigate('Wishlist');
        }}
      />

      {/* Content area with theme background - Clean white screen as requested */}
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <PullToRefreshLayout
          isRefreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={{ flexGrow: 1, padding: 0, margin: 0 }}
        >
          {/* Banner Image */}
          <Image
            source={require('../../assets/tap2go-campaign-banner(1).png')}
            style={{
              width: width - 20, // Full width minus 10px padding on each side (margin: 10 * 2)
              height: (width - 20) * (300 / 1400), // Maintain aspect ratio based on new width
              margin: 10,
              borderRadius: 12,
            }}
            resizeMode="cover"
          />

          {/* Categories Carousel */}
          {customerId ? (
            <LocationBasedProductCategoriesCarousel
              customerId={customerId}
              selectedCategorySlug={selectedCategorySlug}
              onCategorySelect={handleCategorySelect}
            />
          ) : (
            // Placeholder or empty while loading customer
            <View style={{ height: 20 }} />
          )}

          {/* Merchants List */}
          {customerId ? (
            <LocationBasedMerchants
              customerId={customerId}
              categoryId={selectedCategoryId}
              onMerchantPress={handleMerchantPress}
            />
          ) : (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary }}>Please log in to see nearby merchants.</Text>
            </View>
          )}

          {/* Bottom Padding for scroll */}
          <View style={{ height: 5 }} />
        </PullToRefreshLayout>
      </View>
    </View>
  );
}
