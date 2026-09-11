'use client';

import { useState, useEffect, useMemo } from 'react';

// Global Google Maps loader with singleton pattern and async loading
let googleMapsPromise: Promise<void> | null = null;
let isGoogleMapsLoaded = false;

const loadGoogleMaps = (): Promise<void> => {
  // If already loaded, return resolved promise
  if (isGoogleMapsLoaded && window.google && window.google.maps && window.google.maps.places) {
    return Promise.resolve();
  }

  // If loading is in progress, return the existing promise
  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  // Check if script already exists
  const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
  if (existingScript) {
    // Script exists, wait for it to load
    googleMapsPromise = new Promise((resolve) => {
      const checkLoaded = () => {
        if (window.google && window.google.maps && window.google.maps.places) {
          isGoogleMapsLoaded = true;
          resolve();
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
    });
    return googleMapsPromise;
  }

  // Create new loading promise with proper async loading
  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_MAPS_BACKEND_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      isGoogleMapsLoaded = true;
      resolve();
    };

    script.onerror = () => {
      googleMapsPromise = null; // Reset on error so it can be retried
      reject(new Error('Failed to load Google Maps API'));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
};

export interface UseGoogleMapsPlacesOptions {
  debounceMs?: number;
  locationBias?: {
    center: { lat: number; lng: number };
    radius: number;
  };
}

export interface UseGoogleMapsPlacesReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  predictions: google.maps.places.AutocompletePrediction[];
  isLoading: boolean;
  isMapsReady: boolean;
  selectPlace: (placeId: string) => Promise<google.maps.places.PlaceResult | null>;
}

export function useGoogleMapsPlaces(options: UseGoogleMapsPlacesOptions = {}): UseGoogleMapsPlacesReturn {
  const {
    debounceMs = 300
  } = options;

  // Memoize locationBias to prevent infinite re-renders
  const locationBias = useMemo(() => ({
    center: { lat: 12.8797, lng: 121.7740 }, // Center of Philippines
    radius: 50000 // 50km radius
  }), []);

  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Initialize isMapsReady based on whether Google Maps is already loaded to prevent flash
  const [isMapsReady, setIsMapsReady] = useState<boolean>(() => {
    return !!(isGoogleMapsLoaded && typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.places);
  });

  // Load Google Maps API
  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        setIsMapsReady(true);
      })
      .catch((error) => {
        console.error('Failed to load Google Maps:', error);
      });
  }, []);

  // Handle search input changes with AutocompleteSuggestion API
  useEffect(() => {
    if (!searchQuery.trim() || !isMapsReady) {
      setPredictions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        // Use the new AutocompleteSuggestion API
        const { suggestions } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: searchQuery,
          locationBias
        });

        // Convert suggestions to the expected format
        const convertedPredictions: google.maps.places.AutocompletePrediction[] = suggestions.map(suggestion => ({
          description: suggestion.placePrediction?.text?.text || '',
          matched_substrings: (suggestion.placePrediction?.text?.matches || []).map(match => ({
            length: match.endOffset - match.startOffset,
            offset: match.startOffset,
          })),
          place_id: suggestion.placePrediction?.placeId || '',
          reference: suggestion.placePrediction?.placeId || '',
          structured_formatting: {
            main_text: suggestion.placePrediction?.text?.text?.split(',')[0] || '',
            main_text_matched_substrings: (suggestion.placePrediction?.text?.matches || []).map(match => ({
              length: match.endOffset - match.startOffset,
              offset: match.startOffset,
            })),
            secondary_text: suggestion.placePrediction?.text?.text?.split(',').slice(1).join(',').trim() || '',
          },
          terms: [],
          types: suggestion.placePrediction?.types || [],
        }));

        setPredictions(convertedPredictions);
      } catch (error) {
        console.error('Error fetching autocomplete suggestions:', error);
        setPredictions([]);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isMapsReady, debounceMs, locationBias]);

  const selectPlace = async (placeId: string): Promise<google.maps.places.PlaceResult | null> => {
    if (!placeId) return null;

    setIsLoading(true);
    try {
      // Use the new Place API
      const place = new google.maps.places.Place({
        id: placeId,
        requestedLanguage: 'en',
      });

      // Fetch place details
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'id'],
      });

      // Convert to the expected PlaceResult format for backward compatibility
      const placeResult: google.maps.places.PlaceResult = {
        name: place.displayName || undefined,
        formatted_address: place.formattedAddress || undefined,
        geometry: place.location ? {
          location: place.location,
          viewport: undefined,
        } : undefined,
        place_id: place.id,
      };

      return placeResult;
    } catch (error) {
      console.error('Error fetching place details:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    predictions,
    isLoading,
    isMapsReady,
    selectPlace,
  };
}