'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ensureGoogleMapsLoaded,
  isGoogleMapsApiReadySync,
} from '@/lib/google-maps-api';

// Single shared bootstrap lives in @/lib/google-maps-api — this hook only
// consumes it (previously it injected its own script, colliding with maps).
const loadGoogleMaps = (): Promise<void> => ensureGoogleMapsLoaded();

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
    debounceMs = 350
  } = options;

  // tap2go parity: one session token object reused across autocomplete +
  // details, refreshed after each details call (Places billing sessions).
  const sessionTokenRef = useRef<any>(null);

  // Memoize locationBias to prevent infinite re-renders
  const locationBias = useMemo(() => ({
    center: { lat: 12.8797, lng: 121.7740 }, // Center of Philippines
    radius: 50000 // 50km radius
  }), []);

  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Initialize isMapsReady based on whether Google Maps is already loaded to prevent flash
  const [isMapsReady, setIsMapsReady] = useState<boolean>(() => isGoogleMapsApiReadySync());

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
    // tap2go parity: <2 chars clears without a request
    if (searchQuery.trim().length < 2 || !isMapsReady) {
      setPredictions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        if (!sessionTokenRef.current && typeof (google.maps.places as any).AutocompleteSessionToken === 'function') {
          sessionTokenRef.current = new (google.maps.places as any).AutocompleteSessionToken();
        }
        // Use the new AutocompleteSuggestion API (tap2go parity: en + PH scope)
        const { suggestions } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: searchQuery,
          locationBias,
          language: 'en',
          includedRegionCodes: ['ph'],
          ...(sessionTokenRef.current
            ? { sessionToken: sessionTokenRef.current as any }
            : {}),
        } as any);

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

      // tap2go parity: refresh the billing session after each details call
      sessionTokenRef.current = null;

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