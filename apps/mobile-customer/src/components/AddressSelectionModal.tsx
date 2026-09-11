import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { AddressService } from '@encreasl/client-services';
import { Ionicons } from '@expo/vector-icons';
import { AddressSearchInput } from './shared/AddressSearchInput';
import { ActiveAddressCard } from './shared/ActiveAddressCard';
import { AddressEditView } from './shared/AddressEditView';
import {
  buildAddressUpdate,
  ReverseGeocodeDetails,
} from '../services/geocoding';
import { invalidateAddressDependentQueries } from '../services/addressQueryInvalidation';

interface AddressSelectionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onAddressSelected: (address: any) => void;
}

const LIST_SNAP_POINTS = ['80%'];
const FULL_SNAP_POINTS = ['100%'];

// ─── Component ────────────────────────────────────────────────────────────────
export default function AddressSelectionModal({
  isVisible,
  onClose,
  onAddressSelected,
}: AddressSelectionModalProps) {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const sheetRef = useRef<BottomSheet>(null);

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
  const [editExtraFields, setEditExtraFields] = useState<{
    street?: string;
    floorUnitRoom?: string;
    deliveryInstructions?: string;
    label?: string;
  }>({});
  const [isUpdating, setIsUpdating] = useState(false);

  const snapPoints = useMemo(
    () => (currentStep === 'list' ? LIST_SNAP_POINTS : FULL_SNAP_POINTS),
    [currentStep],
  );

  const activeIndex = 0;

  // ── Reset state whenever modal becomes visible ──────────────────────────────
  useEffect(() => {
    if (isVisible) {
      setCurrentStep('list');
      setSelectedAddress(null);
      setPreviewCoords(null);
      setEditingAddress(null);
      setEditCoords(null);
      setEditAddressDetails(null);

      if (user?.id && token) {
        loadUserAddresses();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

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

  // ── Address management ──────────────────────────────────────────────────────
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
          setActiveAddressId(String(typeof active === 'object' ? active.id : active));
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
  }, [user?.id, token]);

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
          street: editExtraFields.street,
          floor_unit_room: editExtraFields.floorUnitRoom,
          delivery_instructions: editExtraFields.deliveryInstructions,
          label: editExtraFields.label,
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

      setActiveAddressId(String(addressId));
      AddressService.clearCache();
      await loadUserAddresses();

      onAddressSelected(saveResponse.address);
      onClose();
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

      setActiveAddressId(String(address.id));
      AddressService.clearCache();
      await loadUserAddresses();
      onAddressSelected(address);
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
    setEditExtraFields({
      street: address?.street || '',
      floorUnitRoom: address?.floor_unit_room || '',
      deliveryInstructions: address?.delivery_instructions || '',
      label: address?.label || '',
    });
    setCurrentStep('edit');
  };

  const handleSaveEdit = async () => {
    if (!editingAddress || !editCoords || !user?.id || !token) return;

    setIsUpdating(true);
    try {
      const updates = buildAddressUpdate(editCoords, editAddressDetails);

      if (editExtraFields.street) updates.street = editExtraFields.street;
      if (editExtraFields.floorUnitRoom) updates.floor_unit_room = editExtraFields.floorUnitRoom;
      if (editExtraFields.deliveryInstructions) {
        updates.delivery_instructions = editExtraFields.deliveryInstructions;
      }
      if (editExtraFields.label) updates.label = editExtraFields.label;

      const response = await AddressService.updateAddress(editingAddress.id, updates, token);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update address');
      }

      AddressService.clearCache();
      await loadUserAddresses();

      await invalidateAddressDependentQueries(queryClient);

      setEditingAddress(null);
      setEditCoords(null);
      setEditAddressDetails(null);
      setEditExtraFields({});
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

  const sortedAddresses = [...userAddresses].sort((a, b) => {
    const aIsActive = String(a.id) === String(activeAddressId) ? 0 : 1;
    const bIsActive = String(b.id) === String(activeAddressId) ? 0 : 1;
    return aIsActive - bIsActive;
  });

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <Modal
      animationType="fade"
      transparent
      statusBarTranslucent
      visible={isVisible}
      onRequestClose={onClose}
    >
      {/* ── Edit / Preview : full-screen edge-to-edge (no gorhom) ── */}
      {(currentStep === 'edit' || currentStep === 'preview') && (
        <View style={StyleSheet.absoluteFill}>
          {currentStep === 'edit' ? (
            <AddressEditView
              address={editingAddress}
              initialLat={editCoords?.lat ?? null}
              initialLng={editCoords?.lng ?? null}
              isSaving={isUpdating}
              fullBleed
              initialExtraFields={editExtraFields}
              onChangeCoords={(lat, lng) => setEditCoords({ lat, lng })}
              onAddressDetails={setEditAddressDetails}
              onExtraFieldsChange={setEditExtraFields}
              onSave={handleSaveEdit}
              onCancel={() => {
                setEditingAddress(null);
                setEditCoords(null);
                setEditAddressDetails(null);
                setEditExtraFields({});
                setCurrentStep('list');
              }}
            />
          ) : (
            <AddressEditView
              address={selectedAddress}
              initialLat={previewCoords?.lat ?? null}
              initialLng={previewCoords?.lng ?? null}
              isSaving={isSaving}
              fullBleed
              initialExtraFields={editExtraFields}
              headerLabel="Creating an address"
              saveLabel="Save and Activate"
              onChangeCoords={(lat, lng) => setPreviewCoords({ lat, lng })}
              onExtraFieldsChange={setEditExtraFields}
              onSave={handleSaveAddress}
              onCancel={() => {
                setSelectedAddress(null);
                setPreviewCoords(null);
                setEditExtraFields({});
                setCurrentStep('list');
              }}
            />
          )}
        </View>
      )}

      {/* ── List / Search : bottom sheet with drag ── */}
      {(currentStep === 'list' || currentStep === 'search') && (
      <GestureHandlerRootView style={styles.modalOverlay}>
        {/* Dimmed backdrop area — tapping dismisses the modal */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <BottomSheet
          ref={sheetRef}
          index={activeIndex}
          snapPoints={snapPoints}
          enablePanDownToClose={currentStep === 'list'}
          enableDynamicSizing={false}
          enableOverDrag={false}
          enableContentPanningGesture={true}
          topInset={0}
          onClose={onClose}
          backgroundStyle={[
            styles.sheetBackground,
            currentStep !== 'list' && styles.sheetBackgroundFull,
          ]}
          handleIndicatorStyle={currentStep === 'list' ? styles.modalHandleIndicator : { display: 'none' }}
          keyboardBehavior="interactive"
          android_keyboardInputMode="adjustResize"
        >
          <BottomSheetView style={styles.sheetContent}>
            <SafeAreaView
              edges={
                currentStep === 'list'
                  ? ['bottom']
                  : ['top', 'bottom']
              }
              style={styles.safeArea}
            >
              {/* ── Header: back arrow on search step ── */}
              {currentStep === 'search' && (
                <View style={styles.header}>
                  <TouchableOpacity
                    onPress={() => setCurrentStep('list')}
                    style={styles.headerButton}
                  >
                    <Ionicons name="arrow-back" size={24} color="#000" />
                  </TouchableOpacity>

                  <Text style={styles.headerTitle}>Add New Address</Text>

                  <View style={{ width: 40 }} />
                </View>
              )}

              {/* ── Content ── */}
              {currentStep === 'list' ? (
                <View style={styles.container}>
                  <View style={styles.manageSection}>
                    <Text style={styles.sectionTitle}>Saved Addresses</Text>

                    {isLoadingAddresses ? (
                      <View style={{ marginTop: 8 }}>
                        {[1, 2, 3].map(key => (
                          <View key={key} style={styles.addressCard}>
                            <View style={styles.addressInfo}>
                              <View style={{ width: '80%', height: 16, borderRadius: 8, backgroundColor: '#E5E7EB', marginBottom: 8 }} />
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 64, height: 18, borderRadius: 9, backgroundColor: '#E5E7EB', marginRight: 8 }} />
                                <View style={{ width: 64, height: 18, borderRadius: 9, backgroundColor: '#fef3e2' }} />
                              </View>
                            </View>
                            <View style={[styles.radioRow, { alignItems: 'center' }]}>
                              <View style={{ flex: 1, height: 24, borderRadius: 6, backgroundColor: '#E5E7EB' }} />
                              <View style={styles.radioPlaceholder} />
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <BottomSheetFlatList
                        data={sortedAddresses}
                        keyExtractor={item => String(item.id)}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={
                          <Text style={styles.emptyText}>No saved addresses found.</Text>
                        }
                        renderItem={({ item }: { item: any }) => {
                          const isActive = String(activeAddressId) === String(item.id);
                          const isSettingActive = settingActiveId === item.id;
                          const isDeleting = deletingAddressId === item.id;
                          const isBusy = isSettingActive || isDeleting;
                          if (isActive) {
                            return (
                              <ActiveAddressCard
                                address={item}
                                onDelete={() => handleDeleteAddress(item.id)}
                                onEdit={handleStartEdit}
                                isDeleting={isDeleting}
                              />
                            );
                          }
                          return (
                            <View style={[styles.addressCard, isActive && styles.activeCard]}>
                              <TouchableOpacity
                                style={styles.radioRow}
                                activeOpacity={0.7}
                                onPress={() => {
                                  if (!isActive) handleSetActiveAddress(item);
                                }}
                                disabled={isBusy}
                              >
                                {isSettingActive ? (
                                  <ActivityIndicator size="small" color="#f3a823" style={styles.radioLeftBusy} />
                                ) : (
                                  <View style={[styles.radio, isActive && styles.radioActive]}>
                                    {isActive && <View style={styles.radioDot} />}
                                  </View>
                                )}

                                <View style={styles.addressInfo}>
                                  <Text style={styles.addressText}>{item.formatted_address}</Text>
                                  <View style={styles.badgesContainer}>
                                    {item.address_type && (
                                      <View style={styles.typeBadge}>
                                        <Text style={styles.typeBadgeText}>{item.address_type}</Text>
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
                                  onPress={() => handleStartEdit(item)}
                                  disabled={isBusy}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Ionicons name="pencil-outline" size={20} color="#374151" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={styles.deleteIconButton}
                                  onPress={() => handleDeleteAddress(item.id)}
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
                        }}
                      />
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.addAddressButton}
                    activeOpacity={0.8}
                    onPress={() => setCurrentStep('search')}
                  >
                    <Ionicons name="add-circle-outline" size={24} color="#f3a823" />
                    <Text style={styles.addAddressText}>Add New Address</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.containerSearch}>
                  <AddressSearchInput onAddressSelect={handleAddressSelect} />
                </View>
              )}
            </SafeAreaView>
          </BottomSheetView>
        </BottomSheet>
      </GestureHandlerRootView>
      )}
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetBackground: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetBackgroundFull: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  sheetContent: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  modalHandleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerButton: {
    padding: 8,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: 'white',
  },
  containerSearch: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: 'white',
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 24,
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
  manageSection: {
    flex: 1,
    zIndex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addressInfo: {
    flex: 1,
    minWidth: 0,
    marginBottom: 12,
  },
  addressText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 22,
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    backgroundColor: '#fef7e6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  typeBadgeText: {
    color: '#9a5f0f',
    fontSize: 12,
    fontWeight: '500',
  },
  activeBadge: {
    backgroundColor: '#fef3e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  activeBadgeText: {
    color: '#f3a823',
    fontSize: 12,
    fontWeight: '500',
  },
  radioRow: {
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
  radioLeftBusy: {
    width: 24,
    height: 24,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  radioPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  activeCard: {
    borderColor: '#fdecc0',
    backgroundColor: '#fffdf7',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  deleteIconButton: {
    padding: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 20,
  },
  });
