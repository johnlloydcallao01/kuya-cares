'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from '@/components/ui/ImageWrapper';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'react-hot-toast';
import { formatPHP, type MarketplaceProduct } from '@encreasl/client-services';

/**
 * Shared marketplace product tile (home Recommended grid + full
 * /merchant-products virtualized feed). Kept in its own module so the
 * listing page doesn't pull the home section's filter drawer / flash
 * rail code into its chunk (§docs/performance.md §4b.3 bundle discipline).
 */
export function ProductCard({ product, hideDistance = false }: { product: MarketplaceProduct; hideDistance?: boolean }) {
  const { addToCart } = useCart();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const LinkComponent = Link as unknown as React.ElementType;

  const priceLabel = formatPHP(product.price);
  const compareLabel =
    product.compareAtPrice != null && product.compareAtPrice > (product.price ?? 0)
      ? formatPHP(product.compareAtPrice)
      : null;

  const handleQuickAdd = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Variable/grouped items must be configured on the detail page
      // (mobile parity) — POSTing without a variation 400/500s. Route to
      // the PDP instead of silently swallowing the tap.
      if (product.productType !== 'simple') {
        router.push(product.href as any);
        return;
      }
      const merchantId = Number(product.merchantId);
      const productId = Number(product.id);
      const merchantProductId = Number(product.merchantProductId);
      if (!merchantId || !productId || !merchantProductId || Number.isNaN(merchantId) || Number.isNaN(productId) || Number.isNaN(merchantProductId)) {
        return;
      }
      try {
        setAdding(true);
        await addToCart({
          merchantId,
          productId,
          merchantProductId,
          quantity: 1,
          priceAtAdd: product.price ?? 0,
          compareAtPrice: product.compareAtPrice ?? null,
        });
      } catch {
        toast.error('Failed to add to cart. Please sign in and try again.');
      } finally {
        setAdding(false);
      }
    },
    [addToCart, product, router],
  );

  return (
    <LinkComponent href={product.href} className="bg-white rounded-lg shadow-sm overflow-hidden block hover:shadow-md transition-shadow group">
      <div className="relative aspect-square bg-gray-100">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 240px"
            className="object-cover group-hover:scale-[1.02] transition-transform duration-200"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 gap-1">
            <i className="fas fa-image text-2xl" />
            <span className="text-[11px]">No image</span>
          </div>
        )}
        {product.discountPercent != null && product.discountPercent > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[11px] font-bold px-1.5 py-0.5 rounded">
            -{product.discountPercent}%
          </div>
        )}
        {product.productType === 'simple' ? (
          <button
            type="button"
            aria-label={`Add ${product.name} to cart`}
            onClick={handleQuickAdd}
            disabled={adding}
            className="absolute bottom-2 right-2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {adding ? (
              <i className="fas fa-spinner fa-spin text-[12px]" style={{ color: '#333' }} />
            ) : (
              <i className="fas fa-plus text-[12px]" style={{ color: '#333' }} />
            )}
          </button>
        ) : null}
      </div>
      <div className="p-3">
        <h3 className="text-[13px] leading-[1.35] font-normal text-gray-900 line-clamp-2 min-h-[35px]">{product.name}</h3>
        <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
          {product.productType === 'simple' ? (
            priceLabel ? (
              <span className="text-[15px] font-bold text-[#ee4d2d]">{priceLabel}</span>
            ) : (
              <span className="text-[13px] text-gray-500">Price varies</span>
            )
          ) : product.productType === 'variable' ? (
            <span className="text-[13px] font-medium text-[#239459]">Show Variations</span>
          ) : product.productType === 'grouped' ? (
            <span className="text-[13px] font-medium text-[#239459]">Show Grouped Items</span>
          ) : (
            priceLabel ? (
              <span className="text-[15px] font-bold text-[#ee4d2d]">{priceLabel}</span>
            ) : (
              <span className="text-[13px] text-gray-500">Price varies</span>
            )
          )}
          {priceLabel && compareLabel && <span className="text-[11px] text-gray-400 line-through">{compareLabel}</span>}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 min-w-0">
          <p className="text-[11px] text-gray-500 truncate">
            <i className="fas fa-store mr-1 text-gray-400" />
            {product.merchantName}
            {!hideDistance && typeof product.distanceKm === 'number' && (
              <span className="ml-1 text-gray-400">
                • {product.distanceKm <= 0 ? '0km' : product.distanceKm < 1 ? `${Math.round(product.distanceKm * 1000)}m` : `${product.distanceKm.toFixed(1)}km`}
              </span>
            )}
          </p>
          {typeof product.rating === 'number' && (
            <span className="flex items-center gap-0.5 text-[11px] text-gray-500 shrink-0">
              <span className="text-amber-400">★</span>
              {product.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </LinkComponent>
  );
}
