import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiConfig } from '../../src/config/environment';
import { formatCurrency } from '../../src/utils/format';
import { PullToRefreshLayout } from '../../src/components/PullToRefreshLayout';

const CMS_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `users API-Key ${apiConfig.payloadApiKey}`,
};

type DeliveryBooking = {
  id: number;
  lalamove_order_id?: string | null;
  share_link?: string | null;
  service_type?: string | null;
  status?: string;
  lalamove_raw_status?: string | null;
  delivery_fee?: number | null;
  currency?: string | null;
  priority_fee?: number | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_plate_number?: string | null;
  driver_photo_url?: string | null;
  driver_lat?: number | null;
  driver_lng?: number | null;
  driver_location_updated_at?: string | null;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  distance_meters?: number | null;
};

type OrderItem = {
  id: number;
  product_name_snapshot?: string;
  price_at_purchase?: number;
  quantity?: number;
  total_price?: number;
  product?: any;
  options_snapshot?: any;
};

type DeliveryLocation = {
  id: number;
  order?: any;
  formatted_address?: string | null;
  street?: string | null;
  floor_unit_room?: string | null;
  delivery_instructions?: string | null;
  coordinates?: { lat?: number; lng?: number } | null;
  notes?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  label?: string | null;
  merchant_formatted_address?: string | null;
  merchant_street?: string | null;
  merchant_floor_unit_room?: string | null;
  merchant_delivery_instructions?: string | null;
  merchant_label?: string | null;
};

type OrderDetail = {
  id: number;
  status?: string;
  fulfillment_type?: string;
  total?: number;
  subtotal?: number;
  delivery_fee?: number;
  platform_fee?: number;
  delivery_service_type?: string;
  delivery_status?: string;
  delivery_tracking_link?: string | null;
  lalamove_order_id?: string | null;
  placed_at?: string;
  merchant?: any;
  customer?: any;
  deliveryBooking?: DeliveryBooking | null;
  deliveryLocation?: DeliveryLocation | null;
  items?: OrderItem[];
  isPaid?: boolean;
};

const STATUS_STEPS = [
  { key: 'accepted', label: 'Order Confirmed', icon: 'checkmark-circle' as const },
  { key: 'assigning_driver', label: 'Assigning Driver', icon: 'search' as const },
  { key: 'driver_assigned', label: 'On Going', icon: 'bicycle' as const },
  { key: 'picked_up', label: 'Picked Up', icon: 'navigate' as const },
  { key: 'completed', label: 'Completed', icon: 'checkmark-done-circle' as const },
];

// Old status values map onto the new Lalamove-based steps
const STATUS_ALIASES: Record<string, number> = {
  preparing: 1, // → assigning_driver
  ready_for_pickup: 2, // → driver_assigned
  on_delivery: 3, // → picked_up
  delivered: 4, // → completed
};

function getStatusColor(status: string): string {
  if (status === 'canceled' || status === 'cancelled') return '#ef4444';
  if (status === 'expired' || status === 'rejected') return '#ef4444';
  switch (status) {
    case 'pending': return '#f59e0b';
    case 'accepted': return '#3b82f6';
    case 'assigning_driver': return '#8b5cf6';
    case 'driver_assigned': return '#10b981';
    case 'picked_up': return '#06b6d4';
    case 'completed': return '#10b981';
    default: return '#6b7280';
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case 'assigning_driver': return 'Assigning Driver';
    case 'driver_assigned':  return 'On Going';
    case 'picked_up':        return 'Picked Up';
    case 'completed':        return 'Completed';
    case 'canceled':         return 'Cancelled';
    case 'rejected':         return 'Rejected';
    case 'expired':          return 'Expired';
    default:
      return status
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
  }
}

function getActiveStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  if (idx >= 0) return idx;
  return STATUS_ALIASES[status] ?? 0;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const OrderDetailSkeleton = () => {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      {/* Status Banner */}
      <View style={{
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        gap: 12,
      }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#F3F4F6' }} />
        <View style={{ flex: 1 }}>
          <View style={{ width: '40%', height: 16, borderRadius: 4, backgroundColor: '#E5E7EB', marginBottom: 8 }} />
          <View style={{ width: '55%', height: 12, borderRadius: 4, backgroundColor: '#F3F4F6' }} />
        </View>
      </View>

      {/* Status Timeline */}
      <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flexDirection: 'row' as const, alignItems: 'center' as const }}>
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: '#F3F4F6',
              marginRight: 8,
            }} />
            <View style={{ flex: 1 }}>
              <View
                style={{
                  width: i === 3 ? '50%' : '65%',
                  height: 14,
                  borderRadius: 4,
                  backgroundColor: i < 4 ? '#F3F4F6' : '#E5E7EB',
                }}
              />
            </View>
          </View>
        ))}
      </View>

      {/* Rider Section */}
      <View>
        <View style={{ width: '30%', height: 16, borderRadius: 4, backgroundColor: '#E5E7EB', marginBottom: 12 }} />
        <View style={{
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: 16,
          gap: 12,
        }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6' }} />
          <View style={{ flex: 1 }}>
            <View style={{ width: '45%', height: 16, borderRadius: 4, backgroundColor: '#E5E7EB', marginBottom: 8 }} />
            <View style={{ width: '30%', height: 12, borderRadius: 4, backgroundColor: '#F3F4F6' }} />
          </View>
        </View>
      </View>

      {/* Items Section */}
      <View>
        <View style={{ width: '30%', height: 16, borderRadius: 4, backgroundColor: '#E5E7EB', marginBottom: 12 }} />
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flexDirection: 'row' as const, alignItems: 'center' as const }}>
              <View style={{ width: 32, height: 14, borderRadius: 4, backgroundColor: '#F3F4F6', marginRight: 8 }} />
              <View style={{ flex: 1, height: 14, borderRadius: 4, backgroundColor: '#F3F4F6' }} />
            </View>
          ))}
        </View>
      </View>

      {/* Price Breakdown */}
      <View>
        <View style={{ width: '25%', height: 16, borderRadius: 4, backgroundColor: '#E5E7EB', marginBottom: 12 }} />
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const }}>
              <View style={{ width: 64, height: 14, borderRadius: 4, backgroundColor: '#F3F4F6' }} />
              <View style={{ width: 48, height: 14, borderRadius: 4, backgroundColor: '#F3F4F6' }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [showRiderInfo, setShowRiderInfo] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!id || !user?.id) return;
    try {
      const res = await fetch(
        `${apiConfig.baseUrl}/orders/aggregate?userId=${user.id}&orderId=${id}`,
        { headers: { 'Content-Type': 'application/json' } },
      );
      if (!res.ok) throw new Error('Order not found');
      const agg = await res.json();
      if (!agg) throw new Error('Order not found');

      // Map aggregation response to existing types
      let deliveryBooking: DeliveryBooking | null = null;
      if (agg.delivery) {
        const d = agg.delivery;
        deliveryBooking = {
          id: d.id,
          lalamove_order_id: d.lalamoveOrderId,
          share_link: d.shareLink,
          status: d.status,
          lalamove_raw_status: d.rawStatus,
          delivery_fee: d.deliveryFee,
          priority_fee: d.priorityFee,
          distance_meters: d.distanceMeters,
          driver_name: d.driver?.name,
          driver_phone: d.driver?.phone,
          driver_plate_number: d.driver?.plateNumber,
          driver_photo_url: d.driver?.photoUrl,
          driver_lat: d.driver?.lat,
          driver_lng: d.driver?.lng,
          driver_location_updated_at: d.driver?.locationUpdatedAt,
        };
      }

      let deliveryLocation: DeliveryLocation | null = null;
      if (agg.deliveryLocation) {
        const dl = agg.deliveryLocation;
        deliveryLocation = {
          id: dl.id,
          formatted_address: dl.formattedAddress,
          street: dl.street,
          floor_unit_room: dl.floorUnitRoom,
          delivery_instructions: dl.deliveryInstructions,
          notes: dl.notes,
          contact_name: dl.contactName,
          contact_phone: dl.contactPhone,
          label: dl.label,
          merchant_formatted_address: dl.merchantFormattedAddress,
          merchant_street: dl.merchantStreet,
          merchant_floor_unit_room: dl.merchantFloorUnitRoom,
          merchant_delivery_instructions: dl.merchantDeliveryInstructions,
        };
      }

      // Pull LIVE status from Lalamove (keeps the real-time tracking working)
      if (deliveryBooking?.lalamove_order_id) {
        try {
          const trackRes = await fetch(
            `${apiConfig.baseUrl}/delivery/track?orderId=${encodeURIComponent(id)}`,
            { headers: CMS_HEADERS },
          );
          if (trackRes.ok) {
            const trackData = await trackRes.json();
            const ds = trackData?.data?.deliveryStatus;
            const raw = trackData?.data?.lalamoveRawStatus;
            if (ds && deliveryBooking) {
              deliveryBooking = {
                ...deliveryBooking,
                status: ds,
                lalamove_raw_status: raw || deliveryBooking.lalamove_raw_status,
              };
            }
          }
        } catch (err) {
          console.warn('[OrderDetail] live Lalamove status unavailable:', err);
        }
      }

      setOrder({
        id: agg.id,
        status: agg.status,
        fulfillment_type: agg.fulfillmentType,
        total: agg.total,
        subtotal: agg.subtotal,
        delivery_fee: agg.deliveryFee,
        platform_fee: agg.platformFee,
        placed_at: agg.placedAt,
        delivery_status: deliveryBooking?.status || null,
        lalamove_order_id: agg.delivery?.lalamoveOrderId || null,
        merchant: agg.merchant,
        customer: agg.customer,
        deliveryBooking,
        deliveryLocation,
        items: (agg.items || []).map((item: any) => ({
          id: item.id,
          product_name_snapshot: item.name,
          price_at_purchase: item.price,
          quantity: item.quantity,
          total_price: item.total,
        })),
        isPaid: agg.isPaid || false,
      });
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchOrder();
    } finally {
      setRefreshing(false);
    }
  }, [fetchOrder]);

  // Poll for updates on active deliveries
  useEffect(() => {
    if (
      order?.status &&
      !['delivered', 'completed', 'canceled', 'cancelled', 'expired', 'rejected'].includes(order.status)
    ) {
      pollingRef.current = setInterval(() => {
        fetchOrder();
      }, 15000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [order?.status, fetchOrder]);

  const handleCancelOrder = useCallback(async () => {
    if (!id || canceling) return;
    setCanceling(true);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/delivery/cancel`, {
        method: 'POST',
        headers: CMS_HEADERS,
        body: JSON.stringify({ orderId: Number(id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert(
          'Cannot cancel order',
          data?.error || 'The delivery could not be cancelled.',
        );
        return;
      }
      Alert.alert(
        'Order cancelled',
        'Your delivery has been cancelled. The delivery fee was not charged.',
      );
      fetchOrder();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to cancel the order.');
    } finally {
      setCanceling(false);
    }
  }, [id, canceling, fetchOrder]);

  const confirmCancel = useCallback(() => {
    Alert.alert(
      'Cancel order?',
      'The delivery has not been matched to a rider yet, so it can still be cancelled and the delivery fee will not be charged. Continue?',
      [
        { text: 'Keep order', style: 'cancel' },
        { text: 'Cancel order', style: 'destructive', onPress: () => handleCancelOrder() },
      ],
    );
  }, [handleCancelOrder]);

  const showSkeleton = loading || refreshing;

  if (showSkeleton) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Order Details</Text>
            <View style={{ width: 32 }} />
          </View>
        </SafeAreaView>
        <PullToRefreshLayout onRefresh={handleRefresh} isRefreshing={refreshing}>
          <OrderDetailSkeleton />
        </PullToRefreshLayout>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Order Details</Text>
            <View style={{ width: 32 }} />
          </View>
        </SafeAreaView>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#9ca3af" />
          <Text style={{ marginTop: 12, color: '#6b7280', fontSize: 16 }}>
            {error || 'Order not found'}
          </Text>
          <TouchableOpacity onPress={fetchOrder} style={{ marginTop: 16 }}>
            <Text style={{ color: '#f97316', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const merchant =
    order.merchant && typeof order.merchant === 'object'
      ? order.merchant
      : null;
  const merchantPhone =
    merchant?.contactInfo?.phone || '+639000000000';
  const merchantName =
    merchant?.outletName || merchant?.vendor?.businessName || 'Restaurant';
  const merchantLogo =
    merchant?.vendor?.logo && typeof merchant.vendor.logo === 'object'
      ? merchant.vendor.logo.cloudinaryURL || merchant.vendor.logo.url
      : null;

  const delivery = order.deliveryBooking;
  const CANCELLED_DELIVERY_STATUSES = ['canceled', 'expired', 'rejected'];
  const isDeliveryCancelled =
    CANCELLED_DELIVERY_STATUSES.includes(delivery?.status || '') ||
    order.delivery_status === 'canceled' ||
    order.delivery_status === 'expired' ||
    order.status === 'cancelled' ||
    order.status === 'canceled';
  const deliveryCancelledTitle =
    delivery?.status === 'expired' || order.delivery_status === 'expired'
      ? 'Delivery Expired — No Rider Found'
      : 'Delivery Cancelled';
  const deliveryCancelledNote =
    delivery?.status === 'rejected'
      ? 'A rider was matched but could not accept this delivery. We’ll stop trying and this delivery won’t be completed.'
      : delivery?.status === 'expired' || order.delivery_status === 'expired'
        ? 'No rider accepted this delivery in time. This delivery was not completed.'
        : 'This delivery could not be completed. Your order will not be delivered by a Tap2Go rider.';
  const activeIdx = getActiveStepIndex(
    delivery?.status || order.delivery_status || order.status || 'pending',
  );
  const deliveryFee = order.delivery_fee || delivery?.delivery_fee || 0;
  const priorityFee = delivery?.priority_fee || 0;
  const platformFee = order.platform_fee || 0;

  // ── Rider-view info (mirrors what deliveryBook.ts sends to Lalamove) ────────
  const customerUser =
    order.customer?.user && typeof order.customer.user === 'object'
      ? order.customer.user
      : null;
  // Sender = merchant (pickup)
  const senderName = merchantName;
  const senderPhone = merchantPhone;
  const deliveryLocation = order.deliveryLocation;
  // Recipient = customer (dropoff)
  const recipientName = deliveryLocation?.contact_name ||
    [customerUser?.firstName, customerUser?.lastName].filter(Boolean).join(' ') ||
    (order.customer?.email ? order.customer.email : 'Tap2Go Customer');
  const recipientPhone = deliveryLocation?.contact_phone || customerUser?.phone || '+639000000000';
  const notesForRider = [
    deliveryLocation?.merchant_delivery_instructions,
    deliveryLocation?.delivery_instructions,
    deliveryLocation?.notes,
  ].filter(Boolean).join(' | ') || '';
  const pickupAddress = [
    deliveryLocation?.merchant_street,
    deliveryLocation?.merchant_floor_unit_room,
    deliveryLocation?.merchant_formatted_address ||
    delivery?.pickup_address ||
    'Merchant Location',
  ].filter(Boolean).join(', ');
  const isPlaceholder = (v?: string | null) =>
    !v || /unknown address|delivery location/i.test(String(v).trim());
  const dropoffAddress = [
    deliveryLocation?.street,
    deliveryLocation?.floor_unit_room,
    deliveryLocation?.formatted_address ||
    (delivery?.dropoff_address && !isPlaceholder(delivery.dropoff_address)
      ? delivery.dropoff_address
      : undefined),
  ].filter(Boolean).join(', ') || 'Delivery Location';

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#374151" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            {merchantLogo ? (
              <Image source={{ uri: merchantLogo }} style={styles.merchantLogo} />
            ) : (
              <View style={styles.merchantLogoPlaceholder}>
                <Ionicons name="storefront" size={14} color="#6B7280" />
              </View>
            )}
            <View>
              <Text style={styles.merchantNameText} numberOfLines={1}>
                {merchantName}
              </Text>
              <Text style={styles.subtitleText}>
                #{String(order.id).padStart(5, '0')}
              </Text>
            </View>
          </View>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>

      <PullToRefreshLayout
        onRefresh={handleRefresh}
        isRefreshing={refreshing}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Status Banner */}
        <View
          style={[
            styles.statusBanner,
            { borderLeftColor: getStatusColor(isDeliveryCancelled
              ? 'canceled'
              : (order.status === 'pending' || order.status === 'accepted')
                ? (order.isPaid ? 'accepted' : 'pending')
                : (delivery?.status || order.delivery_status || order.status || 'pending')) },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(isDeliveryCancelled
                ? 'canceled'
                : (order.status === 'pending' || order.status === 'accepted')
                  ? (order.isPaid ? 'accepted' : 'pending')
                  : (delivery?.status || order.delivery_status || order.status || 'pending')) },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusText}>
              {isDeliveryCancelled
                ? deliveryCancelledTitle
                : (order.status === 'pending' || order.status === 'accepted')
                  ? (order.isPaid ? 'Accepted' : 'Pending')
                  : formatStatus(delivery?.status || order.delivery_status || order.status || 'pending')}
            </Text>
            {order.placed_at && (
              <Text style={styles.dateText}>{formatDate(order.placed_at)}</Text>
            )}
            {order.isPaid && (
              <View style={{ flexDirection: 'row', marginTop: 6 }}>
                <View style={{
                  backgroundColor: '#10b9811A',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                }}>
                  <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '700' }}>
                    Paid
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Priority notice */}
        {order.fulfillment_type === 'delivery' && priorityFee > 0 && (
          <View style={styles.priorityBanner}>
            <Ionicons name="flash" size={15} color="#fff" />
            <Text style={styles.priorityBannerText}>
              Priority Delivery — with a ₱{priorityFee} fee, rider matching is
              boosted for faster pickup.
            </Text>
          </View>
        )}

        {/* Status Timeline */}
        {isDeliveryCancelled ? (
          <View style={styles.cancelledCard}>
            <View style={styles.cancelledIcon}>
              <Ionicons name="close-circle" size={22} color="#ef4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cancelledTitle}>{deliveryCancelledTitle}</Text>
              <Text style={styles.cancelledNote}>{deliveryCancelledNote}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.timelineCard}>
          {STATUS_STEPS.map((step, idx) => {
            const isActive = idx <= activeIdx;
            const isCurrent = idx === activeIdx;
            return (
              <View key={step.key} style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.timelineDot,
                      isActive && { backgroundColor: '#f97316' },
                      isCurrent && styles.timelineDotCurrent,
                    ]}
                  >
                    <Ionicons
                      name={step.icon}
                      size={12}
                      color={isActive ? '#fff' : '#d1d5db'}
                    />
                  </View>
                  {idx < STATUS_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        isActive && { backgroundColor: '#f97316' },
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.timelineLabel,
                    isActive && { color: '#111827', fontWeight: isCurrent ? '700' : '500' },
                  ]}
                >
                  {idx === 0 ? (order.isPaid ? 'Accepted' : 'Pending') : step.label}
                </Text>
              </View>
            );
          })}
          </View>
        )}

        {/* Rider Details */}
        {delivery?.driver_name && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Rider</Text>
            <View style={styles.riderCard}>
              {delivery.driver_photo_url ? (
                <Image
                  source={{ uri: delivery.driver_photo_url }}
                  style={styles.riderAvatar}
                />
              ) : (
                <View style={styles.riderAvatarPlaceholder}>
                  <Ionicons name="person" size={24} color="#9ca3af" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.riderName}>{delivery.driver_name}</Text>
                {delivery.driver_plate_number && (
                  <Text style={styles.riderPlate}>
                    {delivery.driver_plate_number}
                  </Text>
                )}
                {delivery.driver_phone && (
                  <TouchableOpacity
                    onPress={() =>
                      Linking.openURL(`tel:${delivery.driver_phone}`)
                    }
                  >
                    <Text style={styles.riderCall}>Call rider</Text>
                  </TouchableOpacity>
                )}
              </View>
              {delivery.share_link && (
                <TouchableOpacity
                  style={styles.trackBtn}
                  onPress={() =>
                    router.push({ pathname: '/order/[id]/track', params: { id: String(id) } })
                  }
                >
                  <Ionicons name="navigate-outline" size={16} color="#fff" />
                  <Text style={styles.trackBtnText}>Track</Text>
                </TouchableOpacity>
              )}
            </View>
            {delivery.status && (
              <View style={styles.deliveryStatusRow}>
                <Text style={styles.deliveryStatusLabel}>Delivery status:</Text>
                <Text style={styles.deliveryStatusValue}>
                  {formatStatus(delivery.status)}
                </Text>
              </View>
            )}
            {delivery.distance_meters && (
              <Text style={styles.distanceText}>
                {(delivery.distance_meters / 1000).toFixed(1)} km
              </Text>
            )}
          </View>
        )}

        {/* Delivery tracking (in-app tracking screen) */}
        {!isDeliveryCancelled && !delivery?.driver_name && delivery?.share_link && delivery && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.trackLinkCard}
              onPress={() =>
                router.push({ pathname: '/order/[id]/track', params: { id: String(id) } })
              }
            >
              <Ionicons name="navigate-outline" size={18} color="#f97316" />
              <Text style={styles.trackLinkText}>Track delivery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Information Sent to Rider */}
        {order.fulfillment_type === 'delivery' && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.riderInfoCard}
              onPress={() => setShowRiderInfo(true)}
              activeOpacity={0.7}
            >
              <View style={styles.riderInfoIcon}>
                <Ionicons name="walk" size={18} color="#f97316" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.riderInfoTitle}>Information Sent to Rider</Text>
                <Text style={styles.riderInfoSubtitle}>
                  What the rider sees when the delivery is booked
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        )}

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.itemsCard}>
            {(order.items || []).map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemQty}>{item.quantity}x</Text>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.product_name_snapshot || 'Item'}
                </Text>
                <Text style={styles.itemPrice}>
                  {formatCurrency(item.total_price || item.price_at_purchase || 0)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Price Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Total</Text>
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Subtotal</Text>
              <Text style={styles.priceValue}>
                {formatCurrency(order.subtotal || 0)}
              </Text>
            </View>
            {deliveryFee > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Delivery Fee</Text>
                <Text style={styles.priceValue}>
                  {formatCurrency(deliveryFee)}
                </Text>
              </View>
            )}
            {priorityFee > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Priority Fee</Text>
                <Text style={styles.priceValue}>
                  {formatCurrency(priorityFee)}
                </Text>
              </View>
            )}
            {platformFee > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Platform Fee</Text>
                <Text style={styles.priceValue}>
                  {formatCurrency(platformFee)}
                </Text>
              </View>
            )}
            <View style={styles.priceRowTotal}>
              <Text style={styles.priceTotalLabel}>Total</Text>
              <Text style={styles.priceTotalValue}>
                {formatCurrency(order.total || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Cancel delivery */}
        {order.fulfillment_type === 'delivery' &&
          order.status !== 'cancelled' &&
          order.status !== 'canceled' &&
          (order.delivery_status === 'assigning_driver' ||
            order.delivery_status === 'pending' ||
            order.delivery_status === 'none') && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={confirmCancel}
                disabled={canceling}
                activeOpacity={0.7}
              >
                {canceling ? (
                  <ActivityIndicator color="#ef4444" />
                ) : (
                  <Text style={styles.cancelButtonText}>Cancel Order</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.cancelHint}>
                Cancellation is available while we are still finding a rider. Once a rider is
                matched, it can no longer be cancelled.
              </Text>
            </View>
          )}

        <View style={{ height: 40 }} />
      </PullToRefreshLayout>

      {/* Rider View Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={showRiderInfo}
        onRequestClose={() => setShowRiderInfo(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Information Sent to Rider</Text>
              <TouchableOpacity
                onPress={() => setShowRiderInfo(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              This is what is shared with the delivery rider when your delivery is
              booked.
            </Text>

            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Sender */}
              <View style={styles.infoGroup}>
                <Text style={styles.infoGroupTitle}>Sender (Pickup)</Text>
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={16} color="#6b7280" />
                  <Text style={styles.infoValue}>{senderName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={16} color="#6b7280" />
                  <Text style={styles.infoValue}>{senderPhone}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color="#6b7280" />
                  <Text style={styles.infoValue}>{pickupAddress}</Text>
                </View>
                {deliveryLocation?.merchant_street ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="navigate-outline" size={16} color="#6b7280" />
                    <Text style={styles.infoValue}>{deliveryLocation.merchant_street}</Text>
                  </View>
                ) : null}
                {deliveryLocation?.merchant_floor_unit_room ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="business-outline" size={16} color="#6b7280" />
                    <Text style={styles.infoValue}>{deliveryLocation.merchant_floor_unit_room}</Text>
                  </View>
                ) : null}
                {deliveryLocation?.merchant_delivery_instructions ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="clipboard-outline" size={16} color="#6b7280" />
                    <Text style={styles.infoValue}>{deliveryLocation.merchant_delivery_instructions}</Text>
                  </View>
                ) : null}
              </View>

              {/* Recipient */}
              <View style={styles.infoGroup}>
                <Text style={styles.infoGroupTitle}>Recipient (Dropoff)</Text>
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={16} color="#6b7280" />
                  <Text style={styles.infoValue}>{recipientName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={16} color="#6b7280" />
                  <Text style={styles.infoValue}>{recipientPhone}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color="#6b7280" />
                  <Text style={styles.infoValue}>{dropoffAddress}</Text>
                </View>
              </View>

              {/* Delivery Info */}
              {(deliveryLocation?.street ||
                deliveryLocation?.floor_unit_room ||
                deliveryLocation?.delivery_instructions) ? (
                <View style={styles.infoGroup}>
                  <Text style={styles.infoGroupTitle}>Delivery Info</Text>
                  {deliveryLocation?.street ? (
                    <View style={styles.infoRow}>
                      <Ionicons name="navigate-outline" size={16} color="#6b7280" />
                      <Text style={styles.infoValue}>{deliveryLocation.street}</Text>
                    </View>
                  ) : null}
                  {deliveryLocation?.floor_unit_room ? (
                    <View style={styles.infoRow}>
                      <Ionicons name="business-outline" size={16} color="#6b7280" />
                      <Text style={styles.infoValue}>{deliveryLocation.floor_unit_room}</Text>
                    </View>
                  ) : null}
                  {deliveryLocation?.delivery_instructions ? (
                    <View style={styles.infoRow}>
                      <Ionicons name="clipboard-outline" size={16} color="#6b7280" />
                      <Text style={styles.infoValue}>{deliveryLocation.delivery_instructions}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Notes */}
              <View style={styles.infoGroup}>
                <Text style={styles.infoGroupTitle}>Delivery Notes</Text>
                <View style={styles.infoRow}>
                  <Ionicons name="document-text-outline" size={16} color="#6b7280" />
                  <Text style={styles.infoValue}>
                    {notesForRider || 'No notes provided'}
                  </Text>
                </View>
              </View>

              {/* Vehicle */}
              <View style={styles.infoGroup}>
                <Text style={styles.infoGroupTitle}>Vehicle</Text>
                <View style={styles.infoRow}>
                  <Ionicons name="bicycle-outline" size={16} color="#6b7280" />
                  <Text style={styles.infoValue}>
                    {delivery?.service_type || ''}
                  </Text>
                </View>
              </View>

              {delivery?.distance_meters ? (
                <View style={styles.infoGroup}>
                  <Text style={styles.infoGroupTitle}>Distance</Text>
                  <View style={styles.infoRow}>
                    <Ionicons name="map-outline" size={16} color="#6b7280" />
                    <Text style={styles.infoValue}>
                      {(delivery.distance_meters / 1000).toFixed(1)} km
                    </Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalDoneBtn}
                onPress={() => setShowRiderInfo(false)}
              >
                <Text style={styles.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTitle: { flex: 1, textAlign: 'center' as const, fontSize: 16, fontWeight: '600' as const, color: '#111827' },
  headerCenter: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  merchantLogo: { width: 28, height: 28, borderRadius: 14 },
  merchantLogoPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  merchantNameText: { fontSize: 13, fontWeight: '600' as const, color: '#111827' },
  subtitleText: { fontSize: 11, color: '#6B7280' },
  scrollContent: { padding: 16, gap: 16 },
  statusBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    gap: 12,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 16, fontWeight: '700' as const, color: '#111827' },
  dateText: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  priorityBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#f97316',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  priorityBannerText: { fontSize: 13, color: '#fff', fontWeight: '600' as const, flex: 1 },
  timelineCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  timelineRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const },
  timelineLeft: { width: 28, alignItems: 'center' as const },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  timelineDotCurrent: { width: 28, height: 28, borderRadius: 14 },
  timelineLine: { width: 2, height: 24, backgroundColor: '#e5e7eb', marginTop: 4 },
  timelineLabel: { fontSize: 14, color: '#9ca3af', marginLeft: 8, marginBottom: 8 },
  cancelledCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cancelledIcon: { width: 24, alignItems: 'center' as const, marginTop: 1 },
  cancelledTitle: { fontSize: 15, fontWeight: '700' as const, color: '#ef4444' },
  cancelledNote: { fontSize: 13, color: '#7f1d1d', marginTop: 4, lineHeight: 19 },
  section: { marginBottom: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '600' as const, color: '#111827', marginBottom: 12 },
  riderCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  riderAvatar: { width: 48, height: 48, borderRadius: 24 },
  riderAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  riderName: { fontSize: 16, fontWeight: '600' as const, color: '#111827' },
  riderPlate: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  riderCall: { fontSize: 13, color: '#f97316', fontWeight: '600' as const, marginTop: 2 },
  trackBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#f97316',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  trackBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' as const },
  deliveryStatusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  deliveryStatusLabel: { fontSize: 13, color: '#6b7280' },
  deliveryStatusValue: { fontSize: 13, fontWeight: '600' as const, color: '#111827', marginLeft: 6 },
  distanceText: { fontSize: 12, color: '#9ca3af', marginTop: 4, paddingHorizontal: 4 },
  trackLinkCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  trackLinkText: { fontSize: 14, color: '#f97316', fontWeight: '600' as const },
  itemsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  itemQty: { fontSize: 14, fontWeight: '500' as const, color: '#374151', width: 32 },
  itemName: { fontSize: 14, color: '#111827', flex: 1 },
  itemPrice: { fontSize: 14, fontWeight: '600' as const, color: '#111827', marginLeft: 8 },
  priceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  priceRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  priceLabel: { fontSize: 14, color: '#6b7280' },
  priceValue: { fontSize: 14, color: '#111827' },
  priceRowTotal: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
    marginTop: 4,
  },
  priceTotalLabel: { fontSize: 16, fontWeight: '700' as const, color: '#111827' },
  priceTotalValue: { fontSize: 16, fontWeight: '700' as const, color: '#111827' },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  cancelButtonText: { fontSize: 15, fontWeight: '600' as const, color: '#ef4444' },
  cancelHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center' as const,
    lineHeight: 17,
  },
  riderInfoCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  riderInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  riderInfoTitle: { fontSize: 15, fontWeight: '600' as const, color: '#111827' },
  riderInfoSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    justifyContent: 'flex-end' as const,
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    maxHeight: '80%' as any,
  },
  modalHandle: {
    alignSelf: 'center' as const,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
  },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '700' as const, color: '#111827' },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  modalContent: { padding: 20, gap: 20 },
  infoGroup: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  infoGroupTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#f97316',
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  infoValue: { fontSize: 15, color: '#111827', flex: 1, lineHeight: 21 },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  modalDoneBtn: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  modalDoneText: { color: '#fff', fontSize: 15, fontWeight: '600' as const },
};
