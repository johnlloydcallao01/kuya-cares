import React, { useState, useRef, useEffect, useCallback } from 'react';

interface CourseNavigationCarouselProps {
  sections?: string[];
  activeSection?: string;
  onSectionChange?: (section: string) => void;
}

/**
 * Professional Course Navigation Carousel with smooth momentum scrolling
 * Implements physics-based scrolling similar to native mobile apps
 */
export function CourseNavigationCarousel({
  sections = ["Overview", "Description", "Curriculum", "Materials", "Announcements"],
  activeSection = "Overview",
  onSectionChange
}: CourseNavigationCarouselProps) {
  // Filter out Overview section on desktop (lg screens and above)
  const [isDesktop, setIsDesktop] = React.useState(false);
  
  React.useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024); // lg breakpoint
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  const filteredSections = isDesktop 
    ? sections.filter(section => section !== "Overview")
    : sections;
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [startTranslateX, setStartTranslateX] = useState(0);
  const [lastTime, setLastTime] = useState(0);
  const [velocityX, setVelocityX] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const boundsCalculatedRef = useRef(false);

  // Calculate proper maxTranslate to ensure last item is fully visible
  const getMaxTranslate = useCallback(() => {
    if (!carouselRef.current) return 0;
    const container = carouselRef.current.parentElement;
    if (!container) return 0;

    const containerWidth = container.getBoundingClientRect().width - 48; // minus padding
    const actualItemWidth = 120; // approximate width per tab
    const gapWidth = 24; // gap between items
    const totalContentWidth = (filteredSections.length * actualItemWidth) + ((filteredSections.length - 1) * gapWidth);

    return Math.max(0, totalContentWidth - containerWidth);
  }, [filteredSections.length]);

  const [maxTranslate, setMaxTranslate] = useState(1000); // Start with a large value to allow initial movement

  // Smooth scrolling with momentum physics
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
    const itemWidth = 120; // Tab width
    const gapWidth = 24; // Gap between items
    const swipeDistance = (itemWidth + gapWidth) * 1.5; // Gentle swipe distance
    const newPosition = Math.max(0, translateX - swipeDistance);
    animateToPosition(newPosition, 400); // Smooth animation like normal swipe
  };

  const scrollRight = () => {
    // Equivalent to a gentle swipe gesture (about 1.5 items worth)
    const itemWidth = 120; // Tab width
    const gapWidth = 24; // Gap between items
    const swipeDistance = (itemWidth + gapWidth) * 1.5; // Gentle swipe distance
    const newPosition = Math.min(-maxTranslate, translateX - swipeDistance);
    animateToPosition(newPosition, 400); // Smooth animation like normal swipe
  };

  const handleSectionClick = (section: string) => {
    if (onSectionChange && !isDragging) {
      onSectionChange(section);
    }
  };

  // Professional touch/drag handling with momentum
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

    const now = Date.now();
    const deltaTime = now - lastTime;
    const deltaX = clientX - currentX;

    // Calculate velocity for momentum (pixels per millisecond)
    if (deltaTime > 0) {
      setVelocityX(deltaX / deltaTime);
    }

    // Direct 1:1 movement - finger follows exactly
    // Add the drag distance to the starting position
    const dragDistance = clientX - startX;
    const newTranslateX = startTranslateX + dragDistance;

    // Constrain to bounds
    const constrainedX = Math.max(-maxTranslate, Math.min(0, newTranslateX));

    setTranslateX(constrainedX);
    setCurrentX(clientX);
    setLastTime(now);
  }, [isDragging, currentX, startX, startTranslateX, maxTranslate, lastTime]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    // Apply momentum based on velocity
    const momentum = velocityX * 300; // Momentum multiplier
    const targetX = translateX + momentum;

    // Constrain to bounds
    const constrainedX = Math.max(-maxTranslate, Math.min(0, targetX));

    // Animate to final position with momentum
    animateToPosition(constrainedX, 600);
  }, [isDragging, velocityX, translateX, maxTranslate, animateToPosition]);

  // Mouse events
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

  // Touch events - optimized for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      e.stopPropagation();
    }
    handleMove(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    handleEnd();
  };

  // Calculate maxTranslate on mount and resize
  useEffect(() => {
    const updateMaxTranslate = () => {
      // Only calculate once to prevent breaking bounds
      if (!boundsCalculatedRef.current) {
        const newMaxTranslate = getMaxTranslate();
        setMaxTranslate(newMaxTranslate);
        boundsCalculatedRef.current = true;
      }
    };

    updateMaxTranslate();

    const handleResize = () => {
      // Allow recalculation on resize
      boundsCalculatedRef.current = false;
      updateMaxTranslate();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [getMaxTranslate]);

  // Global mouse event listeners for smooth dragging
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
    <div className="relative mb-8">
      {/* Left Arrow - Hidden on mobile/tablet, visible on desktop */}
      {translateX < 0 && (
        <button
          onClick={scrollLeft}
          className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white shadow-lg rounded-full items-center justify-center hover:bg-gray-50 transition-colors"
          aria-label="Scroll left"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Right Arrow - Hidden on mobile/tablet, visible on desktop */}
      {translateX > -maxTranslate && (
        <button
          onClick={scrollRight}
          className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white shadow-lg rounded-full items-center justify-center hover:bg-gray-50 transition-colors"
          aria-label="Scroll right"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Carousel Container */}
      <div
        className="overflow-hidden px-[10px] bg-white rounded-lg shadow-sm"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseMove={isDragging ? handleMouseMove : undefined}
        onMouseUp={isDragging ? handleMouseUp : undefined}
        style={{
          touchAction: 'pan-x',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        <div
          ref={carouselRef}
          className="flex py-1.5 select-none"
          style={{
            transform: `translateX(${translateX}px)`,
            gap: '24px',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            transition: 'none', // Using requestAnimationFrame for smooth animations
            willChange: 'transform',
            pointerEvents: 'none' // Prevent individual items from blocking events
          }}
        >
          {filteredSections.map((section) => (
            <div
              key={section}
              className="flex-shrink-0"
              style={{ pointerEvents: 'auto' }} // Re-enable pointer events for clicking
            >
              <button
                onClick={() => handleSectionClick(section)}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                  activeSection === section
                    ? 'bg-gray-200 text-gray-700 shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {section}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}