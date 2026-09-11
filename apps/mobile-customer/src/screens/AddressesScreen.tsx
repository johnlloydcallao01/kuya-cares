import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useThemeColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { AddressService } from '@encreasl/client-services';
import { PullToRefreshLayout } from '../components/PullToRefreshLayout';
import { ActiveAddressCard } from '../components/shared/ActiveAddressCard';
import { AddressEditView } from '../components/shared/AddressEditView';
import {
  buildAddressUpdate,
  ReverseGeocodeDetails,
} from '../services/geocoding';
import { invalidateAddressDependentQueries } from '../services/addressQueryInvalidation';

export default function AddressesScreen() {
  const colors = useThemeColors();
  const { user, token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [addresses, setAddresses] = useState<any[]>([]);
  const [activeAddressId, setActiveAddressId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const [editCoords, setEditCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [editAddressDetails, setEditAddressDetails] = useState<ReverseGeocodeDetails | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id || !token) {
      setLoading(false);
      return;
    }

    try {
      const [addrRes, activeRes] = await Promise.all([
        AddressService.getUserAddresses(user.id, token, false),
        AddressService.getActiveAddress(user.id, token),
      ]);

      setAddresses(
        addrRes.success && addrRes.addresses ? addrRes.addresses : [],
      );

      if (activeRes.success && activeRes.address) {
        const active = activeRes.address;
        setActiveAddressId(
          String(typeof active === 'object' ? active.id : active),
        );
      } else {
        setActiveAddressId(null);
      }
    } catch (err) {
      console.error('Failed to load addresses:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSetActive = async (address: any) => {
    if (!user?.id || !token || settingActiveId) return;
    setSettingActiveId(String(address.id));

    try {
      const res = await AddressService.setActiveAddressForUser(
        user.id,
        address.id,
        token,
      );
      if (!res.success) {
        throw new Error(res.error || 'Failed to set active address');
      }

      setActiveAddressId(String(address.id));
      AddressService.clearCache();
      await loadData();
      Alert.alert('Success', 'Active address updated');
    } catch (err) {
      console.error('Failed to set active address:', err);
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to set active address',
      );
      await loadData();
    } finally {
      setSettingActiveId(null);
    }
  };

  const handleStartEdit = (address: any) => {
    setEditingAddress(address);
    setEditAddressDetails(null);
    setEditCoords({
      lat: typeof address?.latitude === 'number' ? address.latitude : null,
      lng: typeof address?.longitude === 'number' ? address.longitude : null,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingAddress || !editCoords || !user?.id || !token) return;

    setIsUpdating(true);
    try {
      const updates = buildAddressUpdate(editCoords, editAddressDetails);

      const res = await AddressService.updateAddress(editingAddress.id, updates, token);

      if (!res.success) {
        throw new Error(res.error || 'Failed to update address');
      }

      AddressService.clearCache();
      await loadData();

      // Refresh the header's active-address + location-based sections immediately.
      await invalidateAddressDependentQueries(queryClient);

      setEditingAddress(null);
      setEditCoords(null);
      setEditAddressDetails(null);
      Alert.alert('Success', 'Address updated');
    } catch (err) {
      console.error('Failed to update address:', err);
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to update address',
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingAddressId(id);
          try {
            const res = await AddressService.deleteAddress(id, token);
            if (!res.success) {
              throw new Error(res.error || 'Failed to delete address');
            }

            setAddresses((prev) => prev.filter((a) => String(a.id) !== id));
            if (activeAddressId === id) setActiveAddressId(null);
            Alert.alert('Success', 'Address deleted');
          } catch (err) {
            console.error('Failed to delete address:', err);
            Alert.alert(
              'Error',
              err instanceof Error ? err.message : 'Failed to delete address',
            );
            await loadData();
          } finally {
            setDeletingAddressId(null);
          }
        },
      },
    ]);
  };

  const renderAddress = (address: any) => {
    const isActive = String(activeAddressId) === String(address.id);
    const addressType = address.address_type || 'Other';
    const isSettingActive = settingActiveId === String(address.id);
    const isDeleting = deletingAddressId === String(address.id);
    const isBusy = isSettingActive || isDeleting;

    if (isActive) {
      return (
        <ActiveAddressCard
          address={address}
          onDelete={(id) => handleDelete(String(id))}
          onEdit={handleStartEdit}
          isDeleting={isDeleting}
        />
      );
    }

    return (
      <View
        key={String(address.id)}
        style={{
          backgroundColor: isActive ? colors.primaryLight : colors.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: isActive ? colors.primary : colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        }}
      >
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'flex-start' }}
          activeOpacity={0.7}
          onPress={() => {
            if (!isActive) handleSetActive(address);
          }}
          disabled={isBusy}
        >
          {isSettingActive ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12, marginTop: 1 }} />
          ) : (
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: isActive ? colors.primary : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
                marginTop: 1,
                flexShrink: 0,
              }}
            >
              {isActive && (
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: colors.primary,
                  }}
                />
              )}
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: colors.text,
                marginBottom: 4,
              }}
              numberOfLines={3}
            >
              {address.formatted_address || 'Untitled address'}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {addressType && (
                <View
                  style={{
                    backgroundColor: isActive ? colors.primary : colors.border,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                  }}
                >
                  <Text
                    style={{
                      color: isActive ? colors.surface : colors.textSecondary,
                      fontSize: 11,
                      fontWeight: '600',
                      textTransform: 'capitalize',
                    }}
                  >
                    {addressType}
                  </Text>
                </View>
              )}
              {isActive && (
                <View
                  style={{
                    backgroundColor: colors.primary,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                  }}
                >
                  <Text
                    style={{
                      color: colors.surface,
                      fontSize: 11,
                      fontWeight: '600',
                    }}
                  >
                    Active
                  </Text>
                </View>
              )}
              {address.is_verified && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={13} color="#10b981" />
                  <Text
                    style={{
                      color: '#10b981',
                      fontSize: 11,
                      fontWeight: '600',
                    }}
                  >
                    Verified
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Actions */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => handleStartEdit(address)}
            disabled={isBusy}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              padding: 4,
            }}
          >
            <Ionicons name="pencil-outline" size={20} color="#374151" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleDelete(String(address.id))}
            disabled={isDeleting}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              padding: 4,
            }}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Ionicons name="trash-outline" size={22} color="#dc2626" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={{ backgroundColor: colors.primary }} edges={['top']} />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 8, marginRight: 8, marginLeft: -8 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, flex: 1 }}>
            Delivery Addresses
          </Text>
          <View
            style={{
              backgroundColor: colors.primaryLight,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
              {addresses.length} saved
            </Text>
          </View>
        </View>

        <PullToRefreshLayout isRefreshing={refreshing} onRefresh={handleRefresh}>
          <View style={{ padding: 16 }}>
            {editingAddress ? (
              <AddressEditView
                address={editingAddress}
                initialLat={editCoords?.lat ?? null}
                initialLng={editCoords?.lng ?? null}
                isSaving={isUpdating}
                onChangeCoords={(lat, lng) => setEditCoords({ lat, lng })}
                onAddressDetails={setEditAddressDetails}
                onSave={handleSaveEdit}
                onCancel={() => {
                  setEditingAddress(null);
                  setEditCoords(null);
                  setEditAddressDetails(null);
                }}
              />
            ) : loading && !refreshing ? (
              <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : !user ? (
              <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                <Ionicons name="person-outline" size={48} color={colors.textSecondary} />
                <Text
                  style={{
                    marginTop: 16,
                    color: colors.textSecondary,
                    fontSize: 16,
                    textAlign: 'center',
                  }}
                >
                  Please log in to manage your addresses.
                </Text>
              </View>
            ) : addresses.length === 0 ? (
              <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                <View
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    backgroundColor: colors.primaryLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Ionicons name="location-outline" size={48} color={colors.primary} />
                </View>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: colors.text,
                    marginBottom: 8,
                    textAlign: 'center',
                  }}
                >
                  No saved addresses
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    textAlign: 'center',
                    lineHeight: 20,
                    marginBottom: 8,
                  }}
                >
                  Add a delivery address during checkout and it will appear here.
                </Text>
              </View>
            ) : (
              [...addresses]
                .sort((a, b) => {
                  const aIsActive = String(activeAddressId) === String(a.id) ? 0 : 1;
                  const bIsActive = String(activeAddressId) === String(b.id) ? 0 : 1;
                  return aIsActive - bIsActive;
                })
                .map(renderAddress)
            )}
          </View>
          <View style={{ height: 40 }} />
        </PullToRefreshLayout>
      </View>
    </View>
  );
}
