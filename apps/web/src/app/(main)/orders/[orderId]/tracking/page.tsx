'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import Image from '@/components/ui/ImageWrapper';
import OrderHeader from '@/components/orders/OrderHeader';
import { TrackingPageSkeleton } from '@/components/skeletons/OrdersSkeleton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || '1331d981-b6b7-4ff5-aab6-b9ddbb0c63ae';
const MAPS_API_KEY = process.env.NEXT_PUBLIC_MAPS_BACKEND_KEY || '';

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

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: MAPS_API_KEY,
  });

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      try {
        const headers = {
          Authorization: `users API-Key ${API_KEY}`,
          'Content-Type': 'application/json',
        };

        // 1. Fetch Order
        const orderRes = await fetch(`${API_URL}/orders/${orderId}?depth=3`, { headers, cache: 'no-store' });
        if (!orderRes.ok) throw new Error('Failed to fetch order');
        const order = await orderRes.json();

        // 2. Fetch Tracking Events
        const trackingRes = await fetch(
          `${API_URL}/order-tracking?where[order][equals]=${orderId}&sort=-timestamp&depth=1`,
          { headers, cache: 'no-store' }
        );
        const trackingData = await trackingRes.json();

        // 3. Fetch Delivery Location
        const locRes = await fetch(
          `${API_URL}/delivery-locations?where[order][equals]=${orderId}&depth=1`,
          { headers, cache: 'no-store' }
        );
        const locData = await locRes.json();
        const deliveryLocationDoc = locData.docs?.[0];

        // 4. Fetch Driver Assignment
        const driverRes = await fetch(
          `${API_URL}/driver-assignments?where[order][equals]=${orderId}&where[status][equals]=accepted&depth=2`,
          { headers, cache: 'no-store' }
        );
        const driverData = await driverRes.json();
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

        if (active) {
          const placedAt = order.placed_at ? new Date(order.placed_at) : null;
          
          setData({
            orderId: order.id,
            orderNumber: `#${String(order.id).padStart(5, '0')}`,
            placedAt: placedAt
            ? placedAt.toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : '',
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
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [orderId]);

  if (loading) {
    return <TrackingPageSkeleton />;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Tracking information not available.</div>
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
      
      {/* Bottom Content Area (Placeholder) */}
      <div className="flex-1 bg-white p-4">
        {/* Future status card/driver info will go here */}
      </div>
    </div>
  );
}
