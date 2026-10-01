'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CheckCircle } from '@/components/ui/IconWrapper';
import type { MembershipPlan } from '@/app/(auth)/signup/signup-form';

// Same physics as apps/web merchant-category carousels
// (LocationBasedProductCategoriesCarousel): translateX track, velocity
// tracking, momentum release, elastic bounds, easeOut-cubic rAF animation,
// mouse + touch drag, global move/up continuation, desktop arrow buttons.
const GAP_PX = 16;

function planSlugOf(p: MembershipPlan): string {
  const s = p.slug ?? p.id;
  return s == null || s === '' ? '' : String(s);
}

function planPriceOf(p: MembershipPlan): number {
  const n = Number(p.price ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmtPeso(v: number): string {
  return `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function limitText(v: number | null | undefined, unit: string): string | null {
  if (v == null) return null;
  if (v === -1) return `Unlimited ${unit}`;
  return `${v} ${unit}`;
}

// Feature rows built ONLY from real plan fields — never invented.
function planFeatures(p: MembershipPlan): string[] {
  const out: string[] = [];
  const limits = p.limits ?? {};
  const caps = p.capabilities ?? {};
  const outlets = limitText(limits.max_merchants as number | null | undefined, 'outlets');
  if (outlets) out.push(outlets);
  const products = limitText(limits.max_products as number | null | undefined, 'products');
  if (products) out.push(products);
  out.push(`${Number(p.commission_percent ?? 0)}% commission per order`);
  if (Number(p.transaction_fee ?? 0) > 0) out.push(`${fmtPeso(Number(p.transaction_fee))} per-order fee`);
  if (Number(p.trial_days ?? 0) > 0) out.push(`${p.trial_days}-day free trial`);
  const seats = Number(limits.staff_seats ?? 1);
  if (Number.isFinite(seats) && seats > 1) out.push(`${seats} staff seats`);
  const flag = (label: string, key: string) => {
    if (caps[key] === true) out.push(label);
  };
  flag('Online storefront', 'microstore');
  flag('Coupons & promos', 'promos');
  flag('Sales analytics', 'analytics');
  flag('Sponsored ads', 'ads');
  flag('API access', 'api_access');
  flag('Custom shipping rates', 'custom_shipping');
  flag('Multi-user access', 'multi_user');
  const boost = Number(caps.visibility_boost ?? 0);
  if (Number.isFinite(boost) && boost > 0) out.push(`Boosted listings +${boost}%`);
  const sla = String(caps.support_sla ?? 'email');
  out.push(sla === 'dedicated' ? 'Dedicated support' : sla === 'priority' ? 'Priority support' : sla === 'none' ? 'Community support' : 'Email support');
  return out;
}

// Growth Monthly is the best-value middle tier → highlighted recommendation.
function isPopularPlan(p: MembershipPlan): boolean {
  return planSlugOf(p) === 'growth-monthly';
}

function normalizeInterval(raw: unknown): 'month' | 'year' | 'one_time' {
  const v = String(raw ?? 'month').trim().toLowerCase();
  if (v === 'year' || v === 'yearly' || v === 'annual') return 'year';
  if (v === 'one_time' || v === 'onetime' || v === 'one-time') return 'one_time';
  return 'month';
}

export default function PlanCarousel({
  plans,
  selectedPlanSlug,
  onSelect,
  disabled,
}: {
  plans: MembershipPlan[];
  selectedPlanSlug: string;
  onSelect: (slug: string) => void;
  disabled: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [startTranslateX, setStartTranslateX] = useState(0);
  const [lastTime, setLastTime] = useState(0);
  const [velocityX, setVelocityX] = useState(0);
  const [maxTranslate, setMaxTranslate] = useState(0);

  const trackRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const draggedDistanceRef = useRef(0);

  // Bounds measured from real DOM widths (cards are fixed-width, track may
  // overflow) — same clamp/elastic math as the category carousel.
  const getMaxTranslate = useCallback(() => {
    if (!trackRef.current) return 0;
    const container = trackRef.current.parentElement;
    if (!container) return 0;
    const containerWidth = container.getBoundingClientRect().width;
    const totalContentWidth = trackRef.current.scrollWidth;
    return Math.max(0, totalContentWidth - containerWidth);
  }, []);

  // Mirror of translateX for use inside rAF closures without stale state.
  const translateXRef = useRef(0);
  useEffect(() => {
    translateXRef.current = translateX;
  }, [translateX]);

  const animateToPosition = useCallback((targetX: number, duration = 300) => {
    const startValue = translateXRef.current;
    const distance = targetX - startValue;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setTranslateX(startValue + distance * easeOut);
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animate();
  }, []);

  const stepDistance = useCallback(() => {
    if (!trackRef.current) return 320;
    const first = trackRef.current.children[0] as HTMLElement | undefined;
    return (first?.getBoundingClientRect().width ?? 320) + GAP_PX;
  }, []);

  const scrollLeft = () => {
    const next = Math.max(0, translateXRef.current - stepDistance() * 1.5);
    animateToPosition(next, 400);
  };

  const scrollRight = () => {
    const next = Math.min(-maxTranslate, translateXRef.current + stepDistance() * 1.5);
    animateToPosition(next, 400);
  };

  const handleStart = (clientX: number) => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setIsDragging(true);
    draggedDistanceRef.current = 0;
    setStartX(clientX);
    setCurrentX(clientX);
    setStartTranslateX(translateXRef.current);
    setLastTime(Date.now());
    setVelocityX(0);
  };

  const handleMove = useCallback(
    (clientX: number) => {
      const currentTime = Date.now();
      const deltaTime = currentTime - lastTime;
      const deltaX = clientX - currentX;
      if (deltaTime > 0) setVelocityX(deltaX / deltaTime);
      setCurrentX(clientX);
      setLastTime(currentTime);
      const dragDistance = clientX - startX;
      draggedDistanceRef.current = Math.max(draggedDistanceRef.current, Math.abs(dragDistance));
      const next = startTranslateX + dragDistance;
      let bounded = next;
      if (next > 0) {
        bounded = next * 0.3;
      } else if (next < -maxTranslate) {
        const overflow = next + maxTranslate;
        bounded = -maxTranslate + overflow * 0.3;
      }
      setTranslateX(bounded);
    },
    [startX, startTranslateX, currentX, lastTime, maxTranslate],
  );

  const handleEnd = useCallback(() => {
    const momentum = velocityX * 200;
    let finalPosition = translateXRef.current + momentum;
    finalPosition = Math.max(-maxTranslate, Math.min(0, finalPosition));
    animateToPosition(finalPosition, 400);
    setIsDragging(false);
  }, [velocityX, maxTranslate, animateToPosition]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  // Recalculate bounds when plans change, on mount, and on resize.
  useEffect(() => {
    const calculateBounds = () => {
      const next = getMaxTranslate();
      setMaxTranslate(next);
      if (translateXRef.current < -next) setTranslateX(-next);
    };
    if (plans.length > 0) {
      const timer = setTimeout(calculateBounds, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [plans.length, getMaxTranslate]);

  useEffect(() => {
    const onResize = () => {
      const next = getMaxTranslate();
      setMaxTranslate(next);
      if (translateXRef.current < -next) animateToPosition(-next);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [getMaxTranslate, animateToPosition]);

  // Global mouse continuation while dragging.
  useEffect(() => {
    if (!isDragging) return undefined;
    const onMove = (e: MouseEvent) => handleMove(e.clientX);
    const onUp = () => handleEnd();
    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, handleMove, handleEnd]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const handleSelect = (slug: string, selected: boolean) => {
    // A real drag (moved more than a tap) must not toggle selection.
    if (draggedDistanceRef.current > 6) return;
    onSelect(selected ? '' : slug);
  };

  return (
    <div className="relative">
      {translateX < 0 && (
        <button
          type="button"
          onClick={scrollLeft}
          className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] shadow-lg rounded-full items-center justify-center hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors"
          aria-label="Scroll plans left"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {translateX > -maxTranslate && (
        <button
          type="button"
          onClick={scrollRight}
          className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] shadow-lg rounded-full items-center justify-center hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors"
          aria-label="Scroll plans right"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
      <div
        className="overflow-hidden -mx-1 px-1"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEnd}
        style={{ touchAction: 'pan-y', cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          ref={trackRef}
          className="flex py-2 select-none"
          style={{
            transform: `translateX(${translateX}px)`,
            gap: `${GAP_PX}px`,
            WebkitUserSelect: 'none',
            userSelect: 'none',
            transition: 'none',
            willChange: 'transform',
            pointerEvents: 'none',
          }}
        >
          {plans.map((plan) => {
            const slug = planSlugOf(plan);
            const selected = selectedPlanSlug !== '' && selectedPlanSlug === slug;
            const popular = isPopularPlan(plan);
            const price = planPriceOf(plan);
            const interval = normalizeInterval(
              (plan as unknown as Record<string, unknown>).billing_interval,
            );
            const monthlyEquiv = interval === 'year' ? price / 12 : price;
            const trial = Number(plan.trial_days ?? 0);
            const features = planFeatures(plan);
            return (
              <article
                key={slug || plan.name}
                style={{ pointerEvents: 'auto' }}
                className={`relative overflow-hidden rounded-xl border p-6 transition-all flex-shrink-0 w-[300px] sm:w-[340px] ${selected ? 'border-[#239459] ring-2 ring-[#239459]/30 bg-emerald-50/40 dark:bg-emerald-900/10' : popular ? 'border-[#239459]/60 bg-white dark:bg-[#171717]' : 'border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717]'}`}
              >
                {popular && (
                  <span className="absolute top-4 right-4 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#239459] text-white">
                    Most Popular
                  </span>
                )}
                <div className="space-y-1 pr-20">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                  {plan.description ? (
                    <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">{plan.description}</p>
                  ) : null}
                </div>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">{fmtPeso(price)}</span>
                  <span className="text-sm text-gray-500 dark:text-[#a1a1aa]">
                    /{interval === 'year' ? 'year' : 'month'}
                  </span>
                </div>
                {interval === 'year' && price > 0 ? (
                  <div className="text-xs text-gray-500 dark:text-[#a1a1aa]">
                    {fmtPeso(monthlyEquiv)}/mo billed yearly
                  </div>
                ) : null}
                {trial > 0 ? (
                  <div className="mt-2">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {trial}-day free trial
                    </span>
                  </div>
                ) : null}
                <div className="mt-4 space-y-2">
                  {features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#239459] flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-[#a1a1aa]">{f}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => handleSelect(slug, selected)}
                    disabled={disabled}
                    className={`w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition border ${selected ? 'bg-[#239459] border-[#239459] text-white' : 'bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-[#262626] text-gray-700 dark:text-[#ededed] hover:border-[#239459]'}`}
                  >
                    {selected ? (
                      <>
                        <CheckCircle className="w-4 h-4" /> Selected
                      </>
                    ) : (
                      'Select plan'
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
