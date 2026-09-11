'use client';

import { useCallback, useEffect, useState } from 'react';
import ProductBackButton from '@/components/ui/ProductBackButton';
import { toast } from 'react-hot-toast';

export default function ProductStickyHeader({
  fallbackHref,
  overlay = false,
  isWishlisted = false,
  onToggleWishlist,
}: {
  fallbackHref?: string;
  overlay?: boolean;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
}) {
  const [bgAlpha, setBgAlpha] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = typeof window !== 'undefined' ? window.scrollY : 0;
      const alpha = Math.max(0, Math.min(1, y / 350));
      setBgAlpha(alpha);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleShare = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const title = document.title || 'Merchant';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
        return;
      }
      toast.error('Sharing not supported');
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Failed to share';
      toast.error(message);
    }
  }, []);

  return (
    <div className={overlay ? 'sticky top-0 left-0 right-0 z-50 lg:top-16' : 'sticky top-0 left-0 right-0 z-50 lg:block lg:top-16'}>
      <div
        className={
          'w-full px-[10px] h-[45px] min-h-[45px] max-h-[45px] flex items-center justify-between transition-colors duration-200'
        }
        style={{ backgroundColor: `rgba(255,255,255,${bgAlpha})` }}
      >
        <ProductBackButton fallbackHref={fallbackHref} />
        <div className="flex items-center gap-2">
          <button aria-label="Information" className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
            <i className="fas fa-info text-[14px] text-[#333]"></i>
          </button>
          <button
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={isWishlisted}
            onClick={onToggleWishlist}
            className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center"
          >
            <i className={`${isWishlisted ? "fas" : "fa-regular"} fa-heart text-[14px]`} style={{ color: isWishlisted ? "#f3a823" : "#333" }}></i>
          </button>
          <button aria-label="Share" onClick={handleShare} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
            <i className="fa-regular fa-share-from-square text-[14px] text-[#333]"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
