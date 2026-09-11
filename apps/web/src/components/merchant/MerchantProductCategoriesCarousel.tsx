"use client";

import React from "react";

type MerchantCategoryDisplay = {
  id: number;
  name: string;
  slug: string;
  media?: { icon?: any | null };
};

export default function MerchantProductCategoriesCarousel({
  categories,
  activeCategoryId,
  onSelect,
}: {
  categories: MerchantCategoryDisplay[];
  activeCategoryId?: number | null;
  onSelect?: (id: number) => void;
}) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [startX, setStartX] = React.useState(0);
  const [currentX, setCurrentX] = React.useState(0);
  const [translateX, setTranslateX] = React.useState(0);
  const [startTranslateX, setStartTranslateX] = React.useState(0);
  const [lastTime, setLastTime] = React.useState(0);
  const [velocityX, setVelocityX] = React.useState(0);
  const carouselRef = React.useRef<HTMLDivElement>(null);
  const animationRef = React.useRef<number | null>(null);
  const boundsCalculatedRef = React.useRef(false);
  const chipRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const [autoFollow, setAutoFollow] = React.useState(true);
  const [viewportWidth, setViewportWidth] = React.useState<number>(typeof window !== "undefined" ? window.innerWidth : 0);
  const isUltraWide = viewportWidth >= 1500;
  const gapWidth = isUltraWide ? 16 : 12;
  const [maxTranslate, setMaxTranslate] = React.useState(0);

  const getMaxTranslate = React.useCallback(() => {
    if (!carouselRef.current) return 0;
    const container = carouselRef.current.parentElement;
    if (!container) return 0;
    const containerWidth = container.getBoundingClientRect().width;
    const totalContentWidth = carouselRef.current.scrollWidth;
    return Math.max(0, totalContentWidth - containerWidth);
  }, []);

  const animateToPosition = React.useCallback(
    (targetX: number, duration = 300) => {
      const sx = translateX;
      const distance = targetX - sx;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const cx = sx + distance * easeOut;
        setTranslateX(cx);
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animate();
    },
    [translateX]
  );

  const scrollLeft = () => {
    setAutoFollow(false);
    const container = carouselRef.current?.parentElement;
    const containerWidth = container ? container.getBoundingClientRect().width : 300;
    const swipeDistance = Math.max(180, Math.min(containerWidth * 0.6, containerWidth * 0.8));
    const newPosition = Math.max(0, translateX - swipeDistance);
    animateToPosition(newPosition, 400);
  };

  const scrollRight = () => {
    setAutoFollow(false);
    const container = carouselRef.current?.parentElement;
    const containerWidth = container ? container.getBoundingClientRect().width : 300;
    const swipeDistance = Math.max(180, Math.min(containerWidth * 0.6, containerWidth * 0.8));
    const newPosition = Math.min(-maxTranslate, translateX + swipeDistance);
    animateToPosition(newPosition, 400);
  };

  const handleStart = (clientX: number) => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setIsDragging(true);
    setAutoFollow(false);
    setStartX(clientX);
    setCurrentX(clientX);
    setStartTranslateX(translateX);
    setLastTime(Date.now());
    setVelocityX(0);
  };

  const handleMove = React.useCallback(
    (clientX: number) => {
      if (!isDragging) return;
      const currentTime = Date.now();
      const deltaTime = currentTime - lastTime;
      const deltaX = clientX - currentX;
      if (deltaTime > 0) setVelocityX(deltaX / deltaTime);
      setCurrentX(clientX);
      setLastTime(currentTime);
      const dragDistance = clientX - startX;
      const newTranslateX = startTranslateX + dragDistance;
      let boundedTranslateX = newTranslateX;
      if (newTranslateX > 0) boundedTranslateX = newTranslateX * 0.3;
      else if (newTranslateX < -maxTranslate) {
        const overflow = newTranslateX + maxTranslate;
        boundedTranslateX = -maxTranslate + overflow * 0.3;
      }
      setTranslateX(boundedTranslateX);
    },
    [isDragging, startX, startTranslateX, currentX, lastTime, maxTranslate]
  );

  const handleEnd = React.useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    const momentum = velocityX * 200;
    let finalPosition = translateX + momentum;
    finalPosition = Math.max(-maxTranslate, Math.min(0, finalPosition));
    animateToPosition(finalPosition, 400);
  }, [isDragging, velocityX, translateX, maxTranslate, animateToPosition]);

  React.useEffect(() => {
    const calculateBounds = () => {
      const newMax = getMaxTranslate();
      setMaxTranslate(newMax);
      if (translateX < -newMax) setTranslateX(-newMax);
      boundsCalculatedRef.current = true;
    };
    if (categories.length > 0) {
      const timer = setTimeout(calculateBounds, 100);
      return () => clearTimeout(timer);
    }
  }, [categories.length, getMaxTranslate, translateX]);

  React.useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
      const newMax = getMaxTranslate();
      setMaxTranslate(newMax);
      if (translateX < -newMax) animateToPosition(-newMax);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [getMaxTranslate, translateX, animateToPosition]);

  React.useEffect(() => {
    if (!activeCategoryId || isDragging || !autoFollow) return;
    const list = carouselRef.current;
    const container = list?.parentElement;
    if (!list || !container) return;
    const chipEl = chipRefs.current.get(activeCategoryId);
    if (!chipEl) return;
    const containerWidth = container.getBoundingClientRect().width;
    const chipLeft = chipEl.offsetLeft;
    const chipWidth = chipEl.offsetWidth;
    const target = -(chipLeft - (containerWidth - chipWidth) / 2);
    const clamped = Math.max(-maxTranslate, Math.min(0, target));
    animateToPosition(clamped, 350);
  }, [activeCategoryId, isDragging, autoFollow, maxTranslate, animateToPosition]);

  React.useEffect(() => {
    const onWindowScroll = () => {
      setAutoFollow(true);
    };
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", onWindowScroll);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => handleMove(e.clientX);
      const handleGlobalMouseUp = () => handleEnd();
      document.addEventListener("mousemove", handleGlobalMouseMove, { passive: false });
      document.addEventListener("mouseup", handleGlobalMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleGlobalMouseMove);
        document.removeEventListener("mouseup", handleGlobalMouseUp);
      };
    }
  }, [isDragging, handleMove, handleEnd]);

  const handleCategoryClick = (categoryId: number) => {
    if (isDragging) return;
    if (onSelect) onSelect(categoryId);
  };

  return (
    <div className="relative">
      {categories.length === 0 ? (
        <div className="overflow-hidden">
          <div className="flex items-center justify-center py-4 text-gray-500">No categories</div>
        </div>
      ) : (
        <>
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
          <div
            className="overflow-hidden"
            onMouseDown={(e) => {
              e.preventDefault();
              handleStart(e.clientX);
            }}
            onTouchStart={(e) => handleStart(e.touches[0].clientX)}
            onTouchMove={(e) => {
              if (isDragging) e.stopPropagation();
              handleMove(e.touches[0].clientX);
            }}
            onTouchEnd={() => handleEnd()}
            onMouseMove={isDragging ? (e) => handleMove(e.clientX) : undefined}
            onMouseUp={isDragging ? () => handleEnd() : undefined}
            onWheel={(e) => {
              if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                setAutoFollow(false);
              }
            }}
            style={{ touchAction: "pan-y", cursor: isDragging ? "grabbing" : "grab" }}
          >
            <div
              ref={carouselRef}
              className="flex py-2 select-none"
              style={{
                transform: `translateX(${translateX}px)`,
                gap: `${gapWidth}px`,
                WebkitUserSelect: "none",
                userSelect: "none",
                transition: "none",
                willChange: "transform",
                pointerEvents: "none",
              }}
            >
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex-shrink-0"
                  style={{ pointerEvents: "auto" }}
                  ref={(el) => { if (el) chipRefs.current.set(category.id, el); }}
                >
                  <button
                    type="button"
                    onClick={() => handleCategoryClick(category.id)}
                    className={
                      `px-4 h-9 min-[1500px]:h-10 inline-flex items-center rounded-full border text-sm font-medium transition-colors ` +
                      (activeCategoryId === category.id
                        ? `bg-[#eba236] border-[#eba236] text-white`
                        : `bg-white border-gray-300 text-gray-700 hover:bg-gray-50`)
                    }
                  >
                    {category.name}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
