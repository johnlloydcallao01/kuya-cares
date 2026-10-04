import { useQuery } from '@tanstack/react-query';
import { LocationBasedMerchantService } from '../services/location-based-merchant-service';

export const MERCHANT_KEYS = {
  all: ['merchants'] as const,
  // limit is part of the key (§24 keys-carry-params): home limit=20 and the
  // search index limit=9999 must never share (or poison) one cache entry.
  list: (customerId: string, categoryId?: string | null, limit?: number) =>
    [...MERCHANT_KEYS.all, 'list', customerId, categoryId, limit] as const,
};

export function useLocationBasedMerchants(
  customerId?: string,
  categoryId?: string | null,
  limit: number = 20
) {
  return useQuery({
    queryKey: MERCHANT_KEYS.list(customerId || '', categoryId, limit),
    queryFn: async () => {
      if (!customerId) return [];
      return LocationBasedMerchantService.getLocationBasedMerchants({
        customerId,
        limit,
        categoryId: categoryId || undefined,
      });
    },
    enabled: !!customerId,
  });
}
