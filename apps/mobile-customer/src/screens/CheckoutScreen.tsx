import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useNavigation } from '../navigation/NavigationContext';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/format';
import { apiConfig } from '../config/environment';
import AddressSelectionModal from '../components/AddressSelectionModal';
import {
  dataCache,
  ADDRESS_KEYS,
  useActiveAddress,
} from '@encreasl/client-services';
import { useQueryClient } from '@tanstack/react-query';
import {
  clearPendingCheckoutSession,
  finalizePaidOrder,
  findActiveCartLinkedOrder,
  getCheckoutPaymentStatus,
  getPendingCheckoutSession,
  savePendingCheckoutSession,
} from '../services/checkoutReturn';

type PaymentMethod =
  | 'card'
  | 'gcash'
  | 'grab_pay'
  | 'paymaya'
  | 'billease'
  | 'dob'
  | 'brankas'
  | 'qrph';

const PAYMONGO_MINIMUM_AMOUNT_PHP = 1;

// Map address_type (Addresses) → label (DeliveryLocations enum: home | office | other)
function normalizeLabel(val: string): string {
  const map: Record<string, string> = { home: 'home', work: 'office', partner: 'other', office: 'office' };
  return map[val] || 'other';
}

const methodLogos: Record<PaymentMethod, { srcs: any[]; label: string; icon: any }> = {
  card: {
    srcs: [
      require('../../assets/payment-logos/visa.png'),
      require('../../assets/payment-logos/mastercard.png')
    ],
    label: 'Cards (Visa/Mastercard)',
    icon: 'card-outline'
  },
  gcash: {
    srcs: [require('../../assets/payment-logos/gcash.png')],
    label: 'GCash',
    icon: 'wallet-outline'
  },
  grab_pay: {
    srcs: [require('../../assets/payment-logos/grabpay.png')],
    label: 'GrabPay',
    icon: 'wallet-outline'
  },
  paymaya: {
    srcs: [require('../../assets/payment-logos/maya.png')],
    label: 'Maya',
    icon: 'wallet-outline'
  },
  billease: {
    srcs: [require('../../assets/payment-logos/billease.png')],
    label: 'BillEase (BNPL)',
    icon: 'cash-outline'
  },
  dob: {
    srcs: [
      require('../../assets/payment-logos/bpi.png'),
      require('../../assets/payment-logos/ubp.png')
    ],
    label: 'Online Banking (BPI/UBP)',
    icon: 'business-outline'
  },
  brankas: {
    srcs: [
      require('../../assets/payment-logos/bdo.png'),
      require('../../assets/payment-logos/metrobank.png'),
      require('../../assets/payment-logos/landbank.png')
    ],
    label: 'Online Banking (BDO/Metrobank/LandBank)',
    icon: 'business-outline'
  },
  qrph: {
    srcs: [require('../../assets/payment-logos/qrph.png')],
    label: 'QR Ph',
    icon: 'qr-code-outline'
  },
};

