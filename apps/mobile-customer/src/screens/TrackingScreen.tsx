import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { apiConfig } from '../config/environment';
import MapView, { Marker, Polyline } from 'react-native-maps';

const CMS_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `users API-Key ${apiConfig.payloadApiKey}`,
};

type LatLng = {
  latitude: number;
  longitude: number;
};

type TrackedDriver = {
  driverId: string | null;
  name: string | null;
  phone: string | null;
  plateNumber: string | null;
  photoUrl: string | null;
  lat: number | null;
  lng: number | null;
  locationUpdatedAt: string | null;
};

type StopInfo = {
  lat: number | null;
  lng: number | null;
  address: string | null;
};

type TrackingData = {
  orderId: number;
  deliveryStatus: string;
  lalamoveRawStatus?: string | null;
  driver: TrackedDriver;
  pickup: StopInfo;
  dropoff: StopInfo;
  distanceMeters: number | null;
  priorityFee?: number | null;
  shareLink: string | null;
};

function statusLabel(status: string): string {
  switch (status) {
    case 'assigning_driver':
      return 'Finding your rider';
    case 'driver_assigned':
      return 'Rider is on the way to pickup';
    case 'picked_up':
      return 'Order picked up — heading to you';
    case 'completed':
      return 'Delivered';
    case 'canceled':
      return 'Cancelled';
    case 'expired':
      return 'Cancelled';
    case 'rejected':
      return 'Re-matching rider';
    default:
      return 'Preparing your delivery';
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'picked_up':
      return '#06b6d4';
    case 'completed':
      return '#10b981';
    case 'canceled':
    case 'expired':
      return '#ef4444';
    case 'driver_assigned':
      return '#f59e0b';
    default:
      return '#8b5cf6';
  }
}

function formatTimeAgo(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 15) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

