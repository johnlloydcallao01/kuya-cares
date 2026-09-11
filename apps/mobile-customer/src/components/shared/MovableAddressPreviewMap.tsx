import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { MapLayer, MapTypeControl } from './MapTypeControl';

interface MovableAddressPreviewMapProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onChange?: (lat: number, lng: number) => void;
}

const DEFAULTS = { latitude: 14.5995, longitude: 120.9842 };
const PIN_SIZE = 42;
const MAP_HEIGHT = 240;

export function MovableAddressPreviewMap({
  initialLat,
  initialLng,
  onChange,
}: MovableAddressPreviewMapProps) {
  const lat = typeof initialLat === 'number' && !Number.isNaN(initialLat)
    ? initialLat
    : DEFAULTS.latitude;
  const lng = typeof initialLng === 'number' && !Number.isNaN(initialLng)
    ? initialLng
    : DEFAULTS.longitude;

  const initialRegion = useMemo(
    () => ({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }),
    [lat, lng],
  );

  const [mapLayer, setMapLayer] = useState<MapLayer>('standard');

  const handleRegionChangeComplete = (region: Region) => {
    onChange?.(region.latitude, region.longitude);
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        mapType={mapLayer}
        initialRegion={initialRegion}
        scrollEnabled
        zoomEnabled
        pitchEnabled={false}
        rotateEnabled={false}
        showsScale
        loadingEnabled
        loadingBackgroundColor="#F9FAFB"
        onRegionChangeComplete={handleRegionChangeComplete}
      />

      {/* Center pin marker — the tip sits on the map's center coordinate */}
      <View style={styles.pinWrap} pointerEvents="none">
        <Ionicons name="location" size={PIN_SIZE} color="#f3a823" />
      </View>

      <View style={styles.hintPill} pointerEvents="none">
        <Ionicons name="finger-print-outline" size={14} color="#fff" />
        <Ionicons name="swap-horizontal" size={14} color="#fff" />
        <Ionicons name="location" size={13} color="#fff" />
      </View>

      <MapTypeControl value={mapLayer} onChange={setMapLayer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: MAP_HEIGHT,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  map: {
    flex: 1,
  },
  pinWrap: {
    position: 'absolute',
    top: MAP_HEIGHT / 2 - PIN_SIZE * 0.85,
    left: 0,
    right: 0,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  hintPill: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
});