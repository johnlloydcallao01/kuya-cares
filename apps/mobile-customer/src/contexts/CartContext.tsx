import React, { createContext, useContext, useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { apiConfig } from '../config/environment';
import { useAuth } from './AuthContext';

// Web CartItem Type
export type CartItem = {
  id: number;
  customer: number;
  merchant: number;
  product: number;
  merchantProduct: number;
  quantity: number;
  priceAtAdd: number;
  compareAtPrice?: number | null;
  subtotal: number;
  productSize?: string | null;
  selectedVariation?: number | null;
  selectedVariationName?: string | null;
  selectedModifiers?: any[] | null;
  selectedAddons?: any[] | null;
  isAvailable?: boolean;
  unavailableReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  productName?: string;
  merchantName?: string;
  imageUrl?: string | null;
  merchantLogoUrl?: string | null;
};

export type AddToCartPayload = {
  merchantId: number;
  productId: number;
  merchantProductId: number;
  quantity: number;
  priceAtAdd: number;
  compareAtPrice?: number | null;
  selectedModifiers?: any[] | null;
  selectedVariation?: { relationTo: string; value: number | string } | null;
};

// Mobile specific helper types for UI grouping
export interface MerchantCartSummary {
  merchantId: string; // Keep as string for route params compatibility
  merchantName: string;
  merchantLogoUrl?: string | null;
  totalItems: number;
  subtotal: number;
  items: CartItem[];
}

export interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  error: string | null;
  totalQuantity: number;
  reload: () => Promise<void>;
  addToCart: (payload: AddToCartPayload) => Promise<void>;
  removeFromCart: (id: number) => Promise<void>;
  updateQuantity: (id: number, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  clearMerchantCart: (merchantId: string | number) => Promise<void>;
  getMerchantCart: (merchantId: string | number) => MerchantCartSummary | null;
  getAllMerchantCarts: () => MerchantCartSummary[];
  getCartTotal: () => number;
  getCartItemCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { customerId } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMerchantIds, setPendingMerchantIds] = useState<Set<number>>(new Set());
  
  // Track if initial load is done to avoid loading spinner on background refresh
  const hasLoadedRef = useRef(false);

  const API_BASE = apiConfig.baseUrl;

  const loadCart = useCallback(async () => {
    try {
      // Only show loading state on first load
      if (!hasLoadedRef.current) setIsLoading(true);
      setError(null);

      if (!customerId) {
        setItems([]);
        setIsLoading(false);
        hasLoadedRef.current = true;
        return;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = apiConfig.payloadApiKey;
      if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;

      const url = `${API_BASE}/cart-items?where[customer][equals]=${customerId}&where[status][equals]=active&depth=3&limit=200`;
      const res = await fetch(url, { headers, cache: 'no-store' });
      
      if (!res.ok) {
        setIsLoading(false);
        hasLoadedRef.current = true;
        return;
      }
      
      const data = await res.json();
      const docs: any[] = Array.isArray(data?.docs) ? data.docs : [];
      
      const mapped: CartItem[] = docs.map((doc: any) => {
        const product = doc.product || null;
        const merchant = doc.merchant || null;
        const media = product?.media?.primaryImage || null;
        const imageUrl = media?.cloudinaryURL || media?.url || media?.thumbnailURL || null;
        const merchantLogoMedia = merchant?.vendor?.logo || null;
        const merchantLogoUrl =
          merchantLogoMedia?.cloudinaryURL ||
          merchantLogoMedia?.url ||
          merchantLogoMedia?.thumbnailURL ||
          null;
          
        return {
          id: doc.id,
          customer: typeof doc.customer === 'object' ? doc.customer.id : doc.customer,
          merchant: typeof doc.merchant === 'object' ? doc.merchant.id : doc.merchant,
          product: typeof doc.product === 'object' ? doc.product.id : doc.product,
          merchantProduct: typeof doc.merchantProduct === 'object' ? doc.merchantProduct.id : doc.merchantProduct,
          quantity: doc.quantity,
          priceAtAdd: doc.priceAtAdd,
          compareAtPrice: doc.compareAtPrice ?? null,
          subtotal: doc.subtotal,
          productSize: doc.productSize || null,
          selectedVariation: doc.selectedVariation
            ? (typeof doc.selectedVariation === 'object' && doc.selectedVariation !== null
                ? ('value' in doc.selectedVariation
                    ? (typeof doc.selectedVariation.value === 'object' ? doc.selectedVariation.value.id : doc.selectedVariation.value)
                    : doc.selectedVariation.id)
                : doc.selectedVariation)
            : null,
          selectedVariationName:
            typeof doc.selectedVariation === 'object' && doc.selectedVariation !== null
              ? ('value' in doc.selectedVariation
                  ? (typeof doc.selectedVariation.value === 'object' ? doc.selectedVariation.value?.name || null : null)
                  : doc.selectedVariation.name || null)
              : null,
          selectedModifiers: doc.selectedModifiers || null,
          selectedAddons: doc.selectedAddons || null,
          isAvailable: typeof doc.isAvailable === 'boolean' ? doc.isAvailable : true,
          unavailableReason: doc.unavailableReason || null,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          productName: product?.name || '',
          merchantName: merchant?.outletName || merchant?.name || '',
          imageUrl,
          merchantLogoUrl,
        };
      });
      
      setItems(mapped);
      setIsLoading(false);
      hasLoadedRef.current = true;
    } catch (e: any) {
      setError(e?.message || 'Failed to load cart');
      // Don't clear items on error — keep the last good snapshot so a
      // transient network failure doesn't wipe the cart from the UI.
      setIsLoading(false);
      hasLoadedRef.current = true;
    }
  }, [customerId, API_BASE]);

  const addToCart = useCallback(
    async (payload: AddToCartPayload) => {
      try {
        setError(null);
        setPendingMerchantIds((prev) => {
          const next = new Set(prev);
          if (!next.has(payload.merchantId)) {
            next.add(payload.merchantId);
          }
          return next;
        });

        if (!customerId) {
          throw new Error('Please login to add items to cart');
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const apiKey = apiConfig.payloadApiKey;
        if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;

        const body: any = {
          customer: Number(customerId), // Ensure number if backend expects it
          merchant: payload.merchantId,
          product: payload.productId,
          merchantProduct: payload.merchantProductId,
          quantity: payload.quantity,
          priceAtAdd: payload.priceAtAdd,
        };
        
        if (payload.compareAtPrice != null) {
          body.compareAtPrice = payload.compareAtPrice;
        }
        if (payload.selectedModifiers && payload.selectedModifiers.length > 0) {
          body.selectedModifiers = payload.selectedModifiers;
        }
        if (payload.selectedVariation) {
          body.selectedVariation = payload.selectedVariation;
        }

        const res = await fetch(`${API_BASE}/cart-items`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          let rawText = '';
          let message = '';
          try {
            const data = await res.json();
            const messages: string[] = [];
            if (data && typeof (data as any).message === 'string') {
              messages.push((data as any).message);
            }
            const errors = (data as any).errors;
            if (Array.isArray(errors)) {
              for (const err of errors) {
                if (err && typeof err.message === 'string') {
                  messages.push(err.message);
                }
              }
            }
            message = messages.join(' | ');
            rawText = message || JSON.stringify(data);
          } catch {
            rawText = await res.text().catch(() => '');
          }

          const text = rawText || '';
          if (text.includes('CART_ITEM_MERGED:')) {
            await loadCart();
            return;
          }

          throw new Error(text || `Add to cart failed (${res.status})`);
        }

        await loadCart();
      } catch (e: any) {
        setError(e?.message || 'Failed to add to cart');
        throw e; // Re-throw so UI can handle it
      } finally {
        setPendingMerchantIds((prev) => {
          const next = new Set(prev);
          next.delete(payload.merchantId);
          return next;
        });
      }
    },
    [customerId, loadCart, API_BASE]
  );

  const removeItemServer = useCallback(
    async (id: number) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = apiConfig.payloadApiKey;
      if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;

      const res = await fetch(`${API_BASE}/cart-items/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'removed',
          deleted_at: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Remove from cart failed (${res.status})`);
      }
    },
    [API_BASE],
  );

  const removeFromCart = useCallback(
    async (id: number) => {
      try {
        setError(null);
        await removeItemServer(id);
        await loadCart();
      } catch (e: any) {
        setError(e?.message || 'Failed to remove from cart');
      }
    },
    [removeItemServer, loadCart]
  );

  const updateQuantity = useCallback(
    async (id: number, quantity: number) => {
      try {
        setError(null);

        // Decrementing below 1 removes the item from the cart instead of
        // leaving a stale zero-quantity line item.
        if (quantity < 1) {
          await removeFromCart(id);
          return;
        }

        // Optimistic update
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== id) return item;
            const unit =
              item.quantity > 0 ? item.subtotal / item.quantity : item.priceAtAdd;
            return {
              ...item,
              quantity,
              subtotal: unit * quantity,
            };
          }),
        );
        
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const apiKey = apiConfig.payloadApiKey;
        if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;

        const res = await fetch(`${API_BASE}/cart-items/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ quantity }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `Update quantity failed (${res.status})`);
        }

        await loadCart();
      } catch (e: any) {
        setError(e?.message || 'Failed to update quantity');
      }
    },
    [removeFromCart, loadCart, API_BASE]
  );

  const clearCart = useCallback(async () => {
    try {
      await Promise.allSettled(items.map((item) => removeItemServer(item.id)));
      await loadCart();
    } catch (e) {
      console.error('Failed to clear cart', e);
    }
  }, [items, removeItemServer, loadCart]);

  const clearMerchantCart = useCallback(async (merchantId: string | number) => {
    try {
      const mIdStr = String(merchantId);
      const itemsToDelete = items.filter(item => String(item.merchant) === mIdStr);
      await Promise.allSettled(itemsToDelete.map(item => removeItemServer(item.id)));
      await loadCart();
    } catch (e) {
      console.error('Failed to clear merchant cart', e);
    }
  }, [items, removeItemServer, loadCart]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const totalQuantity = useMemo(() => {
    let count = 0;
    for (const item of items) {
      count += Number(item.quantity) || 0;
    }
    // Rough in-flight feedback for adds that haven't loaded yet.
    count += pendingMerchantIds.size;
    return count;
  }, [items, pendingMerchantIds]);

  const getCartTotal = () => {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const getCartItemCount = () => {
    return totalQuantity;
  };

  const getAllMerchantCarts = useCallback((): MerchantCartSummary[] => {
    const groups: Record<string, CartItem[]> = {};
    
    items.forEach(item => {
      const mId = String(item.merchant);
      if (!groups[mId]) groups[mId] = [];
      groups[mId].push(item);
    });

    return Object.keys(groups).map(merchantId => {
      const groupItems = groups[merchantId];
      const subtotal = groupItems.reduce((sum, item) => sum + item.subtotal, 0);
      const totalItems = groupItems.reduce((sum, item) => sum + item.quantity, 0);
      
      // Use the name/logo from the first item
      const merchantName = groupItems[0]?.merchantName || 'Merchant';
      const merchantLogoUrl = groupItems[0]?.merchantLogoUrl;
      
      return {
        merchantId,
        merchantName,
        merchantLogoUrl,
        totalItems,
        subtotal,
        items: groupItems
      };
    });
  }, [items]);

  const getMerchantCart = useCallback((merchantId: string | number): MerchantCartSummary | null => {
    const mIdStr = String(merchantId);
    const merchantItems = items.filter(item => String(item.merchant) === mIdStr);
    
    if (merchantItems.length === 0) return null;

    const merchantName = merchantItems[0]?.merchantName || 'Merchant';
    const merchantLogoUrl = merchantItems[0]?.merchantLogoUrl;
    const subtotal = merchantItems.reduce((sum, item) => sum + item.subtotal, 0);
    const totalItems = merchantItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      merchantId: mIdStr,
      merchantName,
      merchantLogoUrl,
      totalItems,
      subtotal,
      items: merchantItems
    };
  }, [items]);

  const value: CartContextType = {
    items,
    isLoading,
    error,
    totalQuantity,
    reload: loadCart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    clearMerchantCart,
    getMerchantCart,
    getAllMerchantCarts,
    getCartTotal,
    getCartItemCount
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}
