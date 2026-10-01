'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import { useGoogleMapsApiReady } from '@/lib/google-maps-api';
import { AddressSearchInput } from '@/components/shared/AddressSearchInput';
import { AddressService } from '@encreasl/client-services';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';
import { emitAddressChange, useAddressChange } from '@/hooks/useAddressChange';
import { clearAllLocationCaches } from '@/lib/clear-location-caches';
import { useShowAll } from '@/lib/show-all';
import { AddressSkeleton, ListItemSkeleton } from '@/components/ui/Skeleton';
import { LABEL_CHIPS } from '@/types/address';
import DeleteAddressDialog from '@/components/addresses/DeleteAddressDialog';

const MAPS_KEY = process.env.NEXT_PUBLIC_MAPS_BACKEND_KEY || '';
const MANILA = { lat: 14.5995, lng: 120.9842 };
// tap2go parity: MovableAddressPreviewMap initialRegion 0.005 delta (~500m zoom)
const MAP_CONTAINER = { width: '100%', height: '100%' } as const;
type MapTypeChoice = 'standard' | 'hybrid' | 'terrain';
const MAP_TYPE_TO_GOOGLE: Record<MapTypeChoice, string> = {
  standard: 'roadmap',
  hybrid: 'satellite',
  terrain: 'terrain',
};

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2));
}

// tap2go ActiveAddressCard parity: live NON-interactive map of the address
// (h-140, delta 0.01 ≈ zoom 15, orange #f3a823 pin, Active pill overlay).
// Rendered ONLY on the active card — non-active cards have no map, identical.
function ActiveAddressMap({ lat, lng }: { lat: number | null; lng: number | null }) {
  const isLoaded = useGoogleMapsApiReady();

  const pinIcon = React.useMemo(() => {
    if (!isLoaded || typeof window === 'undefined' || !window.google?.maps) return undefined;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30">` +
      `<path fill="#f3a823" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>` +
      `</svg>`;
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new window.google.maps.Size(30, 30),
      anchor: new window.google.maps.Point(15, 30),
    } as google.maps.Icon;
  }, [isLoaded]);

  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return (
      <div className="h-[140px] bg-gray-100 flex items-center justify-center">
        <i className="fa fa-map text-2xl text-gray-300" />
      </div>
    );
  }

  if (!isLoaded || !MAPS_KEY) {
    return (
      <div className="h-[140px] bg-gray-100 flex items-center justify-center text-xs text-gray-400">
        {MAPS_KEY ? 'Loading map…' : 'Map unavailable'}
      </div>
    );
  }

  return (
    <div className="relative h-[140px] pointer-events-none">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER}
        center={{ lat, lng }}
        zoom={15}
        options={{
          disableDefaultUI: true,
          gestureHandling: 'none',
          clickableIcons: false,
          keyboardShortcuts: false,
          draggable: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
        }}
      >
        <MarkerF position={{ lat, lng }} icon={pinIcon} />
      </GoogleMap>
      <div
        className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 rounded-full"
        style={{ backgroundColor: '#f3a823' }}
      >
        <i className="fa fa-check-circle text-white text-[14px]" />
        <span className="text-white text-[11px] font-semibold">Active Address</span>
      </div>
    </div>
  );
}

