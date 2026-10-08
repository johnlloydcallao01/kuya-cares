'use client';

import React, { useEffect, useState, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from '@/components/ui/ImageWrapper';
import { toast } from 'react-hot-toast';
import { OrderDetailSkeleton } from '@/components/skeletons/OrdersSkeleton';
import OrderHelpModal from '@/components/modals/OrderHelpModal';
import OrderHeader from '@/components/orders/OrderHeader';
import RateOrderModal from '@/components/orders/RateOrderModal';
import { useCart } from '@/contexts/CartContext';
import { getCurrentUserIdFromStorage } from '@/lib/client-services/wishlist-service';
import {
  fetchOrderHead,
  resolveCustomerId,
  submitOrderReview,
} from '@/lib/client-services/order-service';
import { formatOrderDateTime, orderNumberOf } from '@/types/order';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || '';

type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'on_delivery'
  | 'delivered'
  | 'cancelled';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  options: { name: string; price: number }[];
  totalPrice: number;
  image: string;
  productId?: string | number | null;
  merchantProductId?: string | number | null;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  restaurantName: string;
  merchantLogo?: string | null;
  merchantId?: string | number | null;
  fulfillmentType: 'delivery' | 'pickup';
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  total: number;
  paymentMethod?: string;
}

const DELIVERY_FLOW: { id: OrderStatus; label: string }[] = [
  { id: 'pending', label: 'Placed' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'on_delivery', label: 'On the way' },
  { id: 'delivered', label: 'Delivered' },
];

const DELIVERY_FLOW_CANCELLED: { id: OrderStatus; label: string }[] = [
  { id: 'pending', label: 'Placed' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'on_delivery', label: 'On the way' },
  { id: 'cancelled', label: 'Cancelled' },
];

