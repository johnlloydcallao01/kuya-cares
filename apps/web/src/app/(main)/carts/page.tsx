'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ImageWrapper from '@/components/ui/ImageWrapper';
import { useCart } from '@/contexts/CartContext';
import { createPortal } from 'react-dom';
import { Skeleton } from '@/components/ui/Skeleton';

export default function CartPage() {
  const { items, isLoading, removeItem } = useCart();
  const router = useRouter();
  const [activeMerchantId, setActiveMerchantId] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);

  const merchantGroups = useMemo(() => {
    const byMerchant = new Map<
      number,
      {
        merchantId: number;
        merchantName: string;
        merchantLogoUrl: string | null;
        items: any[];
        totalSubtotal: number;
      }
    >();

    for (const item of items) {
      const merchantId = item.merchant;
      const existing = byMerchant.get(merchantId);

      if (existing) {
        existing.items.push(item);
        existing.totalSubtotal += item.subtotal || 0;
      } else {
        byMerchant.set(merchantId, {
          merchantId,
          merchantName: item.merchantName || 'Merchant',
          merchantLogoUrl: item.merchantLogoUrl || null,
          items: [item],
          totalSubtotal: item.subtotal || 0,
        });
      }
    }

    return Array.from(byMerchant.values());
  }, [items]);

  const buildMerchantSlugId = (name: string, id: number) => {
    const base = (name || String(id))
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    return `${base}-${id}`;
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const activeGroup =
    activeMerchantId != null
      ? merchantGroups.find((g) => g.merchantId === activeMerchantId) || null
      : null;

  const handleDeleteCart = async () => {
    if (activeMerchantId == null) return;
    const toRemove = items.filter((item) => item.merchant === activeMerchantId);
    for (const item of toRemove) {
      await removeItem(item.id);
    }
    setActiveMerchantId(null);
  };

  const handleAddMoreItems = () => {
    if (!activeGroup) return;
    router.push(
      `/merchant/${buildMerchantSlugId(activeGroup.merchantName, activeGroup.merchantId)}` as any,
    );
    setActiveMerchantId(null);
  };

  if (isLoading && items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
        <div className="bg-white shadow-sm">
          <div className="px-2.5 py-4">
            <div className="flex items-center justify-between">
              <div className="h-6 w-32 bg-transparent" />
              <div className="flex items-center space-x-3">
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        <div className="px-2.5 py-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="min-w-0 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                  </div>
                  <Skeleton className="w-8 h-8 rounded-full" />
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {Array.from({ length: 3 }).map((__, i) => (
                      <Skeleton
                        key={i}
                        className="w-12 h-12 rounded-lg flex-shrink-0"
                      />
                    ))}
                  </div>
                  <Skeleton className="ml-3 w-10 h-10 rounded-full flex-shrink-0" />
                </div>

                <div className="mt-4 border-t border-gray-100 pt-3 space-y-3">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-9 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
          <div className="pb-20" />
        </div>
      </div>
    );
  }

  if (!isLoading && items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="px-2.5 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-gray-900">Your Carts</h1>
              <div className="flex items-center space-x-3">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <i className="fas fa-search text-gray-600"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Empty Cart State */}
        <div className="flex flex-col items-center justify-center px-2.5 py-16">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <i className="fas fa-shopping-cart text-3xl text-gray-400"></i>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-600 text-center mb-8 max-w-sm">
            Looks like you haven&apos;t added any items to your cart yet. Start browsing to find delicious food!
          </p>
          <button 
            className="text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-colors"
            style={{backgroundColor: '#eba236'}}
            onClick={() => router.push('/' as any)}
          >
            <i className="fas fa-utensils mr-2"></i>
            Browse Restaurants
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <div className="bg-white shadow-sm">
          <div className="px-2.5 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-gray-900">Your Carts</h1>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600 font-medium">
                {merchantGroups.length} {merchantGroups.length === 1 ? 'cart' : 'carts'}
                </span>
              </div>
            </div>
          </div>
        </div>

      <div className="px-2.5 py-6">
        {/* Cart Items */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {merchantGroups.map((group) => (
            <div
              key={group.merchantId}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                    {group.merchantLogoUrl ? (
                      <ImageWrapper
                        src={group.merchantLogoUrl}
                        alt={group.merchantName}
                        width={40}
                        height={40}
                        className="object-contain"
                      />
                    ) : (
                      <i className="fas fa-store text-gray-500 text-sm"></i>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-gray-900 text-sm leading-tight truncate">
                      {group.merchantName}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      <span>10-25 mins</span>
                      <span className="flex items-center gap-1 text-pink-500 font-medium">
                        <i className="fas fa-motorcycle text-[11px]"></i>
                        <span>Free</span>
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
                  aria-label="More options"
                  onClick={() => setActiveMerchantId(group.merchantId)}
                >
                  <i className="fas fa-ellipsis-h text-sm" />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-x-auto">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0"
                    >
                      {item.imageUrl ? (
                        <ImageWrapper
                          src={item.imageUrl}
                          alt={item.productName || ''}
                          width={48}
                          height={48}
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-[10px] text-gray-400">No image</span>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/merchant/${buildMerchantSlugId(group.merchantName, group.merchantId)}` as any,
                    )
                  }
                  className="ml-3 w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-50 flex-shrink-0"
                >
                  <i className="fas fa-plus text-sm"></i>
                </button>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-3 space-y-3">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Subtotal</span>
                  <span>{formatCurrency(group.totalSubtotal)}</span>
                </div>

                <button
                  type="button"
                  onClick={() => router.push(`/carts/${group.merchantId}` as any)}
                  className="w-full border border-gray-300 rounded-full py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  View your cart
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pb-20" />
      </div>

      {isMounted &&
        activeGroup &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex flex-col justify-end bg-black/40">
            <button
              type="button"
              className="flex-1"
              onClick={() => setActiveMerchantId(null)}
              aria-label="Close cart options"
            />
            <div className="w-full bg-white rounded-t-2xl pt-3 pb-4 px-4 space-y-1">
              <div className="flex justify-center mb-2">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <button
                type="button"
                onClick={handleAddMoreItems}
                className="w-full flex items-center gap-3 py-3 text-sm font-medium text-gray-900"
              >
                <span className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center">
                  <i className="fas fa-plus text-xs" />
                </span>
                <span>Add more items</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteCart}
                className="w-full flex items-center gap-3 py-3 text-sm font-medium text-red-600"
              >
                <span className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center">
                  <i className="fas fa-trash text-xs" />
                </span>
                <span>Delete cart</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMerchantId(null)}
                className="w-full mt-2 rounded-full py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: '#e81c63' }}
              >
                Close
              </button>
            </div>
          </div>,
          document.body as any,
        )}
    </div>
  );
}
