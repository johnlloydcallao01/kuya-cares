'use client';

import {
  AddressService,
  LocationBasedMerchantService,
  LocationBasedProductCategoriesService,
  MarketplaceProductService,
} from '@encreasl/client-services';

/**
 * Clear every location-scoped cache in one call.
 *
 * Location cache keys are keyed by customerId only (not by address), so
 * switching the active address MUST bust them — otherwise refetches hit
 * stale entries and the page only updates after a full reload.
 * Call this in every address emitter (save / set-active / delete) BEFORE
 * emitAddressChange, and in subscribers before refetching.
 */
export function clearAllLocationCaches(): void {
  try {
    AddressService.clearCache();
  } catch {
    // Best-effort: never break the address flow on cache errors.
  }
  try {
    LocationBasedMerchantService.clearCache();
  } catch {}
  try {
    LocationBasedProductCategoriesService.clearCache();
  } catch {}
  try {
    MarketplaceProductService.clearCache();
  } catch {}
}
