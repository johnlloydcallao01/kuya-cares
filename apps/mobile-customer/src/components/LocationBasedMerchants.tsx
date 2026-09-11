import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  LocationBasedMerchant,
  sortMerchantsByRecentlyUpdated,
  useLocationBasedMerchants,
  useMerchantAddresses
} from '@encreasl/client-services';
import LocationMerchantCard from './LocationMerchantCard';
import { useThemeColors } from '../contexts/ThemeContext';
import { useWishlist } from '../hooks/useWishlist';
import { useNavigation } from '../navigation/NavigationContext';

interface LocationBasedMerchantsProps {
  customerId?: string;
  limit?: number;
  categoryId?: string | null;
  onMerchantPress?: (merchant: LocationBasedMerchant) => void;
}

function MerchantCardSkeleton({ width }: { width: number }) {
  return (
    <View
      style={{
        width: width * 0.75,
        marginRight: 16,
        marginBottom: 24,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        padding: 16,
      }}
    >
      <View
        style={{
          width: '100%',
          height: 140,
          borderRadius: 12,
          backgroundColor: '#E5E7EB',
          marginBottom: 12,
        }}
      />
      <View
        style={{
          width: '60%',
          height: 12,
          borderRadius: 6,
          backgroundColor: '#E5E7EB',
          marginBottom: 8,
        }}
      />
      <View
        style={{
          width: '40%',
          height: 10,
          borderRadius: 5,
          backgroundColor: '#E5E7EB',
        }}
      />
    </View>
  );
}

function VerticalMerchantCardSkeleton() {
  return (
    <View
      style={{
        width: '100%',
        marginBottom: 16,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        padding: 16,
      }}
    >
      <View
        style={{
          width: '100%',
          height: 140,
          borderRadius: 12,
          backgroundColor: '#E5E7EB',
          marginBottom: 12,
        }}
      />
      <View
        style={{
          width: '60%',
          height: 12,
          borderRadius: 6,
          backgroundColor: '#E5E7EB',
          marginBottom: 8,
        }}
      />
      <View
        style={{
          width: '40%',
          height: 10,
          borderRadius: 5,
          backgroundColor: '#E5E7EB',
        }}
      />
    </View>
  );
}

