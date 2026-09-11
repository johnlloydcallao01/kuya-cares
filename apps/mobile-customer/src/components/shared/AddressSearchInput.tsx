import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Alert,
  TextInput,
  Keyboard,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Google Places API ────────────────────────────────────────────────────────
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const IS_PLACES_CONFIGURED = !!GOOGLE_PLACES_API_KEY;

const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

// Fields requested from Places Details (only what we need — minimises billing SKU)
const DETAIL_FIELDS = 'formatted_address,geometry,name,address_components,types,place_id';

/** Generate a lightweight session token (groups autocomplete + details into 1 billed session) */
function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PlaceSuggestion {
  place_id: string;
  description: string;       // full address string from Places API
  structured_formatting: {
    main_text: string;       // primary part e.g. "Pangi, Ipil"
    secondary_text: string;  // secondary part e.g. "Zamboanga Sibugay, Philippines"
  };
}

export interface AddressSearchInputProps {
  onAddressSelect: (place: any) => void;
  placeholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AddressSearchInput({
  onAddressSelect,
  placeholder = 'Search for an address',
  containerStyle,
}: AddressSearchInputProps) {
  // ── Search state ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);   // true once ≥1 request completed

  // ── Refs for request lifecycle management ───────────────────────────────────
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);           // monotonically increases; only the latest response is processed
  const sessionTokenRef = useRef(generateSessionToken());

  // ── Debounced search — triggered on every searchQuery change ─────────────────
  useEffect(() => {
    // Clear previous debounce timer
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    // Clear suggestions immediately if query is too short
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      setSearchError(null);
      setHasSearched(false);
      return;
    }

    // Show loading indicator right away so the UI feels responsive
    setIsSearching(true);
    setSearchError(null);

    // Wait 350 ms after the user stops typing before firing the actual request
    debounceTimerRef.current = setTimeout(() => {
      performSearch(searchQuery.trim());
    }, 350);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  /**
   * Calls Google Places Autocomplete API with the current query.
   * Uses AbortController to cancel stale requests and a requestId to
   * discard out-of-order responses.
   */
  const performSearch = useCallback(async (query: string) => {
    if (!IS_PLACES_CONFIGURED) {
      setIsSearching(false);
      return;
    }

    // Cancel any previous in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Tag this request — responses for older requests will be ignored
    const myRequestId = ++requestIdRef.current;

    try {
      const params = new URLSearchParams({
        input: query,
        key: GOOGLE_PLACES_API_KEY,
        language: 'en',
        components: 'country:ph',
        types: 'geocode',              // addresses + geographic features
        sessiontoken: sessionTokenRef.current,
      });

      const response = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`, {
        signal: controller.signal,
      });

      // Discard stale responses (a newer request has already been sent)
      if (myRequestId !== requestIdRef.current) return;

      if (!response.ok) {
        throw new Error(`Places API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'OK') {
        setSuggestions(data.predictions ?? []);
      } else if (data.status === 'ZERO_RESULTS') {
        setSuggestions([]);
      } else {
        throw new Error(data.error_message || data.status);
      }

      setHasSearched(true);
    } catch (err: any) {
      if (err.name === 'AbortError') return; // intentionally cancelled — not an error
      if (myRequestId !== requestIdRef.current) return;
      console.error('Places Autocomplete error:', err);
      setSearchError('Could not fetch suggestions. Check your connection.');
      setSuggestions([]);
    } finally {
      if (myRequestId === requestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, []);

  /**
   * Called when the user taps a suggestion row.
   * Fetches full place details then passes it up.
   */
  const handleSuggestionPress = useCallback(async (suggestion: PlaceSuggestion) => {
    Keyboard.dismiss();
    setIsFetchingDetails(true);

    try {
      const params = new URLSearchParams({
        place_id: suggestion.place_id,
        key: GOOGLE_PLACES_API_KEY,
        fields: DETAIL_FIELDS,
        sessiontoken: sessionTokenRef.current,
      });

      const response = await fetch(`${DETAILS_URL}?${params.toString()}`);

      if (!response.ok) throw new Error(`Details API error: ${response.status}`);

      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(data.error_message || data.status);
      }

      const details = data.result;
      const placeResult = {
        formatted_address: details.formatted_address,
        place_id: details.place_id,
        name: details.name,
        geometry: details.geometry,
        address_components: details.address_components,
        types: details.types,
      };

      // Refresh the session token now that this session (autocomplete + details) is complete
      sessionTokenRef.current = generateSessionToken();

      setSuggestions([]);
      setSearchQuery('');
      
      onAddressSelect(placeResult);
    } catch (err) {
      console.error('Places Details error:', err);
      Alert.alert('Error', 'Could not load address details. Please try again.');
    } finally {
      setIsFetchingDetails(false);
    }
  }, [onAddressSelect]);

  // ── Render suggestion row ───────────────────────────────────────────────────
  const renderSuggestion = ({ item }: { item: PlaceSuggestion }) => (
    <TouchableOpacity
      style={styles.suggestionRow}
      onPress={() => handleSuggestionPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.suggestionIconWrapper}>
        <Ionicons name="location-outline" size={18} color="#6B7280" />
      </View>
      <View style={styles.suggestionTextWrapper}>
        <Text style={styles.suggestionMainText} numberOfLines={1}>
          {item.structured_formatting?.main_text ?? item.description}
        </Text>
        {!!item.structured_formatting?.secondary_text && (
          <Text style={styles.suggestionSubText} numberOfLines={1}>
            {item.structured_formatting.secondary_text}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (!IS_PLACES_CONFIGURED) {
    return (
      <View style={[styles.container, containerStyle]}>
        <Text style={styles.emptyText}>
          Address search is not available. Google Places API key is not configured.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Input row */}
      <View style={styles.searchInputRow}>
        <Ionicons name="search-outline" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {/* Loading spinner inside input */}
        {isSearching && (
          <ActivityIndicator size="small" color="#9CA3AF" style={{ marginRight: 12 }} />
        )}
        {/* Clear button (Android — iOS uses clearButtonMode) */}
        {!isSearching && searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Fetching details overlay */}
      {isFetchingDetails && (
        <View style={styles.detailsLoader}>
          <ActivityIndicator size="small" color="#f3a823" />
          <Text style={styles.detailsLoaderText}>Loading address details…</Text>
        </View>
      )}

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={item => item.place_id}
            renderItem={renderSuggestion}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* No results */}
      {!isSearching && hasSearched && suggestions.length === 0 && searchQuery.trim().length >= 2 && (
        <View style={styles.noResults}>
          <Ionicons name="search-outline" size={24} color="#D1D5DB" />
          <Text style={styles.noResultsText}>No addresses found for &quot;{searchQuery}&quot;</Text>
        </View>
      )}

      {/* Error */}
      {!!searchError && (
        <View style={styles.noResults}>
          <Ionicons name="wifi-outline" size={24} color="#FCA5A5" />
          <Text style={[styles.noResultsText, { color: '#EF4444' }]}>{searchError}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 100,
    marginBottom: 20,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#111827',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
    marginRight: 4,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    zIndex: 1000,
    maxHeight: 280,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  suggestionIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionTextWrapper: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  suggestionSubText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 14,
  },
  noResults: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    gap: 8,
  },
  noResultsText: {
    fontSize: 13,
    color: '#9CA3AF',
    flexShrink: 1,
  },
  detailsLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    gap: 8,
  },
  detailsLoaderText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 20,
  },
});
