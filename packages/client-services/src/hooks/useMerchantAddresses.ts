
import { useQuery } from '@tanstack/react-query';
import { LocationBasedMerchantService, LocationBasedMerchant } from '../services/location-based-merchant-service';

export const MERCHANT_ADDRESS_KEYS = {
  all: ['merchant-addresses'] as const,
  byMerchants: (merchantIds: string) => [...MERCHANT_ADDRESS_KEYS.all, merchantIds] as const,
};

export function useMerchantAddresses(merchants: LocationBasedMerchant[]) {
  // Create a stable key based on merchant IDs to prevent unnecessary refetches
  // We sort them to ensure order doesn't affect the cache key
  const merchantIds = merchants
    .map(m => m.id)
    .sort()
    .join(',');

  return useQuery({
    queryKey: MERCHANT_ADDRESS_KEYS.byMerchants(merchantIds),
    queryFn: async () => {
      if (!merchants || merchants.length === 0) return {};
      return LocationBasedMerchantService.getActiveAddressNamesForMerchants(merchants);
    },
    enabled: !!merchants && merchants.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}
