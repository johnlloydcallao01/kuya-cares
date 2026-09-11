'use client';

import Image from '@/components/ui/ImageWrapper';
import LocationMerchantCard from '@/components/cards/LocationMerchantCard';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  LocationBasedMerchantService,
  type LocationBasedMerchant,
  type Media,
  getActiveAddressNamesForMerchants,
  sortMerchantsByRecentlyUpdated,
} from '@encreasl/client-services';
import {
  getWishlistMerchantIdsForCurrentUser,
  addMerchantToWishlist,
  removeMerchantFromWishlist,
} from '@/lib/client-services/wishlist-service';
import { useAddressChange } from '@/hooks/useAddressChange';
import { toast } from 'react-hot-toast';

interface LocationBasedMerchantsProps {
  customerId?: string;
  limit?: number;
  categoryId?: string | null;
}

// Location-based Merchant Card Skeleton
function LocationMerchantCardSkeleton() {
  return (
    <div className="group cursor-pointer animate-pulse">
      <div className="relative aspect-[2/1] bg-gray-200 rounded-lg overflow-hidden mb-3">
        <div className="w-full h-full bg-gray-300"></div>
        {/* Distance badge skeleton */}
        <div className="absolute top-2 left-2 bg-gray-300 rounded-full px-2 py-1">
          <div className="h-3 w-12 bg-gray-400 rounded"></div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 rounded w-full"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        {/* Delivery time skeleton */}
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
  );
}

// Location-based Merchant Card Component
interface LocationMerchantCardLegacyProps {
  merchant: LocationBasedMerchant;
  isWishlisted?: boolean;
  onToggleWishlist?: (id: string) => void;
  addressName?: string | null;
}