export default function LocationBasedMerchants({
  customerId,
  limit = 20,
  categoryId,
  onMerchantPress
}: LocationBasedMerchantsProps) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const navigation = useNavigation();

  const {
    data: allMerchants = [],
    isLoading,
    isRefetching
  } = useLocationBasedMerchants(
    customerId,
    categoryId,
    limit
  );

  // Apply limit logic for display:
  // If no category filter (categoryId is null), show max 8 items.
  // Otherwise, show all (or up to limit passed in props)
  const merchants = useMemo(() => {
    if (!categoryId) {
      return allMerchants.slice(0, 8);
    }
    return allMerchants;
  }, [allMerchants, categoryId]);

  // Check if we have more than 8 merchants to show the chevron
  const showChevron = !categoryId && allMerchants.length > 8;

  // Fetch active addresses for merchants
  const { data: addressMap = {} } = useMerchantAddresses(merchants);

  const loading = isLoading || isRefetching;

  const colors = useThemeColors();
  const { width } = useWindowDimensions();

  // Compute newly updated merchants (Client-side sort using shared logic)
  // Only shown when no category filter is active, matching web logic
  const newlyUpdatedMerchantsFull = useMemo(() => {
    if (categoryId) return [];
    return sortMerchantsByRecentlyUpdated(allMerchants);
  }, [allMerchants, categoryId]);

  const newlyUpdatedMerchants = useMemo(() => {
    return newlyUpdatedMerchantsFull.slice(0, 8);
  }, [newlyUpdatedMerchantsFull]);

  const showChevronNewlyUpdated = newlyUpdatedMerchantsFull.length > 8;

  const handleNavigateToNearby = () => {
    navigation.navigate('NearbyRestaurants');
  };

  const handleNavigateToNewlyUpdated = () => {
    navigation.navigate('NewlyUpdated');
  };

  if (!customerId) return null;

  // Newly Updated only ever exists on the unfiltered home view
  const showNewlyUpdatedSection = !categoryId && (loading || newlyUpdatedMerchants.length > 0);

  return (
    <View style={styles.container}>
      {/* ================= Nearby Merchants Section ================= */}
      <View style={styles.sectionContainer}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: colors.text }]}>
              {categoryId ? 'Filtered Merchants' : 'Nearby Merchants'}
            </Text>
            {showChevron && (
              <TouchableOpacity
                onPress={handleNavigateToNearby}
                style={styles.chevronButton}
              >
                <Ionicons name="chevron-forward" size={16} color="#333" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          categoryId ? (
            <View style={styles.verticalList}>
              {[1, 2, 3].map(key => (
                <VerticalMerchantCardSkeleton key={key} />
              ))}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              decelerationRate="fast"
              snapToInterval={width * 0.75 + 16}
            >
              {[1, 2, 3].map(key => (
                <MerchantCardSkeleton key={key} width={width} />
              ))}
            </ScrollView>
          )
        ) : merchants.length > 0 ? (
          categoryId ? (
            <View style={styles.verticalList}>
              {merchants.map((merchant) => (
                <View
                  key={merchant.id}
                  style={{ width: '100%', marginBottom: 16 }}
                >
                  <LocationMerchantCard
                    merchant={merchant}
                    onPress={onMerchantPress}
                    addressName={addressMap[merchant.id] || null}
                    isWishlisted={isWishlisted(merchant.id)}
                    onToggleWishlist={toggleWishlist}
                  />
                </View>
              ))}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              decelerationRate="fast"
              snapToInterval={width * 0.75 + 16} // card width + margin
            >
              {merchants.map((merchant) => (
                <View
                  key={merchant.id}
                  style={{ width: width * 0.75, marginRight: 16 }}
                >
                  <LocationMerchantCard
                    merchant={merchant}
                    onPress={onMerchantPress}
                    addressName={addressMap[merchant.id] || null}
                    isWishlisted={isWishlisted(merchant.id)}
                    onToggleWishlist={toggleWishlist}
                  />
                </View>
              ))}
            </ScrollView>
          )
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No merchants found nearby.
            </Text>
          </View>
        )}
      </View>

      {/* Newly Updated Section - Independent skeleton rendered in its real position */}
      {showNewlyUpdatedSection && (
        <View style={styles.sectionContainer}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={[styles.title, { color: colors.text }]}>
                Newly Updated
              </Text>
              {!loading && showChevronNewlyUpdated && (
                <TouchableOpacity
                  onPress={handleNavigateToNewlyUpdated}
                  style={styles.chevronButton}
                >
                  <Ionicons name="chevron-forward" size={16} color="#333" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {loading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              decelerationRate="fast"
              snapToInterval={width * 0.75 + 16}
            >
              {[1, 2, 3].map(key => (
                <MerchantCardSkeleton key={`newly-${key}`} width={width} />
              ))}
            </ScrollView>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              decelerationRate="fast"
              snapToInterval={width * 0.75 + 16} // card width + margin
            >
              {newlyUpdatedMerchants.map((merchant) => (
                <View
                  key={`newly-${merchant.id}`}
                  style={{ width: width * 0.75, marginRight: 16 }}
                >
                  <LocationMerchantCard
                    merchant={merchant}
                    onPress={onMerchantPress}
                    addressName={addressMap[merchant.id] || null}
                    isWishlisted={isWishlisted(merchant.id)}
                    onToggleWishlist={toggleWishlist}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionContainer: {
    marginTop: 0,
  },
  header: {
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  chevronButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  list: {
    // Items handle their own spacing
  },
  horizontalList: {
    paddingRight: 16,
  },
  verticalList: {
    paddingHorizontal: 0,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  }
});
