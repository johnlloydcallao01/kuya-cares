import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useResponsiveStyles, createResponsiveValue, createResponsiveSpacing, createResponsiveFontSize } from '../hooks/useResponsiveStyles';
import { useThemeColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationsContext';
import {
  useActiveAddress,
  ADDRESS_KEYS,
  MERCHANT_KEYS,
  CATEGORY_KEYS,
  MERCHANT_ADDRESS_KEYS,
  dataCache,
} from '@encreasl/client-services';
import AddressSelectionModal from './AddressSelectionModal';
import SearchModal from './SearchModal';

interface MobileHeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSearchPress?: () => void;
  onNotificationPress?: () => void;
  onWishlistPress?: () => void;
  navigation?: any;
}

export default function MobileHeader({
  searchQuery,
  onSearchChange,
  onSearchPress,
  onNotificationPress,
  onWishlistPress,
  navigation,
}: MobileHeaderProps) {
  const colors = useThemeColors();
  const { user, token } = useAuth();
  const { unseenCount, markAllAsSeen } = useNotifications();
  const queryClient = useQueryClient();
  const [isAddressModalVisible, setIsAddressModalVisible] = useState(false);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);

  const {
    data: selectedAddress = null,
    isLoading: isLoadingAddress,
    isRefetching: isRefetchingAddress
  } = useActiveAddress(user?.id ? String(user.id) : undefined, token || undefined);

  // Combine loading states for UI feedback
  const isLoading = isLoadingAddress || isRefetchingAddress;

  // Create responsive styles
  const styles = useResponsiveStyles((screenInfo) => ({
    container: {
      backgroundColor: 'white',
      paddingHorizontal: createResponsiveSpacing(screenInfo, 10),
      paddingVertical: createResponsiveSpacing(screenInfo, 8),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: createResponsiveValue(screenInfo, {
        mobile: 56,
        tablet: 64,
        largeTablet: 72,
      }),
    },
    leftSection: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 16,
    },
    locationIcon: {
      marginRight: createResponsiveSpacing(screenInfo, 8),
    },
    locationText: {
      fontSize: createResponsiveFontSize(screenInfo, 14),
      fontWeight: '600',
      color: '#333',
    },
    locationSkeleton: {
      width: createResponsiveValue(screenInfo, {
        mobile: 140,
        tablet: 200,
        largeTablet: 240,
      }),
      height: 14,
      borderRadius: 7,
      backgroundColor: '#E5E7EB',
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconButton: {
      width: createResponsiveValue(screenInfo, { mobile: 38, tablet: 42, largeTablet: 46 }),
      height: createResponsiveValue(screenInfo, { mobile: 38, tablet: 42, largeTablet: 46 }),
      borderRadius: createResponsiveValue(screenInfo, { mobile: 10, tablet: 11, largeTablet: 12 }),
      backgroundColor: 'white',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: createResponsiveSpacing(screenInfo, 8),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
  }));

  const handleAddressSelected = async (_address: any) => {
    // 1. Clear the internal in-memory service cache so stale location-based
    //    results don't bleed through on the next fetch.
    dataCache.clear();

    // 2. Reset (evict + refetch) every query that depends on the active address.
    //    resetQueries wipes the cached data immediately, causing active consumers
    //    (HomeScreen merchants/categories) to show their loading state and re-fetch
    //    fresh data — exactly like FoodPanda does on address change.
    await Promise.all([
      queryClient.resetQueries({ queryKey: ADDRESS_KEYS.all }),
      queryClient.resetQueries({ queryKey: MERCHANT_KEYS.all }),
      queryClient.resetQueries({ queryKey: CATEGORY_KEYS.all }),
      queryClient.resetQueries({ queryKey: MERCHANT_ADDRESS_KEYS.all }),
    ]);

    setIsAddressModalVisible(false);
  };

  const displayAddress = selectedAddress
    ? (selectedAddress.formatted_address || selectedAddress.name || 'Set Address')
    : 'Select Location';

  return (
    <>
      <View style={styles.container}>
        {/* Left Side - Location */}
        <TouchableOpacity
          style={styles.leftSection}
          onPress={() => setIsAddressModalVisible(true)}
        >
          <Ionicons
            name="location-outline"
            size={20}
            color={colors.textSecondary}
            style={styles.locationIcon}
          />
          {isLoading ? (
            <View style={styles.locationSkeleton} />
          ) : (
            <Text style={styles.locationText} numberOfLines={1}>
              {displayAddress}
            </Text>
          )}
        </TouchableOpacity>

        {/* Right Side - Icons */}
        <View style={styles.rightSection}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              if (onSearchPress) onSearchPress();
              setIsSearchModalVisible(true);
            }}
          >
            <Ionicons name="search-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(event) => {
              event?.stopPropagation?.();
              // Facebook-style: clicking the bell clears the badge (seen) but
              // the notifications stay unread until individually read.
              markAllAsSeen();
              if (onNotificationPress) onNotificationPress();
            }}
            style={styles.iconButton}
          >
            <View>
              <Ionicons name="notifications-outline" size={24} color={colors.textSecondary} />
              {unseenCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -8,
                    backgroundColor: colors.notification,
                    borderRadius: 9,
                    minWidth: 18,
                    height: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 3,
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>
                    {unseenCount > 9 ? '9+' : unseenCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <AddressSelectionModal
        isVisible={isAddressModalVisible}
        onClose={() => setIsAddressModalVisible(false)}
        onAddressSelected={handleAddressSelected}
      />
      <SearchModal
        visible={isSearchModalVisible}
        onClose={() => setIsSearchModalVisible(false)}
        navigation={navigation}
      />
    </>
  );
}