function LocationMerchantCardLegacy({ merchant, isWishlisted = false, onToggleWishlist, addressName = null }: LocationMerchantCardLegacyProps) {
  // Get the best available image URL from thumbnail
  const getImageUrl = (media: Media | null | undefined): string | null => {
    if (!media) return null;

    // Priority: cloudinaryURL > url > thumbnailURL
    return media.cloudinaryURL || media.url || media.thumbnailURL || null;
  };

  const thumbnailImageUrl = getImageUrl(merchant.media?.thumbnail);
  const altText = merchant.media?.thumbnail?.alt || `${merchant.outletName} thumbnail`;
  
  // Get vendor logo URL
  const vendorLogoUrl = getImageUrl(merchant.vendor?.logo);

  // Format distance display
  const formatDistance = (distanceKm: number): string => {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
  };

  // Get delivery status color
  const getDeliveryStatusColor = (isWithinRadius: boolean, operationalStatus: string): string => {
    if (operationalStatus !== 'open') return 'bg-red-500';
    return isWithinRadius ? 'bg-green-500' : 'bg-orange-500';
  };

  // Get delivery status text
  const getDeliveryStatusText = (isWithinRadius: boolean, operationalStatus: string): string => {
    if (operationalStatus !== 'open') return 'Closed';
    return isWithinRadius ? 'Delivers' : 'Too Far';
  };

  return (
    <div className="group cursor-pointer">
      <div className="relative aspect-[2/1] bg-gray-100 rounded-lg overflow-visible mb-6 group-hover:shadow-lg transition-shadow duration-200">
        {thumbnailImageUrl ? (
          <div className="relative w-full h-full">
            <Image
              src={thumbnailImageUrl}
              alt={altText}
              fill
              className="object-cover rounded-lg"
              onError={(e) => {
                e.currentTarget.src = '/placeholder-merchant.jpg';
              }}
            />
          </div>
        ) : (
          <div className="relative w-full h-full">
            <Image
              src="/placeholder-merchant.jpg"
              alt="Merchant placeholder"
              fill
              className="object-cover rounded-lg"
            />
          </div>
        )}

        {/* Distance Badge */}
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
          {formatDistance(merchant.distanceKm)}
        </div>

        {/* Wishlist Heart - top-right, white circular background */}
        <button
          type="button"
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={isWishlisted}
          onClick={(e) => { e.stopPropagation(); onToggleWishlist && onToggleWishlist(merchant.id); }}
          className="absolute top-2 right-2 w-[28px] h-[28px] rounded-full bg-white flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
          style={{ zIndex: 2 }}
        >
          <i
            className={`fas fa-heart text-[16px]`}
            style={{ color: isWishlisted ? '#f3a823' : '#ffffff', WebkitTextStroke: '2px #333' }}
          ></i>
        </button>

        {/* Vendor Logo Overlay - Professional delivery platform style */}
        {vendorLogoUrl && (
          <div className="absolute -bottom-4 left-0 w-12 h-12 bg-white rounded-full shadow-lg border-2 border-white">
            { }
            <img
              src={vendorLogoUrl}
              alt={`${merchant.vendor?.businessName || 'Vendor'} logo`}
              className="w-full h-full object-contain rounded-full"
              loading="lazy"
              onError={(e) => {
                // Hide logo on error
                const target = e.target as HTMLImageElement;
                const parent = target.parentElement;
                if (parent) {
                  parent.style.display = 'none';
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Merchant Info */}
      <div className="space-y-1">
        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
          {addressName ? `${merchant.outletName} - ${addressName}` : merchant.outletName}
        </h3>
        
        {merchant.vendor?.businessName && (
          <p className="text-sm text-gray-600 line-clamp-1">
            {merchant.vendor.businessName}
          </p>
        )}

        {/* Rating and Orders */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {merchant.metrics?.averageRating && (
            <div className="flex items-center gap-1">
              <span className="text-yellow-400">★</span>
              <span>{merchant.metrics.averageRating.toFixed(1)}</span>
            </div>
          )}
          {merchant.metrics?.totalOrders && (
            <span>({merchant.metrics.totalOrders} orders)</span>
          )}
        </div>

        {/* Delivery Time */}
        <div className="text-sm text-gray-600">
          <span className="font-medium">
            {merchant.estimatedDeliveryTime} min delivery
          </span>
        </div>
      </div>
    </div>
  );
}

// Main LocationBasedMerchants Component
export function LocationBasedMerchants({ customerId, limit = 9999, categoryId }: LocationBasedMerchantsProps) {
  const router = useRouter();
  const [addressMap, setAddressMap] = useState<Record<string, string>>({});
  const [merchants, setMerchants] = useState<LocationBasedMerchant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCustomerId, setResolvedCustomerId] = useState<string | null>(customerId || null);

  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const toggleWishlist = useCallback((id: string | number) => {
    const idStr = String(id);
    setWishlistIds(prev => {
      const next = new Set(prev);
      const willAdd = !next.has(idStr);
      if (willAdd) {
        next.add(idStr);
      } else {
        next.delete(idStr);
      }
      (async () => {
        try {
          if (willAdd) {
            await addMerchantToWishlist(id);
            toast.success('Added to wishlist', { id: `wishlist-${idStr}` });
          } else {
            await removeMerchantFromWishlist(id);
            toast.success('Removed from wishlist', { id: `wishlist-${idStr}` });
          }
        } catch (err) {
          setWishlistIds(current => {
            const rollback = new Set(current);
            if (willAdd) {
              rollback.delete(idStr);
            } else {
              rollback.add(idStr);
            }
            return rollback;
          });
          const message = err instanceof Error && err.message ? err.message : 'Wishlist update failed';
          toast.error(message, { id: `wishlist-${idStr}-error` });
        }
      })();
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const ids = await getWishlistMerchantIdsForCurrentUser();
        if (cancelled) return;
        const setIds = new Set<string>(ids.map((v) => String(v)));
        setWishlistIds(setIds);
      } catch {
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Momentum carousel states (tailored from category carousel)
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [startTranslateX, setStartTranslateX] = useState(0);
  const [lastTime, setLastTime] = useState(0);
  const [velocityX, setVelocityX] = useState(0);
  const [maxTranslate, setMaxTranslate] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const boundsCalculatedRef = useRef(false);

  // Fastest Delivery carousel independent states
  const [isDraggingFast, setIsDraggingFast] = useState(false);
  const [startXFast, setStartXFast] = useState(0);
  const [currentXFast, setCurrentXFast] = useState(0);
  const [translateXFast, setTranslateXFast] = useState(0);
  const [startTranslateXFast, setStartTranslateXFast] = useState(0);
  const [lastTimeFast, setLastTimeFast] = useState(0);
  const [velocityXFast, setVelocityXFast] = useState(0);
  const [maxTranslateFast, setMaxTranslateFast] = useState(0);
  const carouselRefFast = useRef<HTMLDivElement>(null);
  const animationRefFast = useRef<number | null>(null);
  const boundsCalculatedRefFast = useRef(false);

  // Helper: build headers with API key
  const buildHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
    if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
    return headers;
  }, []);

  // Fetch active address name for a single merchant with fallback by coordinates
  const fetchAndSetActiveAddresses = useCallback(async (list: LocationBasedMerchant[]) => {
    if (!list || list.length === 0) return;
    const map = await getActiveAddressNamesForMerchants(list);
    let changed = false;
    const next: Record<string, string> = { ...addressMap };
    for (const id of Object.keys(map)) {
      const name = map[id];
      if (name && (!next[id] || next[id] !== name)) {
        next[id] = name;
        changed = true;
      }
    }
    if (changed) setAddressMap(next);
  }, [addressMap]);

  // Function to fetch merchants
  const fetchLocationBasedMerchants = useCallback(async (customerIdToUse: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const locationMerchants = await LocationBasedMerchantService.getLocationBasedMerchants({
        customerId: customerIdToUse,
        limit,
        categoryId: categoryId || undefined,
      });
      setMerchants(locationMerchants);
      fetchAndSetActiveAddresses(locationMerchants);
    } catch (err) {
      console.error('❌ Error fetching location-based merchants:', err);
      setError('Failed to load merchants. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [limit, categoryId, fetchAndSetActiveAddresses]);


  // Parse update timestamp robustly from updatedAt/createdAt
  const fastestMerchants = React.useMemo(() => {
    return sortMerchantsByRecentlyUpdated(merchants);
  }, [merchants]);

  // Viewport width tracking for responsive grid sizing (>1024px)
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 0);
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Show-more counters for desktop grids
  const [nearbyVisibleCount, setNearbyVisibleCount] = useState<number>(0);
  const [newlyVisibleCount, setNewlyVisibleCount] = useState<number>(0);

  const getGridStep = useCallback((w: number) => {
    if (w > 1120) return 8;
    if (w >= 1025) return 6;
    return 0;
  }, []);

  // Initialize or adjust counts when data or viewport changes
  // Ensure counts increase to at least the default step when data grows after unfiltering
  useEffect(() => {
    if (!categoryId && viewportWidth >= 1025) {
      const step = getGridStep(viewportWidth);
      setNearbyVisibleCount(prev => {
        const base = Math.max(prev, step);
        return Math.min(base, merchants.length);
      });
      setNewlyVisibleCount(prev => {
        const base = Math.max(prev, step);
        return Math.min(base, fastestMerchants.length);
      });
    }
  }, [categoryId, viewportWidth, merchants.length, fastestMerchants.length, getGridStep]);

  const showMoreNearby = useCallback(() => {
    const step = getGridStep(viewportWidth);
    if (step > 0) setNearbyVisibleCount(c => Math.min(c + step, merchants.length));
  }, [getGridStep, viewportWidth, merchants.length]);

  const showMoreNewly = useCallback(() => {
    const step = getGridStep(viewportWidth);
    if (step > 0) setNewlyVisibleCount(c => Math.min(c + step, fastestMerchants.length));
  }, [getGridStep, viewportWidth, fastestMerchants.length]);

  // Helpers for carousel physics
  const getItemWidth = useCallback(() => {
    if (!carouselRef.current) return 280; // fallback width
    const firstChild = carouselRef.current.children[0] as HTMLElement | undefined;
    if (!firstChild) return 280;
    const rect = firstChild.getBoundingClientRect();
    return rect.width || 280;
  }, []);

  const GAP_WIDTH = 10; // spacing between merchant cards in carousel
  const MOBILE_CAROUSEL_LIMIT = 8; // limit items shown in mobile carousels

  const getMaxTranslate = useCallback(() => {
    if (!carouselRef.current) return 0;
    const container = carouselRef.current.parentElement;
    if (!container) return 0;

    const containerWidth = container.getBoundingClientRect().width - 0; // account for padding (0px left + 0px right)
    const itemWidth = getItemWidth();
    const totalItems = Math.min(merchants.length, MOBILE_CAROUSEL_LIMIT);
    const gaps = Math.max(totalItems - 1, 0);
    const totalContentWidth = (totalItems * itemWidth) + (gaps * GAP_WIDTH);

    return Math.max(0, totalContentWidth - containerWidth);
  }, [merchants.length, getItemWidth]);

  // Fastest Delivery carousel helpers
  const getItemWidthFast = useCallback(() => {
    if (!carouselRefFast.current) return 280;
    const firstChild = carouselRefFast.current.children[0] as HTMLElement | undefined;
    if (!firstChild) return 280;
    const rect = firstChild.getBoundingClientRect();
    return rect.width || 280;
  }, []);

  const getMaxTranslateFast = useCallback(() => {
    if (!carouselRefFast.current) return 0;
    const container = carouselRefFast.current.parentElement;
    if (!container) return 0;
    const containerWidth = container.getBoundingClientRect().width - 0;
    const itemWidth = getItemWidthFast();
    const totalItems = Math.min(fastestMerchants.length, MOBILE_CAROUSEL_LIMIT);
    const gaps = Math.max(totalItems - 1, 0);
    const totalContentWidth = (totalItems * itemWidth) + (gaps * GAP_WIDTH);
    return Math.max(0, totalContentWidth - containerWidth);
  }, [fastestMerchants.length, getItemWidthFast]);

  const animateToPosition = useCallback((targetX: number, duration = 400) => {
    const startPos = translateX;
    const distance = targetX - startPos;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startPos + distance * easeOut;
      setTranslateX(current);
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animate();
  }, [translateX]);

  const animateToPositionFast = useCallback((targetX: number, duration = 400) => {
    const startPos = translateXFast;
    const distance = targetX - startPos;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startPos + distance * easeOut;
      setTranslateXFast(current);
      if (progress < 1) {
        animationRefFast.current = requestAnimationFrame(animate);
      }
    };

    if (animationRefFast.current) cancelAnimationFrame(animationRefFast.current);
    animate();
  }, [translateXFast]);

  const scrollLeft = useCallback(() => {
    const swipeDistance = (getItemWidth() + GAP_WIDTH) * 1.2;
    const newPosition = Math.max(0, translateX - swipeDistance);
    animateToPosition(newPosition, 400);
  }, [translateX, animateToPosition, getItemWidth]);

  const scrollRight = useCallback(() => {
    const swipeDistance = (getItemWidth() + GAP_WIDTH) * 1.2;
    const newPosition = Math.min(-maxTranslate, translateX + swipeDistance);
    animateToPosition(newPosition, 400);
  }, [translateX, animateToPosition, maxTranslate, getItemWidth]);

  const scrollLeftFast = useCallback(() => {
    const swipeDistance = (getItemWidthFast() + GAP_WIDTH) * 1.2;
    const newPosition = Math.max(0, translateXFast - swipeDistance);
    animateToPositionFast(newPosition, 400);
  }, [translateXFast, animateToPositionFast, getItemWidthFast]);

  const scrollRightFast = useCallback(() => {
    const swipeDistance = (getItemWidthFast() + GAP_WIDTH) * 1.2;
    const newPosition = Math.min(-maxTranslateFast, translateXFast + swipeDistance);
    animateToPositionFast(newPosition, 400);
  }, [translateXFast, animateToPositionFast, maxTranslateFast, getItemWidthFast]);

  const handleStart = (clientX: number) => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setIsDragging(true);
    setStartX(clientX);
    setCurrentX(clientX);
    setStartTranslateX(translateX);
    setLastTime(Date.now());
    setVelocityX(0);
  };

  const handleStartFast = (clientX: number) => {
    if (animationRefFast.current) cancelAnimationFrame(animationRefFast.current);
    setIsDraggingFast(true);
    setStartXFast(clientX);
    setCurrentXFast(clientX);
    setStartTranslateXFast(translateXFast);
    setLastTimeFast(Date.now());
    setVelocityXFast(0);
  };

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging) return;
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime;
    const deltaX = clientX - currentX;
    if (deltaTime > 0) setVelocityX(deltaX / deltaTime);
    setCurrentX(clientX);
    setLastTime(currentTime);
    const dragDistance = clientX - startX;
    const newTranslate = startTranslateX + dragDistance;

    let bounded = newTranslate;
    if (newTranslate > 0) {
      bounded = newTranslate * 0.3; // elastic left bound
    } else if (newTranslate < -maxTranslate) {
      const overflow = newTranslate + maxTranslate;
      bounded = -maxTranslate + overflow * 0.3; // elastic right bound
    }
    setTranslateX(bounded);
  }, [isDragging, startX, startTranslateX, currentX, lastTime, maxTranslate]);

  const handleMoveFast = useCallback((clientX: number) => {
    if (!isDraggingFast) return;
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTimeFast;
    const deltaX = clientX - currentXFast;
    if (deltaTime > 0) setVelocityXFast(deltaX / deltaTime);
    setCurrentXFast(clientX);
    setLastTimeFast(currentTime);
    const dragDistance = clientX - startXFast;
    const newTranslate = startTranslateXFast + dragDistance;

    let bounded = newTranslate;
    if (newTranslate > 0) {
      bounded = newTranslate * 0.3;
    } else if (newTranslate < -maxTranslateFast) {
      const overflow = newTranslate + maxTranslateFast;
      bounded = -maxTranslateFast + overflow * 0.3;
    }
    setTranslateXFast(bounded);
  }, [isDraggingFast, startXFast, startTranslateXFast, currentXFast, lastTimeFast, maxTranslateFast]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    const momentum = velocityX * 200;
    let finalPos = translateX + momentum;
    finalPos = Math.max(-maxTranslate, Math.min(0, finalPos));
    animateToPosition(finalPos, 400);
  }, [isDragging, velocityX, translateX, maxTranslate, animateToPosition]);

  const handleEndFast = useCallback(() => {
    if (!isDraggingFast) return;
    setIsDraggingFast(false);
    const momentum = velocityXFast * 200;
    let finalPos = translateXFast + momentum;
    finalPos = Math.max(-maxTranslateFast, Math.min(0, finalPos));
    animateToPositionFast(finalPos, 400);
  }, [isDraggingFast, velocityXFast, translateXFast, maxTranslateFast, animateToPositionFast]);

  // Listen for address changes and refetch merchants
  useAddressChange((addressId: string) => {
    if (resolvedCustomerId) {
      
      // Clear the cache first to ensure fresh data
      LocationBasedMerchantService.clearCache(resolvedCustomerId);
      
      fetchLocationBasedMerchants(resolvedCustomerId);
    } else {
    }
  });

  // Effect to resolve customer ID if not provided
  useEffect(() => {
    const resolveCustomerId = async () => {
      if (customerId) {
        setResolvedCustomerId(customerId);
        return;
      }

      try {
        const currentCustomerId = await LocationBasedMerchantService.getCurrentCustomerId();
        
        if (currentCustomerId) {
          setResolvedCustomerId(currentCustomerId);
        } else {
          console.error('❌ No customer ID available');
          setError('Customer ID is required for location-based merchants');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('❌ Error resolving customer ID:', err);
        setError('Failed to resolve customer information');
        setIsLoading(false);
      }
    };

    resolveCustomerId();
  }, [customerId]);

  // Effect to fetch merchants when customer ID is resolved
  useEffect(() => {
    if (!resolvedCustomerId) {
      return;
    }

    fetchLocationBasedMerchants(resolvedCustomerId);
  }, [resolvedCustomerId, fetchLocationBasedMerchants]);

  // Calculate bounds when merchants change or component mounts (for carousel)
  useEffect(() => {
    const calculateBounds = () => {
      const newMax = getMaxTranslate();
      setMaxTranslate(newMax);
      if (translateX < -newMax) setTranslateX(-newMax);
      boundsCalculatedRef.current = true;
    };
    if (merchants.length > 0) {
      const timer = setTimeout(calculateBounds, 100);
      return () => clearTimeout(timer);
    }
  }, [merchants.length, getMaxTranslate, translateX]);

  // Calculate bounds for Fastest Delivery carousel
  useEffect(() => {
    const calculateBoundsFast = () => {
      const newMaxFast = getMaxTranslateFast();
      setMaxTranslateFast(newMaxFast);
      if (translateXFast < -newMaxFast) setTranslateXFast(-newMaxFast);
      boundsCalculatedRefFast.current = true;
    };
    if (fastestMerchants.length > 0) {
      const timer = setTimeout(calculateBoundsFast, 100);
      return () => clearTimeout(timer);
    }
  }, [fastestMerchants.length, getMaxTranslateFast, translateXFast]);

  // Handle window resize for carousel bounds
  useEffect(() => {
    const handleResize = () => {
      const newMax = getMaxTranslate();
      setMaxTranslate(newMax);
      if (translateX < -newMax) animateToPosition(-newMax);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getMaxTranslate, translateX, animateToPosition]);

  // Handle window resize for Fastest Delivery carousel bounds
  useEffect(() => {
    const handleResizeFast = () => {
      const newMaxFast = getMaxTranslateFast();
      setMaxTranslateFast(newMaxFast);
      if (translateXFast < -newMaxFast) animateToPositionFast(-newMaxFast);
    };
    window.addEventListener('resize', handleResizeFast);
    return () => window.removeEventListener('resize', handleResizeFast);
  }, [getMaxTranslateFast, translateXFast, animateToPositionFast]);

  // Global mouse events to continue drag outside element
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => handleMove(e.clientX);
      const handleGlobalMouseUp = () => handleEnd();
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, handleMove, handleEnd]);

  // Global mouse events for Fastest Delivery carousel
  useEffect(() => {
    if (isDraggingFast) {
      const handleGlobalMouseMove = (e: MouseEvent) => handleMoveFast(e.clientX);
      const handleGlobalMouseUp = () => handleEndFast();
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDraggingFast, handleMoveFast, handleEndFast]);

  if (isLoading) {
    return (
      <section className="py-4 bg-white">
        <div className="w-full px-2.5">
          <div className="mb-[15px]">
            <div className="flex items-center justify-between">
              <h2 className="text-[1.2rem] font-bold text-gray-900">
                Nearby Restaurants
              </h2>
              <span
                role="button"
                tabIndex={0}
                aria-label="View all nearby restaurants"
                onClick={() => router.push('/nearby-restaurants')}
                className="min-[1025px]:hidden inline-flex w-7 h-7 items-center justify-center rounded-full bg-white text-[#333] shadow-md"
              >
                <i className="fas fa-chevron-right leading-none text-[0.9rem]"></i>
              </span>
            </div>
            <p className="text-gray-600">
              Loading merchants near your location...
            </p>
          </div>
          
          {/* Grid skeleton (visible on >1024px or when filtered) */}
          <div className="hidden min-[1025px]:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <LocationMerchantCardSkeleton key={index} />
            ))}
          </div>
          {/* Carousel skeleton (visible on <=1024 when no filter) */}
          <div className="block min-[1025px]:hidden overflow-hidden px-0">
            <div className="flex" style={{ gap: `${GAP_WIDTH}px` }}>
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="w-[75%] min-[650px]:w-[30%] flex-shrink-0">
                  <LocationMerchantCardSkeleton />
                </div>
              ))}
            </div>
          </div>

          {!categoryId && (
            <>
              <div className="mb-[15px] mt-[30px]">
                <div className="flex items-center justify-between">
                  <h2 className="text-[1.2rem] font-bold text-gray-900">
                    Newly Updated
                  </h2>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="View all newly updated restaurants"
                    onClick={() => router.push('/newly-updated')}
                    className="min-[1025px]:hidden inline-flex w-7 h-7 items-center justify-center rounded-full bg-white text-[#333] shadow-md"
                  >
                    <i className="fas fa-chevron-right leading-none text-[0.9rem]"></i>
                  </span>
                </div>
                <p className="text-gray-600">
                  Loading newly updated merchants...
                </p>
              </div>

              <div className="hidden min-[1025px]:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, index) => (
                  <LocationMerchantCardSkeleton key={index} />
                ))}
              </div>

              <div className="block min-[1025px]:hidden overflow-hidden px-0">
                <div className="flex" style={{ gap: `${GAP_WIDTH}px` }}>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="w-[75%] min-[650px]:w-[30%] flex-shrink-0">
                      <LocationMerchantCardSkeleton />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-4 bg-white">
        <div className="w-full px-2.5">
          <div className="mb-[15px]">
            <div className="flex items-center justify-between">
              <h2 className="text-[1.2rem] font-bold text-gray-900">
                Nearby Restaurants
              </h2>
              {merchants && merchants.length > 8 && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="View all nearby restaurants"
                  onClick={() => router.push('/nearby-restaurants')}
                  className="min-[1025px]:hidden inline-flex w-7 h-7 items-center justify-center rounded-full bg-white text-[#333] shadow-md"
                >
                  <i className="fas fa-chevron-right leading-none text-[0.9rem]"></i>
                </span>
              )}
            </div>
            <p className="text-gray-600">
              Merchants near your location with delivery information
            </p>
          </div>
          
          <div className="text-center py-12">
            <div className="text-red-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Unable to load merchants
            </h3>
            <p className="text-gray-600 mb-4">
              {error}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!merchants || merchants.length === 0) {
    return (
      <section className="py-4 bg-white">
        <div className="w-full px-2.5">
          <div className="mb-[15px]">
            <div className="flex items-center justify-between">
              <h2 className="text-[1.2rem] font-bold text-gray-900">
                Nearby Restaurants
              </h2>
              <span
                role="button"
                tabIndex={0}
                aria-label="View all nearby restaurants"
                onClick={() => router.push('/nearby-restaurants')}
                className="min-[1025px]:hidden inline-flex w-7 h-7 items-center justify-center rounded-full bg-white text-[#333] shadow-md"
              >
                <i className="fas fa-chevron-right leading-none text-[0.9rem]"></i>
              </span>
            </div>
            <p className="text-gray-600">
              Merchants near your location with delivery information
            </p>
          </div>
          
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No merchants found in your area
            </h3>
            <p className="text-gray-600">
              Try expanding your search radius or check back later.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-4 bg-white">
      <div className="w-full px-2.5">
        <div className="mb-[15px] flex items-center justify-between">
          <h2 className="text-[1.2rem] font-bold text-gray-900">
            {categoryId ? 'Filtered Restaurants' : 'Nearby Restaurants'}
          </h2>
          {!categoryId && merchants.length > 8 && (
            <span
              role="button"
              tabIndex={0}
              aria-label="View all nearby restaurants"
              onClick={() => router.push('/nearby-restaurants')}
              className="min-[1025px]:hidden inline-flex w-7 h-7 items-center justify-center rounded-full bg-white text-[#333] shadow-md"
            >
              <i className="fas fa-chevron-right leading-none text-[0.9rem]"></i>
            </span>
          )}
        </div>
        {/* Grid view for >1024px or when filtered */}
        <div className={`${categoryId ? 'grid' : 'hidden min-[1025px]:grid'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`}>
          {(categoryId ? merchants : merchants.slice(0, nearbyVisibleCount)).map((merchant) => (
            <LocationMerchantCard
              key={merchant.id}
              merchant={merchant}
              isWishlisted={wishlistIds.has(String(merchant.id))}
              onToggleWishlist={toggleWishlist}
              addressName={addressMap[merchant.id] || null}
            />
          ))}
        </div>

        {/* Show More for Nearby grid (>1024px), only when unfiltered */}
        {!categoryId && viewportWidth >= 1025 && nearbyVisibleCount < merchants.length && (
          <div className="hidden min-[1025px]:flex justify-center mt-4">
            <button
              onClick={showMoreNearby}
              className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200"
            >
              Show more
            </button>
          </div>
        )}

        {/* Carousel view: visible only when no filter and <=1024px (inclusive) */}
        {!categoryId && (
          <div
            className="block min-[1025px]:hidden overflow-hidden px-0 relative"
            onMouseDown={(e) => { if (maxTranslate <= 0) return; e.preventDefault(); handleStart(e.clientX); }}
            onMouseMove={isDragging ? (e) => handleMove(e.clientX) : undefined}
            onMouseUp={isDragging ? () => handleEnd() : undefined}
            onTouchStart={(e) => { if (maxTranslate <= 0) return; handleStart(e.touches[0].clientX); }}
            onTouchMove={(e) => { if (isDragging) e.stopPropagation(); handleMove(e.touches[0].clientX); }}
            onTouchEnd={() => handleEnd()}
        style={{ touchAction: 'pan-y', cursor: isDragging ? 'grabbing' : (maxTranslate > 0 ? 'grab' : 'default') }}
          >
            <div
              ref={carouselRef}
              className="flex select-none"
              style={{
                transform: `translateX(${translateX}px)`,
                gap: `${GAP_WIDTH}px`,
                WebkitUserSelect: 'none',
                userSelect: 'none',
                transition: 'none',
                willChange: 'transform',
                pointerEvents: 'none'
              }}
            >
              {merchants.slice(0, 8).map((merchant) => (
                <div key={merchant.id} className="flex-shrink-0 w-[75%] min-[650px]:w-[30%]" style={{ pointerEvents: 'auto' }}>
                  <LocationMerchantCard
                    merchant={merchant}
                    isWishlisted={wishlistIds.has(String(merchant.id))}
                    onToggleWishlist={toggleWishlist}
                    addressName={addressMap[merchant.id] || null}
                  />
                </div>
              ))}
            </div>
            {/* Optional: discrete scroll controls for accessibility on mobile */}
            {maxTranslate > 0 && (
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none">
                <button
                  aria-label="Scroll left"
                  className="pointer-events-auto px-2 py-6 opacity-0"
                  onClick={scrollLeft}
                />
                <button
                  aria-label="Scroll right"
                  className="pointer-events-auto px-2 py-6 opacity-0"
                  onClick={scrollRight}
                />
              </div>
            )}
          </div>
        )}

        {/* Newly Updated section: visible only when no filter */}
        {!categoryId && (
          <>
            <div className="mb-[15px] mt-[30px] flex items-center justify-between">
              <h2 className="text-[1.2rem] font-bold text-gray-900">Newly Updated</h2>
              {fastestMerchants.length > 8 && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="View all newly updated restaurants"
                  onClick={() => router.push('/newly-updated')}
                  className="min-[1025px]:hidden inline-flex w-7 h-7 items-center justify-center rounded-full bg-white text-[#333] shadow-md"
                >
                  <i className="fas fa-chevron-right leading-none text-[0.9rem]"></i>
                </span>
              )}
            </div>
            {/* Grid view for >1024px */}
            <div className="hidden min-[1025px]:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {fastestMerchants.slice(0, newlyVisibleCount).map((merchant) => (
                    <LocationMerchantCard
                      key={merchant.id}
                      merchant={merchant}
                      isWishlisted={wishlistIds.has(String(merchant.id))}
                      onToggleWishlist={toggleWishlist}
                      addressName={addressMap[merchant.id] || null}
                    />
              ))}
            </div>

            {/* Show More for Newly Updated grid (>1024px) */}
            {viewportWidth >= 1025 && newlyVisibleCount < fastestMerchants.length && (
              <div className="hidden min-[1025px]:flex justify-center mt-4">
                <button
                  onClick={showMoreNewly}
                  className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200"
                >
                  Show more
                </button>
              </div>
            )}
            <div
              className="block min-[1025px]:hidden overflow-hidden px-0 relative"
              onMouseDown={(e) => { if (maxTranslateFast <= 0) return; e.preventDefault(); handleStartFast(e.clientX); }}
              onMouseMove={isDraggingFast ? (e) => handleMoveFast(e.clientX) : undefined}
              onMouseUp={isDraggingFast ? () => handleEndFast() : undefined}
              onTouchStart={(e) => { if (maxTranslateFast <= 0) return; handleStartFast(e.touches[0].clientX); }}
              onTouchMove={(e) => { if (isDraggingFast) e.stopPropagation(); handleMoveFast(e.touches[0].clientX); }}
              onTouchEnd={() => handleEndFast()}
        style={{ touchAction: 'pan-y', cursor: isDraggingFast ? 'grabbing' : (maxTranslateFast > 0 ? 'grab' : 'default') }}
            >
              <div
                ref={carouselRefFast}
                className="flex select-none"
                style={{
                  transform: `translateX(${translateXFast}px)`,
                  gap: `${GAP_WIDTH}px`,
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  transition: 'none',
                  willChange: 'transform',
                  pointerEvents: 'none'
                }}
              >
                {fastestMerchants.slice(0, 8).map((merchant) => (
                  <div key={merchant.id} className="flex-shrink-0 w-[75%] min-[650px]:w-[30%]" style={{ pointerEvents: 'auto' }}>
                    <LocationMerchantCard 
                      merchant={merchant} 
                      isWishlisted={wishlistIds.has(String(merchant.id))} 
                      onToggleWishlist={toggleWishlist}
                      addressName={addressMap[merchant.id] || null}
                    />
                  </div>
                ))}
              </div>
              {maxTranslateFast > 0 && (
                <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none">
                  <button
                    aria-label="Scroll left"
                    className="pointer-events-auto px-2 py-6 opacity-0"
                    onClick={scrollLeftFast}
                  />
                  <button
                    aria-label="Scroll right"
                    className="pointer-events-auto px-2 py-6 opacity-0"
                    onClick={scrollRightFast}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Removed View More Merchants button to show all merchants without pagination */}
      </div>
    </section>
  );
}

export default LocationBasedMerchants;
