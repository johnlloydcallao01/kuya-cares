'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ImageWrapper from '@/components/ui/ImageWrapper';
import { useCart } from '@/contexts/CartContext';
import { Skeleton } from '@/components/ui/Skeleton';

export default function MerchantCartPage() {
  const params = useParams() as { merchantId?: string };
  const merchantIdParam = params?.merchantId || '';
  const merchantId = merchantIdParam ? Number(merchantIdParam) : NaN;

  const { items, isLoading, removeItem, updateQuantity } = useCart();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);

  const merchantItems = useMemo(() => {
    if (!Number.isFinite(merchantId)) return [];
    return items.filter((item) => {
      const id =
        typeof item.merchant === 'number' ? item.merchant : Number(item.merchant);
      return !Number.isNaN(id) && id === merchantId;
    });
  }, [items, merchantId]);

  const merchantName = merchantItems[0]?.merchantName || 'Merchant';
  const merchantLogoUrl = merchantItems[0]?.merchantLogoUrl || null;
  const totalSubtotal = merchantItems.reduce(
    (sum, item) => sum + (item.subtotal || 0),
    0,
  );

  const handleQuantityChange = async (itemId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    await updateQuantity(itemId, newQuantity);
  };

  const handleRemoveItem = async (itemId: number) => {
    await removeItem(itemId);
  };

  const toggleItemExpanded = (itemId: number) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleCheckout = () => {
    if (!Number.isFinite(merchantId) || totalSubtotal <= 0) return;
    router.push(`/checkout/${merchantId}` as any);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm">
          <div className="px-2.5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center">
              <i className="fas fa-arrow-left text-gray-300 text-sm" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 py-4 space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100"
            >
              <div className="flex gap-3">
                <Skeleton className="w-20 h-20 rounded-lg" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                  <div className="flex items-center justify-between mt-2">
                    <Skeleton className="h-5 w-20" />
                    <div className="flex items-center space-x-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <Skeleton className="h-4 w-6" />
                      <Skeleton className="w-8 h-8 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mt-2 space-y-3">
            <div className="flex items-center justify-between text-sm font-semibold">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading && (!Number.isFinite(merchantId) || merchantItems.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm">
          <div className="px-2.5 py-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/carts' as any)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
            >
              <i className="fas fa-arrow-left text-gray-700 text-sm" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Your cart</h1>
          </div>
        </div>

        <div className="px-3 py-10 text-center text-gray-600">
          <p>No items found for this merchant.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="px-2.5 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/carts' as any)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
          >
            <i className="fas fa-arrow-left text-gray-700 text-sm" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {merchantLogoUrl ? (
                <ImageWrapper
                  src={merchantLogoUrl}
                  alt={merchantName}
                  width={36}
                  height={36}
                  className="object-contain"
                />
              ) : (
                <i className="fas fa-store text-gray-500 text-xs" />
              )}
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900 leading-tight">
                {merchantName}
              </h1>
              <p className="text-xs text-gray-500">Items in your cart</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-4 space-y-4">
        {merchantItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100"
          >
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                {item.imageUrl ? (
                  <ImageWrapper
                    src={item.imageUrl}
                    alt={item.productName || ''}
                    width={80}
                    height={80}
                    className="rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                    No image
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                      {item.productName || 'Product'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {merchantName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <i className="fas fa-trash text-xs text-gray-400 hover:text-red-500" />
                  </button>
                </div>

                {item.productSize && (
                  <p className="mb-2 text-xs text-gray-600">
                    Size: {item.productSize}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-900">
                      {formatCurrency(item.subtotal || 0)}
                    </span>
                    {(Array.isArray(item.selectedModifiers) &&
                      item.selectedModifiers.length > 0) ||
                    (Array.isArray(item.selectedAddons) &&
                      item.selectedAddons.length > 0) ? (
                      <button
                        type="button"
                        onClick={() => toggleItemExpanded(item.id)}
                        className="ml-1 text-xs text-gray-500 hover:text-gray-700 flex items-center"
                      >
                        <span className="mr-1">
                          {expandedItems[item.id] ? 'Hide details' : 'View details'}
                        </span>
                        <i
                          className={`fas fa-chevron-${
                            expandedItems[item.id] ? 'up' : 'down'
                          } text-[10px]`}
                        />
                      </button>
                    ) : null}
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleQuantityChange(item.id, item.quantity - 1)
                      }
                      className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
                      style={{ border: '1px solid #e5e7eb' }}
                    >
                      <i className="fas fa-minus text-xs text-gray-600" />
                    </button>
                    <span className="font-medium text-gray-900 min-w-[20px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleQuantityChange(item.id, item.quantity + 1)
                      }
                      className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-50"
                      style={{
                        border: '1px solid #eba236',
                        color: '#eba236',
                        backgroundColor: 'white',
                      }}
                    >
                      <i className="fas fa-plus text-xs" />
                    </button>
                  </div>
                </div>

                {expandedItems[item.id] && (
                  <div className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-700 space-y-1">
                    {Array.isArray(item.selectedModifiers) &&
                      item.selectedModifiers.length > 0 && (
                        <>
                          <div className="font-semibold text-gray-800">
                            Required
                          </div>
                          {item.selectedModifiers
                            .filter((mod: any) => mod.isRequired)
                            .map((mod: any, idx: number) => (
                              <div
                                key={`req-${idx}`}
                                className="flex justify-between pl-3"
                              >
                                <span>{mod.name ?? 'Option'}</span>
                                <span>{formatCurrency(mod.price || 0)}</span>
                              </div>
                            ))}

                          <div className="mt-1 font-semibold text-gray-800">
                            Optional
                          </div>
                          {item.selectedModifiers
                            .filter((mod: any) => !mod.isRequired)
                            .map((mod: any, idx: number) => (
                              <div
                                key={`opt-${idx}`}
                                className="flex justify-between pl-3"
                              >
                                <span>{mod.name ?? 'Option'}</span>
                                <span>{formatCurrency(mod.price || 0)}</span>
                              </div>
                            ))}
                        </>
                      )}

                    {Array.isArray(item.selectedAddons) &&
                      item.selectedAddons.length > 0 && (
                        <>
                          <div className="font-semibold text-gray-800">
                            Add-ons
                          </div>
                          {item.selectedAddons.map((addon: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex justify-between pl-3"
                            >
                              <span>
                                {addon.name ?? 'Addon'}
                                {addon.quantity ? ` x${addon.quantity}` : ''}
                              </span>
                              <span>
                                {formatCurrency(
                                  (addon.price || 0) * (addon.quantity || 1),
                                )}
                              </span>
                            </div>
                          ))}
                        </>
                      )}

                    <div className="flex justify-between mt-1">
                      <span>Item total</span>
                      <span>{formatCurrency(item.subtotal || 0)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mt-2 space-y-3">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Subtotal</span>
            <span>{formatCurrency(totalSubtotal)}</span>
          </div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={totalSubtotal <= 0}
            className="w-full text-white rounded-full py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#eba236' }}
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
