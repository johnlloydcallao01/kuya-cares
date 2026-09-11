import { useQuery } from '@tanstack/react-query';
import { AddressService } from '../services/address-service';

export const ADDRESS_KEYS = {
  all: ['addresses'] as const,
  active: (userId: string) => [...ADDRESS_KEYS.all, 'active', userId] as const,
};

export function useActiveAddress(userId?: string, token?: string) {
  return useQuery({
    queryKey: ADDRESS_KEYS.active(userId || ''),
    queryFn: async () => {
      if (!userId || !token) return null;
      
      // 1. Try to get explicitly active address
      const response = await AddressService.getActiveAddress(userId, token);
      if (response.success && response.address) {
        return response.address;
      }
      
      // 2. Fallback: Get most recent user address
      const addressesResponse = await AddressService.getUserAddresses(userId, token, false);
      if (addressesResponse.success && addressesResponse.addresses && addressesResponse.addresses.length > 0) {
        return addressesResponse.addresses[0];
      }
      
      return null;
    },
    enabled: !!userId && !!token,
  });
}
