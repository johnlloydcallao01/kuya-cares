"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ProductCategoryCircle } from '@/components/ui/ProductCategoryCircle';
import { useAddressChange } from '@/hooks/useAddressChange';
import { LocationBasedMerchantService, getLocationBasedMerchantCategories, type MerchantCategoryDisplay, type Media } from '@encreasl/client-services';

interface LocationBasedProductCategoriesCarouselProps {
  customerId?: string;
  limit?: number;
  sortBy?: 'name' | 'popularity' | 'productCount';
  includeInactive?: boolean;
  selectedCategorySlug?: string | null;
  onCategorySelect?: (categoryId: string | null, categorySlug: string | null, categoryName?: string) => void;
  onCategoryIdResolved?: (categoryId: string | null) => void;
}

/**
 * LocationBasedProductCategoriesCarousel with smooth momentum scrolling
 * Implements physics-based scrolling with smooth momentum
 * 100% CSR - fetches data client-side
 */

export const LocationBasedProductCategoriesCarousel = ({
  customerId,
  limit = 20,
  sortBy = 'popularity',
  includeInactive = false,
  selectedCategorySlug,
  onCategorySelect,
  onCategoryIdResolved,
}: LocationBasedProductCategoriesCarouselProps): React.ReactNode => {
  // CSR state management for location-based categories
  const [categories, setCategories] = useState<MerchantCategoryDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [startTranslateX, setStartTranslateX] = useState(0);
  const [lastTime, setLastTime] = useState(0);
  const [velocityX, setVelocityX] = useState(0);
  const [resolvedCustomerId, setResolvedCustomerId] = useState<string | null>(customerId || null);

  const activeCategory = selectedCategorySlug 
    ? (categories.find(cat => cat.slug === selectedCategorySlug)?.name 
        || categories.find(cat => cat.name.toLowerCase().replace(/\s+/g, '-') === selectedCategorySlug)?.name 
        || '')
    : '';
  
  useEffect(() => {
    if (selectedCategorySlug && categories.length > 0 && onCategoryIdResolved) {
      const category = categories.find(cat => cat.slug === selectedCategorySlug) 
        || categories.find(cat => cat.name.toLowerCase().replace(/\s+/g, '-') === selectedCategorySlug);
      onCategoryIdResolved(category ? String(category.id) : null);
    } else if (!selectedCategorySlug && onCategoryIdResolved) {
      onCategoryIdResolved(null);
    }
  }, [selectedCategorySlug, categories, onCategoryIdResolved]);
  const [error, setError] = useState<string | null>(null);
  
  const carouselRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const boundsCalculatedRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 0);
  const isUltraWide = viewportWidth >= 1500;
  const itemWidth = isUltraWide ? 80 : 64;
  const gapWidth = isUltraWide ? 56 : 48;

  const fetchMerchantCategories = useCallback(async (customerIdToUse: string) => {
    try {
      setLoading(true);
      setError(null);
      const cats = await getLocationBasedMerchantCategories({ customerId: customerIdToUse, includeInactive, limit: limit });
      let mapped = cats || [];
      if (sortBy === 'name') {
        mapped = mapped.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      } else if (sortBy === 'productCount') {
        mapped = mapped.slice().sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      }
      setCategories(mapped.slice(0, limit));
    } catch (err) {
      setError('Failed to load categories');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [includeInactive, limit, sortBy]);

  // Resolve customer ID if not provided
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
          setError('Unable to determine customer location');
          setLoading(false);
        }
      } catch (err) {
        console.error('❌ Error resolving customer ID:', err);
        setError('Failed to determine customer location');
        setLoading(false);
      }
    };

    resolveCustomerId();
  }, [customerId]);

  // Fetch categories when customer ID is resolved
  useEffect(() => {
    if (resolvedCustomerId) {
      fetchMerchantCategories(resolvedCustomerId);
    }
  }, [resolvedCustomerId, fetchMerchantCategories]);

  useAddressChange((addressId: string) => {
    if (resolvedCustomerId) {
      LocationBasedMerchantService.clearCache(resolvedCustomerId);
      fetchMerchantCategories(resolvedCustomerId);
    } else {
    }
  });

  // Calculate proper maxTranslate to ensure last item is fully visible - identical to ProductCategoryCarousel
  const getMaxTranslate = useCallback(() => {
    if (!carouselRef.current) return 0;
    const container = carouselRef.current.parentElement;
    if (!container) return 0;

    const containerWidth = container.getBoundingClientRect().width - 20;
    const totalItems = categories.length;
    const totalContentWidth = (totalItems * itemWidth) + ((totalItems - 1) * gapWidth);

    return Math.max(0, totalContentWidth - containerWidth);
  }, [categories.length, itemWidth, gapWidth]);

  const [maxTranslate, setMaxTranslate] = useState(0);

  // Smooth scrolling with momentum physics - identical to ProductCategoryCarousel
  const animateToPosition = useCallback((targetX: number, duration = 300) => {
    const startX = translateX;
    const distance = targetX - startX;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth easing function
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentX = startX + distance * easeOut;

      setTranslateX(currentX);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animate();
  }, [translateX]);

  const scrollLeft = () => {
    // Equivalent to a gentle swipe gesture (about 1.5 items worth)
    const swipeDistance = (itemWidth + gapWidth) * 1.5; // Gentle swipe distance
    const newPosition = Math.max(0, translateX - swipeDistance);
    animateToPosition(newPosition, 400); // Smooth animation like normal swipe
  };

  const scrollRight = () => {
    // Equivalent to a gentle swipe gesture (about 1.5 items worth)
    const swipeDistance = (itemWidth + gapWidth) * 1.5; // Gentle swipe distance
    const newPosition = Math.min(-maxTranslate, translateX + swipeDistance);
    animateToPosition(newPosition, 400); // Smooth animation like normal swipe
  };

  const handleCategoryClick = (categoryName: string) => {
    const category = categories.find(cat => cat.name === categoryName);
    if (!isDragging && category) {
      const categorySlug = category.slug || category.name.toLowerCase().replace(/\s+/g, '-');
      if (onCategorySelect) {
        onCategorySelect(String(category.id), categorySlug, categoryName);
      }
      if (onCategoryIdResolved) {
        onCategoryIdResolved(String(category.id));
      }
    }
  };

  // Professional touch/drag handling with momentum - identical to ProductCategoryCarousel
  const handleStart = (clientX: number) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsDragging(true);
    setStartX(clientX);
    setCurrentX(clientX);
    setStartTranslateX(translateX); // Remember where we started dragging from
    setLastTime(Date.now());
    setVelocityX(0);
  };

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging) return;

    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime;
    const deltaX = clientX - currentX;

    // Calculate velocity for momentum
    if (deltaTime > 0) {
      setVelocityX(deltaX / deltaTime);
    }

    setCurrentX(clientX);
    setLastTime(currentTime);

    // Calculate new position
    const dragDistance = clientX - startX;
    const newTranslateX = startTranslateX + dragDistance;

    // Apply bounds with elastic resistance
    let boundedTranslateX = newTranslateX;
    if (newTranslateX > 0) {
      // Left boundary - elastic resistance
      boundedTranslateX = newTranslateX * 0.3;
    } else if (newTranslateX < -maxTranslate) {
      // Right boundary - elastic resistance
      const overflow = newTranslateX + maxTranslate;
      boundedTranslateX = -maxTranslate + overflow * 0.3;
    }

    setTranslateX(boundedTranslateX);
  }, [isDragging, startX, startTranslateX, currentX, lastTime, maxTranslate]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    // Apply momentum with physics
    const momentum = velocityX * 200; // Momentum factor
    let finalPosition = translateX + momentum;

    // Apply bounds
    finalPosition = Math.max(-maxTranslate, Math.min(0, finalPosition));

    // Smooth animation to final position
    animateToPosition(finalPosition, 400);
  }, [isDragging, velocityX, translateX, maxTranslate, animateToPosition]);

  // Mouse events - identical to ProductCategoryCarousel
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  // Touch events - optimized for mobile - identical to ProductCategoryCarousel
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      e.stopPropagation();
    }
    handleMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  // Calculate bounds when categories change or component mounts - identical to ProductCategoryCarousel
  useEffect(() => {
    const calculateBounds = () => {
      const newMaxTranslate = getMaxTranslate();
      setMaxTranslate(newMaxTranslate);
      
      // Reset position if current position is out of bounds
      if (translateX < -newMaxTranslate) {
        setTranslateX(-newMaxTranslate);
      }
      
      boundsCalculatedRef.current = true;
    };

    if (categories.length > 0) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(calculateBounds, 100);
      return () => clearTimeout(timer);
    }
  }, [categories.length, getMaxTranslate, translateX]);

  // Handle window resize - identical to ProductCategoryCarousel
  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
      const newMaxTranslate = getMaxTranslate();
      setMaxTranslate(newMaxTranslate);
      if (translateX < -newMaxTranslate) {
        animateToPosition(-newMaxTranslate);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [getMaxTranslate, translateX, animateToPosition]);

  // Global mouse events for drag continuation - identical to ProductCategoryCarousel
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        handleMove(e.clientX);
      };

      const handleGlobalMouseUp = () => {
        handleEnd();
      };

      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, handleMove, handleEnd]);

  return (
    <div className="relative">
      {/* Loading state - show skeleton while fetching data - identical to ProductCategoryCarousel */}
      {loading ? (
        <div className="overflow-hidden px-2.5">
          <div className="flex py-2.5" style={{ gap: '48px' }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex-shrink-0">
                <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="w-12 h-3 bg-gray-200 rounded mt-2 mx-auto animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        // Error state
        <div className="overflow-hidden px-2.5">
          <div className="flex items-center justify-center py-8 text-gray-500">
            <p>{error}</p>
          </div>
        </div>
      ) : categories.length === 0 ? (
        // No categories found
        <div className="overflow-hidden px-2.5">
          <div className="flex items-center justify-center py-8 text-gray-500">
            <p>No categories available in your area</p>
          </div>
        </div>
      ) : (
        <>
          {/* Left Arrow - Hidden on mobile/tablet, visible on desktop - identical to ProductCategoryCarousel */}
          {translateX < 0 && (
            <button
              onClick={scrollLeft}
              className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white shadow-lg rounded-full items-center justify-center hover:bg-gray-50 transition-colors"
              aria-label="Scroll left"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Right Arrow - Hidden on mobile/tablet, visible on desktop - identical to ProductCategoryCarousel */}
          {translateX > -maxTranslate && (
            <button
              onClick={scrollRight}
              className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white shadow-lg rounded-full items-center justify-center hover:bg-gray-50 transition-colors"
              aria-label="Scroll right"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Carousel Container - identical to ProductCategoryCarousel */}
          <div
            className="overflow-hidden px-2.5"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseMove={isDragging ? handleMouseMove : undefined}
            onMouseUp={isDragging ? handleMouseUp : undefined}
            style={{
            touchAction: 'pan-y',
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
          >
            <div
              ref={carouselRef}
              className="flex py-2.5 select-none"
              style={{
                transform: `translateX(${translateX}px)`,
                gap: `${gapWidth}px`,
                WebkitUserSelect: 'none',
                userSelect: 'none',
                transition: 'none', // Using requestAnimationFrame for smooth animations
                willChange: 'transform',
                pointerEvents: 'none' // Prevent individual items from blocking events
              }}
            >
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex-shrink-0"
                  style={{ pointerEvents: 'auto' }} // Re-enable pointer events for clicking
                >
                  <ProductCategoryCircle
                    category={{
                      id: category.id as any,
                      name: category.name,
                      slug: category.slug,
                      media: category.media && category.media.icon
                        ? {
                            icon: {
                              id: category.media.icon.id,
                              url: category.media.icon.url || '',
                              cloudinaryURL: category.media.icon.cloudinaryURL || undefined,
                              alt: category.media.icon.alt || undefined,
                            },
                          }
                        : undefined,
                    }}
                    active={activeCategory === category.name}
                    onClick={() => handleCategoryClick(category.name)}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
