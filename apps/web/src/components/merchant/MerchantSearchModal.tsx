'use client';

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SearchField from '@/components/ui/SearchField';
import Image from '@/components/ui/ImageWrapper';

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
};

export default function MerchantSearchModal({ isOpen, onClose, products = [], categories = [] }: Props) {
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

  const handleAddToCart = useCallback((p: ProductCardItem) => {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cart:add', { detail: { id: p.id, name: p.name, price: p.basePrice } }));
      }
    } catch {}
  }, []);

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
                const slug = toSlug(p.name);
                const productSlugId = `${slug}-${p.id}`;
                const href = merchantSlugId ? `/merchant/${merchantSlugId}/${productSlugId}` : `/merchant/${productSlugId}`;
                const LinkComponent = Link as any;
                const base = formatPrice(p.basePrice);
                const compare = formatPrice(p.compareAtPrice);
                return (
                  <LinkComponent key={p.id} href={href} className="flex items-center py-3">
                    <div className="flex-1 pr-4">
                      <h3 className="text-[0.95rem] font-semibold text-gray-900 leading-tight line-clamp-1">{p.name}</h3>
                      {p.shortDescription && (
                        <p className="mt-1 text-sm text-gray-600 leading-snug line-clamp-2">{p.shortDescription}</p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        {base && <span className="text-[0.95rem] font-bold text-gray-900">{base}</span>}
                        {compare && (p.compareAtPrice as number) > (p.basePrice ?? 0) && (
                          <span className="text-sm text-gray-500 line-through">{compare}</span>
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
                        aria-label="Add to cart"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddToCart(p); }}
                        className="absolute bottom-2 right-2 w-7 h-7 rounded-full shadow-lg text-white flex items-center justify-center"
                        style={{ backgroundColor: '#eba236' }}
                      >
                        <i className="fas fa-plus text-[11px]" />
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
