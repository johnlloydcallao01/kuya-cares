'use client';

import React, { useCallback, useEffect, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';
import { useGoogleMapsApiReady } from '@/lib/google-maps-api';
import Image from '@/components/ui/ImageWrapper';
import OrderHeader from '@/components/orders/OrderHeader';
import { TrackingPageSkeleton } from '@/components/skeletons/OrdersSkeleton';
import { fetchOrderHead } from '@/lib/client-services/order-service';
import { formatOrderDateTime, getStatusMeta, orderNumberOf } from '@/types/order';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || '';

const TRACK_POLL_MS = 15000;

// Mock Coordinates
const MOCK_COORDINATES = {
  user: { lat: 14.5995, lng: 120.9842 }, // Manila
  restaurant: { lat: 14.5547, lng: 121.0244 }, // Makati
  driver: { lat: 14.5771, lng: 121.0043 }, // In between
};

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const mapCenter = MOCK_COORDINATES.driver;

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
};

type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'on_delivery'
  | 'delivered'
  | 'cancelled';

interface TrackingEvent {
  id: string;
  status: OrderStatus;
  timestamp: string;
  description?: string;
  actor?: {
    name?: string;
    email?: string;
  };
}

interface DriverInfo {
  name: string;
  phone?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  vehicleModel?: string;
  photo?: string;
  rating?: number;
}

interface DeliveryLocation {
  formattedAddress: string;
  street?: string;
  floorUnitRoom?: string;
  deliveryInstructions?: string;
  notes?: string;
  contactName?: string;
  contactPhone?: string;
  merchantFormattedAddress?: string;
  merchantStreet?: string;
  merchantFloorUnitRoom?: string;
  merchantDeliveryInstructions?: string;
  merchantLabel?: string;
}

interface TrackingData {
  orderId: string;
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  restaurantName: string;
  merchantLogo?: string | null;
  events: TrackingEvent[];
  driver?: DriverInfo;
  deliveryLocation?: DeliveryLocation;
  estimatedArrival?: string; // Mock or calculated
}

type PageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default function OrderTrackingPage({ params }: PageProps) {
  const { orderId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const isLoaded = useGoogleMapsApiReady();
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(
    async (silent = false) => {
      const isActive = () => mountedRef.current;
      try {
        if (!silent) {
          setLoading(true);
          setLoadError(null);
        }
        const headers = {
          Authorization: `users API-Key ${API_KEY}`,
          'Content-Type': 'application/json',
        };

        // Parallel fan-out (§4): tracking, location and driver only need
        // orderId — the old code awaited all four sequentially (+3 RTT).
        // The order head is shared + 60s-cached with the detail screen.
        const [order, trackingData, locData, driverData] = await Promise.all([
          fetchOrderHead(orderId).then((d) => {
            if (!d) throw new Error('order 404');
            return d;
          }),
          fetch(
            `${API_URL}/order-tracking?where[order][equals]=${orderId}&sort=-timestamp&depth=1`,
            { headers, cache: 'no-store' },
          ).then((r) => {
            if (!r.ok) throw new Error(`tracking ${r.status}`);
            return r.json();
          }),
          fetch(
            `${API_URL}/delivery-locations?where[order][equals]=${orderId}&depth=1`,
            { headers, cache: 'no-store' },
          ).then((r) => {
            if (!r.ok) throw new Error(`location ${r.status}`);
            return r.json();
          }),
          fetch(
            `${API_URL}/driver-assignments?where[order][equals]=${orderId}&where[status][equals]=accepted&depth=2`,
            { headers, cache: 'no-store' },
          ).then((r) => {
            if (!r.ok) throw new Error(`driver ${r.status}`);
            return r.json();
          }),
        ]);
        const deliveryLocationDoc = locData.docs?.[0];
        const assignment = driverData.docs?.[0];

        // Process Data
        let merchantLogo: string | null = null;
        const merchant = order.merchant;
        if (merchant && typeof merchant === 'object' && merchant.vendor) {
          const vendor = merchant.vendor;
          if (typeof vendor === 'object' && vendor.logo) {
            const logo = vendor.logo;
            if (typeof logo === 'object') {
              merchantLogo = logo.cloudinaryURL || logo.url || null;
            }
          }
        }

        const events: TrackingEvent[] = (trackingData.docs || []).map((doc: any) => ({
          id: doc.id,
          status: doc.status,
          timestamp: doc.timestamp,
          description: doc.description,
          actor: doc.actor ? { name: doc.actor.name, email: doc.actor.email } : undefined,
        }));

        let driver: DriverInfo | undefined;
        if (assignment && assignment.driver) {
          const d = assignment.driver;
          driver = {
            name: d.user?.name || 'Assigned Driver',
            phone: d.user?.phone, // Assuming phone is on user
            vehicleType: d.vehicleType,
            vehiclePlate: d.vehiclePlateNumber,
            vehicleColor: d.vehicleColor,
            vehicleModel: d.vehicleModel,
            rating: d.ratingAverage,
          };
          
           // Handle driver photo
           if (d.user?.photo) {
              const photo = d.user.photo;
               driver.photo = photo.cloudinaryURL || photo.url || null;
           }
        }

        let deliveryLocation: DeliveryLocation | undefined;
        if (deliveryLocationDoc) {
          deliveryLocation = {
            formattedAddress: deliveryLocationDoc.formatted_address,
            street: deliveryLocationDoc.street,
            floorUnitRoom: deliveryLocationDoc.floor_unit_room,
            deliveryInstructions: deliveryLocationDoc.delivery_instructions,
            notes: deliveryLocationDoc.notes,
            contactName: deliveryLocationDoc.contact_name,
            contactPhone: deliveryLocationDoc.contact_phone,
            merchantFormattedAddress: deliveryLocationDoc.merchant_formatted_address,
            merchantStreet: deliveryLocationDoc.merchant_street,
            merchantFloorUnitRoom: deliveryLocationDoc.merchant_floor_unit_room,
            merchantDeliveryInstructions: deliveryLocationDoc.merchant_delivery_instructions,
            merchantLabel: deliveryLocationDoc.merchant_label,
          };
        }

        if (isActive()) {
          const placedAt = order.placed_at ? new Date(order.placed_at) : null;

          setData({
            orderId: order.id,
            orderNumber: orderNumberOf(order.id),
            placedAt: placedAt ? formatOrderDateTime(order.placed_at) : '',
            status: order.status,
            restaurantName: (() => {
              let name = 'Unknown Restaurant';
              const merchant = order.merchant;
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
            events,
            driver,
            deliveryLocation,
          });
          if (isActive()) setLoadError(null);
        }
      } catch (err: any) {
        if (isActive() && !silent) {
          const msg = String(err?.message ?? '');
          setLoadError(
            msg.includes('404')
              ? 'Order not found. It may have been removed.'
              : 'Couldn’t load tracking. Check your connection and retry.',
          );
        }
      } finally {
        if (isActive() && !silent) setLoading(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData, reloadKey]);

  // Live tracking refresh (§4 poll): active orders revalidate every 15s,
  // silently and only while the tab is visible. Settled orders never poll.
  useEffect(() => {
    if (loading || !data) return;
    if (getStatusMeta(data.status).group !== 'active') return;
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchData(true);
    };
    const t = setInterval(tick, TRACK_POLL_MS);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loading, data, fetchData]);

  if (loading) {
    return <TrackingPageSkeleton />;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <i className="fas fa-map-marker-alt text-xl text-gray-400" />
          </div>
          <h2 className="text-lg font-extrabold text-gray-900 mb-2">Tracking unavailable</h2>
          <p className="text-sm text-gray-500 mb-5">
            {loadError ?? 'Tracking information not available.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => router.back()}
              className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-200"
            >
              Go back
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <OrderHeader
        onBack={() => router.back()}
        merchantLogo={data.merchantLogo}
        restaurantName={data.restaurantName}
        status={data.status}
        placedAt={data.placedAt}
        orderNumber={data.orderNumber}
      />

      {/* Immersive Map Background (Top 50-60%) */}
      <div className="h-[60vh] w-full relative bg-gray-200">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={13}
            options={mapOptions}
          >
            {/* User Location (Home) */}
            <Marker
              position={MOCK_COORDINATES.user}
              label="User"
            />

            {/* Restaurant Location (Store) */}
            <Marker
              position={MOCK_COORDINATES.restaurant}
              label="Store"
            />

            {/* Driver Location */}
            <Marker
              position={MOCK_COORDINATES.driver}
              label="Driver"
              icon={{
                path: typeof google !== 'undefined' ? google.maps.SymbolPath.CIRCLE : 0,
                scale: 8,
                fillColor: "#4285F4",
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "white",
              }}
            />

            {/* Route Polyline */}
            <Polyline
              path={[
                MOCK_COORDINATES.restaurant,
                MOCK_COORDINATES.driver,
                MOCK_COORDINATES.user
              ]}
              options={{
                strokeColor: "#4285F4",
                strokeOpacity: 0.8,
                strokeWeight: 4,
              }}
            />
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            Loading Map...
          </div>
        )}
      </div>
      
      {/* Bottom Content Area — live timeline, driver & addresses.
          Previously a placeholder while C2–C4 hydrated for zero pixels. */}
      <div className="flex-1 bg-white p-4 space-y-4 pb-24">
        {data.driver && (
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
              {data.driver.photo ? (
                <Image
                  src={data.driver.photo}
                  alt={data.driver.name}
                  width={48}
                  height={48}
                  className="object-cover w-full h-full"
                />
              ) : (
                <i className="fas fa-motorcycle text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{data.driver.name}</p>
              <p className="text-xs text-gray-500 truncate">
                {[data.driver.vehicleModel, data.driver.vehicleColor, data.driver.vehiclePlate]
                  .filter(Boolean)
                  .join(' • ') || data.driver.vehicleType || 'Delivery rider'}
                {data.driver.rating != null && ` • ★ ${Number(data.driver.rating).toFixed(1)}`}
              </p>
            </div>
            {data.driver.phone && (
              <a
                href={`tel:${data.driver.phone}`}
                className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50"
                aria-label={`Call ${data.driver.name}`}
              >
                <i className="fas fa-phone text-sm" />
              </a>
            )}
          </div>
        )}

        {data.deliveryLocation && (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-start gap-2.5">
              <i className="fas fa-location-dot text-red-500 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Deliver to</p>
                <p className="text-sm font-medium text-gray-900 leading-snug">
                  {data.deliveryLocation.formattedAddress || '—'}
                </p>
                {data.deliveryLocation.deliveryInstructions && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    “{data.deliveryLocation.deliveryInstructions}”
                  </p>
                )}
              </div>
            </div>
            {data.deliveryLocation.merchantFormattedAddress && (
              <div className="flex items-start gap-2.5 pt-2 border-t border-gray-200/70">
                <i className="fas fa-store text-gray-400 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    {data.deliveryLocation.merchantLabel || 'Pickup from'}
                  </p>
                  <p className="text-sm font-medium text-gray-900 leading-snug">
                    {data.deliveryLocation.merchantFormattedAddress}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-2.5">Tracking history</h2>
          {data.events.length > 0 ? (
            <ol className="relative border-l-2 border-gray-100 ml-2 space-y-4">
              {data.events.map((ev) => (
                <li key={ev.id} className="ml-4">
                  <span className="absolute -left-[7px] mt-1 w-3 h-3 rounded-full bg-green-500 ring-4 ring-green-50" />
                  <p className="text-sm font-bold text-gray-900 capitalize">
                    {String(ev.status).replace(/_/g, ' ')}
                  </p>
                  {ev.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {ev.timestamp ? formatOrderDateTime(ev.timestamp) : ''}
                    {ev.actor?.name ? ` • ${ev.actor.name}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-400">No tracking events yet — check back soon.</p>
          )}
        </div>
      </div>
    </div>
  );
}
