'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { useGoogleMapsApiReady } from '@/lib/google-maps-api';
import { AddressSearchInput } from '@/components/shared/AddressSearchInput';
import { LABEL_CHIPS, type AddressUI } from '@/types/address';
import type { AddressInput } from '@/lib/client-services/address-book-service';

interface AddressFormModalProps {
  isOpen: boolean;
  initial?: AddressUI | null;
  defaultSetActive?: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: AddressInput) => void;
}

const MAPS_KEY = process.env.NEXT_PUBLIC_MAPS_BACKEND_KEY || '';
const MANILA = { lat: 14.5995, lng: 120.9842 };

export default function AddressFormModal({
  isOpen,
  initial,
  defaultSetActive,
  submitting,
  onClose,
  onSubmit,
}: AddressFormModalProps) {
  const isEdit = !!initial;
  const [formattedAddress, setFormattedAddress] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [chip, setChip] = useState<string>('Home');
  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [instructions, setInstructions] = useState('');
  const [setActive, setSetActive] = useState(true);
  const [resolving, setResolving] = useState(false);
  const geocoderRef = useRef<any>(null);

  const isLoaded = useGoogleMapsApiReady();

  useEffect(() => {
    if (isOpen) {
      setFormattedAddress(initial?.formattedAddress || '');
      setPlaceId('');
      setCoords(
        initial?.latitude != null && initial?.longitude != null
          ? { lat: Number(initial.latitude), lng: Number(initial.longitude) }
          : null,
      );
      setChip(initial?.label || 'Home');
      setStreet(initial?.street || '');
      setUnit(initial?.floorUnitRoom || '');
      setInstructions(initial?.deliveryInstructions || '');
      setSetActive(defaultSetActive ?? !initial);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initial, defaultSetActive]);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      if (!window.google?.maps) return;
      if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder();
      setResolving(true);
      const res = await geocoderRef.current.geocode({ location: { lat, lng } });
      const first = res?.results?.[0];
      if (first?.formatted_address) {
        setFormattedAddress(first.formatted_address);
        setPlaceId(first.place_id || '');
      }
    } catch {
      /* keep pin — CMS geocodes server-side as fallback */
    } finally {
      setResolving(false);
    }
  }, []);

  const handlePlaceSelect = useCallback((place: google.maps.places.PlaceResult) => {
    const loc = place.geometry?.location;
    const lat = typeof loc?.lat === 'function' ? loc.lat() : (loc as any)?.lat;
    const lng = typeof loc?.lng === 'function' ? loc.lng() : (loc as any)?.lng;
    if (typeof lat === 'number' && typeof lng === 'number') {
      setCoords({ lat, lng });
    }
    if (place.formatted_address) setFormattedAddress(place.formatted_address);
    if (place.place_id) setPlaceId(place.place_id);
  }, []);

  const handleMarkerDrag = useCallback(
    (e: google.maps.MapMouseEvent) => {
      const lat = e.latLng?.lat();
      const lng = e.latLng?.lng();
      if (typeof lat === 'number' && typeof lng === 'number') {
        setCoords({ lat, lng });
        reverseGeocode(lat, lng);
      }
    },
    [reverseGeocode],
  );

  const chipType = useMemo(
    () => LABEL_CHIPS.find((c) => c.label === chip)?.addressType ?? 'home',
    [chip],
  );

  if (!isOpen) return null;

  const canSubmit =
    !submitting && formattedAddress.trim().length >= 5 && coords != null;

  const handleSubmit = () => {
    if (!canSubmit || !coords) return;
    onSubmit({
      formatted_address: formattedAddress.trim(),
      google_place_id: placeId || undefined,
      latitude: coords.lat,
      longitude: coords.lng,
      street: street.trim() || undefined,
      floor_unit_room: unit.trim() || undefined,
      delivery_instructions: instructions.trim() || undefined,
      label: chip,
      address_type: chipType,
      setActive,
    });
  };

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-gray-900">
              {isEdit ? 'Edit address' : 'Add new address'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
              <i className="fas fa-times" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Search, drag the pin to fine-tune, then add details</p>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Search</label>
              <AddressSearchInput placeholder="Search street, building, landmark…" onAddressSelect={handlePlaceSelect} />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              Pin location {resolving && <i className="fas fa-spinner fa-spin ml-1" />}
            </label>
            <div className="h-52 w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
              {isLoaded && MAPS_KEY ? (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={coords ?? MANILA}
                  zoom={coords ? 17 : 12}
                  options={{ disableDefaultUI: true, zoomControl: true }}
                >
                  <Marker
                    position={coords ?? MANILA}
                    draggable
                    onDragEnd={handleMarkerDrag}
                  />
                </GoogleMap>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                  {MAPS_KEY ? 'Loading map…' : 'Map unavailable — search still works'}
                </div>
              )}
            </div>
            {coords && (
              <p className="text-[11px] text-gray-400 mt-1.5">
                {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)} • drag the pin to adjust
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Full address</label>
            <textarea
              value={formattedAddress}
              onChange={(e) => setFormattedAddress(e.target.value)}
              rows={2}
              placeholder="House no., street, barangay, city…"
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:bg-white resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Label</label>
            <div className="flex flex-wrap gap-2">
              {LABEL_CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setChip(c.label)}
                  className={`px-4 py-2 rounded-xl text-[13px] font-bold border transition-all ${
                    chip === c.label ? 'text-white border-transparent shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
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

          <label className="flex items-center gap-2.5 text-sm font-semibold text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={setActive}
              onChange={(e) => setSetActive(e.target.checked)}
              className="w-4 h-4 accent-green-700"
            />
            Use as active delivery address
          </label>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#239459' }}
          >
            {submitting ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-save mr-2" />}
            {isEdit ? 'Save changes' : 'Save address'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
