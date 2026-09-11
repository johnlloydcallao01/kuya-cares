import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWishlist } from '../hooks/useWishlist';
import LocationMerchantCard from '../components/LocationMerchantCard';
import { useThemeColors } from '../contexts/ThemeContext';
import { LocationBasedMerchant, useMerchantAddresses } from '@encreasl/client-services';
import { PullToRefreshLayout } from '../components/PullToRefreshLayout';

import { useNavigation } from '../navigation/NavigationContext';

export default function WishlistScreen() {
  const navigation = useNavigation();
  const { wishlistDocs, isLoading, isRefetching, isWishlisted, toggleWishlist, refetch } = useWishlist();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();

  const merchants = useMemo(() => {
    return wishlistDocs
      .map((doc: any) => doc.merchant)
      .filter((m: any): m is LocationBasedMerchant => !!m && typeof m === 'object');
  }, [wishlistDocs]);

  // Fetch active addresses for merchants
  const { data: addressMap = {} } = useMerchantAddresses(merchants);

  const handleMerchantPress = (merchant: LocationBasedMerchant) => {
    navigation.navigate('Merchant', { 
      merchantId: merchant.id,
      distanceKm: (merchant as any).distanceKm,
      distanceInMeters: (merchant as any).distanceInMeters
    });
  };

  const handleRefresh = useCallback(async () => {
    // Force refetch of wishlist
    await refetch();
  }, [refetch]);

  const showSkeleton = isLoading || isRefetching;

  const contentStyle = useMemo(() => {
    if (merchants.length === 0 && !showSkeleton) {
      return styles.emptyContainer;
    }
    return styles.listContent;
  }, [merchants.length, showSkeleton]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          My Wishlist
        </Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {merchants.length} places
          </Text>
        </View>
      </View>

      <PullToRefreshLayout 
        isRefreshing={isRefetching}
        onRefresh={handleRefresh}
        contentContainerStyle={contentStyle}
      >
        {showSkeleton ? (
          [1, 2, 3].map(key => (
            <View key={key} style={styles.cardWrapper}>
              <View
                style={{
                  width: '100%',
                  // Mimic LocationMerchantCard height roughly
                  height: width * 0.6, 
                  borderRadius: 16,
                  backgroundColor: '#F3F4F6',
                  padding: 16,
                }}
              >
                <View style={{ width: '100%', height: '60%', borderRadius: 12, backgroundColor: '#E5E7EB', marginBottom: 12 }} />
                <View style={{ width: '60%', height: 16, borderRadius: 8, backgroundColor: '#E5E7EB', marginBottom: 8 }} />
                <View style={{ width: '40%', height: 16, borderRadius: 8, backgroundColor: '#E5E7EB' }} />
              </View>
            </View>
          ))
        ) : merchants.length === 0 ? (
          <>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="heart-outline" size={60} color="#9ca3af" />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Your wishlist is empty
            </Text>
            <Text style={styles.emptySubtitle}>
              Save your favorite restaurants to find them easily later!
            </Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Home')}
              style={styles.exploreButton}
            >
              <Text style={styles.exploreButtonText}>
                Explore Restaurants
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          merchants.map((merchant) => (
            <View key={merchant.id} style={styles.cardWrapper}>
              <LocationMerchantCard
                merchant={merchant}
                onPress={handleMerchantPress}
                addressName={addressMap[merchant.id] || null}
                isWishlisted={isWishlisted(merchant.id)}
                onToggleWishlist={toggleWishlist}
              />
            </View>
          ))
        )}
      </PullToRefreshLayout>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  countText: {
    color: '#f97316',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  cardWrapper: {
    marginBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 100,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    backgroundColor: '#f3f4f6',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    fontSize: 16,
  },
  exploreButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  exploreButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
