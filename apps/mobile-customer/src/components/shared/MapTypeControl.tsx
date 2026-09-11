import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Map layers the user can switch between on the address maps (like the Google
 * Maps app's Map / Satellite / Terrain picker).
 *
 * Mapping to react-native-maps `mapType`:
 *  - Default  -> `standard` (road map)
 *  - Satellite-> `hybrid`   (satellite imagery WITH roads + labels on top —
 *               this is what Google Maps renders for its "Satellite" layer;
 *               plain `satellite` has no labels and hurts pin reading)
 *  - Terrain  -> `terrain`  (topographic; Google Maps only — Apple Maps/MapKit
 *               has no terrain layer, so it's hidden on iOS)
 */
export type MapLayer = 'standard' | 'hybrid' | 'terrain';

export const MAP_LAYER_OPTIONS: { key: MapLayer; label: string }[] = [
  { key: 'standard', label: 'Default' },
  { key: 'hybrid', label: 'Satellite' },
  { key: 'terrain', label: 'Terrain' },
];

/** Options valid for the current platform (Terrain is Google Maps/Android only). */
export const AVAILABLE_MAP_LAYER_OPTIONS =
  Platform.OS === 'ios' ? MAP_LAYER_OPTIONS.filter(o => o.key !== 'terrain') : MAP_LAYER_OPTIONS;

interface MapTypeControlProps {
  value: MapLayer;
  onChange: (layer: MapLayer) => void;
}

export function MapTypeControl({ value, onChange }: MapTypeControlProps) {
  return (
    <View style={styles.container}>
      {AVAILABLE_MAP_LAYER_OPTIONS.map(option => {
        const active = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.segment, active && styles.segmentActive]}
            activeOpacity={0.7}
            onPress={() => onChange(option.key)}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  segmentActive: {
    backgroundColor: '#f3a823',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
});