// tap2go parity: center-pin draggable map (no Marker) + MapTypeControl.
function PinMap({
  coords,
  resolving,
  mapType,
  onMapTypeChange,
  onCenterChange,
}: {
  coords: { lat: number; lng: number } | null;
  resolving: boolean;
  mapType: MapTypeChoice;
  onMapTypeChange: (t: MapTypeChoice) => void;
  onCenterChange: (lat: number, lng: number) => void;
}) {
  const isLoaded = useGoogleMapsApiReady();
  const mapRef = useRef<google.maps.Map | null>(null);

  const handleDragEnd = useCallback(() => {
    const c = mapRef.current?.getCenter();
    const lat = c?.lat();
    const lng = c?.lng();
    if (typeof lat === 'number' && typeof lng === 'number') {
      onCenterChange(lat, lng);
    }
  }, [onCenterChange]);

  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
        Pin location {resolving && <i className="fas fa-spinner fa-spin ml-1" />}
      </label>
      <div className="h-60 w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-100 relative">
        {isLoaded && MAPS_KEY ? (
          <>
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER}
              center={coords ?? MANILA}
              zoom={coords ? 16 : 12}
              options={{ disableDefaultUI: true, zoomControl: true, mapTypeId: MAP_TYPE_TO_GOOGLE[mapType] }}
              onLoad={(map) => {
                mapRef.current = map;
              }}
              onUnmount={() => {
                mapRef.current = null;
              }}
              onDragEnd={handleDragEnd}
            />
            {/* Fixed center pin — drag the map beneath it (tap2go parity) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div style={{ transform: 'translateY(-50%)' }}>
                <i className="fas fa-location-dot text-[48px]" style={{ color: '#f3a823' }} />
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
            {MAPS_KEY ? 'Loading map…' : 'Map unavailable — search still works'}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        {coords ? (
          <p className="text-[11px] text-gray-400">
            {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)} • drag the map to adjust
          </p>
        ) : (
          <span />
        )}
        <div className="flex gap-1">
          {(['standard', 'hybrid', 'terrain'] as MapTypeChoice[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onMapTypeChange(t)}
              className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                mapType === t
                  ? 'text-white border-transparent'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
              style={mapType === t ? { backgroundColor: '#f3a823' } : {}}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface LocationSelectorProps {
  onLocationSelect?: (location: google.maps.places.PlaceResult) => void;
  className?: string;
}

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelect?: (location: google.maps.places.PlaceResult) => void;
  onAddressesChanged?: () => void; // New callback for when addresses are modified
}

// Location Icon Component
function LocationIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

// Location Modal Component
function LocationModal({ isOpen, onClose, onLocationSelect, onAddressesChanged }: LocationModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userAddresses, setUserAddresses] = useState<any[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [activeAddressId, setActiveAddressId] = useState<string | null>(null);

  // Multi-step popup state — tap2go AddressSelectionModal parity: list(search) | preview | edit
  const [currentStep, setCurrentStep] = useState<'search' | 'preview' | 'edit'>('search');
  const [selectedAddress, setSelectedAddress] = useState<google.maps.places.PlaceResult | null>(null);
  const [editingAddress, setEditingAddress] = useState<any | null>(null);
  const [showAll, setShowAllFlag] = useShowAll();

  // tap2go AddressEditView parity: draggable pin coords + extras + label chips
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [editedAddressText, setEditedAddressText] = useState('');
  // tap2go parity: no default label (extras start empty, chip toggles off)
  const [chip, setChip] = useState<string>('');
  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [instructions, setInstructions] = useState('');
  const [mapType, setMapType] = useState<MapTypeChoice>('standard');
  const [resolving, setResolving] = useState(false);
  const geocoderRef = useRef<any>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGeocodedRef = useRef<{ lat: number; lng: number } | null>(null);
  const geocodeCacheRef = useRef<Map<string, { addr: string; placeId: string; t: number }>>(new Map());

  const { user } = useUser();

  // tap2go geocoding.ts parity: reverse-geocode on pin move, 800ms debounce,
  // 12m min-change skip, LRU Map max 256 / TTL 6h keyed at 5-decimal (~1m).
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      if (typeof window === 'undefined' || !window.google?.maps) return;
      if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder();
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      const cached = geocodeCacheRef.current.get(key);
      if (cached && Date.now() - cached.t < 6 * 60 * 60 * 1000) {
        setEditedAddressText(cached.addr);
        lastGeocodedRef.current = { lat, lng };
        return;
      }
      setResolving(true);
      const res = await geocoderRef.current.geocode({ location: { lat, lng } });
      const first = res?.results?.[0];
      if (first?.formatted_address) {
        setEditedAddressText(first.formatted_address);
        lastGeocodedRef.current = { lat, lng };
        geocodeCacheRef.current.set(key, {
          addr: first.formatted_address,
          placeId: first.place_id || '',
          t: Date.now(),
        });
        if (geocodeCacheRef.current.size > 256) {
          const oldest = geocodeCacheRef.current.keys().next().value;
          if (oldest) geocodeCacheRef.current.delete(oldest);
        }
      }
    } catch {
      /* keep pin + typed address — CMS geocodes server-side as fallback */
    } finally {
      setResolving(false);
    }
  }, []);

  const handlePinMove = useCallback(
    (lat: number, lng: number) => {
      setPinCoords({ lat, lng });
      const last = lastGeocodedRef.current;
      if (last && haversineM(last.lat, last.lng, lat, lng) < 12) return;
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      geocodeTimerRef.current = setTimeout(() => reverseGeocode(lat, lng), 800);
    },
    [reverseGeocode],
  );

  useEffect(() => {
    return () => {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    };
  }, []);

  const placeLatLng = (place: google.maps.places.PlaceResult | null): { lat: number; lng: number } | null => {
    const loc = place?.geometry?.location as any;
    const lat = typeof loc?.lat === 'function' ? loc.lat() : loc?.lat;
    const lng = typeof loc?.lng === 'function' ? loc.lng() : loc?.lng;
    return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
  };

  const resetFlowState = useCallback(() => {
    setSelectedAddress(null);
    setEditingAddress(null);
    setPinCoords(null);
    setEditedAddressText('');
    setChip('');
    setStreet('');
    setUnit('');
    setInstructions('');
    setMapType('standard');
    setResolving(false);
    lastGeocodedRef.current = null;
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
  }, []);

  // Check if we're on mobile/tablet
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024); // Below lg breakpoint
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

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

  // Load user addresses when modal opens
  useEffect(() => {
    if (isOpen && user?.id) {
      loadUserAddresses();
    }
  }, [isOpen, user?.id, loadUserAddresses]);

  // Reset modal state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('search');
      resetFlowState();
    }
  }, [isOpen, resetFlowState]);

  // Pending id for the professional confirm dialog (DeleteAddressDialog).
  // This replaces window.confirm — the delete sequence below is untouched.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleDeleteAddress = async (addressId: string) => {
    setPendingDeleteId(addressId);
  };

  const confirmDeleteAddress = async () => {
    const addressId = pendingDeleteId;
    if (!addressId) return;
    setPendingDeleteId(null);

    setDeletingAddressId(addressId);
    try {
      const response = await AddressService.deleteAddress(addressId);

      if (response.success) {
        toast.success('Address deleted successfully!');

        // Optimistically update UI state - remove the deleted address
        setUserAddresses(prev => prev.filter(addr => addr.id !== addressId));

        // If the deleted address was the active one, clear active address
        if (activeAddressId === addressId) {
          setActiveAddressId(null);
        }

        // Bust location caches so merchants/categories/products refetch fresh,
        // then notify every subscriber (no page reload needed).
        clearAllLocationCaches();
        emitAddressChange(addressId);

        // Notify parent component that addresses have changed
        onAddressesChanged?.();
      } else {
        throw new Error(response.error || 'Failed to delete address');
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete address');

      // On error, reload to ensure UI is in sync
      await loadUserAddresses();
    } finally {
      setDeletingAddressId(null);
    }
  };

  const handleSetActiveAddress = async (addressId: string) => {
    if (!user?.id) return;

    console.log('🎯 handleSetActiveAddress called with addressId:', addressId);
    setSettingActiveId(addressId);
    try {
      const response = await AddressService.setActiveAddressForUser(user.id, addressId);

      if (response.success) {
        console.log('✅ Address set as active successfully, emitting change event...');
        toast.success('Active address updated successfully!');

        // Optimistically update UI state - set the new active address
        setActiveAddressId(addressId);

        // Bust location caches BEFORE emitting so subscribers refetch fresh.
        clearAllLocationCaches();

        // Emit address change event for real-time updates
        console.log('📢 About to emit address change for:', addressId);
        emitAddressChange(addressId);
        console.log('📢 Address change event emitted successfully');

        // Notify parent component that addresses have changed
        onAddressesChanged?.();
      } else {
        console.error('❌ Failed to set active address:', response.error);
        throw new Error(response.error || 'Failed to set active address');
      }
    } catch (error) {
      console.error('Error setting active address:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to set active address');

      // On error, reload to ensure UI is in sync
      await loadUserAddresses();
    } finally {
      setSettingActiveId(null);
    }
  };

  const handleAddressSelect = async (place: google.maps.places.PlaceResult) => {
    // Instead of directly saving, show preview step (tap2go: search -> preview)
    setSelectedAddress(place);
    const coords = placeLatLng(place);
    setPinCoords(coords);
    setEditedAddressText(place.formatted_address || place.name || '');
    setChip('');
    setStreet('');
    setUnit('');
    setInstructions('');
    setMapType('standard');
    lastGeocodedRef.current = coords;
    setEditingAddress(null);
    setCurrentStep('preview');
  };

  // tap2go parity: String() compare everywhere (ids may be number|string)
  const isActiveAddress = useCallback(
    (address: any) =>
      !!activeAddressId && String(address?.id) === String(activeAddressId),
    [activeAddressId],
  );

  // tap2go placeForSave parity: dragged pin coords override the place geometry.
  const placeWithPin = (
    place: google.maps.places.PlaceResult,
    coords: { lat: number; lng: number } | null,
    addressText: string,
  ): google.maps.places.PlaceResult => {
    if (!coords) return place;
    return {
      ...place,
      formatted_address: addressText || place.formatted_address,
      geometry: {
        ...(place.geometry as any),
        location: {
          lat: () => coords.lat,
          lng: () => coords.lng,
        } as unknown as google.maps.LatLng,
      },
    };
  };

  // Start editing a saved address (tap2go: list -> edit via pencil)
  const handleStartEdit = (address: any) => {
    setEditingAddress(address);
    setSelectedAddress(null);
    const lat = Number(address.latitude);
    const lng = Number(address.longitude);
    const coords =
      Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    setPinCoords(coords);
    lastGeocodedRef.current = coords;
    setEditedAddressText(address.formatted_address || '');
    setChip(address.label || '');
    setStreet(address.street || '');
    setUnit(address.floor_unit_room || address.floorUnitRoom || '');
    setInstructions(address.delivery_instructions || address.deliveryInstructions || '');
    setMapType('standard');
    setCurrentStep('edit');
  };

  const handleSaveEdit = async () => {
    if (!editingAddress || !user?.id) return;
    if (!editedAddressText.trim() || editedAddressText.trim().length < 5) {
      toast.error('Please enter a valid address');
      return;
    }
    setIsSaving(true);
    try {
      // tap2go parity: only truthy extras are sent (empty fields don't overwrite)
      const updates: Record<string, unknown> = {
        latitude: pinCoords?.lat,
        longitude: pinCoords?.lng,
        formatted_address: editedAddressText.trim(),
      };
      if (street.trim()) updates.street = street.trim();
      if (unit.trim()) updates.floor_unit_room = unit.trim();
      if (instructions.trim()) updates.delivery_instructions = instructions.trim();
      if (chip) updates.label = chip;
      const response = await AddressService.updateAddress(
        String(editingAddress.id),
        updates as any,
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to update address');
      }

      toast.success('Address updated successfully!');
      clearAllLocationCaches();
      await loadUserAddresses();

      // Edited pin affects delivery scope — refresh subscribers when active edited.
      if (activeAddressId && String(activeAddressId) === String(editingAddress.id)) {
        emitAddressChange(editingAddress.id);
      }
      onAddressesChanged?.();

      setCurrentStep('search');
      resetFlowState();
    } catch (error) {
      console.error('Error updating address:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update address');
    } finally {
      setIsSaving(false);
    }
  };

  // New function to handle the actual saving from preview step
  const handleSaveAddress = async () => {
    if (!selectedAddress || !user?.id) return;

    setIsSaving(true);

    try {
      // Step 1: Save the address to the database (pin + extras included).
      // tap2go parity: address_type hardcoded 'home', label from chip (or none).
      const saveResponse = await AddressService.saveAddress({
        place: placeWithPin(selectedAddress, pinCoords, editedAddressText.trim()),
        address_type: 'home',
        is_default: false, // User can set default later
        userId: user.id,
        street: street.trim() || undefined,
        floor_unit_room: unit.trim() || undefined,
        delivery_instructions: instructions.trim() || undefined,
        label: chip || undefined,
      });

      if (!saveResponse.success || !saveResponse.address) {
        throw new Error(saveResponse.error || 'Failed to save address');
      }

      // Extract the correct address ID from PayloadCMS response structure
      const addressId = saveResponse.address.doc?.id || saveResponse.address.id;

      if (!addressId) {
        throw new Error('Address ID not found in response');
      }

      console.log('🔍 Address saved with ID:', addressId);

      // Step 2: Set the saved address as active
      const setActiveResponse = await AddressService.setActiveAddressForUser(user.id, addressId);

      if (!setActiveResponse.success) {
        throw new Error(setActiveResponse.error || 'Failed to set address as active');
      }

      // Both operations successful
      toast.success('Address saved and activated successfully!');

      // Update local state to reflect the new active address
      setActiveAddressId(addressId);

      // Clear ALL location caches (not just addresses) and force fresh
      // fetch to ensure data consistency
      clearAllLocationCaches();
      await loadUserAddresses();

      // Emit address change event for real-time updates
      emitAddressChange(addressId);

      // Notify parent component that addresses have changed
      onAddressesChanged?.();

      onLocationSelect?.(selectedAddress);
      onClose();

    } catch (error) {
      console.error('Error in save and activate process:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save and activate address');
    } finally {
      setIsSaving(false);
    }
  };

  // Function to go back to search step (tap2go: preview/edit -> list)
  const handleBackToSearch = () => {
    setCurrentStep('search');
    resetFlowState();
  };

  // Handle click outside to close modal (desktop only)
  useEffect(() => {
    if (!isOpen || isMobile) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Delete confirm dialog is portaled above us — its clicks must not
      // close this modal (previously any dialog click hit this branch).
      const deleteDialog = document.querySelector('[data-delete-dialog]');
      if (deleteDialog && deleteDialog.contains(event.target as Node)) return;
      const modalContent = document.querySelector('[data-modal-content]');
      if (modalContent && !modalContent.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Let the delete dialog consume Escape first when open.
        if (document.querySelector('[data-delete-dialog]')) return;
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, isMobile, onClose]);

  // Prevent body scroll when modal is open on mobile
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen, isMobile]);

  if (!isOpen) return null;

  const modalElement = (
    <div
      className={isMobile ? '' : 'fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-lg px-4'}
      style={isMobile ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'white',
        zIndex: 99999
      } : { position: 'fixed', zIndex: 9999 }}
    >
      {/* Modal - Responsive design */}
      <div
        data-modal-content
        className={`${isMobile
            ? 'w-full h-full flex flex-col bg-white' // Full height on mobile/tablet with solid white background
            : 'bg-white rounded-2xl shadow-2xl w-full transform transition-all' // Popup style on desktop
          }`}
        style={isMobile ? { width: '100%', height: '100%', backgroundColor: 'white' } : {}}
      >
        {/* Header */}
        <div className={`${isMobile
            ? 'px-4 py-3 border-b border-gray-100 flex items-center' // Mobile header with back button
            : 'px-6 py-4 border-b border-gray-100' // Desktop header
          }`}>
          {isMobile ? (
            // Mobile header with back button
            <div className="flex items-center w-full">
              <button
                onClick={currentStep === 'search' ? onClose : handleBackToSearch}
                className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors mr-3"
              >
                <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="text-xl font-semibold text-gray-900">
                {currentStep === 'preview' ? 'Address Preview' : currentStep === 'edit' ? 'Edit your address' : 'Addresses'}
              </h3>
            </div>
          ) : (
            // Desktop header with close button
            <div className="flex items-center justify-between">
              {currentStep !== 'search' && (
                <button
                  onClick={handleBackToSearch}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors mr-3"
                >
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <h3 className="text-xl font-semibold text-gray-900">
                {currentStep === 'preview' ? 'Address Preview' : currentStep === 'edit' ? 'Edit your address' : 'Addresses'}
              </h3>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Content Section - Conditional rendering based on current step */}
        <div
          className={`${isMobile ? 'px-4 py-4 overflow-y-auto' : 'px-6 py-4 flex-1 overflow-y-auto max-h-[24rem]'}`}
          style={isMobile ? { maxHeight: '125vh', flex: '1 1 auto', paddingBottom: '60px' } : {}}
        >
          {isSaving && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="text-sm text-blue-700">Saving address...</span>
            </div>
          )}

          {currentStep === 'search' ? (
            // Search Step Content
            <>
              <AddressSearchInput
                placeholder="Search for an address"
                onAddressSelect={handleAddressSelect}
                autoFocus={true}
                inputClassName="w-full pl-12 pr-4 py-3 bg-gray-50 border-0 rounded-xl text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all"
                fullPage={true}
              />

              <label className="flex items-center gap-2.5 mt-4 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(e) => setShowAllFlag(e.target.checked)}
                  className="w-4 h-4 accent-green-700 flex-shrink-0"
                />
                <span className="text-[13px] font-semibold text-gray-700">
                  Show All Merchants & Products
                  <span className="block text-[11px] font-normal text-gray-400">Turn off location filtering</span>
                </span>
              </label>

              {/* Manage Address Section */}
              {user?.id && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Manage Address</h3>

                  {isLoadingAddresses ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <ListItemSkeleton key={i} />
                      ))}
                    </div>
                  ) : userAddresses.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No saved addresses found.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* tap2go parity: active address first */}
                      {[...userAddresses]
                        .sort((a, b) => {
                          const aActive = isActiveAddress(a) ? 0 : 1;
                          const bActive = isActiveAddress(b) ? 0 : 1;
                          return aActive - bActive;
                        })
                        .map((address) => {
                          const isActive = isActiveAddress(address);
                          const addrLat = Number(address.latitude);
                          const addrLng = Number(address.longitude);
                          const hasCoords =
                            Number.isFinite(addrLat) && Number.isFinite(addrLng);
                          return (
                          <div
                            key={address.id}
                            className={
                              isActive
                                ? 'bg-white rounded-xl border overflow-hidden'
                                : 'p-4 bg-gray-50 rounded-lg border border-gray-200'
                            }
                            style={isActive ? { borderColor: '#f3a823' } : {}}
                          >
                            {/* tap2go ActiveAddressCard parity: live map ONLY on active card */}
                            {isActive && (
                              <ActiveAddressMap
                                lat={hasCoords ? addrLat : null}
                                lng={hasCoords ? addrLng : null}
                              />
                            )}
                            <div className={isActive ? 'p-4' : ''}>
                            <div className="flex flex-col space-y-3">
                            <div>
                              <p className="font-medium text-gray-900">
                                {address.formatted_address}
                              </p>
                              {address.address_type && (
                                <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full mt-1">
                                  {address.address_type}
                                </span>
                              )}
                              {address.is_default && (
                                <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full mt-1 ml-2">
                                  Default
                                </span>
                              )}
                              {isActive && (
                                <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full mt-1 ml-2">
                                  Active
                                </span>
                              )}
                              {address.notes && (
                                <p className="text-sm text-gray-600 mt-1">{address.notes}</p>
                              )}
                            </div>
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleStartEdit(address)}
                                aria-label="Edit address"
                                className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                              >
                                <i className="fa fa-pencil mr-1" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleSetActiveAddress(address.id)}
                                disabled={settingActiveId === address.id || isActive}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isActive
                                    ? 'text-purple-600 bg-purple-50 border border-purple-200'
                                    : 'text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                                  }`}
                              >
                                {settingActiveId === address.id ? (
                                  <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 mr-1"></div>
                                    Setting...
                                  </div>
                                ) : isActive ? (
                                  'Currently Active'
                                ) : (
                                  'Set as Active'
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteAddress(address.id)}
                                disabled={deletingAddressId === address.id}
                                className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {deletingAddressId === address.id ? (
                                  <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b border-red-600 mr-1"></div>
                                    Deleting...
                                  </div>
                                ) : (
                                  'Delete'
                                )}
                              </button>
                            </div>
                            </div>
                            </div>
                        </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            // Preview / Edit Step Content — tap2go AddressEditView parity:
            // draggable center-pin map, editable address, label chips, extras.
            <div className="space-y-4">
              <PinMap
                coords={pinCoords}
                resolving={resolving}
                mapType={mapType}
                onMapTypeChange={setMapType}
                onCenterChange={handlePinMove}
              />
              <p className="text-[11px] text-gray-400">
                Drag the map to fine-tune your pin — the address updates automatically.
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Full address
                </label>
                <textarea
                  value={editedAddressText}
                  onChange={(e) => setEditedAddressText(e.target.value)}
                  rows={2}
                  placeholder="House no., street, barangay, city…"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Label
                </label>
                <div className="flex flex-wrap gap-2">
                  {LABEL_CHIPS.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      // tap2go parity: tapping the active chip deselects it
                      onClick={() => setChip((prev) => (prev === c.label ? '' : c.label))}
                      className={`px-4 py-2 rounded-xl text-[13px] font-bold border transition-all ${
                        chip === c.label
                          ? 'text-white border-transparent shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                      style={chip === c.label ? { backgroundColor: '#239459' } : {}}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Street (e.g. Rizal Avenue)"
                  className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:bg-white"
                />
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Floor / Unit / Room"
                  className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:bg-white"
                />
              </div>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                placeholder="Delivery instructions (e.g. Ring doorbell twice…)"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:bg-white resize-none"
              />

              {currentStep === 'preview' ? (
                <div className="pt-2">
                  <button
                    onClick={handleSaveAddress}
                    disabled={isSaving}
                    className="w-full bg-black text-white py-4 px-6 rounded-xl font-medium text-base hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Saving and Activating...
                      </div>
                    ) : (
                      'Save and Activate'
                    )}
                  </button>
                </div>
              ) : (
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={handleBackToSearch}
                    disabled={isSaving}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="flex-1 py-3 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: '#239459' }}
                  >
                    {isSaving ? (
                      <i className="fas fa-spinner fa-spin mr-2" />
                    ) : (
                      <i className="fas fa-save mr-2" />
                    )}
                    Save changes
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Professional delete confirmation (replaces window.confirm) */}
      <DeleteAddressDialog
        open={!!pendingDeleteId}
        addressText={
          userAddresses.find((a) => a.id === pendingDeleteId)?.formatted_address
        }
        deleting={!!deletingAddressId}
        onCancel={() => {
          if (!deletingAddressId) setPendingDeleteId(null);
        }}
        onConfirm={confirmDeleteAddress}
      />
    </div>
  );

  return createPortal(modalElement as React.ReactNode, document.body);
}

// Main Location Selector Component
export function LocationSelector({ onLocationSelect, className = '' }: LocationSelectorProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<google.maps.places.PlaceResult | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(true);
  const { user } = useUser();

  // Check if we're on mobile/tablet
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024); // Below lg breakpoint
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Load address from backend with improved error handling
  const loadAddressFromBackend = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingAddress(false);
      return;
    }

    try {
      setIsLoadingAddress(true);

      // Try to get user's active address first
      const activeAddressResponse = await AddressService.getActiveAddress(user.id, undefined, true);

      if (activeAddressResponse.success && activeAddressResponse.address) {
        const activeAddress = activeAddressResponse.address;

        // Convert API address back to Google Places format for display
        const googlePlaceFormat: google.maps.places.PlaceResult = {
          formatted_address: activeAddress.formatted_address,
          place_id: activeAddress.google_place_id,
          name: activeAddress.formatted_address,
          geometry: activeAddress.latitude && activeAddress.longitude ? {
            location: {
              lat: () => activeAddress.latitude,
              lng: () => activeAddress.longitude
            } as google.maps.LatLng
          } : undefined
        };

        setSelectedLocation(googlePlaceFormat);
        return; // Exit early, we have the active address
      }

      // If no active address, the getActiveAddress method already handles fallback
      // So if we reach here, there are truly no addresses
      console.log('No addresses found for user');
      setSelectedLocation(null);

    } catch (error) {
      console.error('Error loading address from backend:', error);
      setSelectedLocation(null);
    } finally {
      setIsLoadingAddress(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadAddressFromBackend();
  }, [loadAddressFromBackend]);

  // Listen for address changes globally
  useAddressChange(() => {
    loadAddressFromBackend();
  });

  const handleLocationSelect = (location: google.maps.places.PlaceResult) => {
    setSelectedLocation(location);
    onLocationSelect?.(location);
  };

  const handleAddressesChanged = () => {
    // Reload the address when addresses are modified
    loadAddressFromBackend();
  };

  const handleClick = () => {
    // Always open modal (full-screen on mobile, popup on desktop)
    setIsModalOpen(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors max-w-full ${className}`}
      >
        {isLoadingAddress ? (
          <AddressSkeleton />
        ) : (
          <>
            <LocationIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
            <span className="truncate">
              {selectedLocation?.name || selectedLocation?.formatted_address || 'Enter Address'}
            </span>
          </>
        )}
      </button>

      {/* Always show modal */}
      <LocationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onLocationSelect={handleLocationSelect}
        onAddressesChanged={handleAddressesChanged}
      />
    </>
  );
}

export default LocationSelector;
