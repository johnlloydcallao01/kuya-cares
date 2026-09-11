import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getWishlistMerchantIds, addMerchantToWishlist, removeMerchantFromWishlist, getWishlistDocs } from '../services/wishlist';
import { useCallback } from 'react';

export function useWishlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const {
    data: wishlistIds = [],
    isLoading: isLoadingIds,
    isRefetching: isRefetchingIds,
    refetch: refetchIds
  } = useQuery({
    queryKey: ['wishlist-ids', userId],
    queryFn: () => userId ? getWishlistMerchantIds(userId) : Promise.resolve([]),
    enabled: !!userId,
  });

  const {
    data: wishlistDocs = [],
    isLoading: isLoadingDocs,
    isRefetching: isRefetchingDocs,
    refetch: refetchDocs
  } = useQuery({
    queryKey: ['wishlist-docs', userId],
    queryFn: () => userId ? getWishlistDocs(userId) : Promise.resolve([]),
    enabled: !!userId,
  });

  const refetch = useCallback(async () => {
    await Promise.all([refetchIds(), refetchDocs()]);
  }, [refetchIds, refetchDocs]);

  const addMutation = useMutation({
    mutationFn: (merchantId: string | number) => {
      if (!userId) throw new Error('User not logged in');
      return addMerchantToWishlist(userId, merchantId);
    },
    onMutate: async (merchantId) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['wishlist-ids', userId] });
      // Snapshot the previous value for rollback
      const previousIds = queryClient.getQueryData<string[]>(['wishlist-ids', userId]);
      // Optimistically add the merchant id to the cache immediately
      queryClient.setQueryData<string[]>(['wishlist-ids', userId], (old = []) => [
        ...old,
        String(merchantId),
      ]);
      return { previousIds };
    },
    onError: (_err, _merchantId, context) => {
      // Roll back to the snapshot on failure
      if (context?.previousIds !== undefined) {
        queryClient.setQueryData(['wishlist-ids', userId], context.previousIds);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-ids', userId] });
      queryClient.invalidateQueries({ queryKey: ['wishlist-docs', userId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (merchantId: string | number) => {
      if (!userId) throw new Error('User not logged in');
      return removeMerchantFromWishlist(userId, merchantId);
    },
    onMutate: async (merchantId) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['wishlist-ids', userId] });
      // Snapshot the previous value for rollback
      const previousIds = queryClient.getQueryData<string[]>(['wishlist-ids', userId]);
      // Optimistically remove the merchant id from the cache immediately
      queryClient.setQueryData<string[]>(['wishlist-ids', userId], (old = []) =>
        old.filter((id) => id !== String(merchantId))
      );
      return { previousIds };
    },
    onError: (_err, _merchantId, context) => {
      // Roll back to the snapshot on failure
      if (context?.previousIds !== undefined) {
        queryClient.setQueryData(['wishlist-ids', userId], context.previousIds);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-ids', userId] });
      queryClient.invalidateQueries({ queryKey: ['wishlist-docs', userId] });
    },
  });

  const toggleWishlist = useCallback((merchantId: string | number) => {
    if (!userId) return; // TODO: Show login prompt if needed, handled by caller usually
    const idStr = String(merchantId);
    const isPresent = wishlistIds.includes(idStr);

    if (isPresent) {
      removeMutation.mutate(merchantId);
    } else {
      addMutation.mutate(merchantId);
    }
  }, [userId, wishlistIds, addMutation, removeMutation]);

  const isWishlisted = useCallback((merchantId: string | number) => {
    return wishlistIds.includes(String(merchantId));
  }, [wishlistIds]);

  return {
    wishlistIds,
    wishlistDocs,
    isLoading: isLoadingIds || isLoadingDocs,
    isRefetching: isRefetchingIds || isRefetchingDocs,
    toggleWishlist,
    isWishlisted,
    isToggling: addMutation.isPending || removeMutation.isPending,
    refetch,
  };
}
