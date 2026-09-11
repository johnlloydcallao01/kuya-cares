// ─── Google Geocoding API (reverse geocoding) ────────────────────────────────
// Translates map coordinates into a human-readable address.
// We call the legacy geocode/json endpoint directly with the public maps key,
// mirroring how AddressSearchInput calls Places Autocomplete/Details.

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const IS_CONFIGURED = !!GOOGLE_PLACES_API_KEY;

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export interface ReverseGeocodeDetails {
  formatted_address: string;
  google_place_id: string;
  latitude: number;
  longitude: number;
  street_number?: string;
  route?: string;
  barangay?: string;
  locality?: string;
  administrative_area_level_1?: string;
  country?: string;
  postal_code?: string;
}

// ─── In-memory reverse-geocode cache ─────────────────────────────────────────
// Reverse geocoding is a paid, network call. Coordinates that round to the same
// ~5-decimal cell (~1 m) describe the same place for addressing purposes, so we
// keep a small LRU cache for the session to avoid re-hitting the API for the
// same pin (fine-tuning drags, re-opening an address, double-taps, etc.).
const CACHE_SCRUB_DECIMALS = 5;
const CACHE_MAX_ENTRIES = 256;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface GeocodeCacheEntry {
  details: ReverseGeocodeDetails;
  cachedAt: number;
}

const reverseGeocodeCache = new Map<string, GeocodeCacheEntry>();

function scrubCoords(lat: number, lng: number): string {
  const factor = 10 ** CACHE_SCRUB_DECIMALS;
  return `${Math.round(lat * factor)}:${Math.round(lng * factor)}`;
}

function getCachedDetails(key: string): ReverseGeocodeDetails | null {
  const entry = reverseGeocodeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    reverseGeocodeCache.delete(key);
    return null;
  }
  // LRU touch — re-insert so eviction always drops the coldest entry.
  reverseGeocodeCache.delete(key);
  reverseGeocodeCache.set(key, entry);
  return entry.details;
}

function cacheDetails(key: string, details: ReverseGeocodeDetails) {
  reverseGeocodeCache.set(key, { details, cachedAt: Date.now() });
  if (reverseGeocodeCache.size > CACHE_MAX_ENTRIES) {
    const oldest = reverseGeocodeCache.keys().next().value;
    if (oldest !== undefined) reverseGeocodeCache.delete(oldest);
  }
}

/** Forget all cached geocoding results (e.g. after an address edit/test). */
export function clearReverseGeocodeCache() {
  reverseGeocodeCache.clear();
}

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GeocodeResult {
  formatted_address?: string;
  place_id?: string;
  geometry?: {
    location?: { lat?: number; lng?: number };
  };
  address_components?: AddressComponent[];
  types?: string[];
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  options?: { signal?: AbortSignal; useCache?: boolean },
): Promise<ReverseGeocodeDetails | null> {
  if (!IS_CONFIGURED || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const useCache = options?.useCache !== false;
  const cacheKey = useCache ? scrubCoords(lat, lng) : null;

  if (cacheKey) {
    const cached = getCachedDetails(cacheKey);
    if (cached) return cached;
  }

  try {
    const params = new URLSearchParams({
      latlng: `${lat},${lng}`,
      key: GOOGLE_PLACES_API_KEY,
      language: 'en',
    });

    const response = await fetch(`${GEOCODE_URL}?${params.toString()}`, {
      signal: options?.signal,
    });

    if (options?.signal?.aborted) return null;
    const data = await response.json();
    if (options?.signal?.aborted) return null;

    if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
      return null;
    }

    const result = pickMostSpecificResult(data.results as GeocodeResult[]);
    if (!result?.formatted_address) return null;

    const details = mapResultToDetails(result, lat, lng);
    if (cacheKey) cacheDetails(cacheKey, details);
    return details;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return null;
    console.error('Reverse geocode error:', error);
    return null;
  }
}

/**
 * Google returns multiple results from most to least specific.
 * Prefer a result that names an actual geographic feature/street instead of
 * a pure plus-code, falling back to the first result when uncertain.
 */
function pickMostSpecificResult(results: GeocodeResult[]): GeocodeResult | null {
  const preferred = results.find(
    (r) => r.types && !r.types.includes('plus_code') && !r.types.includes('postal_code'),
  );
  return preferred || results[0] || null;
}

/** Map a geocoding result into the same fields AddressService.parsePlaceData produces. */
function mapResultToDetails(
  result: GeocodeResult,
  lat: number,
  lng: number,
): ReverseGeocodeDetails {
  const components = result.address_components || [];

  const findName = (types: string[]) =>
    components.find((c) => c.types.some((t) => types.includes(t)));

  const streetNumber = findName(['street_number']);
  const route = findName(['route']);
  const barangay = findName(['sublocality_level_1', 'neighborhood']);
  const locality = findName(['locality', 'administrative_area_level_2']);
  const province = findName(['administrative_area_level_1']);
  const country = findName(['country']);
  const postalCode = findName(['postal_code']);

  const details: ReverseGeocodeDetails = {
    formatted_address: result.formatted_address || '',
    google_place_id: result.place_id || '',
    latitude: lat,
    longitude: lng,
    street_number: streetNumber?.long_name,
    route: route?.long_name,
    barangay: barangay?.long_name,
    locality: locality?.long_name,
    administrative_area_level_1: province?.long_name,
    country: country?.long_name,
    postal_code: postalCode?.long_name,
  };

  return details;
}

/**
 * Build the PATCH payload for updating an address after the user moves the map.
 * When reverse geocoding is unavailable/fails we still persist the new coords so
 * the pin move is never lost.
 */
export function buildAddressUpdate(
  coords: { lat: number; lng: number },
  details: ReverseGeocodeDetails | null,
): Record<string, any> {
  const patch: Record<string, any> = {
    latitude: coords.lat,
    longitude: coords.lng,
  };

  if (!details) return patch;

  patch.formatted_address = details.formatted_address;
  patch.google_place_id = details.google_place_id;
  if (details.street_number) patch.street_number = details.street_number;
  if (details.route) patch.route = details.route;
  if (details.barangay) patch.barangay = details.barangay;
  if (details.locality) patch.locality = details.locality;
  if (details.administrative_area_level_1) {
    patch.administrative_area_level_1 = details.administrative_area_level_1;
  }
  if (details.country) patch.country = details.country;
  if (details.postal_code) patch.postal_code = details.postal_code;

  return patch;
}