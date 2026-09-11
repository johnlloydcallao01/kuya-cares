import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Temporary type until shared-types is working
interface Restaurant {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  cuisine: string[];
  rating?: number;
  deliveryTime?: string;
  deliveryFee?: number;
  minimumOrder?: number;
  distance?: number;
  isOpen: boolean;
  isOpenNow?: boolean;
  nextOpeningAt?: string | null;
}

interface RestaurantCardProps {
  restaurant: Restaurant;
  onPress?: () => void;
}

export default function RestaurantCard({ restaurant, onPress }: RestaurantCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.container}
    >
      {/* Restaurant Image */}
      <View style={styles.imageContainer}>
        {restaurant.imageUrl ? (
          <Image
            source={{ uri: restaurant.imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="restaurant-outline" size={48} color="#9CA3AF" />
          </View>
        )}
      </View>

      {/* Restaurant Info */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <View style={styles.rating}>
            <Ionicons name="star" size={16} color="#F59E0B" />
            <Text style={styles.ratingText}>
              {restaurant.rating?.toFixed(1) || 'New'}
            </Text>
          </View>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {restaurant.description}
        </Text>

        {/* Cuisine Tags */}
        <View style={styles.cuisineContainer}>
          {restaurant.cuisine.slice(0, 3).map((cuisine, index) => (
            <View key={index} style={styles.cuisineTag}>
              <Text style={styles.cuisineText}>{cuisine}</Text>
            </View>
          ))}
          {restaurant.cuisine.length > 3 && (
            <View style={styles.cuisineTag}>
              <Text style={styles.cuisineText}>
                +{restaurant.cuisine.length - 3} more
              </Text>
            </View>
          )}
        </View>

        {/* Restaurant Details */}
        <View style={styles.details}>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {restaurant.deliveryTime || '30-45'} min
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Ionicons name="bicycle-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              ₱{restaurant.deliveryFee ?? 49} delivery
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {restaurant.distance ?? 2.5} km
            </Text>
          </View>
        </View>

        {/* Status */}
        <View style={styles.statusContainer}>
          <View style={styles.status}>
            <View style={[
              styles.statusDot,
              { backgroundColor: (restaurant.isOpenNow ?? restaurant.isOpen) ? '#10b981' : '#ef4444' }
            ]} />
            <Text style={[
              styles.statusText,
              { color: (restaurant.isOpenNow ?? restaurant.isOpen) ? '#059669' : '#dc2626' }
            ]}>
              {(restaurant.isOpenNow ?? restaurant.isOpen) ? 'Open now' : restaurant.nextOpeningAt ? `Opens ${new Date(restaurant.nextOpeningAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Closed'}
            </Text>
          </View>

          {restaurant.minimumOrder !== undefined && restaurant.minimumOrder !== null && (
            <Text style={styles.minimumOrder}>
              Min. ₱{restaurant.minimumOrder}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 192,
    backgroundColor: '#e5e7eb',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 4,
  },
  description: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 12,
  },
  cuisineContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  cuisineTag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  cuisineText: {
    fontSize: 12,
    color: '#6b7280',
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 4,
  },
  statusContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  minimumOrder: {
    fontSize: 14,
    color: '#6b7280',
  },
});
