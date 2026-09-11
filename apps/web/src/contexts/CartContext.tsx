 'use client';

 import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { LocationBasedMerchantService } from '@encreasl/client-services';

type CartItem = {
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

type AddToCartPayload = {
  merchantId: number;
  productId: number;
  merchantProductId: number;
  quantity: number;
  priceAtAdd: number;
  compareAtPrice?: number | null;
  selectedModifiers?: any[] | null;
};

type CartContextValue = {
  items: CartItem[];
  isLoading: boolean;
  error: string | null;
  totalQuantity: number;
  reload: () => Promise<void>;
  addToCart: (payload: AddToCartPayload) => Promise<void>;
  removeItem: (id: number) => Promise<void>;
  updateQuantity: (id: number, quantity: number) => Promise<void>;
};

 const CartContext = createContext<CartContextValue | undefined>(undefined);

 const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';

 export function CartProvider({ children }: { children: React.ReactNode }) {
   const [items, setItems] = useState<CartItem[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [pendingMerchantIds, setPendingMerchantIds] = useState<Set<number>>(new Set());

   const loadCart = useCallback(async () => {
     try {
       setIsLoading(true);
       setError(null);

       const customerId = await LocationBasedMerchantService.getCurrentCustomerId();
       if (!customerId) {
         setItems([]);
         setIsLoading(false);
         return;
       }

       const headers: Record<string, string> = { 'Content-Type': 'application/json' };
       const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
       if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;

       const url = `${API_BASE}/cart-items?where[customer][equals]=${customerId}&depth=3&limit=200`;
       const res = await fetch(url, { headers, cache: 'no-store' });
       if (!res.ok) {
         setItems([]);
         setIsLoading(false);
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
            ? (typeof doc.selectedVariation === 'object' ? doc.selectedVariation.id : doc.selectedVariation)
            : null,
          selectedModifiers: doc.selectedModifiers || null,
          selectedAddons: doc.selectedAddons || null,
          isAvailable: typeof doc.isAvailable === 'boolean' ? doc.isAvailable : true,
          unavailableReason: doc.unavailableReason || null,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          productName: product?.name || '',
          merchantName: merchant?.outletName || '',
          imageUrl,
          merchantLogoUrl,
        };
      });
       setItems(mapped);
       setIsLoading(false);
     } catch (e: any) {
       setError(e?.message || 'Failed to load cart');
       setItems([]);
       setIsLoading(false);
     }
   }, []);

  const addToCart = useCallback(
    async (payload: AddToCartPayload) => {
      try {
        setError(null);
        setPendingMerchantIds((prev) => {
          const next = new Set(prev);
          const hasMerchantInItems = items.some((item) => {
            const id =
              typeof item.merchant === 'number' ? item.merchant : Number(item.merchant);
            return !Number.isNaN(id) && id === payload.merchantId;
          });
          if (!hasMerchantInItems && !next.has(payload.merchantId)) {
            next.add(payload.merchantId);
          }
          return next;
        });

        const customerId = await LocationBasedMerchantService.getCurrentCustomerId();
        if (!customerId) {
          throw new Error('NO_CUSTOMER');
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
        if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;

        const body: any = {
          customer: Number(customerId),
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
      } finally {
        setPendingMerchantIds((prev) => {
          const next = new Set(prev);
          next.delete(payload.merchantId);
          return next;
        });
      }
    },
    [items, loadCart],
  );

  const removeItem = useCallback(
    async (id: number) => {
      try {
        setError(null);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
        if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;

        const res = await fetch(`${API_BASE}/cart-items/${id}`, {
          method: 'DELETE',
          headers,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `Remove from cart failed (${res.status})`);
        }

        await loadCart();
      } catch (e: any) {
        setError(e?.message || 'Failed to remove from cart');
      }
    },
    [loadCart],
  );

  const updateQuantity = useCallback(
    async (id: number, quantity: number) => {
      try {
        setError(null);
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== id) return item;
            if (quantity < 1) return item;
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
        const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
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
    [loadCart],
  );

   useEffect(() => {
     loadCart();
   }, [loadCart]);

  const totalQuantity = React.useMemo(() => {
    const merchantIds = new Set<number>();
    for (const item of items) {
      const id =
        typeof item.merchant === 'number' ? item.merchant : Number(item.merchant);
      if (!Number.isNaN(id)) merchantIds.add(id);
    }
    pendingMerchantIds.forEach((id) => {
      if (!Number.isNaN(id)) merchantIds.add(id);
    });
    return merchantIds.size;
  }, [items, pendingMerchantIds]);

  const value: CartContextValue = {
    items,
    isLoading,
    error,
    totalQuantity,
    reload: loadCart,
    addToCart,
    removeItem,
    updateQuantity,
  };

   return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
 }

 export function useCart() {
   const ctx = useContext(CartContext);
   if (!ctx) throw new Error('useCart must be used within CartProvider');
   return ctx;
 }
