import { useQuery } from '@tanstack/react-query';
import { LocationBasedMerchantService } from '../services/location-based-merchant-service';

export const MERCHANT_KEYS = {
  all: ['merchants'] as const,
  list: (customerId: string, categoryId?: string | null) => 
    [...MERCHANT_KEYS.all, 'list', customerId, categoryId] as const,
};

export function useLocationBasedMerchants(
  customerId?: string,
  categoryId?: string | null,
  limit: number = 20
) {
  return useQuery({
    queryKey: MERCHANT_KEYS.list(customerId || '', categoryId),
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
