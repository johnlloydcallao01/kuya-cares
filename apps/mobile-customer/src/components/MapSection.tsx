import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MapSectionProps {
  showMap: boolean;
  onToggleMap: () => void;
  selectedLocation: {
    lat: number;
    lng: number;
    address: string;
  } | null;
  onLocationSelect: (location: {lat: number; lng: number; address: string}) => void;
}

export default function MapSection({
  showMap,
  onToggleMap,
  selectedLocation,
  onLocationSelect
}: MapSectionProps) {
  return (
    <View style={styles.container}>
      {/* Location Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onToggleMap}
          style={styles.headerButton}
        >
          <View style={styles.locationInfo}>
            <Ionicons name="location" size={20} color="#f97316" />
            <View style={styles.locationText}>
              <Text style={styles.locationTitle}>
                Delivery Location
              </Text>
              <Text style={styles.locationAddress} numberOfLines={1}>
                {selectedLocation?.address || 'Select your location'}
              </Text>
            </View>
          </View>
          <Ionicons
            name={showMap ? "chevron-up" : "chevron-down"}
            size={20}
            color="#6B7280"
          />
        </TouchableOpacity>
      </View>

      {/* Map View (Placeholder for now) */}
      {showMap && (
        <View style={styles.mapContainer}>
          <Ionicons name="map-outline" size={48} color="#9CA3AF" />
          <Text style={styles.mapText}>Map integration coming soon</Text>
          <TouchableOpacity
            onPress={() => {
              // Placeholder location selection
              onLocationSelect({
                lat: 14.5995,
                lng: 120.9842,
                address: 'Manila, Philippines'
              });
            }}
            style={styles.locationButton}
          >
            <Text style={styles.locationButtonText}>Use Current Location</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationText: {
    marginLeft: 12,
    flex: 1,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  locationAddress: {
    fontSize: 14,
    color: '#6b7280',
  },
  mapContainer: {
    height: 256,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapText: {
    color: '#6b7280',
    marginTop: 8,
  },
  locationButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  locationButtonText: {
    color: 'white',
    fontWeight: '500',
  },
});
