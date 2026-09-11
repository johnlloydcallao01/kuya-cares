import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = typeof params.orderId === 'string' ? params.orderId : '';
  const merchantId = typeof params.merchantId === 'string' ? params.merchantId : '';

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea} />
      <View style={styles.content}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="checkmark-circle" size={74} color="#16A34A" />
        </View>

        <Text style={styles.title}>Thank you for your order</Text>
        <Text style={styles.subtitle}>
          Your payment has been confirmed and your order is now with the merchant.
        </Text>

        {orderId ? (
          <View style={styles.orderBadge}>
            <Text style={styles.orderBadgeText}>Order #{orderId}</Text>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="receipt-outline" size={18} color="#F59E0B" />
            <Text style={styles.infoText}>Your order is recorded successfully.</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="cart-outline" size={18} color="#F59E0B" />
            <Text style={styles.infoText}>Your cart for this order has been cleared.</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color="#F59E0B" />
            <Text style={styles.infoText}>You can monitor updates from the Orders tab.</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace('/(tabs)/orders')}
        >
          <Text style={styles.primaryButtonText}>View Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            merchantId
              ? router.replace({ pathname: `/merchant/${merchantId}`, params: { merchantId } })
              : router.replace('/(tabs)')
          }
        >
          <Text style={styles.secondaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  safeArea: {
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconWrap: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 320,
  },
  orderBadge: {
    marginTop: 20,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  orderBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  infoCard: {
    width: '100%',
    marginTop: 28,
    borderRadius: 18,
    backgroundColor: '#fff',
    padding: 18,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 44,
    gap: 12,
  },
  primaryButton: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryButton: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
});
