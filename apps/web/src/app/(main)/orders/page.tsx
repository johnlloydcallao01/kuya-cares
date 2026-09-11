'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from '@/components/ui/ImageWrapper';
import { getCurrentUserIdFromStorage } from '@/lib/client-services/wishlist-service';
import { OrdersPageSkeleton } from '@/components/skeletons/OrdersSkeleton';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || '1331d981-b6b7-4ff5-aab6-b9ddbb0c63ae';

interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  price: string;
  image: string;
  merchantName?: string;
  merchantLogo?: string | null;
}

interface Order {
  id: string;
  orderId: string;
  orderNumber: string;
  date: string;
  status: string;
  total: string;
  items: OrderItem[];
  restaurant: string;
  merchantLogo?: string | null;
  deliveryTime: string;
  rating: number;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'delivered':
      return 'bg-green-100 text-green-800';
    case 'on_delivery':
      return 'bg-blue-100 text-blue-800';
    case 'ready_for_pickup':
      return 'bg-yellow-100 text-yellow-800';
    case 'preparing':
      return 'bg-orange-100 text-orange-800';
    case 'accepted':
      return 'bg-indigo-100 text-indigo-800';
    case 'pending':
      return 'bg-gray-100 text-gray-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'delivered':
      return 'fas fa-check-circle';
    case 'on_delivery':
      return 'fas fa-motorcycle';
    case 'ready_for_pickup':
      return 'fas fa-shopping-bag';
    case 'preparing':
      return 'fas fa-utensils';
    case 'accepted':
      return 'fas fa-clipboard-check';
    case 'pending':
      return 'fas fa-clock';
    case 'cancelled':
      return 'fas fa-times-circle';
    default:
      return 'fas fa-question-circle';
  }
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const tabsInnerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const userId = getCurrentUserIdFromStorage();
        if (!userId) {
          setLoading(false);
          return;
        }

        const headers = {
          'Authorization': `users API-Key ${API_KEY}`,
          'Content-Type': 'application/json',
        };

        // Fetch Orders
        const ordersRes = await fetch(
          `${API_URL}/orders?where[customer.user][equals]=${userId}&depth=3&sort=-placed_at`,
          { headers }
        );
        const ordersData = await ordersRes.json();
        
        if (!ordersData.docs || ordersData.docs.length === 0) {
          setOrders([]);
          setLoading(false);
          return;
        }

        const fetchedOrders = ordersData.docs;
        const orderIds = fetchedOrders.map((o: any) => o.id);

        // Fetch Order Items
        const itemsRes = await fetch(
          `${API_URL}/order-items?where[order][in]=${orderIds.join(',')}&depth=2&limit=300`,
           { headers }
        );
        const itemsData = await itemsRes.json();
        const allItems = itemsData.docs || [];

        // Map to UI format
        const mappedOrders = fetchedOrders.map((order: any) => {
          const orderItems = allItems.filter((item: any) => 
            (typeof item.order === 'object' ? item.order.id : item.order) === order.id
          );

          // Extract merchant name and vendor logo from order.merchant
          let merchantLogo: string | null = null;
          let merchantName = 'Unknown Restaurant';
          const merchant = order.merchant;
          
          if (merchant && typeof merchant === 'object') {
            // Try to get the name from various possible fields
            if (merchant.outletName && merchant.outletName.trim() !== '') {
                merchantName = merchant.outletName;
            } else if (merchant.name && merchant.name.trim() !== '') {
                merchantName = merchant.name;
            } else if (merchant.vendor && typeof merchant.vendor === 'object') {
                // Fallback to vendor business name if outlet name is missing
                if (merchant.vendor.businessName && merchant.vendor.businessName.trim() !== '') {
                    merchantName = merchant.vendor.businessName;
                }
            }

            // Extract logo
            if (merchant.vendor) {
              const vendor = merchant.vendor;
              if (typeof vendor === 'object' && vendor.logo) {
                const logo = vendor.logo;
                if (typeof logo === 'object') {
                  merchantLogo = logo.cloudinaryURL || logo.url || null;
                }
              }
            }
          }

          const mappedItems = orderItems.map((item: any) => {
             const product = item.product;
             // Try to find image URL from various possible locations in Payload response
             let imageUrl: string | null = null;
             
             if (product && typeof product === 'object') {
                // Check media.primaryImage first (correct structure)
                const primaryImage = product.media?.primaryImage;
                if (primaryImage && typeof primaryImage === 'object') {
                    imageUrl = primaryImage.cloudinaryURL || primaryImage.url || primaryImage.thumbnailURL || null;
                }
                
                // Fallback to direct image field (legacy or alternative)
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

             // Get merchant name from merchant_product
             let itemMerchantName = '';
             if (item.merchant_product && typeof item.merchant_product === 'object') {
                const merchantProduct = item.merchant_product;
                if (merchantProduct.merchant_id && typeof merchantProduct.merchant_id === 'object') {
                    itemMerchantName = merchantProduct.merchant_id.outletName || merchantProduct.merchant_id.name || '';
                }
             }

             let productName = item.product_name_snapshot;
             if (!productName && product && typeof product === 'object' && product.name) {
                 productName = product.name;
             }

             return {
               id: item.id,
               name: productName || 'Item',
               quantity: item.quantity,
               price: `$${item.price_at_purchase.toFixed(2)}`,
               image: finalImage,
               merchantName: itemMerchantName || merchantName,
               merchantLogo: merchantLogo
             };
          });

          return {
            id: `ORD-${order.id}`,
            orderId: String(order.id),
            orderNumber: `#${order.id.toString().padStart(5, '0')}`,
            date: new Date(order.placed_at).toLocaleDateString(),
            status: order.status,
            total: `$${order.total.toFixed(2)}`,
            items: mappedItems,
            restaurant: merchantName,
            merchantLogo: merchantLogo,
            deliveryTime: '30 mins',
            rating: 5.0
          };
        });

        setOrders(mappedOrders);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  const statusOptions = [
    { id: 'all', label: 'All Orders', count: orders.length },
    { id: 'pending', label: 'Pending', count: orders.filter(order => order.status === 'pending').length },
    { id: 'accepted', label: 'Accepted', count: orders.filter(order => order.status === 'accepted').length },
    { id: 'preparing', label: 'Preparing', count: orders.filter(order => order.status === 'preparing').length },
    { id: 'ready_for_pickup', label: 'Ready for Pickup', count: orders.filter(order => order.status === 'ready_for_pickup').length },
    { id: 'on_delivery', label: 'On Delivery', count: orders.filter(order => order.status === 'on_delivery').length },
    { id: 'delivered', label: 'Delivered', count: orders.filter(order => order.status === 'delivered').length },
    { id: 'cancelled', label: 'Cancelled', count: orders.filter(order => order.status === 'cancelled').length }
  ];

  const getMaxTranslate = useCallback(() => {
    if (!tabsContainerRef.current || !tabsInnerRef.current) return 0;
    const containerWidth = tabsContainerRef.current.getBoundingClientRect().width;
    const contentWidth = tabsInnerRef.current.scrollWidth;
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

  useEffect(() => {
    const calculateBounds = () => {
      const max = getMaxTranslate();
      setMaxTranslate(max);
      if (translateX < -max) {
        setTranslateX(-max);
      }
    };

    if (statusOptions.length > 0) {
      const timer = setTimeout(calculateBounds, 100);
      return () => clearTimeout(timer);
    }
  }, [statusOptions.length, getMaxTranslate, translateX]);

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

  // Filter orders based on active filter and search query
  const filteredOrders = orders.filter(order => {
    const matchesFilter = 
      activeFilter === 'all' || order.status === activeFilter;
    
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.restaurant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesFilter && matchesSearch;
  });

  const handleReorder = (orderId: string) => {
    console.log('Reordering:', orderId);
    // Reorder logic here
  };

  const handleTrackOrder = (orderId: string) => {
    router.push(`/orders/${orderId}/tracking`);
  };

  const handleRateOrder = (orderId: string) => {
    console.log('Rating order:', orderId);
    // Rate order logic here
  };

  if (loading) {
      return <OrdersPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white shadow-sm">
        <div className="w-full px-2.5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Orders</h1>
              <p className="text-gray-600 mt-1 text-base">Track and manage your food orders</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button className="px-4 py-2 rounded-lg hover:opacity-90 transition-colors font-medium text-sm" style={{color: '#eba236', backgroundColor: '#eba236' + '20'}}>
                <i className="fas fa-receipt mr-2"></i>
                Order History
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-2.5 py-4">
        {/* Search and Filter Section */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="Search orders by number, restaurant, or item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-lg focus:ring-2 focus:bg-white transition-all text-sm"
                  style={{'--tw-ring-color': '#eba236'} as any}
                />
              </div>
            </div>

            {/* Status Filter Tabs with physics carousel */}
            <div
              className="relative w-full lg:w-1/2"
            >
              <div
                ref={tabsContainerRef}
                className="overflow-hidden"
                onMouseDown={handleMouseDown}
                onMouseMove={isDragging ? handleMouseMove : undefined}
                onMouseUp={isDragging ? handleMouseUp : undefined}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                  touchAction: 'pan-y',
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
              >
                <div
                  ref={tabsInnerRef}
                  className="flex flex-nowrap gap-2 select-none"
                  style={{
                    transform: `translateX(${translateX}px)`,
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    transition: 'none',
                    willChange: 'transform'
                  }}
                >
                  {statusOptions.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => {
                        if (!hasDragged) {
                          setActiveFilter(filter.id);
                        }
                      }}
                      className={`px-3 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${
                        activeFilter === filter.id
                          ? 'text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      style={activeFilter === filter.id ? { backgroundColor: '#eba236' } : {}}
                    >
                      {filter.label}
                      <span className="ml-1 text-xs opacity-75">({filter.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                <Link href={`/orders/${order.orderId}`} className="block">
                  <div className="p-4 bg-gray-50">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {order.merchantLogo ? (
                            <Image
                              src={order.merchantLogo}
                              alt={order.restaurant}
                              width={36}
                              height={36}
                              className="object-contain"
                            />
                          ) : (
                            <i className="fas fa-store text-gray-500 text-xs" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 leading-tight">
                            {order.restaurant}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {order.orderNumber} • {order.date}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          <i className={`${getStatusIcon(order.status)} mr-1`}></i>
                          {order.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900 text-base">{order.total}</p>
                          <p className="text-xs text-gray-500">{order.deliveryTime}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 border-t border-gray-100">
                    <div className="flex flex-row gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex-shrink-0 w-20">
                          <div className="relative">
                            <Image
                              src={item.image}
                              alt={item.name}
                              width={80}
                              height={80}
                              className="w-20 h-20 object-cover rounded-lg bg-gray-100"
                            />
                            {item.quantity > 1 && (
                                <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-tl-md font-medium">
                                    x{item.quantity}
                                </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-700 mt-1.5 line-clamp-2 leading-tight">
                            {item.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Link>
                <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => handleTrackOrder(order.orderId)}
                    className="flex-1 py-2 px-4 text-white rounded-lg hover:opacity-90 transition-colors font-medium text-sm"
                    style={{backgroundColor: '#eba236'}}
                  >
                    <i className="fas fa-map-marker-alt mr-2"></i>
                    Track Order
                  </button>
                  <Link
                    href={`/orders/${order.orderId}`}
                    className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm text-center"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <i className="fas fa-shopping-bag text-3xl text-gray-400"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {searchQuery ? 'No orders found' : 'No orders yet'}
              </h3>
              <p className="text-gray-600 mb-6 text-base">
                {searchQuery 
                  ? 'Try adjusting your search or filter criteria'
                  : 'Your food orders will appear here once you place them'
                }
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-6 py-2 text-white rounded-lg hover:opacity-90 transition-colors font-medium text-sm shadow-md"
                  style={{backgroundColor: '#eba236'}}
                >
                  Clear Search
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
