import { useQuery } from '@tanstack/react-query';
import { fetchProductWithMerchantContext } from '../services/product';

export function useProduct(productId: string, merchantId: string | number) {
  return useQuery({
    queryKey: ['product', productId, merchantId],
    queryFn: () => fetchProductWithMerchantContext(productId, merchantId),
    enabled: !!productId && !!merchantId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
