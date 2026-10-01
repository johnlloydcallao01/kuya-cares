'use client';

import { useEffect, useState } from 'react';

/**
 * SINGLE shared Google Maps JS API bootstrap for apps/web.
 *
 * Background: "You have included the Google Maps JavaScript API multiple
 * times on this page" fires on ANY second bootstrap — even byte-identical
 * src — and `useJsApiLoader` (callback bootstrap, per-id script tags) is
 * mutually blind with raw `<script>` injection. Previously 4x
 * `useJsApiLoader` (3 distinct ids) + 1x raw singleton coexisted, colliding
 * whenever e.g. LocationSelector's AddressSearchInput (raw) mounted next to
 * any map. ALL consumers must go through here; do NOT call useJsApiLoader
 * or inject a maps script anywhere else.
 */

const SCRIPT_ID = 'google-maps-shared';
const API_KEY = process.env.NEXT_PUBLIC_MAPS_BACKEND_KEY || '';

function apiReady(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(window.google && window.google.maps && (window.google.maps as any).places)
  );
}

let loadPromise: Promise<void> | null = null;

export function isGoogleMapsApiReadySync(): boolean {
  return apiReady();
}

export function ensureGoogleMapsLoaded(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps API requires a browser environment'));
  }
  if (apiReady()) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    // Another bootstrap (legacy tag, HMR remnant) already present — wait for it
    // instead of injecting a second one (Google errors on ANY second script).
    const existing = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]',
    );
    if (existing) {
      const checkLoaded = () => {
        if (apiReady()) {
          resolve();
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // loading=async bootstrap fetches further chunks — poll for readiness.
      const checkLoaded = () => {
        if (apiReady()) {
          resolve();
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
    };
    script.onerror = () => {
      loadPromise = null; // allow retry
      reject(new Error('Failed to load Google Maps API'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function useGoogleMapsApiReady(): boolean {
  const [ready, setReady] = useState<boolean>(() => isGoogleMapsApiReadySync());

  useEffect(() => {
    let live = true;
    ensureGoogleMapsLoaded()
      .then(() => {
        if (live) setReady(true);
      })
      .catch((error) => {
        console.error('Failed to load Google Maps:', error);
      });
    return () => {
      live = false;
    };
  }, []);

  return ready;
}
