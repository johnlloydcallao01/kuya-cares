import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { AddressService } from '@encreasl/client-services';
import { AddressSearchInput } from '../shared/AddressSearchInput';
import { ActiveAddressCard } from '../shared/ActiveAddressCard';
import { MovableAddressPreviewMap } from '../shared/MovableAddressPreviewMap';
import { AddressEditView } from '../shared/AddressEditView';
import {
  buildAddressUpdate,
  ReverseGeocodeDetails,
} from '../../services/geocoding';
import { invalidateAddressDependentQueries } from '../../services/addressQueryInvalidation';
import { Ionicons } from '@expo/vector-icons';

interface CheckoutAddressSectionProps {
  onAddressChange?: (addressId: string) => void;
  style?: any;
}

export function CheckoutAddressSection({ onAddressChange, style }: CheckoutAddressSectionProps) {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();

  // ── Step state ──────────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<'list' | 'search' | 'preview' | 'edit'>('list');

  // ── Address management state ────────────────────────────────────────────────
  const [userAddresses, setUserAddresses] = useState<any[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [activeAddressId, setActiveAddressId] = useState<string | null>(null);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [previewCoords, setPreviewCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const [editCoords, setEditCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [editAddressDetails, setEditAddressDetails] = useState<ReverseGeocodeDetails | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadUserAddresses = useCallback(async () => {
    if (!user?.id || !token) return;

    setIsLoadingAddresses(true);
    try {
      const response = await AddressService.getUserAddresses(user.id, token, false);
      setUserAddresses(response.success && response.addresses ? response.addresses : []);

      try {
        const activeResponse = await AddressService.getActiveAddress(user.id, token);
        if (activeResponse.success && activeResponse.address) {
          const active = activeResponse.address;
          const newActiveId = String(typeof active === 'object' ? active.id : active);
          setActiveAddressId(newActiveId);
          onAddressChange?.(newActiveId);
        } else {
          setActiveAddressId(null);
        }
      } catch {
        setActiveAddressId(null);
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
      setUserAddresses([]);
      setActiveAddressId(null);
    } finally {
      setIsLoadingAddresses(false);
    }
  }, [user?.id, token, onAddressChange]);

  useEffect(() => {
    if (user?.id && token) {
      loadUserAddresses();
    }
  }, [user?.id, token, loadUserAddresses]);

  const handleAddressSelect = (placeDetails: any) => {
    setSelectedAddress(placeDetails);
    const placedLat = placeDetails?.geometry?.location?.lat;
    const placedLng = placeDetails?.geometry?.location?.lng;
    setPreviewCoords({
      lat: typeof placedLat === 'number' ? placedLat : (placedLat?.() ?? null),
      lng: typeof placedLng === 'number' ? placedLng : (placedLng?.() ?? null),
    });
    setCurrentStep('preview');
  };

  const handleSaveAddress = async () => {
    if (!selectedAddress || !user?.id || !token) return;

    setIsSaving(true);
    try {
      const placeForSave = previewCoords
        ? {
            ...selectedAddress,
            geometry: {
              ...(selectedAddress?.geometry || {}),
              location: {
                lat: previewCoords.lat,
                lng: previewCoords.lng,
              },
            },
          }
        : selectedAddress;

      const saveResponse = await AddressService.saveAddress(
        {
          place: placeForSave,
          address_type: 'home',
          is_default: false,
          userId: user.id,
        },
        token,
      );

      if (!saveResponse.success || !saveResponse.address) {
        throw new Error(saveResponse.error || 'Failed to save address');
      }

      const addressId = saveResponse.address.id;
      if (!addressId) throw new Error('Address ID not found in response');

      const setActiveResponse = await AddressService.setActiveAddressForUser(user.id, addressId, token);
      if (!setActiveResponse.success) {
        throw new Error(setActiveResponse.error || 'Failed to set address as active');
      }

      const newActiveId = String(addressId);
      setActiveAddressId(newActiveId);
      AddressService.clearCache();
      await loadUserAddresses();
      onAddressChange?.(newActiveId);
      
      setCurrentStep('list');
      setSelectedAddress(null);
      Alert.alert('Success', 'Address saved and activated successfully!');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetActiveAddress = async (address: any) => {
    if (!user?.id || !token) return;

    setSettingActiveId(address.id);
    try {
      const response = await AddressService.setActiveAddressForUser(user.id, address.id, token);
      if (!response.success) throw new Error(response.error || 'Failed to set active address');

      const newActiveId = String(address.id);
      setActiveAddressId(newActiveId);
      AddressService.clearCache();
      await loadUserAddresses();
      onAddressChange?.(newActiveId);
      Alert.alert('Success', 'Active address updated successfully!');
    } catch (error) {
      console.error('Error setting active address:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to set active address');
      await loadUserAddresses();
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
    setCurrentStep('edit');
  };

  const handleSaveEdit = async () => {
    if (!editingAddress || !editCoords || !user?.id || !token) return;

    setIsUpdating(true);
    try {
      const updates = buildAddressUpdate(editCoords, editAddressDetails);

      const response = await AddressService.updateAddress(editingAddress.id, updates, token);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update address');
      }

      AddressService.clearCache();
      await loadUserAddresses();

      // Refresh the header's active-address + location-based sections immediately.
      await invalidateAddressDependentQueries(queryClient);

      setEditingAddress(null);
      setEditCoords(null);
      setEditAddressDetails(null);
      setCurrentStep('list');
      Alert.alert('Success', 'Address updated successfully!');
    } catch (error) {
      console.error('Error updating address:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update address');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAddress = (id: string) => {
    if (!token) return;

    Alert.alert('Delete Address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingAddressId(id);
          try {
            const response = await AddressService.deleteAddress(id, token);
            if (!response.success) throw new Error(response.error || 'Failed to delete address');

            setUserAddresses(prev => prev.filter(a => a.id !== id));
            if (activeAddressId === String(id)) setActiveAddressId(null);
            Alert.alert('Success', 'Address deleted successfully!');
          } catch (error) {
            console.error('Error deleting address:', error);
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete address');
            await loadUserAddresses();
          } finally {
            setDeletingAddressId(null);
          }
        },
      },
    ]);
  };

  const handleBackToSearch = () => {
    setCurrentStep('list');
    setSelectedAddress(null);
    setEditingAddress(null);
    setEditCoords(null);
    setEditAddressDetails(null);
  };

  // Active address pinned to top, rest follow original order
  const sortedAddresses = [...userAddresses].sort((a, b) => {
    const aIsActive = String(a.id) === String(activeAddressId) ? 0 : 1;
    const bIsActive = String(b.id) === String(activeAddressId) ? 0 : 1;
    return aIsActive - bIsActive;
  });

  return (
    <View
      style={[
        styles.container,
        currentStep === 'edit' && styles.containerEdit,
        style,
      ]}
    >
      {currentStep !== 'edit' && (
        <Text style={styles.headerTitle}>
          {currentStep === 'preview'
            ? 'Confirm Delivery Address'
            : currentStep === 'search'
              ? 'Add New Address'
              : 'Delivery Address'}
        </Text>
      )}
      
      {currentStep === 'list' ? (
        <>
          {user?.id && (
            <View style={styles.savedAddressesContainer}>
              <Text style={styles.savedAddressesTitle}>SAVED ADDRESSES</Text>

              {isLoadingAddresses ? (
                <View style={styles.loaderContainer}>
                  <ActivityIndicator size="small" color="#9CA3AF" />
                </View>
              ) : userAddresses.length === 0 ? (
                <Text style={styles.emptyText}>No saved addresses found.</Text>
              ) : (
                <View style={styles.addressList}>
                  {sortedAddresses.map((address) => {
                    const isActive = String(activeAddressId) === String(address.id);
                    const isSettingActive = settingActiveId === address.id;
                    const isDeleting = deletingAddressId === address.id;
                    const isBusy = isSettingActive || isDeleting;
                    if (isActive) {
                      return (
                        <ActiveAddressCard
                          key={`active-${address.id}`}
                          address={address}
                          onDelete={() => handleDeleteAddress(address.id)}
                          onEdit={handleStartEdit}
                          isDeleting={isDeleting}
                        />
                      );
                    }
                    return (
                      <View 
                        key={address.id} 
                        style={[
                          styles.addressCard,
                          isActive ? styles.addressCardActive : styles.addressCardInactive
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.addressRow}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (!isActive) handleSetActiveAddress(address);
                          }}
                          disabled={isBusy}
                        >
                          {isSettingActive ? (
                            <ActivityIndicator size="small" color="#f3a823" style={styles.radio} />
                          ) : (
                            <View style={[styles.radio, isActive && styles.radioActive]}>
                              {isActive && <View style={styles.radioDot} />}
                            </View>
                          )}

                          <View style={styles.addressInfo}>
                            <Text style={styles.addressText}>{address.formatted_address}</Text>
                            <View style={styles.badgesContainer}>
                              {address.address_type && (
                                <View style={styles.typeBadge}>
                                  <Text style={styles.typeBadgeText}>{address.address_type}</Text>
                                </View>
                              )}
                              {isActive && (
                                <View style={styles.activeBadge}>
                                  <Text style={styles.activeBadgeText}>Active</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>

                        <View style={styles.cardActions}>
                          <TouchableOpacity
                            style={styles.deleteIconButton}
                            onPress={() => handleStartEdit(address)}
                            disabled={isBusy}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="pencil-outline" size={20} color="#374151" />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.deleteIconButton}
                            onPress={() => handleDeleteAddress(address.id)}
                            disabled={isBusy}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            {isDeleting ? (
                              <ActivityIndicator size="small" color="#DC2626" />
                            ) : (
                              <Ionicons name="trash-outline" size={20} color="#DC2626" />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.addAddressButton}
            activeOpacity={0.8}
            onPress={() => setCurrentStep('search')}
          >
            <Ionicons name="add" size={20} color="#f3a823" />
            <Text style={styles.addAddressText}>Add New Address</Text>
          </TouchableOpacity>
        </>
      ) : currentStep === 'search' ? (
        <AddressSearchInput
          onAddressSelect={handleAddressSelect}
          containerStyle={styles.searchContainer}
        />
      ) : currentStep === 'edit' ? (
        <AddressEditView
          address={editingAddress}
          initialLat={editCoords?.lat ?? null}
          initialLng={editCoords?.lng ?? null}
          isSaving={isUpdating}
          onChangeCoords={(lat, lng) => setEditCoords({ lat, lng })}
          onAddressDetails={setEditAddressDetails}
          onSave={handleSaveEdit}
          onCancel={handleBackToSearch}
        />
      ) : (
        <View style={styles.previewContainer}>
          <MovableAddressPreviewMap
            initialLat={previewCoords?.lat ?? null}
            initialLng={previewCoords?.lng ?? null}
            onChange={(lat, lng) => setPreviewCoords({ lat, lng })}
          />

          <Text style={styles.previewTitle}>
            {selectedAddress?.name || selectedAddress?.formatted_address}
          </Text>

          <Text style={styles.previewHint}>
            Drag the map to fine-tune the exact pin location.
          </Text>

          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToSearch}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleSaveAddress}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm & Use</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  containerEdit: {
    padding: 0,
    borderRadius: 20,
    overflow: 'hidden',
  },
  searchContainer: {
    marginBottom: 0,
  },
  savedAddressesContainer: {
    marginTop: 16,
  },
  savedAddressesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  loaderContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    paddingVertical: 12,
  },
  addressList: {
    gap: 12,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fdecc0',
    backgroundColor: '#fffdf7',
  },
  addAddressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f3a823',
  },
  addressCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  addressCardInactive: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  addressCardActive: {
    backgroundColor: '#fef3e2',
    borderColor: '#E9D5FF',
  },
  addressInfo: {
    flex: 1,
    minWidth: 0,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 6,
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeBadge: {
    backgroundColor: '#fef7e6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    color: '#9a5f0f',
    fontSize: 10,
    fontWeight: '500',
  },
  activeBadge: {
    backgroundColor: '#fef3e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  activeBadgeText: {
    color: '#f3a823',
    fontSize: 10,
    fontWeight: '500',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 12,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  radioActive: {
    borderColor: '#f3a823',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f3a823',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  deleteIconButton: {
    padding: 4,
  },
  previewContainer: {
    gap: 16,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  previewHint: {
    fontSize: 13,
    color: '#6B7280',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
});
