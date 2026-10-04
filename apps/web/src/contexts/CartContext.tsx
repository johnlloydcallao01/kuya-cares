  'use client';

  import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { LocationBasedMerchantService } from '@encreasl/client-services';
import { useAuthContext } from './AuthContext';

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

type AddToCartPayload = {
  merchantId: number;
  productId: number;
  merchantProductId: number;
  quantity: number;
  priceAtAdd: number;
  compareAtPrice?: number | null;
  selectedModifiers?: any[] | null;
  selectedVariation?: { relationTo: string; value: string | number } | null;
};

export type MerchantCartSummary = {
  merchantId: string;
  merchantName: string;
  merchantLogoUrl?: string | null;
  totalItems: number;
  subtotal: number;
  items: CartItem[];
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
  clearCart: () => Promise<void>;
  clearMerchantCart: (merchantId: string | number) => Promise<void>;
  getMerchantCart: (merchantId: string | number) => MerchantCartSummary | null;
  getAllMerchantCarts: () => MerchantCartSummary[];
  getCartTotal: () => number;
  getCartItemCount: () => number;
};

  const CartContext = createContext<CartContextValue | undefined>(undefined);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';

  function cmsHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
    if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
    return headers;
  }

  export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingMerchantIds, setPendingMerchantIds] = useState<Set<number>>(new Set());
    // Auth-reactive identity (mobile parity): mobile reloads on customerId
    // change; the old web cart loaded once on mount, so a mount-while-
    // logged-out wipe was never retried after login — "always empty".
    // CartProvider renders inside AuthProvider (see app/providers.tsx).
    const { user: authUser } = useAuthContext();
    const authUserId = (() => {
      const rawId = (authUser as any)?.id;
      return typeof rawId === 'number' || typeof rawId === 'string' ? rawId : null;
    })();

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

        // Active only (mobile parity): removed/ordered rows must never render
        // as ghost carts, and finalize flows depend on status scoping.
        const url = `${API_BASE}/cart-items?where[customer][equals]=${customerId}&where[status][equals]=active&depth=3&limit=200`;
        const res = await fetch(url, { headers: cmsHeaders(), cache: 'no-store' });
        if (!res.ok) {
          // Keep last-good snapshot on transient failure (mobile parity) —
          // wiping the UI on a blip strands checkout mid-flow.
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
         const variation = doc.selectedVariation;
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
           selectedVariation: variation
             ? (typeof variation === 'object' ? variation.id : variation)
             : null,
           selectedVariationName:
             variation && typeof variation === 'object'
               ? variation.name || variation.label || null
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
      } catch (e: any) {
        setError(e?.message || 'Failed to load cart');
        setIsLoading(false);
      }
    }, []);

   const addToCart = useCallback(
     async (payload: AddToCartPayload) => {
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

       try {
         const customerId = await LocationBasedMerchantService.getCurrentCustomerId();
         if (!customerId) {
           throw new Error('Please login to add items to cart');
         }

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
         if (payload.selectedVariation) {
           body.selectedVariation = payload.selectedVariation;
         }

         const res = await fetch(`${API_BASE}/cart-items`, {
           method: 'POST',
           headers: cmsHeaders(),
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
         const message = e?.message || 'Failed to add to cart';
         setError(message);
         throw e instanceof Error ? e : new Error(message);
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

   const removeItemServer = useCallback(async (id: number) => {
     // Soft-delete only (mobile/CMS lifecycle parity): finalize flows query
     // where[order_id] and status transitions; hard DELETE breaks them.
     const res = await fetch(`${API_BASE}/cart-items/${id}`, {
       method: 'PATCH',
       headers: cmsHeaders(),
       body: JSON.stringify({ status: 'removed', deleted_at: new Date().toISOString() }),
     });

     if (!res.ok) {
       const text = await res.text().catch(() => '');
       throw new Error(text || `Remove from cart failed (${res.status})`);
     }
   }, []);

   const removeItem = useCallback(
     async (id: number) => {
       try {
         setError(null);
         await removeItemServer(id);
         await loadCart();
       } catch (e: any) {
         setError(e?.message || 'Failed to remove from cart');
         throw e instanceof Error ? e : new Error('Failed to remove from cart');
       }
     },
     [loadCart, removeItemServer],
   );

   const clearCart = useCallback(async () => {
     await Promise.allSettled(items.map((item) => removeItemServer(item.id)));
     await loadCart();
   }, [items, loadCart, removeItemServer]);

   const clearMerchantCart = useCallback(
     async (merchantId: string | number) => {
       const targets = items.filter((item) => String(item.merchant) === String(merchantId));
       await Promise.allSettled(targets.map((item) => removeItemServer(item.id)));
       await loadCart();
     },
     [items, loadCart, removeItemServer],
   );

   const updateQuantity = useCallback(
     async (id: number, quantity: number) => {
       // Decrement-to-zero removes the line (mobile parity) — no zero-qty
       // rows persist.
       if (quantity < 1) {
         await removeItem(id);
         return;
       }
       try {
         setError(null);
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

         const res = await fetch(`${API_BASE}/cart-items/${id}`, {
           method: 'PATCH',
           headers: cmsHeaders(),
           body: JSON.stringify({ quantity }),
         });

         if (!res.ok) {
           const text = await res.text().catch(() => '');
           throw new Error(text || `Update quantity failed (${res.status})`);
         }

         await loadCart();
       } catch (e: any) {
         setError(e?.message || 'Failed to update quantity');
         throw e instanceof Error ? e : new Error('Failed to update quantity');
       }
     },
     [loadCart, removeItem],
   );

   const getAllMerchantCarts = useCallback((): MerchantCartSummary[] => {
     const byMerchant = new Map<string, MerchantCartSummary>();
     for (const item of items) {
       const key = String(item.merchant);
       const existing = byMerchant.get(key);
       if (existing) {
         existing.items.push(item);
         existing.subtotal += item.subtotal || 0;
         existing.totalItems += item.quantity || 0;
       } else {
         byMerchant.set(key, {
           merchantId: key,
           merchantName: item.merchantName || 'Merchant',
           merchantLogoUrl: item.merchantLogoUrl || null,
           totalItems: item.quantity || 0,
           subtotal: item.subtotal || 0,
           items: [item],
         });
       }
     }
     return Array.from(byMerchant.values());
   }, [items]);

   const getMerchantCart = useCallback(
     (merchantId: string | number): MerchantCartSummary | null => {
       const key = String(merchantId);
       const merchantItems = items.filter((item) => String(item.merchant) === key);
       if (merchantItems.length === 0) return null;
       return {
         merchantId: key,
         merchantName: merchantItems[0]?.merchantName || 'Merchant',
         merchantLogoUrl: merchantItems[0]?.merchantLogoUrl || null,
         totalItems: merchantItems.reduce((s, i) => s + (i.quantity || 0), 0),
         subtotal: merchantItems.reduce((s, i) => s + (i.subtotal || 0), 0),
         items: merchantItems,
       };
     },
     [items],
   );

   const getCartTotal = useCallback(() => {
     return items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
   }, [items]);

   // Item count (mobile parity): Σ quantities + in-flight adds. The old web
   // badge showed distinct merchant count instead of item count.
   const totalQuantity = React.useMemo(() => {
     let count = 0;
     for (const item of items) {
       count += item.quantity || 0;
     }
     return count + pendingMerchantIds.size;
   }, [items, pendingMerchantIds]);

   const getCartItemCount = useCallback(() => {
     return totalQuantity;
   }, [totalQuantity]);

   useEffect(() => {
     loadCart();
     // Reload when the signed-in user changes (login/logout/switch):
     // a mount-while-logged-out wipe must not stick after login.
   }, [loadCart, authUserId]);

   const value: CartContextValue = {
     items,
     isLoading,
     error,
     totalQuantity,
     reload: loadCart,
     addToCart,
     removeItem,
     updateQuantity,
     clearCart,
     clearMerchantCart,
     getMerchantCart,
     getAllMerchantCarts,
     getCartTotal,
     getCartItemCount,
   };

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
  }

  export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error('useCart must be used within CartProvider');
    return ctx;
  }
