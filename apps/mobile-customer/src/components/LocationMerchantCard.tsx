import React from 'react';
import { View, Text, Image, TouchableOpacity, useWindowDimensions, StyleSheet } from 'react-native';
import { LocationBasedMerchant, Media } from '@encreasl/client-services';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../contexts/ThemeContext';

interface LocationMerchantCardProps {
  merchant: LocationBasedMerchant;
  isWishlisted?: boolean;
  onToggleWishlist?: (id: string) => void;
  addressName?: string | null;
  onPress?: (merchant: LocationBasedMerchant) => void;
}

function getImageUrl(media: Media | null | undefined): string | null {
  if (!media) return null;
  return media.cloudinaryURL || media.url || media.thumbnailURL || null;
}

function formatDistanceKm(distanceKm?: number): string | null {
  if (typeof distanceKm !== "number") return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m`;
  return `${distanceKm.toFixed(1)}km`;
}

export default function LocationMerchantCard({ 
  merchant, 
  isWishlisted = false, 
  onToggleWishlist, 
  addressName = null,
  onPress 
}: LocationMerchantCardProps) {
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  
  // Perfect Responsive Image Pattern
  // Calculate height based on aspect ratio (2:1 for merchant cards)
  // But since we are in a list, we might want a fixed aspect ratio for the card image
  const cardWidth = width - 32; // Full width minus padding (16 * 2)
  const imageHeight = cardWidth * 0.5; // 2:1 aspect ratio

  const thumbnailImageUrl = getImageUrl(merchant.media?.thumbnail);
  const vendorLogoUrl = getImageUrl(merchant.vendor?.logo);
  const distanceKm = (merchant as any)?.distanceKm as number | undefined;
  const distanceInMeters = (merchant as any)?.distanceInMeters as number | undefined;
  const distanceText = typeof distanceKm === "number" ? formatDistanceKm(distanceKm) : (typeof distanceInMeters === "number" ? formatDistanceKm(distanceInMeters / 1000) : null);
  const rating = typeof merchant.metrics?.averageRating === "number" ? merchant.metrics.averageRating : null;

  return (
    <TouchableOpacity 
      activeOpacity={0.9} 
      onPress={() => onPress && onPress(merchant)}
      style={styles.container}
    >
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        {thumbnailImageUrl ? (
          <Image
            source={{ uri: thumbnailImageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.image, { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="restaurant" size={40} color="#9ca3af" />
          </View>
        )}

        {/* Distance Badge */}
        {distanceText && (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>{distanceText}</Text>
          </View>
        )}

        {/* Wishlist Button */}
        <TouchableOpacity
          onPress={() => onToggleWishlist && onToggleWishlist(String(merchant.id))}
          style={styles.wishlistButton}
        >
          <Ionicons 
            name={isWishlisted ? "heart" : "heart-outline"} 
            size={20} 
            color={isWishlisted ? "#f3a823" : "#000"} 
          />
        </TouchableOpacity>
      </View>

      {/* Vendor Logo - Moved outside imageContainer to avoid clipping */}
      {vendorLogoUrl && (
        <View style={[styles.vendorLogoContainer, { top: imageHeight - 24 }]}>
          <Image
            source={{ uri: vendorLogoUrl }}
            style={styles.vendorLogo}
            resizeMode="contain"
          />
        </View>
      )}

      {/* Merchant Info */}
      <View style={styles.infoContainer}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {addressName ? `${merchant.outletName} - ${addressName}` : merchant.outletName}
        </Text>

        {merchant.vendor?.businessName && (
          <Text style={[styles.vendorName, { color: colors.textSecondary }]} numberOfLines={1}>
            {merchant.vendor.businessName}
          </Text>
        )}

        <View style={styles.metaContainer}>
          {typeof rating === 'number' && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#FBBF24" />
              <Text style={[styles.ratingText, { color: colors.textSecondary }]}>{rating.toFixed(1)}</Text>
            </View>
          )}
          
          {merchant.metrics?.totalOrders && (
            <Text style={[styles.ordersText, { color: colors.textSecondary }]}>
              ({merchant.metrics.totalOrders} orders)
            </Text>
          )}

          {merchant.estimatedDeliveryTime && (
            <Text style={[styles.deliveryTime, { color: colors.textSecondary }]}>
              • {merchant.estimatedDeliveryTime} min delivery
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    // Shadow
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  imageContainer: {
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden', // Ensure image doesn't bleed
    position: 'relative',
    backgroundColor: '#f3f4f6',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  distanceBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  wishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  vendorLogoContainer: {
    position: 'absolute',
    left: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    padding: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
    overflow: 'hidden',
    zIndex: 10,
  },
  vendorLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  infoContainer: {
    padding: 12,
    paddingTop: 32, // Increased space for vendor logo overlap
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  vendorName: {
    fontSize: 14,
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  ordersText: {
    fontSize: 12,
    marginRight: 8,
  },
  deliveryTime: {
    fontSize: 12,
    fontWeight: '500',
  },
});