export default function CheckoutScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const merchantIdParam = typeof params.id === 'string' ? params.id : params.merchantId as string;
  const merchantId = merchantIdParam ? Number(merchantIdParam) : NaN;

  const { getMerchantCart, reload } = useCart();
  const { user, customerId, token } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: activeAddress = null,
    isLoading: isLoadingAddress,
  } = useActiveAddress(user?.id ? String(user.id) : undefined, token || undefined);

  const activeAddressId = activeAddress?.id ? String(activeAddress.id) : null;

  const [isAddressModalVisible, setIsAddressModalVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [isCheckingPaymentState, setIsCheckingPaymentState] = useState(false);
  const [hasPendingRecovery, setHasPendingRecovery] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrIntentId, setQrIntentId] = useState<string | null>(null);
  const [qrOrderId, setQrOrderId] = useState<string | null>(null);
  const reconcileInFlightRef = useRef(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasNavigatedToReturnRef = useRef(false);

  const merchantCart = getMerchantCart(String(merchantId));
  const merchantName = merchantCart?.merchantName || 'Merchant';
  const merchantLogoUrl = merchantCart?.merchantLogoUrl;
  const totalSubtotal = merchantCart?.subtotal || 0;
  const isBelowPayMongoMinimum = totalSubtotal < PAYMONGO_MINIMUM_AMOUNT_PHP;

  // ── Delivery fee (only shown when Lalamove is active) ──────────────────────
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [priorityFee, setPriorityFee] = useState(0);
  const [deliveryDistanceMeters, setDeliveryDistanceMeters] = useState<number | null>(null);
  const [deliveryFeeLoading, setDeliveryFeeLoading] = useState(false);
  const [deliveryFeeError, setDeliveryFeeError] = useState<string | null>(null);
  const deliveryQuoteCacheKeyRef = useRef<string | null>(null);

  const orderTotal = totalSubtotal + (deliveryAvailable ? deliveryFee + priorityFee : 0);

  const fetchDeliveryQuote = useCallback(async () => {
    if (!merchantId || !activeAddressId || !customerId || deliveryFeeLoading) return;

    const cacheKey = `${merchantId}:${activeAddressId}`;
    if (deliveryQuoteCacheKeyRef.current === cacheKey) return;
    deliveryQuoteCacheKeyRef.current = cacheKey;

    setDeliveryFeeLoading(true);
    setDeliveryFeeError(null);

    try {
      const cmsHeaders = {
        'Content-Type': 'application/json',
        Authorization: `users API-Key ${apiConfig.payloadApiKey}`,
      };

      // Server resolves pickup from merchant.active_address_id and dropoff
      // from customer.active_address_id (source of truth in the DB)
      const quoteRes = await fetch(`${apiConfig.baseUrl}/delivery/quote`, {
        method: 'POST',
        headers: cmsHeaders,
        body: JSON.stringify({
          merchantId,
          customerId: Number(customerId),
        }),
      });

      const quoteData = await quoteRes.json();
      if (!quoteRes.ok) throw new Error(quoteData?.error || 'Could not get delivery quote');

      if (quoteData?.data?.available === false) {
        setDeliveryAvailable(false);
        setDeliveryFee(0);
        setPriorityFee(0);
        setDeliveryDistanceMeters(null);
        return;
      }
      setDeliveryAvailable(true);

      setDeliveryFee(Number(quoteData?.data?.deliveryFee) || 0);
      setPriorityFee(Number(quoteData?.data?.priorityFee) || 0);

      // Lalamove returns distance as { value, unit } (value in meters unless unit is km)
      const distance = quoteData?.data?.distance as { value?: string | number; unit?: string } | null;
      if (distance && distance.value != null) {
        const rawValue = Number(distance.value);
        if (Number.isFinite(rawValue)) {
          const unit = String(distance.unit || 'm').toLowerCase();
          setDeliveryDistanceMeters(unit === 'km' ? rawValue * 1000 : rawValue);
        }
      }
    } catch (err: any) {
      deliveryQuoteCacheKeyRef.current = null;
      setDeliveryFee(0);
      setDeliveryDistanceMeters(null);
      setDeliveryFeeError(err?.message || 'Could not estimate delivery fee');
    } finally {
      setDeliveryFeeLoading(false);
    }
  }, [merchantId, activeAddressId, customerId, deliveryFeeLoading]);

  useEffect(() => {
    fetchDeliveryQuote();
  }, [fetchDeliveryQuote]);

  const handleAddressSelected = useCallback(async () => {
    dataCache.clear();
    await queryClient.resetQueries({ queryKey: ADDRESS_KEYS.all });
    deliveryQuoteCacheKeyRef.current = null;
    setIsAddressModalVisible(false);
  }, [queryClient]);


  // Filter out 'card' just like the web app
  const availablePaymentMethods = (Object.keys(methodLogos) as PaymentMethod[]).filter(
    (key) => key !== 'card'
  );

  const isFormValid = useMemo(() => {
    if (!apiConfig.isPaymongoSandbox && !paymentMethod) return false;
    if (!activeAddressId) return false;
    return true;
  }, [paymentMethod, activeAddressId]);

  const redirectToCheckoutReturn = useCallback(
    (paymentIntentId: string, orderId: string, merchantKey: string) => {
      if (hasNavigatedToReturnRef.current) {
        return;
      }

      hasNavigatedToReturnRef.current = true;
      router.replace({
        pathname: '/checkout/return',
        params: {
          payment_intent_id: paymentIntentId,
          merchantId: merchantKey,
          order_id: orderId,
        },
      });
    },
    [router],
  );

  const reconcileExistingPayment = useCallback(async (showLoader = false, blockOnPending = false) => {
    if (!customerId || Number.isNaN(merchantId) || reconcileInFlightRef.current) {
      return;
    }

    reconcileInFlightRef.current = true;

    try {
      const customerKey = String(customerId);
      const merchantKey = String(merchantId);
      const pendingSession = await getPendingCheckoutSession(customerKey, merchantKey);
      const linkedOrderId = await findActiveCartLinkedOrder(customerKey, merchantKey);

      // Only auto-recover a checkout that this device actually started recently.
      // Without this guard, any stale order/cart link can hijack a fresh checkout.
      if (!pendingSession || !isPendingSessionFresh(pendingSession.createdAt)) {
        if (pendingSession) {
          await clearPendingCheckoutSession(customerKey, merchantKey);
        }
        setHasPendingRecovery(false);
        return;
      }

      if (showLoader) {
        setIsCheckingPaymentState(true);
      }

      if (linkedOrderId && linkedOrderId !== pendingSession.orderId) {
        await clearPendingCheckoutSession(customerKey, merchantKey);
        setHasPendingRecovery(false);
        return;
      }

      const paymentStatus = await getCheckoutPaymentStatus({
        paymentIntentId: pendingSession.paymentIntentId,
        orderId: pendingSession.orderId,
      });

      if (paymentStatus.status === 'paid') {
        redirectToCheckoutReturn(
          paymentStatus.paymentIntentId || pendingSession.paymentIntentId,
          paymentStatus.orderId,
          merchantKey,
        );
        return;
      }

      if (paymentStatus.status === 'failed') {
        await clearPendingCheckoutSession(customerKey, merchantKey);
        setHasPendingRecovery(false);
        return;
      }

      setHasPendingRecovery(blockOnPending && paymentStatus.status === 'pending');
    } catch (error) {
      console.error('Checkout payment reconciliation failed:', error);
    } finally {
      reconcileInFlightRef.current = false;
      if (showLoader) {
        setIsCheckingPaymentState(false);
      }
    }
  }, [customerId, merchantId, redirectToCheckoutReturn]);

  useEffect(() => {
    reconcileExistingPayment(true).catch(() => undefined);
  }, [reconcileExistingPayment]);

  useEffect(() => {
    if (!hasPendingRecovery) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    pollingIntervalRef.current = setInterval(() => {
      reconcileExistingPayment(false, true).catch(() => undefined);
    }, 2500);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [hasPendingRecovery, reconcileExistingPayment]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        reconcileExistingPayment(true, true).catch(() => undefined);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [reconcileExistingPayment]);

  useEffect(() => {
    if (!qrIntentId || !customerId) return;

    let cancelled = false;
    const intervalId = setInterval(async () => {
      if (cancelled) return;
      try {
        const paymentStatus = await getCheckoutPaymentStatus({ paymentIntentId: qrIntentId });
        if (paymentStatus.status === 'paid') {
          clearInterval(intervalId);
          if (!cancelled) {
            redirectToCheckoutReturn(qrIntentId, paymentStatus.orderId || qrOrderId || '', String(merchantId));
          }
        } else if (paymentStatus.status === 'failed') {
          clearInterval(intervalId);
          if (!cancelled) {
            Alert.alert('Payment Failed', 'Your QR Ph payment was not completed.');
            setQrImage(null);
            setQrIntentId(null);
            setQrOrderId(null);
            setHasPendingRecovery(true);
            reconcileExistingPayment(false).catch(() => undefined);
          }
        }
      } catch {
        // keep polling
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [qrIntentId, qrOrderId, customerId, merchantId, redirectToCheckoutReturn, reconcileExistingPayment]);

  const dismissQr = useCallback(() => {
    setQrImage(null);
    setQrIntentId(null);
    setQrOrderId(null);
    setHasPendingRecovery(true);
    reconcileExistingPayment(true, true).catch(() => undefined);
  }, [reconcileExistingPayment]);

  const dismissPendingRecovery = useCallback(() => {
    if (customerId && !Number.isNaN(merchantId)) {
      clearPendingCheckoutSession(String(customerId), String(merchantId)).catch(() => undefined);
    }
    setHasPendingRecovery(false);
    setIsCheckingPaymentState(false);
    setQrImage(null);
    setQrIntentId(null);
    setQrOrderId(null);
    hasNavigatedToReturnRef.current = false;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, [customerId, merchantId]);

  const handleSandboxPay = async () => {
    if (!user || !customerId || !activeAddressId) {
      Alert.alert('Error', 'Please select a delivery address');
      return;
    }

    if (deliveryFeeLoading) {
      Alert.alert('Please wait', 'We are still calculating your delivery fee.');
      return;
    }

    if (deliveryAvailable && deliveryFee <= 0) {
      Alert.alert(
        'Delivery fee unavailable',
        deliveryFeeError || 'We could not calculate your delivery fee. Please try again.',
      );
      return;
    }

    setIsPaying(true);
    try {
      const cmsHeaders = {
        'Content-Type': 'application/json',
        Authorization: `users API-Key ${apiConfig.payloadApiKey}`,
      };

      // 1. Create Order
      const orderPayload = {
        customer: Number(customerId),
        merchant: merchantId,
        status: 'pending',
        fulfillment_type: 'delivery',
        total: orderTotal,
        subtotal: totalSubtotal,
        delivery_fee: deliveryFee,
        platform_fee: 0,
        placed_at: new Date().toISOString(),
      };
      const orderRes = await fetch(`${apiConfig.baseUrl}/orders`, {
        method: 'POST',
        headers: cmsHeaders,
        body: JSON.stringify(orderPayload),
      });
      const orderDataRes = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderDataRes?.error || 'Failed to create order');
      const createdOrderId = orderDataRes.doc.id;

      // 2. Create Delivery Location
      const addrRes = await fetch(`${apiConfig.baseUrl}/addresses/${activeAddressId}`, { headers: cmsHeaders });
      if (!addrRes.ok) {
        console.warn('[sandbox] address fetch failed:', addrRes.status);
        throw new Error(`Failed to fetch delivery address (${addrRes.status})`);
      }
      const addrData = await addrRes.json();
      const addressText =
        addrData.formatted_address ||
        [addrData.street_number, addrData.route, addrData.barangay, addrData.locality, addrData.country]
          .filter(Boolean).join(', ');

      let merchantAddrData: any = {};
      try {
        const merchantRes = await fetch(`${apiConfig.baseUrl}/merchants/${merchantId}?depth=1`, { headers: cmsHeaders });
        if (merchantRes.ok) {
          const merchantData = await merchantRes.json();
          const merchantAddrId =
            typeof merchantData?.activeAddress === 'object'
              ? merchantData.activeAddress?.id
              : merchantData?.activeAddress;
          if (merchantAddrId) {
            const mAddrRes = await fetch(`${apiConfig.baseUrl}/addresses/${merchantAddrId}`, { headers: cmsHeaders });
            if (mAddrRes.ok) merchantAddrData = await mAddrRes.json();
          }
        }
      } catch { /* non-critical */ }

      const dlRes = await fetch(`${apiConfig.baseUrl}/delivery-locations`, {
        method: 'POST',
        headers: cmsHeaders,
        body: JSON.stringify({
          order: createdOrderId,
          formatted_address: addressText || 'Unknown Address',
          coordinates: { lat: addrData.latitude || 0, lng: addrData.longitude || 0 },
          street: addrData.street || null,
          floor_unit_room: addrData.floor_unit_room || null,
          delivery_instructions: addrData.delivery_instructions || null,
          notes: addrData.notes || addrData.accessibility_notes || null,
          contact_name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Customer',
          contact_phone: user.phone || null,
          label: normalizeLabel(addrData.label || addrData.address_type || ''),
          merchant_formatted_address: merchantAddrData.formatted_address || null,
          merchant_coordinates: (merchantAddrData.latitude && merchantAddrData.longitude)
            ? { lat: merchantAddrData.latitude, lng: merchantAddrData.longitude } : null,
          merchant_street: merchantAddrData.street || null,
          merchant_floor_unit_room: merchantAddrData.floor_unit_room || null,
          merchant_delivery_instructions: merchantAddrData.delivery_instructions || null,
          merchant_label: normalizeLabel(merchantAddrData.label || merchantAddrData.address_type || ''),
        }),
      });
      if (!dlRes.ok) {
        const dlErr = await dlRes.json().catch(() => ({}));
        console.error('[sandbox] delivery-location failed:', dlRes.status, dlErr);
        throw new Error(`Failed to create delivery location: ${dlErr?.error || dlRes.status}`);
      }

      // 3. Create Order Items + link cart items
      for (const item of merchantCart.items) {
        const optionsSnapshot = [
          ...(item.selectedVariation
            ? [{ entryType: 'variation', name: item.selectedVariationName || `Variation #${item.selectedVariation}`, selectedVariationId: item.selectedVariation, selectedVariationName: item.selectedVariationName || undefined, price: 0 }]
            : []),
          ...((item.selectedModifiers || []).map((modifier: any) => ({
            entryType: 'modifier', sourceType: modifier?.source, groupId: modifier?.groupId,
            groupName: modifier?.groupName, optionId: modifier?.optionId,
            optionName: modifier?.name, selectedVariationId: item.selectedVariation || undefined,
            selectedVariationName: item.selectedVariationName || undefined,
            name: modifier?.name || 'Modifier', price: typeof modifier?.price === 'number' ? modifier.price : 0,
          }))),
        ];

        await fetch(`${apiConfig.baseUrl}/order-items`, {
          method: 'POST',
          headers: cmsHeaders,
          body: JSON.stringify({
            order: createdOrderId, product: item.product, merchant_product: item.merchantProduct || null,
            product_name_snapshot: item.productName, price_at_purchase: item.priceAtAdd,
            quantity: item.quantity, options_snapshot: optionsSnapshot, total_price: item.subtotal,
          }),
        });

        await fetch(`${apiConfig.baseUrl}/cart-items/${item.id}`, {
          method: 'PATCH',
          headers: cmsHeaders,
          body: JSON.stringify({ order_id: createdOrderId }),
        });
      }

      // 4. Create Transaction (paid immediately — sandbox)
      await fetch(`${apiConfig.baseUrl}/transactions`, {
        method: 'POST',
        headers: cmsHeaders,
        body: JSON.stringify({
          order: createdOrderId,
          payment_intent_id: `sandbox_${Date.now()}`,
          payment_method: 'gcash',
          amount: orderTotal,
          currency: 'PHP',
          status: 'paid',
          paid_at: new Date().toISOString(),
        }),
      });

      // 5. Finalize + book Lalamove
      await finalizePaidOrder(String(createdOrderId), new Date().toISOString());
      await reload();

      hasNavigatedToReturnRef.current = true;
      router.replace({
        pathname: '/order-success',
        params: { orderId: String(createdOrderId), merchantId: String(merchantId) },
      });
    } catch (error) {
      console.error('Sandbox payment error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process sandbox order');
    } finally {
      setIsPaying(false);
    }
  };

  const handlePayNow = async () => {
    if (!user || !customerId || !activeAddressId) {
      Alert.alert('Error', 'Please select a delivery address');
      return;
    }

    if (!paymentMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    if (deliveryFeeLoading) {
      Alert.alert('Please wait', 'We are still calculating your delivery fee.');
      return;
    }

    if (deliveryAvailable && deliveryFee <= 0) {
      Alert.alert(
        'Delivery fee unavailable',
        deliveryFeeError || 'We could not calculate your delivery fee. Please try again.',
      );
      return;
    }

    if (isBelowPayMongoMinimum) {
      Alert.alert(
        'Checkout total too low',
        'This checkout is below the PayMongo minimum of PHP 1.00. Please review your cart or choose the required priced options before paying.',
      );
      return;
    }

    setIsPaying(true);
    try {
      const pk = apiConfig.paymongoPublicKey;
      if (!pk) {
        throw new Error('Missing PayMongo public key');
      }

      const cmsHeaders = {
        'Content-Type': 'application/json',
        Authorization: `users API-Key ${apiConfig.payloadApiKey}`,
      };

      // 1. Create Payment Method directly with PayMongo API
      const billing = {
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Tap2Go Customer',
        email: user.email || 'customer@example.com',
        phone: '',
        address: { line1: '', line2: '', city: '', state: '', postal_code: '', country: 'PH' },
      };

      const pmPayload: any = {
        data: {
          attributes: {
            type: paymentMethod,
            billing,
          },
        },
      };

      const pmResponse = await fetch('https://api.paymongo.com/v1/payment_methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${btoa(pk + ':')}`,
        },
        body: JSON.stringify(pmPayload),
      });
      const pmData = await pmResponse.json();

      if (!pmResponse.ok) {
        throw new Error(pmData?.errors?.[0]?.detail || 'Failed to create payment method');
      }
      
      const paymentMethodId = pmData.data.id;

      // 2. Create Payment Intent via CMS
      const intentResponse = await fetch(`${apiConfig.baseUrl}/create-payment-intent`, {
        method: 'POST',
        headers: cmsHeaders,
        body: JSON.stringify({
          amount: Math.round(orderTotal * 100),
          currency: 'PHP',
          description: `Order from ${merchantName}`,
          metadata: {
            userId: user.id,
            merchantId,
            addressId: activeAddressId,
          },
        }),
      });

      const intentData = await intentResponse.json();

      if (!intentResponse.ok) {
        throw new Error(intentData.error || 'Failed to create payment intent');
      }

      const intentId = intentData?.data?.id ? String(intentData.data.id) : null;
      const cKey = intentData?.data?.attributes?.client_key ? String(intentData.data.attributes.client_key) : null;

      if (!intentId || !cKey) {
        throw new Error('Missing intent/client_key from CMS response');
      }

      // 3. Create Pending Order in CMS
      const orderPayload = {
        customer: Number(customerId),
        merchant: merchantId,
        status: 'pending',
        fulfillment_type: 'delivery',
        total: orderTotal,
        subtotal: totalSubtotal,
        delivery_fee: deliveryFee,
        platform_fee: 0,
        placed_at: new Date().toISOString(),
      };
      
      const orderRes = await fetch(`${apiConfig.baseUrl}/orders`, {
        method: 'POST',
        headers: cmsHeaders,
        body: JSON.stringify(orderPayload),
      });
      const orderDataRes = await orderRes.json();
      if (!orderRes.ok) throw new Error('Failed to create pending order');
      const createdOrderId = orderDataRes.doc.id;

      // 4. Fetch Address Details and Create Delivery Location Snapshot
      const addrRes = await fetch(`${apiConfig.baseUrl}/addresses/${activeAddressId}`, { headers: cmsHeaders });
      if (addrRes.ok) {
        const addrData = await addrRes.json();
        const addressText =
          addrData.formatted_address ||
          [addrData.street_number, addrData.route, addrData.barangay, addrData.locality, addrData.country]
            .filter(Boolean).join(', ');

        // Fetch merchant address for snapshot
        let merchantAddrData: any = {};
        try {
          const merchantRes = await fetch(
            `${apiConfig.baseUrl}/merchants/${merchantId}?depth=1`,
            { headers: cmsHeaders },
          );
          if (merchantRes.ok) {
            const merchantData = await merchantRes.json();
            const merchantAddrId =
              typeof merchantData?.activeAddress === 'object'
                ? merchantData.activeAddress?.id
                : merchantData?.activeAddress;
            if (merchantAddrId) {
              const mAddrRes = await fetch(
                `${apiConfig.baseUrl}/addresses/${merchantAddrId}`,
                { headers: cmsHeaders },
              );
              if (mAddrRes.ok) {
                merchantAddrData = await mAddrRes.json();
              }
            }
          }
        } catch { /* non-critical */ }
            
        await fetch(`${apiConfig.baseUrl}/delivery-locations`, {
          method: 'POST',
          headers: cmsHeaders,
          body: JSON.stringify({
            order: createdOrderId,
            formatted_address: addressText || 'Unknown Address',
            coordinates: {
              lat: addrData.latitude || 0,
              lng: addrData.longitude || 0,
            },
            street: addrData.street || null,
            floor_unit_room: addrData.floor_unit_room || null,
            delivery_instructions: addrData.delivery_instructions || null,
            notes: addrData.notes || addrData.accessibility_notes || null,
            contact_name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Customer',
            contact_phone: user.phone || null,
            label: normalizeLabel(addrData.label || addrData.address_type || ''),
            merchant_formatted_address: merchantAddrData.formatted_address || null,
            merchant_coordinates: (merchantAddrData.latitude && merchantAddrData.longitude)
              ? { lat: merchantAddrData.latitude, lng: merchantAddrData.longitude }
              : null,
            merchant_street: merchantAddrData.street || null,
            merchant_floor_unit_room: merchantAddrData.floor_unit_room || null,
            merchant_delivery_instructions: merchantAddrData.delivery_instructions || null,
            merchant_label: normalizeLabel(merchantAddrData.label || merchantAddrData.address_type || ''),
          }),
        });
      }

      // 5. Create Order Items
      for (const item of merchantCart.items) {
        const optionsSnapshot = [
          ...(item.selectedVariation
            ? [
                {
                  entryType: 'variation',
                  name: item.selectedVariationName || `Variation #${item.selectedVariation}`,
                  selectedVariationId: item.selectedVariation,
                  selectedVariationName: item.selectedVariationName || undefined,
                  price: 0,
                },
              ]
            : []),
          ...((item.selectedModifiers || []).map((modifier: any) => ({
            entryType: 'modifier',
            sourceType: modifier?.source,
            groupId: modifier?.groupId,
            groupName: modifier?.groupName,
            optionId: modifier?.optionId,
            optionName: modifier?.name,
            selectedVariationId: item.selectedVariation || undefined,
            selectedVariationName: item.selectedVariationName || undefined,
            name: modifier?.name || 'Modifier',
            price: typeof modifier?.price === 'number' ? modifier.price : 0,
          }))),
        ];

        await fetch(`${apiConfig.baseUrl}/order-items`, {
          method: 'POST',
          headers: cmsHeaders,
          body: JSON.stringify({
            order: createdOrderId,
            product: item.product,
            merchant_product: item.merchantProduct || null,
            product_name_snapshot: item.productName,
            price_at_purchase: item.priceAtAdd,
            quantity: item.quantity,
            options_snapshot: optionsSnapshot,
            total_price: item.subtotal,
          }),
        });
        
        // Link Cart Item to Order
        await fetch(`${apiConfig.baseUrl}/cart-items/${item.id}`, {
          method: 'PATCH',
          headers: cmsHeaders,
          body: JSON.stringify({
            order_id: createdOrderId,
          }),
        });
      }

      // 5. Create Pending Transaction
      const txResponse = await fetch(`${apiConfig.baseUrl}/transactions`, {
        method: 'POST',
        headers: cmsHeaders,
        body: JSON.stringify({
          order: createdOrderId,
          payment_intent_id: intentId,
          payment_method: paymentMethod,
          amount: orderTotal,
          currency: 'PHP',
          status: 'pending',
        }),
      });
      const txData = await txResponse.json();
      const transactionId = txData?.doc?.id;

      await savePendingCheckoutSession({
        customerId: String(customerId),
        merchantId: String(merchantId),
        orderId: String(createdOrderId),
        paymentIntentId: intentId,
        createdAt: new Date().toISOString(),
      });

      // Sandbox: skip PayMongo entirely — mark paid and book Lalamove directly
      if (apiConfig.isPaymongoSandbox) {
        // PATCH the pending transaction to paid
        if (transactionId) {
          await fetch(`${apiConfig.baseUrl}/transactions/${transactionId}`, {
            method: 'PATCH',
            headers: cmsHeaders,
            body: JSON.stringify({
              status: 'paid',
              paid_at: new Date().toISOString(),
            }),
          });
        }

        await finalizePaidOrder(String(createdOrderId), new Date().toISOString());
        await clearPendingCheckoutSession(String(customerId), String(merchantId));
        await reload();
        hasNavigatedToReturnRef.current = true;
        router.replace({
          pathname: '/order-success',
          params: {
            orderId: String(createdOrderId),
            merchantId: String(merchantId),
          },
        });
        return;
      }

      // 6. Attach Payment Method to Payment Intent
      // PayMongo requires an absolute http/https return_url, so we send the user to our web bridge.
      // The bridge then forwards to the exact runtime app URL, which is critical in Expo Go where
      // the live app URL is exp://... instead of the standalone app scheme.
      const appReturnUrl = Linking.createURL('checkout/return', {
        queryParams: {
          payment_intent_id: intentId,
          merchantId: String(merchantId),
          order_id: String(createdOrderId),
        },
      });
      const returnUrlAPI =
        `https://app.tap2goph.com/checkout/${merchantId}/return?` +
        `payment_intent_id=${encodeURIComponent(intentId)}` +
        `&order_id=${encodeURIComponent(String(createdOrderId))}` +
        `&app_redirect=${encodeURIComponent(appReturnUrl)}`;
      
      const attachResponse = await fetch(
        `https://api.paymongo.com/v1/payment_intents/${intentId}/attach`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${btoa(pk + ':')}`,
          },
          body: JSON.stringify({
            data: {
              attributes: {
                client_key: cKey,
                payment_method: paymentMethodId,
                return_url: returnUrlAPI,
              },
            },
          }),
        }
      );
      
      const attachData = await attachResponse.json();
      
      if (!attachResponse.ok) {
        throw new Error(attachData?.errors?.[0]?.detail || 'Failed to attach payment method');
      }

      const status = attachData?.data?.attributes?.status;
      const nextAction = attachData?.data?.attributes?.next_action;

      if (status === 'awaiting_next_action' && nextAction) {
        if (nextAction.redirect?.url) {
          // Setup gcash intent handler before opening the browser
          const subscription = Linking.addEventListener('url', ({ url }) => {
            if (url.startsWith('gcash://')) {
              Linking.openURL(url);
            }
          });

          const result = await WebBrowser.openAuthSessionAsync(nextAction.redirect.url, appReturnUrl);

          subscription.remove();

          if (result.type === 'success' && result.url) {
            // Expo Router already handles the incoming deep link. Doing an extra manual
            // replace here causes duplicate mounts of the return/success screens.
            hasNavigatedToReturnRef.current = true;
            return;
          } else {
            setIsPaying(false);
            setHasPendingRecovery(true);
            reconcileExistingPayment(true).catch(() => undefined);
          }
        } else if (nextAction.code?.image_url) {
          setQrImage(nextAction.code.image_url);
          setQrIntentId(intentId);
          setQrOrderId(String(createdOrderId));
          setIsPaying(false);
          return;
        }
      } else if (status === 'succeeded') {
        redirectToCheckoutReturn(intentId, String(createdOrderId), String(merchantId));
      } else {
        throw new Error(`Unexpected payment status: ${status}`);
      }
      
    } catch (error) {
      console.error('Payment error:', error);
      if (customerId && !Number.isNaN(merchantId)) {
        await clearPendingCheckoutSession(String(customerId), String(merchantId));
      }
      Alert.alert('Payment Failed', error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsPaying(false);
    }
  };

  if (!merchantCart || merchantCart.items.length === 0) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Checkout</Text>
            <View style={{ width: 32 }} />
          </View>
        </SafeAreaView>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No items found for this merchant.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#374151" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            {merchantLogoUrl ? (
              <Image source={{ uri: merchantLogoUrl }} style={styles.merchantLogo} />
            ) : (
              <View style={styles.merchantLogoPlaceholder}>
                <Ionicons name="storefront" size={16} color="#6B7280" />
              </View>
            )}
            <View>
              <Text style={styles.merchantNameText}>{merchantName}</Text>
              <Text style={styles.subtitleText}>Checkout</Text>
            </View>
          </View>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>

      {(apiConfig.isPaymongoSandbox || apiConfig.isLalamoveSandbox) && (
        <View style={styles.sandboxBanner}>
          <Ionicons name="flask-outline" size={14} color="#fff" />
          <Text style={styles.sandboxBannerText}>
            Sandbox Mode
            {apiConfig.isPaymongoSandbox && ' · PayMongo Test'}
            {apiConfig.isLalamoveSandbox && ' · Lalamove Test'}
            {' — No real money is used'}
          </Text>
        </View>
      )}

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.section, styles.addressSection]}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <TouchableOpacity
            style={styles.addressRow}
            onPress={() => setIsAddressModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="location-outline" size={20} color="#6b7280" style={{ marginRight: 12 }} />
            {isLoadingAddress ? (
              <View style={{ flex: 1 }}>
                <View style={{ width: '70%', height: 14, borderRadius: 4, backgroundColor: '#E5E7EB', marginBottom: 4 }} />
                <View style={{ width: '40%', height: 12, borderRadius: 4, backgroundColor: '#F3F4F6' }} />
              </View>
            ) : (
              <Text style={styles.addressText} numberOfLines={2}>
                {activeAddress
                  ? activeAddress.formatted_address || activeAddress.name
                  : 'No address set — tap to add'}
              </Text>
            )}
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.orderSummaryCard}>
            {merchantCart.items.map((item) => (
              <View key={item.id} style={styles.orderItem}>
                <View style={styles.orderItemLeft}>
                  <Text style={styles.orderItemQty}>{item.quantity}x</Text>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.orderItemImage} />
                  ) : (
                    <View style={styles.orderItemImagePlaceholder} />
                  )}
                  <View style={styles.orderItemDetails}>
                    <Text style={styles.orderItemName}>{item.productName}</Text>
                    {item.productSize && (
                      <Text style={styles.orderItemSub}>Size: {item.productSize}</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.orderItemPrice}>{formatCurrency(item.subtotal)}</Text>
              </View>
            ))}
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Subtotal</Text>
              <Text style={styles.subtotalValue}>{formatCurrency(totalSubtotal)}</Text>
            </View>
            {deliveryAvailable ? (
              <View style={styles.deliveryFeeRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.subtotalLabel}>Delivery Fee</Text>
                  {!deliveryFeeLoading && priorityFee > 0 && (
                    <View style={styles.priorityPill}>
                      <Ionicons name="flash" size={11} color="#fff" />
                      <Text style={styles.priorityPillText}>Priority</Text>
                    </View>
                  )}
                </View>
                {deliveryFeeLoading ? (
                  <ActivityIndicator size="small" color="#f97316" />
                ) : (
                  <Text style={styles.subtotalValue}>
                    {deliveryFee > 0 ? formatCurrency(deliveryFee) : 'Calculating…'}
                  </Text>
                )}
              </View>
            ) : null}
            {deliveryAvailable && !deliveryFeeLoading && priorityFee > 0 && (
              <View style={styles.priorityNoticeRow}>
                <Ionicons name="flash" size={14} color="#f97316" style={{ marginRight: 6, marginTop: 2 }} />
                <Text style={styles.priorityNoticeText}>
                  Priority Delivery — faster rider matching ({formatCurrency(priorityFee)} fee)
                </Text>
              </View>
            )}
            {deliveryAvailable && !deliveryFeeLoading && deliveryDistanceMeters != null && deliveryFee > 0 && (
              <View style={styles.deliveryDistanceRow}>
                <Text style={styles.deliveryDistanceLabel}>Delivery Distance</Text>
                <Text style={styles.deliveryDistanceValue}>
                  ~{(deliveryDistanceMeters / 1000).toFixed(1)} km
                </Text>
              </View>
            )}
            {deliveryAvailable && deliveryFeeError ? (
              <Text style={styles.deliveryFeeErrorText}>
                Delivery fee unavailable — {deliveryFeeError}
              </Text>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(orderTotal)}</Text>
            </View>
          </View>
        </View>

        {isBelowPayMongoMinimum && (
          <View style={styles.section}>
            <View style={styles.minimumAmountCard}>
              <View style={styles.minimumAmountIconWrap}>
                <Ionicons name="alert-circle-outline" size={20} color="#B45309" />
              </View>
              <View style={styles.minimumAmountContent}>
                <Text style={styles.minimumAmountTitle}>Checkout total is below PHP 1.00</Text>
                <Text style={styles.minimumAmountText}>
                  PayMongo rejects payments below PHP 1.00. This usually means one of the items in the cart has an incomplete or underpriced configuration.
                </Text>
              </View>
            </View>
          </View>
        )}

        {(isCheckingPaymentState || hasPendingRecovery) && (
          <View style={styles.section}>
            <View style={styles.processingCard}>
              <View style={styles.processingIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#92400E" />
              </View>
              <View style={styles.processingContent}>
                <Text style={styles.processingTitle}>
                  {hasPendingRecovery ? 'Payment confirmation in progress' : 'Checking payment status'}
                </Text>
                <Text style={styles.processingText}>
                  {hasPendingRecovery
                    ? 'We found an existing payment attempt for this checkout. Once PayMongo confirms it, this screen will move automatically to your thank-you page.'
                    : 'Please wait while we verify whether this checkout already has a completed payment.'}
                </Text>
              </View>
              {hasPendingRecovery ? (
                <ActivityIndicator color="#F59E0B" />
              ) : (
                <Ionicons name="time-outline" size={20} color="#92400E" />
              )}
            </View>
            {hasPendingRecovery && (
              <TouchableOpacity
                style={styles.startOverButton}
                onPress={dismissPendingRecovery}
                activeOpacity={0.7}
              >
                <Text style={styles.startOverButtonText}>Start a new payment</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!apiConfig.isPaymongoSandbox && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentMethodsGrid}>
            {availablePaymentMethods.map((key) => {
              const isSelected = paymentMethod === key;
              const config = methodLogos[key];
              
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.paymentMethodCard,
                    isSelected && styles.paymentMethodCardSelected
                  ]}
                  onPress={() => setPaymentMethod(key)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                      {config.srcs.length > 0 ? (
                        config.srcs.map((src, index) => (
                          <Image 
                            key={index} 
                            source={src} 
                            style={{ width: 32, height: 20, marginRight: index === config.srcs.length - 1 ? 0 : 4 }} 
                            resizeMode="contain" 
                          />
                        ))
                      ) : (
                        <Ionicons name={config.icon} size={24} color="#6B7280" style={{ width: 32, textAlign: 'center' }} />
                      )}
                    </View>
                    <Text style={styles.paymentMethodText}>{config.label}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.selectedIcon}>
                      <Ionicons name="checkmark-circle" size={16} color="#000" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        )}

        {qrImage && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scan QR Code to Pay</Text>
            <View style={styles.qrCard}>
              <Image
                source={{ uri: qrImage }}
                style={styles.qrImage}
                resizeMode="contain"
              />
              <Text style={styles.qrInstructions}>
                Scan this QR code using your preferred banking or e-wallet app{'\n'}
                (Maya, GCash, BDO, BPI, etc.) to complete your payment.
              </Text>
              <TouchableOpacity
                style={styles.qrCancelButton}
                onPress={dismissQr}
                activeOpacity={0.7}
              >
                <Text style={styles.qrCancelButtonText}>Cancel Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom Padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerTotalRow}>
          <Text style={styles.footerTotalLabel}>Total</Text>
          <Text style={styles.footerTotalValue}>{formatCurrency(orderTotal)}</Text>
        </View>
        {apiConfig.isPaymongoSandbox ? (
          <TouchableOpacity
            style={[
              styles.payButton,
              { backgroundColor: '#8b5cf6' },
              (!isFormValid || isPaying || deliveryFeeLoading || (deliveryAvailable && deliveryFee <= 0)) &&
                styles.payButtonDisabled,
            ]}
            onPress={handleSandboxPay}
            disabled={!isFormValid || isPaying || deliveryFeeLoading || (deliveryAvailable && deliveryFee <= 0)}
          >
            {isPaying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payButtonText}>
                {deliveryFeeLoading
                  ? 'Calculating delivery fee...'
                  : deliveryAvailable && deliveryFee <= 0
                    ? 'Delivery fee unavailable'
                    : `Simulate Payment (Sandbox)`}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.payButton,
              (!isFormValid || isPaying || hasPendingRecovery || isCheckingPaymentState || isBelowPayMongoMinimum || deliveryFeeLoading || (deliveryAvailable && deliveryFee <= 0)) &&
                styles.payButtonDisabled,
            ]}
            onPress={handlePayNow}
            disabled={!isFormValid || isPaying || hasPendingRecovery || isCheckingPaymentState || isBelowPayMongoMinimum || deliveryFeeLoading || (deliveryAvailable && deliveryFee <= 0)}
          >
            {isPaying || isCheckingPaymentState ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payButtonText}>
                {deliveryFeeLoading
                  ? 'Calculating delivery fee...'
                  : deliveryAvailable && deliveryFee <= 0
                    ? 'Delivery fee unavailable'
                    : `Pay ${formatCurrency(orderTotal)}`}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <AddressSelectionModal
        isVisible={isAddressModalVisible}
        onClose={() => setIsAddressModalVisible(false)}
        onAddressSelected={handleAddressSelected}
      />
    </View>
  );
}

const PENDING_SESSION_MAX_AGE_MS = 1000 * 60 * 15;

function isPendingSessionFresh(createdAt: string): boolean {
  const createdAtMs = Date.parse(createdAt);
  if (Number.isNaN(createdAtMs)) {
    return false;
  }

  return Date.now() - createdAtMs <= PENDING_SESSION_MAX_AGE_MS;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  sandboxBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8b5cf6',
    paddingVertical: 6,
    paddingHorizontal: 16,
    gap: 6,
  },
  sandboxBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  safeArea: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  merchantLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  merchantLogoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  subtitleText: {
    fontSize: 12,
    color: '#6B7280',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  section: {
    marginBottom: 8,
  },
  addressSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  orderSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderItemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  orderItemQty: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginRight: 8,
    marginTop: 2,
  },
  orderItemImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  orderItemImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  orderItemDetails: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  orderItemSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  subtotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  subtotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  deliveryFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
  },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f97316',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 3,
  },
  priorityPillText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  priorityNoticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 8,
  },
  priorityNoticeText: {
    fontSize: 12,
    color: '#f97316',
    flex: 1,
    lineHeight: 17,
  },
  deliveryDistanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
  },
  deliveryDistanceLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  deliveryDistanceValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  deliveryFeeErrorText: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#F3F4F6',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f97316',
  },
  processingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  minimumAmountCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  minimumAmountIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimumAmountContent: {
    flex: 1,
  },
  minimumAmountTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9A3412',
    marginBottom: 4,
  },
  minimumAmountText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#9A3412',
  },
  processingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingContent: {
    flex: 1,
  },
  processingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  processingText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#9A3412',
  },
  paymentMethodsGrid: {
    gap: 8,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentMethodCardSelected: {
    borderColor: '#000',
    backgroundColor: '#F9FAFB',
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  selectedIcon: {
    marginLeft: 8,
  },
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 44,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  footerTotalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  footerTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  payButton: {
    backgroundColor: '#eba236',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
  },
  qrImage: {
    width: 220,
    height: 220,
    marginBottom: 16,
  },
  qrInstructions: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  qrCancelButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  qrCancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  startOverButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 12,
  },
  startOverButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
});
