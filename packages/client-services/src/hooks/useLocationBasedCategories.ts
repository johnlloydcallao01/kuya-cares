import { useQuery } from '@tanstack/react-query';
import { LocationBasedMerchantService } from '../services/location-based-merchant-service';

export const CATEGORY_KEYS = {
  all: ['categories'] as const,
  list: (customerId: string) => [...CATEGORY_KEYS.all, 'list', customerId] as const,
};

export function useLocationBasedCategories(
  customerId?: string,
  includeInactive: boolean = false,
  limit: number = 20
) {
  return useQuery({
    queryKey: CATEGORY_KEYS.list(customerId || ''),
    queryFn: async () => {
      if (!customerId) return [];
      return LocationBasedMerchantService.getLocationBasedMerchantCategories({
        customerId,
        includeInactive,
        limit,
      });
    },
    enabled: !!customerId,
  });
}
