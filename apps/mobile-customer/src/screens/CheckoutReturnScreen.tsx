import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCart } from '../contexts/CartContext';
import {
  clearPendingCheckoutSession,
  finalizePaidOrder,
  waitForPaidTransaction,
} from '../services/checkoutReturn';
import { useAuth } from '../contexts/AuthContext';

const handledReturnFlowTimestamps = new Map<string, number>();
const RETURN_FLOW_DEDUP_WINDOW_MS = 15000;

export default function CheckoutReturnScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { reload } = useCart();
  const { customerId } = useAuth();
  const hasStartedRef = useRef(false);

  const paymentIntentId =
    typeof params.payment_intent_id === 'string' ? params.payment_intent_id : '';
  const merchantId = typeof params.merchantId === 'string' ? params.merchantId : '';
  const orderId = typeof params.order_id === 'string' ? params.order_id : '';

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    const confirmPayment = async () => {
      if (!paymentIntentId) {
        Alert.alert('Payment Error', 'Missing payment confirmation reference.');
        router.replace(merchantId ? `/checkout/${merchantId}` : '/(tabs)/orders');
        return;
      }

      if (!claimReturnFlow(paymentIntentId)) {
        return;
      }

      try {
        const { transaction, orderId: resolvedOrderId } = await waitForPaidTransaction(
          paymentIntentId,
          orderId || undefined,
        );

        await finalizePaidOrder(resolvedOrderId, transaction.paid_at);
        if (customerId && merchantId) {
          await clearPendingCheckoutSession(String(customerId), merchantId);
        }
        await reload();

        router.replace({
          pathname: '/order-success',
          params: {
            orderId: resolvedOrderId,
            merchantId,
          },
        });
      } catch (error) {
        Alert.alert(
          'Payment Processing',
          error instanceof Error
            ? error.message
            : 'We are still confirming your payment. Please check your Orders shortly.',
          [
            {
              text: 'Go to Orders',
              onPress: () => router.replace('/(tabs)/orders'),
            },
          ],
        );
      }
    };

    confirmPayment().catch(() => undefined);
  }, [customerId, merchantId, orderId, paymentIntentId, reload, router]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea} />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={40} color="#0F766E" />
        </View>
        <Text style={styles.title}>Confirming your payment</Text>
        <Text style={styles.subtitle}>
          Please wait while we verify your PayMongo payment and finalize your order.
        </Text>
        <ActivityIndicator size="large" color="#F59E0B" style={styles.loader} />
      </View>
    </View>
  );
}

function claimReturnFlow(paymentIntentId: string): boolean {
  const now = Date.now();

  for (const [key, startedAt] of handledReturnFlowTimestamps.entries()) {
    if (now - startedAt > RETURN_FLOW_DEDUP_WINDOW_MS) {
      handledReturnFlowTimestamps.delete(key);
    }
  }

  const existingStartedAt = handledReturnFlowTimestamps.get(paymentIntentId);
  if (existingStartedAt && now - existingStartedAt <= RETURN_FLOW_DEDUP_WINDOW_MS) {
    return false;
  }

  handledReturnFlowTimestamps.set(paymentIntentId, now);
  return true;
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 320,
  },
  loader: {
    marginTop: 28,
  },
});