const PICKUP_FLOW: { id: OrderStatus; label: string }[] = [
  { id: 'pending', label: 'Placed' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready_for_pickup', label: 'Ready for pickup' },
  { id: 'delivered', label: 'Completed' },
];

const PICKUP_FLOW_CANCELLED: { id: OrderStatus; label: string }[] = [
  { id: 'pending', label: 'Placed' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready_for_pickup', label: 'Ready for pickup' },
  { id: 'cancelled', label: 'Cancelled' },
];

type PageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default function OrderDetailPage({ params }: PageProps) {
  const { orderId } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [rateSubmitting, setRateSubmitting] = useState(false);
  const { addToCart } = useCart();

  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [startTranslateX, setStartTranslateX] = useState(0);
  const [lastTime, setLastTime] = useState(0);
  const [velocityX, setVelocityX] = useState(0);
  const [maxTranslate, setMaxTranslate] = useState(0);

  const dragThreshold = 5;

  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const timelineInnerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    const fetchOrder = async () => {
      if (active) {
        setLoading(true);
        setLoadError(null);
      }
      try {
        const headers = {
          Authorization: `users API-Key ${API_KEY}`,
          'Content-Type': 'application/json',
        };

        // Parallel fan-out (§4): items + transaction only need orderId, not
        // the order doc — the old code awaited all three sequentially (+2 RTT).
        // The order head is shared + 60s-cached with the tracking screen.
        const [data, itemsData, transData] = await Promise.all([
          fetchOrderHead(orderId).then((d) => {
            if (!d) throw new Error('404');
            return d;
          }),
          fetch(`${API_URL}/order-items?where[order][equals]=${orderId}&depth=2`, {
            headers,
            cache: 'no-store',
          }).then((r) => {
            if (!r.ok) throw new Error(`items ${r.status}`);
            return r.json();
          }),
          fetch(`${API_URL}/transactions?where[order][equals]=${orderId}&depth=0`, {
            headers,
            cache: 'no-store',
          }).then((r) => {
            if (!r.ok) throw new Error(`tx ${r.status}`);
            return r.json();
          }),
        ]);
        const orderItems = itemsData.docs || [];
        const transaction = transData.docs?.[0];

        let merchantLogo: string | null = null;
        const merchant = data.merchant;
        if (merchant && typeof merchant === 'object' && merchant.vendor) {
          const vendor = merchant.vendor;
          if (typeof vendor === 'object' && vendor.logo) {
            const logo = vendor.logo;
            if (typeof logo === 'object') {
              merchantLogo = logo.cloudinaryURL || logo.url || null;
            }
          }
        }

        const mappedItems: OrderItem[] = orderItems.map((item: any) => {
             const product = item.product;
             const mp = item.merchant_product;
             const idOf = (v: unknown): string | number | null => {
               if (v == null) return null;
               if (typeof v === 'string' || typeof v === 'number') return v;
               if (typeof v === 'object' && v !== null && 'id' in v) {
                 const id = (v as { id: unknown }).id;
                 if (typeof id === 'string' || typeof id === 'number') return id;
               }
               return null;
             };
             let imageUrl: string | null = null;
             
             if (product && typeof product === 'object') {
                const primaryImage = product.media?.primaryImage;
                if (primaryImage && typeof primaryImage === 'object') {
                    imageUrl = primaryImage.cloudinaryURL || primaryImage.url || primaryImage.thumbnailURL || null;
                }
                
                if (!imageUrl && product.image) {
                    if (typeof product.image === 'object') {
                         imageUrl = product.image.cloudinaryURL || product.image.url || null;
                    } else if (typeof product.image === 'string') {
                         imageUrl = product.image;
                    }
                }
             }

             if (!imageUrl) {
                 imageUrl = 'https://placehold.co/400';
             }

             // Handle relative URLs
             const baseUrl = API_URL.replace('/api', '');
             const finalImage = imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`;

             return {
                 id: item.id,
                 name: item.product_name_snapshot,
                 quantity: item.quantity,
                 price: item.price_at_purchase,
                 options: item.options_snapshot || [],
                 totalPrice: item.total_price,
                 image: finalImage,
                 productId: idOf(product) ?? idOf(item.product),
                 merchantProductId: idOf(mp) ?? idOf(item.merchant_product),
             };
        });

        const mapped: OrderDetail = {
          id: String(data.id),
          orderNumber: orderNumberOf(data.id),
          placedAt: data.placed_at ? formatOrderDateTime(data.placed_at) : '',
          status: data.status as OrderStatus,
          restaurantName: (() => {
            let name = 'Unknown Restaurant';
            const merchant = data.merchant;
            if (merchant && typeof merchant === 'object') {
              if (merchant.outletName && merchant.outletName.trim() !== '') {
                name = merchant.outletName;
              } else if (merchant.name && merchant.name.trim() !== '') {
                name = merchant.name;
              } else if (merchant.vendor && typeof merchant.vendor === 'object') {
                if (merchant.vendor.businessName && merchant.vendor.businessName.trim() !== '') {
                  name = merchant.vendor.businessName;
                }
              }
            }
            return name;
          })(),
          merchantLogo,
          merchantId: (() => {
            const m = data.merchant as any;
            if (m == null) return null;
            if (typeof m === 'string' || typeof m === 'number') return m;
            if (typeof m.id === 'string' || typeof m.id === 'number') return m.id;
            return null;
          })(),
          fulfillmentType: data.fulfillment_type === 'pickup' ? 'pickup' : 'delivery',
          items: mappedItems,
          subtotal: data.subtotal,
          deliveryFee: data.delivery_fee,
          platformFee: data.platform_fee,
          total: data.total,
          paymentMethod: transaction?.payment_method || 'Cash',
        };

        if (active) {
          setOrder(mapped);
          setLoadError(null);
        }
      } catch (err: any) {
        if (active) {
          setOrder(null);
          const msg = String(err?.message ?? '');
          setLoadError(
            msg.includes('404')
              ? 'Order not found. It may have been removed.'
              : 'Couldn’t load this order. Check your connection and retry.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchOrder();

    return () => {
      active = false;
    };
  }, [orderId, reloadKey]);

  const getMaxTranslate = useCallback(() => {
    if (!timelineContainerRef.current || !timelineInnerRef.current) return 0;
    const containerWidth = timelineContainerRef.current.getBoundingClientRect().width;
    const contentWidth = timelineInnerRef.current.scrollWidth;
    return Math.max(0, contentWidth - containerWidth);
  }, []);

  const animateToPosition = useCallback(
    (targetX: number, duration = 300) => {
      const start = translateX;
      const distance = targetX - start;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = start + distance * easeOut;

        setTranslateX(current);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      animate();
    },
    [translateX]
  );

  const handleStart = (clientX: number) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsDragging(true);
    setHasDragged(false);
    setStartX(clientX);
    setCurrentX(clientX);
    setStartTranslateX(translateX);
    setLastTime(Date.now());
    setVelocityX(0);
  };

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging) return;

      const now = Date.now();
      const deltaTime = now - lastTime;
      const deltaX = clientX - currentX;

      const totalDragDistance = Math.abs(clientX - startX);
      if (totalDragDistance > dragThreshold) {
        setHasDragged(true);
      }

      if (deltaTime > 0) {
        setVelocityX(deltaX / deltaTime);
      }

      setCurrentX(clientX);
      setLastTime(now);

      const dragDistance = clientX - startX;
      const newTranslate = startTranslateX + dragDistance;

      const max = maxTranslate;
      let bounded = newTranslate;

      if (newTranslate > 0) {
        bounded = newTranslate * 0.3;
      } else if (newTranslate < -max) {
        const overflow = newTranslate + max;
        bounded = -max + overflow * 0.3;
      }

      setTranslateX(bounded);
    },
    [isDragging, startX, startTranslateX, currentX, lastTime, maxTranslate]
  );

  const handleEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    const momentum = velocityX * 200;
    let finalPosition = translateX + momentum;
    const max = maxTranslate;

    finalPosition = Math.max(-max, Math.min(0, finalPosition));

    animateToPosition(finalPosition, 400);

    setTimeout(() => {
      setHasDragged(false);
    }, 100);
  }, [isDragging, velocityX, translateX, maxTranslate, animateToPosition]);

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

  const handleTrackOrder = () => {
    router.push(`/orders/${orderId}/tracking`);
  };

  const handleGetHelp = () => {
    setIsHelpModalOpen(true);
  };

  const handleReorder = useCallback(async () => {
    if (!order || order.items.length === 0 || order.merchantId == null) {
      toast.error('No items to reorder');
      return;
    }
    setReordering(true);
    try {
      // Concurrent fan-out (same pattern as the orders list): one slow item
      // must not serialize the whole cart refill.
      const results = await Promise.allSettled(
        order.items.map(async (item) => {
          if (item.productId == null || item.merchantProductId == null) {
            throw new Error('missing ids');
          }
          await addToCart({
            merchantId: Number(order.merchantId),
            productId: Number(item.productId),
            merchantProductId: Number(item.merchantProductId),
            quantity: item.quantity,
            priceAtAdd: item.price,
          });
        }),
      );
      const added = results.filter((r) => r.status === 'fulfilled').length;
      if (added > 0) {
        toast.success(`${added} item${added === 1 ? '' : 's'} added back to cart`);
        router.push('/carts');
      } else {
        toast.error('Could not reorder — items may be unavailable');
      }
    } finally {
      setReordering(false);
    }
  }, [order, addToCart, router]);

  const handleRateOrder = useCallback(() => {
    setRateOpen(true);
  }, []);

  const handleRateSubmit = useCallback(
    async (rating: number, comment: string) => {
      if (!order) return;
      setRateSubmitting(true);
      try {
        const userId = getCurrentUserIdFromStorage();
        if (!userId) throw new Error('Please sign in to rate');
        const customerId = await resolveCustomerId(userId);
        if (!customerId) throw new Error('Customer profile not found');
        if (order.merchantId == null) throw new Error('Merchant not found');
        await submitOrderReview({
          orderId: order.id,
          customerId,
          merchantId: order.merchantId,
          rating,
          comment,
        });
        toast.success('Thanks for your rating!');
        setRateOpen(false);
      } catch (e: any) {
        toast.error(e?.message || 'Rating failed');
      } finally {
        setRateSubmitting(false);
      }
    },
    [order],
  );

  useEffect(() => {
    const calculateBounds = () => {
      const max = getMaxTranslate();
      setMaxTranslate(max);
      if (translateX < -max) {
        setTranslateX(-max);
      }
    };

    const timer = setTimeout(calculateBounds, 100);
    return () => clearTimeout(timer);
  }, [order, getMaxTranslate, translateX]);

  useEffect(() => {
    const onResize = () => {
      const max = getMaxTranslate();
      setMaxTranslate(max);
      if (translateX < -max) {
        animateToPosition(-max);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, [getMaxTranslate, translateX, animateToPosition]);

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        handleMove(e.clientX);
      };

      const handleGlobalMouseUp = () => {
        handleEnd();
      };

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, handleMove, handleEnd]);

  if (loading) {
    return <OrderDetailSkeleton />;
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white dark:bg-[#151515] rounded-2xl shadow-sm border border-gray-100 dark:border-[#292929] p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-[#202020] rounded-full flex items-center justify-center">
            <i className="fas fa-receipt text-xl text-gray-400" />
          </div>
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">Order unavailable</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            {loadError ?? 'Order not found.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/orders')}
              className="flex-1 py-2.5 bg-gray-100 dark:bg-[#292929] rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#383838]"
            >
              My orders
            </button>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold hover:opacity-90"
              style={{ backgroundColor: '#239459' }}
            >
              <i className="fas fa-redo mr-2" />Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isDelivery = order.fulfillmentType === 'delivery';

  const steps: { id: OrderStatus; label: string }[] = (() => {
    if (order.status === 'cancelled') {
      return isDelivery ? DELIVERY_FLOW_CANCELLED : PICKUP_FLOW_CANCELLED;
    }
    return isDelivery ? DELIVERY_FLOW : PICKUP_FLOW;
  })();

  const currentIndex = steps.findIndex((step) => step.id === order.status);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <OrderHeader
        onBack={() => router.push('/orders')}
        merchantLogo={order.merchantLogo}
        restaurantName={order.restaurantName}
        status={order.status}
        placedAt={order.placedAt}
        orderNumber={order.orderNumber}
      />
      <div className="bg-white dark:bg-[#111111] border-t border-gray-100 dark:border-[#292929]">
        <div className="w-full px-4 pb-4 pt-3">
          <div
            ref={timelineContainerRef}
            className="overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={isDragging ? handleMouseMove : undefined}
            onMouseUp={isDragging ? handleMouseUp : undefined}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              touchAction: 'pan-y',
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
          >
            <div
              ref={timelineInnerRef}
              className="flex flex-nowrap items-center gap-2 select-none"
              style={{
                transform: `translateX(${translateX}px)`,
                WebkitUserSelect: 'none',
                userSelect: 'none',
                transition: 'none',
                willChange: 'transform',
              }}
            >
              {steps.map((step, index) => {
                const isCurrent = index === currentIndex;
                const isCompleted = currentIndex > index && currentIndex !== -1;
                const isLast = index === steps.length - 1;
                const circleBase =
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold';
                let circleClasses = 'bg-gray-200 dark:bg-[#333333] text-gray-500 dark:text-gray-300';
                if (isCompleted) {
                  circleClasses = 'bg-green-500 text-white';
                } else if (isCurrent) {
                  circleClasses = 'bg-amber-500 text-white';
                }

                const labelClasses = isCurrent
                  ? 'text-xs font-semibold text-gray-900 dark:text-white mt-1'
                  : 'text-xs text-gray-500 dark:text-gray-400 mt-1';

                return (
                  <div key={step.id} className="flex items-center flex-shrink-0">
                    <div className="flex flex-col items-center min-w-[80px]">
                      <div className={`${circleBase} ${circleClasses}`}>
                        {index + 1}
                      </div>
                      <div className={labelClasses}>{step.label}</div>
                    </div>
                    {!isLast && (
                      <div
                        className={`h-0.5 w-10 sm:w-16 mx-1 ${
                          isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-[#333333]'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 bg-white dark:bg-[#111111] border-t border-b border-gray-100 dark:border-[#292929]">
        <div className="p-4">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Order Summary</h2>
          
          <div className="space-y-4 mb-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 dark:bg-[#252525]">
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={48}
                    height={48}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                     <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          <span className="font-bold mr-1">{item.quantity}x</span>
                          {item.name}
                        </p>
                        {item.options.length > 0 && (
                            <ul className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                                {item.options.map((opt, i) => (
                                    <li key={i}>+ {opt.name} (₱{opt.price})</li>
                                ))}
                            </ul>
                        )}
                     </div>
                     <p className="text-sm font-medium text-gray-900 dark:text-gray-100">₱{item.totalPrice.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-200 dark:border-[#383838] pt-3 space-y-2">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>Subtotal</span>
              <span>₱{order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>Delivery Fee</span>
              <span>₱{order.deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>Service Fee</span>
              <span>₱{order.platformFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-100 dark:border-[#383838] mt-2">
              <span>Total</span>
              <span>₱{order.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#383838]">
             <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-300">Payment Method</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                    {order.paymentMethod?.replace(/_/g, ' ') || 'Cash'}
                </span>
             </div>
          </div>
        </div>
      </div>

      <div className="mt-2 bg-white dark:bg-[#111111] border-t border-b border-gray-100 dark:border-[#292929] mb-20">
        <div className="p-4">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Actions</h2>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleTrackOrder}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <i className="fas fa-map-marker-alt"></i>
              Track Order
            </button>
            <button
              onClick={handleGetHelp}
              className="w-full py-3 px-4 bg-gray-100 dark:bg-[#292929] hover:bg-gray-200 dark:hover:bg-[#383838] text-gray-700 dark:text-gray-200 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <i className="fas fa-question-circle"></i>
              Get help about this order
            </button>
            {['delivered', 'cancelled'].includes(order.status) && (
              <button
                onClick={handleReorder}
                disabled={reordering}
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {reordering ? (
                  <i className="fas fa-spinner fa-spin" />
                ) : (
                  <i className="fas fa-redo" />
                )}
                {reordering ? 'Adding to cart…' : 'Order Again'}
              </button>
            )}
            {order.status === 'delivered' && (
              <button
                onClick={handleRateOrder}
                className="w-full py-3 px-4 bg-gray-100 dark:bg-[#292929] hover:bg-gray-200 dark:hover:bg-[#383838] text-gray-700 dark:text-gray-200 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <i className="fas fa-star"></i>
                Rate this order
              </button>
            )}
          </div>
        </div>
      </div>
      
      {order && (
        <OrderHelpModal
          isOpen={isHelpModalOpen}
          onClose={() => setIsHelpModalOpen(false)}
          orderId={order.id}
        />
      )}

      {rateOpen && order && (
        <RateOrderModal
          isOpen
          restaurantName={order.restaurantName}
          orderNumber={order.orderNumber}
          submitting={rateSubmitting}
          onClose={() => setRateOpen(false)}
          onSubmit={handleRateSubmit}
        />
      )}
    </div>
  );
}
