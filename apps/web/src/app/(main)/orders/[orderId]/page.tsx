'use client';

import React, { useEffect, useState, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from '@/components/ui/ImageWrapper';
import { OrderDetailSkeleton } from '@/components/skeletons/OrdersSkeleton';
import OrderHelpModal from '@/components/modals/OrderHelpModal';
import OrderHeader from '@/components/orders/OrderHeader';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || '1331d981-b6b7-4ff5-aab6-b9ddbb0c63ae';

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
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  restaurantName: string;
  merchantLogo?: string | null;
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
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

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
      try {
        const headers = {
          Authorization: `users API-Key ${API_KEY}`,
          'Content-Type': 'application/json',
        };

        const res = await fetch(`${API_URL}/orders/${orderId}?depth=3`, {
          headers,
        });

        if (!res.ok) {
          throw new Error(String(res.status));
        }

        const data = await res.json();

        // Fetch Order Items
        const itemsRes = await fetch(`${API_URL}/order-items?where[order][equals]=${orderId}&depth=2`, { headers });
        const itemsData = await itemsRes.json();
        const orderItems = itemsData.docs || [];

        // Fetch Transaction
        const transRes = await fetch(`${API_URL}/transactions?where[order][equals]=${orderId}&depth=0`, { headers });
        const transData = await transRes.json();
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
                 image: finalImage
             };
        });

        const placedAt = data.placed_at ? new Date(data.placed_at) : null;

        const mapped: OrderDetail = {
          id: String(data.id),
          orderNumber: `#${String(data.id).padStart(5, '0')}`,
          placedAt: placedAt
            ? placedAt.toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : '',
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
        }
      } catch (err) {
        if (active) {
          setOrder(null);
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
  }, [orderId]);

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

  const handleReorder = () => {
    // TODO: Implement reorder logic
    console.log('Order again');
  };

  const handleRateOrder = () => {
    // TODO: Implement rating logic
    console.log('Rate order');
  };

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Order not found.</div>
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
    <div className="min-h-screen bg-gray-50">
      <OrderHeader
        onBack={() => router.push('/orders')}
        merchantLogo={order.merchantLogo}
        restaurantName={order.restaurantName}
        status={order.status}
        placedAt={order.placedAt}
        orderNumber={order.orderNumber}
      />
      <div className="bg-white border-t border-gray-100">
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
                let circleClasses = 'bg-gray-200 text-gray-500';
                if (isCompleted) {
                  circleClasses = 'bg-green-500 text-white';
                } else if (isCurrent) {
                  circleClasses = 'bg-amber-500 text-white';
                }

                const labelClasses = isCurrent
                  ? 'text-xs font-semibold text-gray-900 mt-1'
                  : 'text-xs text-gray-500 mt-1';

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
                          isCompleted ? 'bg-green-500' : 'bg-gray-200'
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

      <div className="mt-2 bg-white border-t border-b border-gray-100">
        <div className="p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Order Summary</h2>
          
          <div className="space-y-4 mb-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
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
                        <p className="text-sm font-medium text-gray-900">
                          <span className="font-bold mr-1">{item.quantity}x</span>
                          {item.name}
                        </p>
                        {item.options.length > 0 && (
                            <ul className="text-xs text-gray-500 mt-1 space-y-0.5">
                                {item.options.map((opt, i) => (
                                    <li key={i}>+ {opt.name} (₱{opt.price})</li>
                                ))}
                            </ul>
                        )}
                     </div>
                     <p className="text-sm font-medium text-gray-900">₱{item.totalPrice.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-200 pt-3 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>₱{order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Delivery Fee</span>
              <span>₱{order.deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Service Fee</span>
              <span>₱{order.platformFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100 mt-2">
              <span>Total</span>
              <span>₱{order.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100">
             <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Payment Method</span>
                <span className="text-sm font-medium text-gray-900 capitalize">
                    {order.paymentMethod?.replace(/_/g, ' ') || 'Cash'}
                </span>
             </div>
          </div>
        </div>
      </div>

      <div className="mt-2 bg-white border-t border-b border-gray-100 mb-20">
        <div className="p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Actions</h2>
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
              className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <i className="fas fa-question-circle"></i>
              Get help about this order
            </button>
            {['delivered', 'cancelled'].includes(order.status) && (
              <button
                onClick={handleReorder}
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <i className="fas fa-redo"></i>
                Order Again
              </button>
            )}
            {order.status === 'delivered' && (
              <button
                onClick={handleRateOrder}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
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
    </div>
  );
}
