import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useWishlist } from '../hooks/useWishlist';
import LocationMerchantCard from '../components/LocationMerchantCard';
import { PullToRefreshLayout } from '../components/PullToRefreshLayout';
import {
  useLocationBasedMerchants,
  useMerchantAddresses,
  LocationBasedMerchant,
  dataCache,
  MERCHANT_KEYS,
  MERCHANT_ADDRESS_KEYS
} from '@encreasl/client-services';
import { useQueryClient } from '@tanstack/react-query';

import { useNavigation } from '../navigation/NavigationContext';

export default function NearbyRestaurantsScreen() {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const { customerId } = useAuth();
  const queryClient = useQueryClient();
  const { isWishlisted, toggleWishlist } = useWishlist();

  // Fetch all nearby merchants (limit: 50 for now)
  const {
    data: merchants = [],
    isLoading,
    isRefetching
  } = useLocationBasedMerchants(
    customerId || undefined,
    null, // No category filter
    50
  );

  // Fetch active addresses for merchants
  const { data: addressMap = {} } = useMerchantAddresses(merchants);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      console.log('🔄 NearbyRestaurantsScreen: Pull-to-refresh triggered');
      dataCache.clear();
      await Promise.all([
        queryClient.resetQueries({ queryKey: MERCHANT_KEYS.all }),
        queryClient.resetQueries({ queryKey: MERCHANT_ADDRESS_KEYS.all }),
      ]);
    } catch (error) {
      console.error('NearbyRestaurantsScreen pull-to-refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const handleMerchantPress = (merchant: LocationBasedMerchant) => {
    navigation.navigate('Merchant', {
      merchantId: merchant.id,
      distanceKm: (merchant as any).distanceKm,
      distanceInMeters: (merchant as any).distanceInMeters
    });
  };

  const renderItem = ({ item }: { item: LocationBasedMerchant }) => (
    <View style={styles.cardContainer}>
      <LocationMerchantCard
        merchant={item}
        onPress={handleMerchantPress}
        addressName={addressMap[item.id] || null}
        isWishlisted={isWishlisted(item.id)}
        onToggleWishlist={toggleWishlist}
      />
    </View>
  );

  const showSkeleton = isLoading || refreshing || isRefetching;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Nearby Restaurants
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <PullToRefreshLayout
        isRefreshing={refreshing || isRefetching}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContent}
      >
        {showSkeleton ? (
          [1, 2, 3].map(key => (
            <View key={key} style={styles.cardWrapper}>
              <View
                style={{
                  width: '100%',
                  borderRadius: 16,
                  backgroundColor: '#F3F4F6',
                  padding: 16,
                }}
              >
                <View style={{ width: '100%', height: 140, borderRadius: 12, backgroundColor: '#E5E7EB', marginBottom: 12 }} />
                <View style={{ width: '60%', height: 16, borderRadius: 8, backgroundColor: '#E5E7EB', marginBottom: 8 }} />
                <View style={{ width: '40%', height: 16, borderRadius: 8, backgroundColor: '#E5E7EB' }} />
              </View>
            </View>
          ))
        ) : merchants.length > 0 ? (
          merchants.map(merchant => (
            <View key={merchant.id} style={styles.cardWrapper}>
              {renderItem({ item: merchant })}
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No restaurants found nearby.
            </Text>
          </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  cardWrapper: {
    marginBottom: 24,
  },
  cardContainer: {
    // Container for the card
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});