/** Compute a region that frames every given point (plus padding). */
function regionFraming(points: LatLng[], fallback: LatLng): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} {
  const pts = points.filter(
    (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
  );
  if (pts.length === 0) {
    return {
      latitude: fallback.latitude,
      longitude: fallback.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  const lats = pts.map((p) => p.latitude);
  const lngs = pts.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: (latSpan || 0.01) * 1.4,
    longitudeDelta: (lngSpan || 0.01) * 1.4,
  };
}

export default function TrackingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTracking = useCallback(async () => {
    if (!id || !user?.id) return;
    try {
      const res = await fetch(
        `${apiConfig.baseUrl}/delivery/track?orderId=${encodeURIComponent(id)}`,
        { headers: CMS_HEADERS },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to load tracking');
      }
      const body = await res.json();
      if (mounted.current) {
        setData(body?.data || null);
        setError(null);
      }
    } catch (err: any) {
      if (mounted.current) {
        // Only surface errors on the very first load; subsequent poll failures
        // keep showing the last-good snapshot.
        setError((prev) => (prev === null ? (err?.message || 'Failed to load tracking') : prev));
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [id, user?.id]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  // Poll every 10s while active; stop when delivered/cancelled
  useEffect(() => {
    if (!id || !user?.id) return;

    const isTerminal = data?.deliveryStatus === 'completed'
      || data?.deliveryStatus === 'canceled'
      || data?.deliveryStatus === 'expired';

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isTerminal) {
      intervalRef.current = setInterval(() => {
        fetchTracking();
      }, 10000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [id, user?.id, data?.deliveryStatus, fetchTracking]);

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={styles.loadingText}>Loading your delivery…</Text>
        </View>
      );
    }

    if (error || !data) {
      return (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#9ca3af" />
          <Text style={styles.centerText}>
            {error || 'Tracking information is not available yet.'}
          </Text>
          <TouchableOpacity onPress={() => { setError(null); setLoading(true); fetchTracking(); }} style={{ marginTop: 12 }}>
            <Text style={{ color: '#f97316', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const driver = data.driver;
    const hasDriver = !!(driver?.lat && driver?.lng);
    const pickup = data.pickup;
    const dropoff = data.dropoff;

    const pts: LatLng[] = [];
    if (pickup.lat != null && pickup.lng != null) {
      pts.push({ latitude: pickup.lat, longitude: pickup.lng });
    }
    if (dropoff.lat != null && dropoff.lng != null) {
      pts.push({ latitude: dropoff.lat, longitude: dropoff.lng });
    }
    if (hasDriver) {
      pts.push({ latitude: Number(driver.lat), longitude: Number(driver.lng) });
    }

    const initialRegion = regionFraming(pts.length ? pts : [
      { latitude: 14.5995, longitude: 120.9842 },
    ], { latitude: 14.5995, longitude: 120.9842 });

    const route = [pickup, dropoff].filter(
      (s) => s.lat != null && s.lng != null,
    );

    return (
      <View style={styles.mapContainer}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsCompass
          showsScale
          loadingEnabled
          loadingBackgroundColor="#f9fafb"
          loadingIndicatorColor="#f97316"
        >
          {pickup.lat != null && pickup.lng != null && (
            <Marker
              coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
              title="Restaurant"
              description={pickup.address || 'Pickup'}
            >
              <View style={styles.stopMarker}>
                <Ionicons name="storefront" size={16} color="#fff" />
              </View>
            </Marker>
          )}

          {dropoff.lat != null && dropoff.lng != null && (
            <Marker
              coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }}
              title="Delivery"
              description={dropoff.address || 'Dropoff'}
            >
              <View style={[styles.stopMarker, { backgroundColor: '#3b82f6' }]}>
                <Ionicons name="home" size={16} color="#fff" />
              </View>
            </Marker>
          )}

          {hasDriver && (
            <Marker
              coordinate={{ latitude: Number(driver.lat), longitude: Number(driver.lng) }}
              title={driver.name || 'Your rider'}
              description={driver.plateNumber || undefined}
            >
              <View style={styles.driverMarker}>
                <Ionicons name="bicycle" size={18} color="#fff" />
              </View>
            </Marker>
          )}

          {route.length === 2 && (
            <Polyline
              coordinates={route.map((s) => ({
                latitude: Number(s.lat),
                longitude: Number(s.lng),
              }))}
              strokeColor="#f97316"
              strokeWidth={3}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>

        {/* Status pill overlay */}
        <View style={styles.statusPillRow}>
          <View style={styles.statusPill}>
            <View style={[styles.statusPillDot, { backgroundColor: statusColor(data.deliveryStatus) }]} />
            <Text style={styles.statusPillText}>{statusLabel(data.deliveryStatus)}</Text>
          </View>
          {data.priorityFee != null && data.priorityFee > 0 && (
            <View style={styles.priorityPill}>
              <Ionicons name="flash" size={11} color="#fff" />
              <Text style={styles.priorityPillText}>Priority</Text>
            </View>
          )}
        </View>

        {/* Bottom card */}
        <View style={styles.bottomCard}>
          {hasDriver ? (
            <>
              <View style={styles.driverRow}>
                {driver.photoUrl ? (
                  <Image source={{ uri: driver.photoUrl }} style={styles.driverAvatar} />
                ) : (
                  <View style={styles.driverAvatarPlaceholder}>
                    <Ionicons name="person" size={22} color="#9ca3af" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{driver.name || 'Your rider'}</Text>
                  {driver.plateNumber ? (
                    <Text style={styles.driverPlate}>{driver.plateNumber}</Text>
                  ) : null}
                  {driver.locationUpdatedAt ? (
                    <Text style={styles.updatedAt}>
                      Updated {formatTimeAgo(driver.locationUpdatedAt)}
                    </Text>
                  ) : null}
                </View>
                {driver.phone ? (
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() => Linking.openURL(`tel:${driver.phone}`)}
                  >
                    <Ionicons name="call" size={16} color="#fff" />
                    <Text style={styles.callBtnText}>Call</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          ) : (
            <View style={styles.noDriverRow}>
              <Ionicons name="search" size={20} color="#8b5cf6" />
              <Text style={styles.noDriverText}>Looking for a rider…</Text>
              <ActivityIndicator size="small" color="#8b5cf6" style={{ marginLeft: 8 }} />
            </View>
          )}

          {(data.distanceMeters != null && data.distanceMeters > 0) && (
            <Text style={styles.distanceText}>
              {(data.distanceMeters / 1000).toFixed(1)} km delivery
            </Text>
          )}

          <View style={styles.addressBlock}>
            <View style={styles.addressRow}>
              <View style={[styles.addressDot, { backgroundColor: '#f97316' }]} />
              <Text style={styles.addressText} numberOfLines={1}>
                {pickup.address || 'Restaurant'}
              </Text>
            </View>
            <View style={styles.addressRow}>
              <View style={[styles.addressDot, { backgroundColor: '#3b82f6' }]} />
              <Text style={styles.addressText} numberOfLines={1}>
                {dropoff.address || 'Your location'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Track Delivery</Text>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 24 },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 15 },
  centerText: { marginTop: 12, color: '#6b7280', fontSize: 16, textAlign: 'center' as const, lineHeight: 23 },
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
  mapContainer: { flex: 1, position: 'relative' as const },
  stopMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f97316',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: '#fff',
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111827',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: '#fff',
  },
  statusPillRow: {
    position: 'absolute' as const,
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    zIndex: 2,
  },
  statusPill: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  priorityPill: {
    backgroundColor: '#f97316',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  priorityPillText: { fontSize: 13, fontWeight: '700' as const, color: '#fff' },
  statusPillText: { fontSize: 14, fontWeight: '600' as const, color: '#111827' },
  statusPillDot: { width: 8, height: 8, borderRadius: 4 },
  bottomCard: {
    position: 'absolute' as const,
    left: 12,
    right: 12,
    bottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  driverRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6' },
  driverAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  driverName: { fontSize: 16, fontWeight: '600' as const, color: '#111827' },
  driverPlate: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  updatedAt: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  callBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#f97316',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  callBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' as const },
  noDriverRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  noDriverText: { fontSize: 15, color: '#6b7280', flex: 1 },
  distanceText: { fontSize: 13, color: '#6b7280', marginTop: 10 },
  addressBlock: { marginTop: 12, gap: 6 },
  addressRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  addressDot: { width: 8, height: 8, borderRadius: 4 },
  addressText: { fontSize: 13, color: '#6b7280', flex: 1 },
});