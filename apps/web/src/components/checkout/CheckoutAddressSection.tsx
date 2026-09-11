'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AddressSearchInput } from '@/components/shared/AddressSearchInput';
import { AddressService } from '@encreasl/client-services';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';
import { emitAddressChange } from '@/hooks/useAddressChange';
import { ListItemSkeleton } from '@/components/ui/Skeleton';

interface CheckoutAddressSectionProps {
  className?: string;
}

export function CheckoutAddressSection({ className = '' }: CheckoutAddressSectionProps) {
  const [userAddresses, setUserAddresses] = useState<any[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [activeAddressId, setActiveAddressId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Multi-step state
  const [currentStep, setCurrentStep] = useState<'search' | 'preview'>('search');
  const [selectedAddress, setSelectedAddress] = useState<google.maps.places.PlaceResult | null>(null);

  const { user } = useUser();

  const loadUserAddresses = useCallback(async () => {
    if (!user?.id) return;

    const cachedAddresses = AddressService.getCachedAddresses();
    const cachedActive = AddressService.getCachedActiveAddress(user.id);

    if (cachedAddresses && cachedAddresses.length > 0) {
      setUserAddresses(cachedAddresses);
      if (cachedActive && cachedActive.id) {
        setActiveAddressId(cachedActive.id);
      }
      setIsLoadingAddresses(false);
    } else {
      setIsLoadingAddresses(true);
    }

    try {
      const response = await AddressService.getUserAddresses(user.id, undefined, false);
      if (response.success && response.addresses) {
        setUserAddresses(response.addresses);
      } else {
        console.error('Failed to load addresses:', response.error);
        setUserAddresses([]);
      }

      try {
        const activeResponse = await AddressService.getActiveAddress(user.id, undefined, false);
        if (activeResponse.success && activeResponse.address) {
          setActiveAddressId(activeResponse.address.id);
        } else {
          setActiveAddressId(null);
        }
      } catch (error) {
        console.error('Error loading active address:', error);
        setActiveAddressId(null);
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
      setUserAddresses([]);
      setActiveAddressId(null);
    } finally {
      setIsLoadingAddresses(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadUserAddresses();
    }
  }, [user?.id, loadUserAddresses]);

  const handleDeleteAddress = async (addressId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this address? This action cannot be undone.');
    if (!confirmed) return;

    setDeletingAddressId(addressId);
    try {
      const response = await AddressService.deleteAddress(addressId);

      if (response.success) {
        toast.success('Address deleted successfully!');
        setUserAddresses(prev => prev.filter(addr => addr.id !== addressId));
        if (activeAddressId === addressId) {
          setActiveAddressId(null);
        }
      } else {
        throw new Error(response.error || 'Failed to delete address');
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete address');
      await loadUserAddresses();
    } finally {
      setDeletingAddressId(null);
    }
  };

  const handleSetActiveAddress = async (addressId: string) => {
    if (!user?.id) return;

    setSettingActiveId(addressId);
    try {
      const response = await AddressService.setActiveAddressForUser(user.id, addressId);

      if (response.success) {
        toast.success('Active address updated successfully!');
        setActiveAddressId(addressId);
        emitAddressChange(addressId);
      } else {
        throw new Error(response.error || 'Failed to set active address');
      }
    } catch (error) {
      console.error('Error setting active address:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to set active address');
      await loadUserAddresses();
    } finally {
      setSettingActiveId(null);
    }
  };

  const handleAddressSelect = async (place: google.maps.places.PlaceResult) => {
    setSelectedAddress(place);
    setCurrentStep('preview');
  };

  const handleSaveAddress = async () => {
    if (!selectedAddress || !user?.id) return;

    setIsSaving(true);
    try {
      const saveResponse = await AddressService.saveAddress({
        place: selectedAddress,
        address_type: 'home',
        is_default: false,
        userId: user.id,
      });

      if (!saveResponse.success || !saveResponse.address) {
        throw new Error(saveResponse.error || 'Failed to save address');
      }

      const addressId = saveResponse.address.doc?.id || saveResponse.address.id;
      if (!addressId) {
        throw new Error('Address ID not found in response');
      }

      const setActiveResponse = await AddressService.setActiveAddressForUser(user.id, addressId);

      if (!setActiveResponse.success) {
        throw new Error(setActiveResponse.error || 'Failed to set address as active');
      }

      toast.success('Address saved and activated successfully!');
      setActiveAddressId(addressId);
      AddressService.clearCache();
      await loadUserAddresses();
      emitAddressChange(addressId);
      
      setCurrentStep('search');
      setSelectedAddress(null);
    } catch (error) {
      console.error('Error in save and activate process:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save and activate address');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackToSearch = () => {
    setCurrentStep('search');
    setSelectedAddress(null);
  };

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3 ${className}`}>
      <h2 className="text-sm font-semibold text-gray-900">
        {currentStep === 'preview' ? 'Confirm Delivery Address' : 'Delivery Address'}
      </h2>
      
      {currentStep === 'search' ? (
        <>
          <AddressSearchInput
            placeholder="Search for an address"
            onAddressSelect={handleAddressSelect}
            inputClassName="w-full pl-12 pr-4 py-3 bg-gray-50 border-0 rounded-xl text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all"
            fullPage={false}
          />

          {user?.id && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Saved Addresses</h3>

              {isLoadingAddresses ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <ListItemSkeleton key={i} />
                  ))}
                </div>
              ) : userAddresses.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  <p>No saved addresses found.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {userAddresses.map((address) => (
                    <div
                      key={address.id}
                      className={`p-3 rounded-lg border transition-all ${
                        activeAddressId === address.id 
                          ? 'bg-purple-50 border-purple-200 ring-1 ring-purple-200' 
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex flex-col space-y-2">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {address.formatted_address}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {address.address_type && (
                              <span className="inline-block px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded">
                                {address.address_type}
                              </span>
                            )}
                            {address.is_default && (
                              <span className="inline-block px-1.5 py-0.5 text-[10px] bg-green-100 text-green-800 rounded">
                                Default
                              </span>
                            )}
                            {activeAddressId === address.id && (
                              <span className="inline-block px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-800 rounded">
                                Active
                              </span>
                            )}
                          </div>
                          {address.notes && (
                            <p className="text-xs text-gray-600 mt-1">{address.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleSetActiveAddress(address.id)}
                            disabled={settingActiveId === address.id || activeAddressId === address.id}
                            className={`px-2 py-1 text-[10px] font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${activeAddressId === address.id
                                ? 'text-purple-600 bg-white border border-purple-100'
                                : 'text-blue-600 bg-white border border-blue-100 hover:bg-blue-50'
                              }`}
                          >
                            {settingActiveId === address.id ? 'Setting...' : activeAddressId === address.id ? 'Active' : 'Use'}
                          </button>
                          <button
                            onClick={() => handleDeleteAddress(address.id)}
                            disabled={deletingAddressId === address.id}
                            className="px-2 py-1 text-[10px] font-medium text-red-600 bg-white border border-red-100 rounded hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingAddressId === address.id ? '...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-xl">
            <h4 className="font-medium text-gray-900 mb-1">
              {selectedAddress?.name || selectedAddress?.formatted_address}
            </h4>
            <p className="text-sm text-gray-600">
              {selectedAddress?.formatted_address}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleBackToSearch}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSaveAddress}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-2" />
                  Saving...
                </>
              ) : (
                'Confirm & Use'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
