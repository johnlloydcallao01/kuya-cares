'use client';

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import SearchField from '@/components/ui/SearchField';
import Image from '@/components/ui/ImageWrapper';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'react-hot-toast';

type ProductCardItem = {
  id: string | number;
  name: string;
  productType: string;
  basePrice: number | null;
  compareAtPrice: number | null;
  shortDescription: string | null;
  imageUrl: string | null;
  categoryIds?: number[];
};

type MerchantCategoryDisplay = {
  id: number;
  name: string;
  slug: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  products?: ProductCardItem[];
  categories?: MerchantCategoryDisplay[];
  requiredModifierProductIds?: Set<string | number>;
};

export default function MerchantSearchModal({ isOpen, onClose, products = [], categories = [], requiredModifierProductIds }: Props) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  const pathname = usePathname();
  const router = useRouter();
  const { addToCart } = useCart();
  const [addingId, setAddingId] = useState<string | number | null>(null);
  const merchantSlugId = useMemo(() => {
    const p = String(pathname || '');
    const parts = p.split('/').filter(Boolean);
    const idx = parts.indexOf('merchant');
    return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : '';
  }, [pathname]);

  const formatPrice = (value: number | null) => {
    if (value == null) return null;
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value));
  };

  const toSlug = (name: string | null | undefined): string => {
    const base = String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    return base || 'item';
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const byId = new Map<number, MerchantCategoryDisplay>();
    (categories || []).forEach((c) => byId.set(c.id, c));
    return (products || []).filter((p) => {
      const n = (p.name || '').toLowerCase();
      const d = (p.shortDescription || '').toLowerCase();
      const matchProduct = n.includes(q) || d.includes(q);
      const matchCategory = (p.categoryIds || []).some((cid) => {
        const c = byId.get(cid);
        const text = ((c?.name || '') + ' ' + (c?.slug || '')).toLowerCase();
        return text.includes(q);
      });
      return matchProduct || matchCategory;
    });
  }, [products, categories, query]);

  const needsConfigFor = useCallback((p: ProductCardItem): boolean => {
    const pType = String((p as any).productType || 'simple').toLowerCase();
    if (pType !== 'simple') return true;
    const numericPid = typeof p.id === 'number' ? p.id : Number(String(p.id).split('-').pop() || '');
    return Number.isFinite(numericPid) && (
      requiredModifierProductIds?.has(numericPid) || requiredModifierProductIds?.has(String((p as any).id)) || false
    );
  }, [requiredModifierProductIds]);

  const productHrefFor = useCallback((p: ProductCardItem): string => {
    const slug = toSlug(p.name);
    const productSlugId = `${slug}-${p.id}`;
    return merchantSlugId ? `/merchant/${merchantSlugId}/${productSlugId}` : `/merchant/${productSlugId}`;
  }, [merchantSlugId]);

  const handleAddToCart = useCallback(async (p: ProductCardItem) => {
    // Non-simple / required-modifier rows route to the PDP (grid parity) —
    // the old stub dispatched an unhandled 'cart:add' event (silent no-op).
    if (needsConfigFor(p)) {
      router.push(productHrefFor(p) as any);
      return;
    }
    const parts = String(pathname || '').split('/').filter(Boolean);
    const sIdx = parts.indexOf('merchant');
    const sSlugId = sIdx >= 0 && parts[sIdx + 1] ? parts[sIdx + 1] : '';
    const merchantId = sSlugId ? Number(sSlugId.split('-').pop() || '') : NaN;
    if (!merchantId || Number.isNaN(merchantId)) {
      toast.error('Open a merchant page to add items.');
      return;
    }
    const productId = typeof p.id === 'number' ? p.id : Number(String(p.id).split('-').pop() || '');
    if (!productId || Number.isNaN(productId)) return;
    setAddingId(p.id);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
      const url = `${API_BASE}/merchant-products?where[merchant_id][equals]=${merchantId}&where[product_id][equals]=${productId}&limit=1`;
      const res = await fetch(url, { headers, cache: 'no-store' });
      if (!res.ok) throw new Error('Product not available at this merchant.');
      const data = await res.json();
      const doc = Array.isArray(data?.docs) && data.docs.length > 0 ? data.docs[0] : null;
      const merchantProductId = doc && (typeof doc.id === 'number' ? doc.id : Number(doc.id)) || null;
      if (!merchantProductId) throw new Error('Product not available at this merchant.');
      await addToCart({
        merchantId,
        productId,
        merchantProductId,
        quantity: 1,
        priceAtAdd: p.basePrice ?? 0,
        compareAtPrice: p.compareAtPrice ?? null,
      });
      toast.success('Added to cart');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add to cart.');
    } finally {
      setAddingId(null);
    }
  }, [pathname, router, addToCart, needsConfigFor, productHrefFor]);

  if (!isOpen) return null as any;

  const overlay = (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', backgroundColor: 'white', zIndex: 99999 }}>
      <div className="w-full h-full flex flex-col bg-white" data-modal-content>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors mr-3"
            aria-label="Close"
          >
            <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <SearchField
              placeholder="Search menu"
              value={query}
              onChange={setQuery}
              autoFocus
              inputClassName="pr-10 focus:ring-[#777]"
            />
          </div>
        </div>
        <div className="flex-1 px-4 py-4 overflow-y-auto">
          {filtered.length === 0 ? (
            query.trim().length === 0 ? null : <div className="text-center text-gray-500">No matching items</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((p) => {
                const href = productHrefFor(p);
                const LinkComponent = Link as any;
                const base = formatPrice(p.basePrice);
                const compare = formatPrice(p.compareAtPrice);
                const pType = String((p as any).productType || 'simple').toLowerCase();
                const needsConfig = needsConfigFor(p);
                const adding = addingId != null && String(addingId) === String(p.id);
                return (
                  <LinkComponent key={p.id} href={href} className="flex items-center py-3">
                    <div className="flex-1 pr-4">
                      <h3 className="text-[0.95rem] font-semibold text-gray-900 leading-tight line-clamp-1">{p.name}</h3>
                      {p.shortDescription && (
                        <p className="mt-1 text-sm text-gray-600 leading-snug line-clamp-2">{p.shortDescription}</p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        {pType === 'simple' ? (
                          <>
                            {base && <span className="text-[0.95rem] font-bold text-gray-900">{base}</span>}
                            {base && compare && (p.compareAtPrice as number) > (p.basePrice ?? 0) && (
                              <span className="text-sm text-gray-500 line-through">{compare}</span>
                            )}
                          </>
                        ) : pType === 'variable' ? (
                          <span className="text-sm font-medium text-[#239459]">Show Variations</span>
                        ) : pType === 'grouped' ? (
                          <span className="text-sm font-medium text-[#239459]">Show Grouped Items</span>
                        ) : base ? (
                          <span className="text-[0.95rem] font-bold text-gray-900">{base}</span>
                        ) : (
                          <span className="text-sm text-gray-400">Price varies</span>
                        )}
                      </div>
                    </div>
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
                      {p.imageUrl ? (
                        <Image src={p.imageUrl} alt={p.name} fill className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400">No image</div>
                      )}
                      <button
                        type="button"
                        aria-label={needsConfig ? 'View product' : 'Add to cart'}
                        disabled={adding}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddToCart(p); }}
                        className="absolute bottom-2 right-2 w-7 h-7 rounded-full shadow-lg text-white flex items-center justify-center disabled:opacity-60"
                        style={{ backgroundColor: '#239459' }}
                      >
                        {adding
                          ? <i className="fas fa-spinner fa-spin text-[11px]" />
                          : <i className={`fas ${needsConfig ? 'fa-eye' : 'fa-plus'} text-[11px]`} />}
                      </button>
                    </div>
                  </LinkComponent>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay as any, document.body as any) as any;
}
