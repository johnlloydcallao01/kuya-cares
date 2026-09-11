'use client';

import { useEffect, useCallback, useRef } from 'react';

// Custom event for address changes
export const ADDRESS_CHANGE_EVENT = 'addressChanged';

// Event detail interface
export interface AddressChangeDetail {
  addressId: string;
  timestamp: number;
}

// Custom hook to listen for address changes
export function useAddressChange(callback: (addressId: string) => void) {
  const callbackRef = useRef(callback);
  
  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleAddressChange = (event: CustomEvent<AddressChangeDetail>) => {
      console.log('🔄 Address change detected:', event.detail);
      callbackRef.current(event.detail.addressId);
    };

    // Listen for address change events
    window.addEventListener(ADDRESS_CHANGE_EVENT, handleAddressChange as EventListener);

    return () => {
      window.removeEventListener(ADDRESS_CHANGE_EVENT, handleAddressChange as EventListener);
    };
  }, []);
}

// Function to emit address change events
export function emitAddressChange(addressId: string) {
  console.log('📢 Emitting address change event for:', addressId);
  
  const event = new CustomEvent<AddressChangeDetail>(ADDRESS_CHANGE_EVENT, {
    detail: {
      addressId,
      timestamp: Date.now()
    }
  });
  
  window.dispatchEvent(event);
}