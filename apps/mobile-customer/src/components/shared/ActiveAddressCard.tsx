import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

interface ActiveAddressCardProps {
  address: any;
  onDelete: (id: string) => void;
  onEdit?: (address: any) => void;
  isDeleting?: boolean;
}

const FALLBACK_COORDS = { latitude: 14.5995, longitude: 120.9842 };

export function ActiveAddressCard({ address, onDelete, onEdit, isDeleting }: ActiveAddressCardProps) {
  const lat = address?.latitude != null ? Number(address.latitude) : null;
  const lng = address?.longitude != null ? Number(address.longitude) : null;

  const region = {
    latitude: lat ?? FALLBACK_COORDS.latitude,
    longitude: lng ?? FALLBACK_COORDS.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const addressText = address?.formatted_address
    || address?.formattedAddress
    || 'Address';

  return (
    <View style={styles.card}>
      {/* ── Map preview (rectangular, pin marker) ── */}
      <View style={styles.mapWrap}>
        {lat != null && lng != null ? (
          <MapView
            style={styles.map}
            initialRegion={region}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            toolbarEnabled={false}
            loadingEnabled
            loadingBackgroundColor="#E5E7EB"
            pointerEvents="none"
          >
            <Marker coordinate={{ latitude: lat, longitude: lng }} pinColor="#f3a823" />
          </MapView>
        ) : (
          <View style={[styles.map, styles.mapFallback]}>
            <Ionicons name="map-outline" size={28} color="#C7CBD1" />
          </View>
        )}

        <View style={styles.activePill}>
          <Ionicons name="checkmark-circle" size={14} color="#fff" />
          <Text style={styles.activePillText}>Active Address</Text>
        </View>
      </View>

      {/* ── Address below ── */}
      <View style={styles.body}>
        <View style={[styles.radio, styles.radioActive]}>
          <View style={styles.radioDot} />
        </View>

        <View style={styles.info}>
          <Text style={styles.addressText} numberOfLines={3}>
            {addressText}
          </Text>
          {!!address?.address_type && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{address.address_type}</Text>
            </View>
          )}
        </View>
      </View>

{/* ── Actions ── */}
      <View style={styles.footer}>
        {onEdit && (
          <TouchableOpacity
            style={styles.editIconButton}
            onPress={() => onEdit(address)}
            disabled={isDeleting}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="pencil-outline" size={20} color="#374151" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.deleteIconButton}
          onPress={() => onDelete(address?.id)}
          disabled={isDeleting}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <Ionicons name="trash-outline" size={22} color="#DC2626" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3a823',
    overflow: 'hidden',
    marginBottom: 12,
  },
  mapWrap: {
    height: 140,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapFallback: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3a823',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    paddingBottom: 4,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  radioActive: {
    borderColor: '#f3a823',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f3a823',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  addressText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 22,
    marginBottom: 8,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef7e6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  typeBadgeText: {
    color: '#9a5f0f',
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  editIconButton: {
    padding: 4,
  },
  deleteIconButton: {
    padding: 4,
  },
});