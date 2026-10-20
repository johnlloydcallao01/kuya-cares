'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useAuthContext } from '@/contexts/AuthContext';
import ImageWrapper from '@/components/ui/ImageWrapper';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from 'react-hot-toast';
import { CheckoutAddressSection } from '@/components/checkout/CheckoutAddressSection';
import { AddressService, LocationBasedMerchantService } from '@encreasl/client-services';
import { useAddressChange } from '@/hooks/useAddressChange';
import { API_BASE_URL, getStoredToken } from '@/lib/auth';
import { getPaymentOptions, type PaymentOption } from '@/app/actions/payments';
import {
  FALLBACK_PAYMENT_METHODS,
  logosFor,
} from '@/lib/payments/catalog';
import {
  PAYMONGO_MINIMUM_AMOUNT_PHP,
  clearCheckoutIdempotencyKey,
  clearPendingCheckoutSession,
  createPendingTransaction,
  findActiveCartLinkedOrder,
  getCheckoutIdempotencyKey,
  getCheckoutPaymentStatus,
  getPendingCheckoutSession,
  isPendingSessionFresh,
  savePendingCheckoutSession,
} from '@/lib/client-services/checkout-service';

type PaymentMethod =
  | 'gcash'
  | 'grab_pay'
  | 'paymaya'
  | 'billease'
  | 'dob'
  | 'brankas'
  | 'qrph';

type ShippingOptionQuote = {
  id: string;
  type: 'seller_delivery' | 'pickup';
  name: string;
  fee: number;
  zoneId: string | null;
  zoneName: string | null;
  estimatedDeliveryMinMinutes: number | null;
  estimatedDeliveryMaxMinutes: number | null;
  pickupInstructions: string | null;
  quoteToken: string;
};

type ShippingQuote = {
  cartSubtotal: number;
  pickupLocation: string | null;
  items: Array<{
    cartItemId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  options: ShippingOptionQuote[];
};

type PreparedCheckout = {
  orderId: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  shippingOptionId: string;
  shippingOptionName: string;
  shippingType: 'seller_delivery' | 'pickup';
  estimatedDeliveryMinMinutes: number | null;
  estimatedDeliveryMaxMinutes: number | null;
  pickupInstructions: string | null;
  addressId: string | null;
  addressLabel: string | null;
  pickupLocation: string | null;
};

const CHECKOUT_API_BASE = API_BASE_URL;

const getPayMongoErrorMessage = (error: any) => {
  const code = error?.code;
  const detail = error?.detail;

  switch (code) {
    case 'insufficient_funds':
      return 'Your card has insufficient funds. Please check your balance or use a different card.';
    case 'card_declined':
    case 'do_not_honor':
    case 'payment_refused':
    case 'generic_decline':
      return 'Your card was declined by the issuer. Please contact your bank or use a different card.';
    case 'stolen_card':
    case 'lost_card':
    case 'pickup_card':
    case 'restricted_card':
      return 'This card has been reported as lost, stolen, or restricted. Transaction declined.';
    case 'expired_card':
      return 'Your card has expired. Please use a valid card.';
    case 'incorrect_cvc':
    case 'cvc_check_failed':
      return 'The CVC code provided is incorrect. Please check the 3-digit code on the back of your card.';
    case 'processing_error':
    case 'processor_blocked':
    case 'fraudulent':
    case 'highest_risk_level':
    case 'blocked':
      return 'The transaction was declined due to security reasons. Please try a different payment method.';
    case 'card_not_supported':
    case 'card_type_mismatch':
      return 'This card type is not supported. Please use a Visa or Mastercard.';
    case 'debit_card_usage_limit_exceeded':
    case 'amount_allowed_exceeded':
    case 'credit_limit_exceeded':
      return 'Transaction exceeds the card\'s usage limit or credit limit.';
    case 'payment_method_not_allowed':
      return 'Card payments are not enabled for this transaction. Please try another payment method.';
    case 'authentication_failed':
      return '3D Secure authentication failed. Please try again.';
    default:
      if (detail && detail.toLowerCase().includes('not allowed')) {
        return 'This payment method is not allowed for this transaction. Please try another method or contact support.';
      }
      return detail || 'An error occurred while processing your payment. Please try again.';
  }
};

export default function CheckoutPage() {
  const params = useParams() as { merchantId?: string };
  const merchantIdParam = params?.merchantId || '';
  const merchantId = merchantIdParam ? Number(merchantIdParam) : NaN;
  const router = useRouter();
  const { items, isLoading } = useCart();
  const { user, token: authToken } = useAuthContext();
  const accessToken = authToken || getStoredToken();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  // API-driven options (GET /api/payments/options via server action).
  // `card` is excluded client-side, mirroring mobile's methodLogos filter.
  const [payMethods, setPayMethods] = useState<PaymentOption[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const methods = await getPaymentOptions();
        if (!active) return;
        setPayMethods(methods.filter((m) => m.id !== 'card') as PaymentOption[]);
      } catch {
        // Offline CMS fallback: local catalog mirrors the canonical set.
        if (!active) return;
        setPayMethods(FALLBACK_PAYMENT_METHODS.filter((m) => m.id !== 'card') as PaymentOption[]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const [isPaying, setIsPaying] = useState(false);
  const [isCheckingPaymentState, setIsCheckingPaymentState] = useState(false);
  const [hasPendingRecovery, setHasPendingRecovery] = useState(false);
  const [activeAddressId, setActiveAddressId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isAddressReady, setIsAddressReady] = useState(false);
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
  const [selectedShippingOptionId, setSelectedShippingOptionId] = useState('');
  const [shippingQuoteLoading, setShippingQuoteLoading] = useState(false);
  const [shippingQuoteError, setShippingQuoteError] = useState<string | null>(null);
  const [preparedCheckout, setPreparedCheckout] = useState<PreparedCheckout | null>(null);

  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrIntentId, setQrIntentId] = useState<string | null>(null);

  const reconcileInFlightRef = useRef(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasNavigatedToReturnRef = useRef(false);
  const payGuardRef = useRef(false);
  const checkoutIdempotencyKeyRef = useRef<string | null>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);

  const merchantItems = useMemo(() => {
    if (!Number.isFinite(merchantId)) return [];
    return items.filter((item) => {
      const id =
        typeof item.merchant === 'number' ? item.merchant : Number(item.merchant);
      return !Number.isNaN(id) && id === merchantId;
    });
  }, [items, merchantId]);

  const merchantName = merchantItems[0]?.merchantName || 'Merchant';
  const merchantLogoUrl = merchantItems[0]?.merchantLogoUrl || null;
  const subtotal = merchantItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const cartQuoteKey = merchantItems
    .map((item) => `${item.id}:${item.quantity}:${item.subtotal}`)
    .join('|');

  const refreshActiveAddress = useCallback(async () => {
    const userId = (user as any)?.id;
    if (!userId) {
      setActiveAddressId(null);
      return;
    }
    try {
      const response = await AddressService.getActiveAddress(userId, undefined, true);
      setActiveAddressId(response.success && response.address ? String((response.address as any).id) : null);
    } catch (error) {
      console.error('Unable to refresh checkout address:', error);
      setActiveAddressId(null);
    }
  }, [user]);

  useAddressChange(() => {
    void refreshActiveAddress();
  });

  // ---- identity + active address (mobile useActiveAddress equivalent) ----
  useEffect(() => {
    let active = true;
    setIsAddressReady(false);
    (async () => {
      try {
        const cid = await LocationBasedMerchantService.getCurrentCustomerId().catch(() => null);
        if (!active) return;
        setCustomerId(cid);
        if (!cid) {
          setActiveAddressId(null);
          setIsAddressReady(true);
          return;
        }
        const userId = (user as any)?.id;
        if (!userId) {
          setActiveAddressId(null);
          setIsAddressReady(true);
          return;
        }
        const res = await AddressService.getActiveAddress(userId, undefined, true);
        if (!active) return;
        setActiveAddressId(res.success && res.address ? String((res.address as any).id) : null);
      } catch {
        if (active) setActiveAddressId(null);
      } finally {
        if (active) setIsAddressReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!isAddressReady || isLoading || !merchantItems.length) {
      setShippingQuote(null);
      setSelectedShippingOptionId('');
      setShippingQuoteError(null);
      setShippingQuoteLoading(false);
      return;
    }
    if (!customerId || !accessToken) {
      setShippingQuote(null);
      setSelectedShippingOptionId('');
      setShippingQuoteError(
        !customerId
          ? 'Your customer account could not be verified. Please sign in again.'
          : 'Your sign-in session could not be verified. Please sign in again.',
      );
      setShippingQuoteLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setShippingQuote(null);
    setShippingQuoteError(null);
    setShippingQuoteLoading(true);

    void (async () => {
      try {
        const response = await fetch(`${CHECKOUT_API_BASE}/customer/checkout/shipping/quote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `JWT ${accessToken}`,
          },
          body: JSON.stringify({ merchantId, addressId: activeAddressId }),
          cache: 'no-store',
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || 'Unable to calculate shipping for this address.');
        }
        const nextQuote = result as ShippingQuote;
        if (!Array.isArray(nextQuote.options) || !nextQuote.options.length) {
          throw new Error('No delivery or pickup options are available for this address.');
        }
        if (!active) return;
        setShippingQuote(nextQuote);
        setSelectedShippingOptionId((current) =>
          nextQuote.options.some((option) => option.id === current) ? current : nextQuote.options[0].id,
        );
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setShippingQuoteError(error instanceof Error ? error.message : 'Unable to calculate shipping for this address.');
      } finally {
        if (active) setShippingQuoteLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [activeAddressId, accessToken, cartQuoteKey, customerId, isAddressReady, isLoading, merchantId, merchantItems.length, subtotal]);

  const selectedShippingOption = shippingQuote?.options.find((option) => option.id === selectedShippingOptionId) ?? null;
  const shippingSubtotal = preparedCheckout?.subtotal ?? shippingQuote?.cartSubtotal ?? subtotal;
  const displayedDeliveryFee = preparedCheckout?.deliveryFee ?? selectedShippingOption?.fee ?? 0;
  const displayedShippingType = preparedCheckout?.shippingType ?? selectedShippingOption?.type;
  const displayedShippingName = preparedCheckout?.shippingOptionName ?? selectedShippingOption?.name;
  const displayedAddressId = preparedCheckout?.addressId ?? activeAddressId;
  const orderTotal = preparedCheckout?.total ??
    Math.round((shippingSubtotal + displayedDeliveryFee + Number.EPSILON) * 100) / 100;
  const isBelowPayMongoMinimum = orderTotal < PAYMONGO_MINIMUM_AMOUNT_PHP;
  const isFormValid =
    !!customerId &&
    !!paymentMethod &&
    (!!preparedCheckout || !!selectedShippingOption) &&
    ((preparedCheckout?.shippingType ?? selectedShippingOption?.type) === 'pickup' || !!displayedAddressId) &&
    !shippingQuoteLoading &&
    (!shippingQuoteError || !!preparedCheckout);

  const redirectToReturn = useCallback(
    (paymentIntentId: string, orderId: string) => {
      if (hasNavigatedToReturnRef.current) return;
      hasNavigatedToReturnRef.current = true;
      router.push(
        `/checkout/${merchantId}/return?payment_intent_id=${encodeURIComponent(paymentIntentId)}&order_id=${encodeURIComponent(orderId)}` as any,
      );
    },
    [router, merchantId],
  );

  // ---- pending-session recovery (mobile reconcileExistingPayment parity) ----
  const reconcileExistingPayment = useCallback(
    async (showLoader = false, blockOnPending = false) => {
      if (!customerId || !Number.isFinite(merchantId) || reconcileInFlightRef.current) return;
      reconcileInFlightRef.current = true;
      try {
        const customerKey = String(customerId);
        const merchantKey = String(merchantId);
        const pendingSession = await getPendingCheckoutSession(customerKey, merchantKey);
        const linkedOrderId = await findActiveCartLinkedOrder(customerKey, merchantKey);

        // Only auto-recover a checkout this device started recently — a stale
        // order/cart link must never hijack a fresh checkout.
        if (!pendingSession || !isPendingSessionFresh(pendingSession.createdAt)) {
          if (pendingSession) {
            await clearPendingCheckoutSession(customerKey, merchantKey);
          }
          setHasPendingRecovery(false);
          return;
        }

        if (showLoader) setIsCheckingPaymentState(true);

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
          redirectToReturn(
            paymentStatus.paymentIntentId || pendingSession.paymentIntentId,
            paymentStatus.orderId,
          );
          return;
        }

        if (paymentStatus.status === 'failed') {
          await clearPendingCheckoutSession(customerKey, merchantKey);
          setHasPendingRecovery(false);
          return;
        }

        setHasPendingRecovery(blockOnPending && paymentStatus.status === 'pending');
      } catch (err) {
        console.error('Checkout payment reconciliation failed:', err);
      } finally {
        reconcileInFlightRef.current = false;
        if (showLoader) setIsCheckingPaymentState(false);
      }
    },
    [customerId, merchantId, redirectToReturn],
  );

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

  // Tab visible again → reconcile (web analogue of AppState active).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        reconcileExistingPayment(true, true).catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reconcileExistingPayment]);

  const dismissPendingRecovery = useCallback(async () => {
    if (!customerId || !Number.isFinite(merchantId)) return;
    await clearPendingCheckoutSession(String(customerId), String(merchantId));
    setHasPendingRecovery(false);
    setQrImage(null);
    setQrIntentId(null);
    hasNavigatedToReturnRef.current = false;
  }, [customerId, merchantId]);

  const dismissQr = useCallback(() => {
    setQrImage(null);
    setQrIntentId(null);
    setHasPendingRecovery(true);
    reconcileExistingPayment(true).catch(() => undefined);
  }, [reconcileExistingPayment]);

  // ---- QR inline poll (mobile parity: paid → return, failed → alert) ----
  useEffect(() => {
    if (!qrIntentId || !customerId) return;
    let cancelled = false;
    const intervalId = setInterval(async () => {
      if (cancelled) return;
      try {
        const paymentStatus = await getCheckoutPaymentStatus({ paymentIntentId: qrIntentId });
        if (paymentStatus.status === 'paid' && paymentStatus.orderId) {
          redirectToReturn(paymentStatus.paymentIntentId || qrIntentId, paymentStatus.orderId);
        } else if (paymentStatus.status === 'failed') {
          toast.error('Your QR Ph payment was not completed.');
          setQrImage(null);
          setQrIntentId(null);
              }
      } catch {
        /* transient — next tick retries */
      }
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [qrIntentId, customerId, redirectToReturn]);

  const createPaymentMethod = async (): Promise<string | null> => {
    try {
      const pk = process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY_LIVE;
      if (!pk) {
        toast.error('Missing PayMongo public key');
        return null;
      }
      const billing = {
        name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Kuya Cares Customer',
        email: user?.email || 'customer@example.com',
        phone: '',
        address: { line1: '', line2: '', city: '', state: '', postal_code: '', country: 'PH' },
      };
      const payload: any = {
        data: {
          attributes: {
            type: paymentMethod,
            billing,
          },
        },
      };

      const resp = await fetch('https://api.paymongo.com/v1/payment_methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${typeof window !== 'undefined' ? window.btoa(pk + ':') : ''}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.errors?.[0]?.detail || 'Failed to create payment method');
      }
      const pmId = data?.data?.id ? String(data.data.id) : null;
      return pmId;
    } catch (e: any) {
      toast.error(e?.message || 'Payment method creation failed');
      return null;
    }
  };

  const handlePayNow = async () => {
    if (payGuardRef.current) return;
    if (!customerId || !accessToken) {
      toast.error('Your sign-in session could not be verified. Please sign in again.');
      return;
    }
    if (!preparedCheckout && !selectedShippingOption) {
      toast.error(shippingQuoteError || 'Select an available delivery or pickup option before paying.');
      return;
    }
    if (
      !preparedCheckout &&
      selectedShippingOption?.type === 'seller_delivery' &&
      !activeAddressId
    ) {
      toast.error('Please select a delivery address.');
      return;
    }
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }
    if (isBelowPayMongoMinimum) {
      toast.error('This checkout is below the PayMongo minimum of PHP 1.00. Please review your cart before paying.');
      return;
    }
    payGuardRef.current = true;
    setIsPaying(true);
    setQrImage(null);
    setQrIntentId(null);
    try {
      const pk = process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY_LIVE;
      if (!pk) {
        throw new Error('Missing PayMongo public key');
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `JWT ${accessToken}`,
      };

      // 1. Payment method via PayMongo.
      const pmId = await (async () => {
        const billing = {
          name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Kuya Cares Customer',
          email: user?.email || 'customer@example.com',
          phone: '',
          address: { line1: '', line2: '', city: '', state: '', postal_code: '', country: 'PH' },
        };
        const resp = await fetch('https://api.paymongo.com/v1/payment_methods', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${typeof window !== 'undefined' ? window.btoa(pk + ':') : ''}`,
          },
          body: JSON.stringify({ data: { attributes: { type: paymentMethod, billing } } }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data?.errors?.[0]?.detail || 'Failed to create payment method');
        }
        return data?.data?.id ? String(data.data.id) : null;
      })();
      if (!pmId) return;

      // 2. Create the validated order so the payment intent can be checked against its total.
      let checkout = preparedCheckout;
      if (!checkout) {
        const option = selectedShippingOption;
        if (!option) throw new Error('Shipping options are no longer available. Refresh checkout and try again.');
        const idempotencyKey = checkoutIdempotencyKeyRef.current ??
          getCheckoutIdempotencyKey(String(customerId), String(merchantId));
        checkoutIdempotencyKeyRef.current = idempotencyKey;

        const checkoutResponse = await fetch(`${CHECKOUT_API_BASE}/customer/checkout`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            idempotencyKey,
            quoteToken: option.quoteToken,
          }),
        });
        const checkoutResult = await checkoutResponse.json().catch(() => ({}));
        if (!checkoutResponse.ok) {
          throw new Error(checkoutResult?.error || 'Unable to prepare your order. Refresh checkout and try again.');
        }
        if (checkoutResult?.status === 'cancelled') {
          clearCheckoutIdempotencyKey(String(customerId), String(merchantId));
          checkoutIdempotencyKeyRef.current = null;
          throw new Error('Your previous checkout was cancelled. Refresh shipping options to start a new order.');
        }
        if (checkoutResult?.status !== 'pending') {
          throw new Error('This order is no longer awaiting payment. Please check your orders before trying again.');
        }

        const persistedShipping = checkoutResult?.sellerShipping;
        const orderId = checkoutResult?.orderId == null ? '' : String(checkoutResult.orderId);
        const persistedSubtotal = Number(checkoutResult?.subtotal);
        const persistedFee = Number(checkoutResult?.deliveryFee);
        const persistedShippingFee = Number(persistedShipping?.fee);
        const persistedTotal = Number(checkoutResult?.total);
        const persistedOptionId = typeof persistedShipping?.optionId === 'string'
          ? persistedShipping.optionId.trim()
          : '';
        if (
          !orderId ||
          !persistedShipping ||
          !persistedOptionId ||
          !Number.isFinite(persistedSubtotal) ||
          !Number.isFinite(persistedFee) ||
          !Number.isFinite(persistedShippingFee) ||
          Math.round(persistedShippingFee * 100) !== Math.round(persistedFee * 100) ||
          !Number.isFinite(persistedTotal) ||
          !['seller_delivery', 'pickup'].includes(persistedShipping.type)
        ) {
          throw new Error('The server returned incomplete checkout totals. Please refresh checkout before paying.');
        }

        checkout = {
          orderId,
          subtotal: persistedSubtotal,
          deliveryFee: persistedFee,
          total: persistedTotal,
          shippingOptionId: persistedOptionId,
          shippingOptionName: String(persistedShipping.optionName || 'Seller delivery'),
          shippingType: persistedShipping.type,
          estimatedDeliveryMinMinutes: persistedShipping.estimatedDeliveryMinMinutes == null
            ? null
            : Number(persistedShipping.estimatedDeliveryMinMinutes),
          estimatedDeliveryMaxMinutes: persistedShipping.estimatedDeliveryMaxMinutes == null
            ? null
            : Number(persistedShipping.estimatedDeliveryMaxMinutes),
          pickupInstructions: persistedShipping.pickupInstructions == null
            ? null
            : String(persistedShipping.pickupInstructions),
          addressId: persistedShipping.addressId == null ? null : String(persistedShipping.addressId),
          addressLabel: persistedShipping.address?.formattedAddress
            ? String(persistedShipping.address.formattedAddress)
            : null,
          pickupLocation: persistedShipping.pickupLocation
            ? String(persistedShipping.pickupLocation)
            : null,
        };
        setPreparedCheckout(checkout);

        const quoteDoesNotMatchPreparedOrder =
          checkout.shippingOptionId !== option.id ||
          checkout.shippingType !== option.type ||
          checkout.shippingOptionName !== option.name ||
          Math.round(checkout.deliveryFee * 100) !== Math.round(option.fee * 100) ||
          checkout.estimatedDeliveryMinMinutes !== option.estimatedDeliveryMinMinutes ||
          checkout.estimatedDeliveryMaxMinutes !== option.estimatedDeliveryMaxMinutes ||
          checkout.pickupInstructions !== option.pickupInstructions ||
          checkout.addressId !== activeAddressId ||
          (option.type === 'pickup' && checkout.pickupLocation !== shippingQuote?.pickupLocation) ||
          Math.round(checkout.total * 100) !== Math.round(orderTotal * 100);
        if (quoteDoesNotMatchPreparedOrder) {
          throw new Error('Your shipping details or total changed. Review the updated order summary, then press Pay again to continue.');
        }
      }

      const paymentAmount = Math.round(checkout.total * 100);
      if (paymentAmount < PAYMONGO_MINIMUM_AMOUNT_PHP * 100) {
        throw new Error('Checkout total is below the PayMongo minimum of PHP 1.00.');
      }

      // 3. Payment intent: CMS verifies the centavo amount against the saved order.
      const intentResponse = await fetch(`${CHECKOUT_API_BASE}/create-payment-intent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: paymentAmount,
          currency: 'PHP',
          orderId: checkout.orderId,
          description: `Order from ${merchantName}`,
          metadata: {
            userId: (user as any)?.id,
            merchantId,
            addressId: checkout.addressId,
          },
        }),
      });
      const intentData = await intentResponse.json();
      if (!intentResponse.ok) {
        const firstErr = (intentData as any)?.details?.errors?.[0] || (intentData as any)?.errors?.[0];
        throw new Error(firstErr ? getPayMongoErrorMessage(firstErr) : intentData.error || 'Failed to create payment intent');
      }
      const intentId = intentData?.data?.id ? String(intentData.data.id) : null;
      const cKey = intentData?.data?.attributes?.client_key
        ? String(intentData.data.attributes.client_key)
        : null;
      if (!intentId || !cKey) {
        throw new Error('Missing intent/client_key from CMS response');
      }

      // 4. Record the transaction and pending-payment recovery state.
      await createPendingTransaction({
        orderId: checkout.orderId,
        paymentIntentId: intentId,
        paymentMethod: paymentMethod as string,
        amount: checkout.total,
      });
      await savePendingCheckoutSession({
        customerId: String(customerId),
        merchantId: String(merchantId),
        orderId: checkout.orderId,
        paymentIntentId: intentId,
        createdAt: new Date().toISOString(),
      });

      // 5. Attach → redirect / QR / success.
      const returnUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/checkout/${merchantId}/return?payment_intent_id=${encodeURIComponent(intentId)}&order_id=${encodeURIComponent(checkout.orderId)}`
          : `https://app.kuyacares.com/checkout/${merchantId}/return`;
      const attachResponse = await fetch(
        `https://api.paymongo.com/v1/payment_intents/${intentId}/attach`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${typeof window !== 'undefined' ? window.btoa(pk + ':') : ''}`,
          },
          body: JSON.stringify({
            data: {
              attributes: {
                client_key: cKey,
                payment_method: pmId,
                return_url: returnUrl,
              },
            },
          }),
        },
      );
      const attachData = await attachResponse.json();
      if (!attachResponse.ok) {
        throw new Error(attachData?.errors?.[0]?.detail || 'Failed to attach payment method');
      }
      const status = attachData?.data?.attributes?.status;
      const nextAction = attachData?.data?.attributes?.next_action;
      if (status === 'awaiting_next_action' && nextAction) {
        if (nextAction?.redirect?.url) {
          window.location.assign(nextAction.redirect.url);
          return;
        }
        if (nextAction?.code?.image_url) {
          setQrImage(nextAction.code.image_url);
          setQrIntentId(intentId);
          toast.success('Scan the QR to pay');
          return;
        }
      }
      if (status === 'succeeded') {
        redirectToReturn(intentId, checkout.orderId);
        return;
      }
      throw new Error(`Unexpected payment status: ${status}`);
    } catch (error: any) {
      toast.error(error?.message || 'Checkout failed');
    } finally {
      payGuardRef.current = false;
      setIsPaying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="bg-white dark:bg-[#111111] shadow-sm">
          <div className="px-2.5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center">
              <i className="fas fa-arrow-left text-gray-300 text-sm" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        </div>
        <div className="px-3 py-4 space-y-4">
          <div className="bg-white dark:bg-[#111111] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-[#262626] space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!Number.isFinite(merchantId) || merchantItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="bg-white dark:bg-[#111111] shadow-sm">
          <div className="px-2.5 py-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/carts' as any)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
            >
              <i className="fas fa-arrow-left text-gray-700 text-sm" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Checkout</h1>
          </div>
        </div>
        <div className="px-3 py-10 text-center text-gray-600">
          <p>No items found for this merchant.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="bg-white dark:bg-[#111111] shadow-sm">
        <div className="px-2.5 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/carts/${merchantId}` as any)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
          >
            <i className="fas fa-arrow-left text-gray-700 text-sm" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#1c1c1c] flex items-center justify-center overflow-hidden">
              {merchantLogoUrl ? (
                <ImageWrapper
                  src={merchantLogoUrl}
                  alt={merchantName}
                  width={36}
                  height={36}
                  className="object-contain"
                />
              ) : (
                <i className="fas fa-store text-gray-500 text-xs" />
              )}
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900 leading-tight">
                {merchantName}
              </h1>
              <p className="text-xs text-gray-500">Checkout</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-4 space-y-4">
        <CheckoutAddressSection className="h-full" disabled={!!preparedCheckout || isPaying} />

        <section
          aria-labelledby="shipping-options-heading"
          className="bg-white dark:bg-[#111111] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-[#262626] space-y-3"
        >
          <div>
            <h2 id="shipping-options-heading" className="text-sm font-semibold text-gray-900 dark:text-white">
              Delivery or pickup
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-[#a1a1aa]">
              Options and fees are based on this seller, your address, and current cart.
            </p>
          </div>

          {shippingQuoteLoading && (
            <p role="status" className="text-sm text-gray-500">Checking seller delivery coverage and fees…</p>
          )}
          {shippingQuoteError && (
            <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {shippingQuoteError}
            </div>
          )}

          {preparedCheckout ? (
            <div className="rounded-xl border border-[#239459]/30 bg-[#239459]/5 p-3 text-sm">
              <p className="font-semibold text-gray-900 dark:text-white">
                {preparedCheckout.shippingType === 'pickup' ? 'Seller pickup' : preparedCheckout.shippingOptionName}
                {' · '}{formatCurrency(preparedCheckout.deliveryFee)}
              </p>
              {preparedCheckout.shippingType === 'seller_delivery' && preparedCheckout.addressLabel && (
                <p className="mt-1 text-xs text-gray-600 dark:text-[#a1a1aa]">
                  Delivery address: {preparedCheckout.addressLabel}
                </p>
              )}
              {preparedCheckout.shippingType === 'pickup' && preparedCheckout.pickupLocation && (
                <p className="mt-1 text-xs text-gray-600 dark:text-[#a1a1aa]">
                  Pickup from: {preparedCheckout.pickupLocation}
                </p>
              )}
              {preparedCheckout.shippingType === 'seller_delivery' &&
                preparedCheckout.estimatedDeliveryMinMinutes != null &&
                preparedCheckout.estimatedDeliveryMaxMinutes != null && (
                  <p className="mt-1 text-xs text-gray-600 dark:text-[#a1a1aa]">
                    {preparedCheckout.estimatedDeliveryMinMinutes}–{preparedCheckout.estimatedDeliveryMaxMinutes} min estimate
                  </p>
                )}
              {preparedCheckout.shippingType === 'pickup' && preparedCheckout.pickupInstructions && (
                <p className="mt-1 text-xs text-gray-600 dark:text-[#a1a1aa]">
                  {preparedCheckout.pickupInstructions}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-[#a1a1aa]">
                This shipping choice is locked to the pending order.
              </p>
            </div>
          ) : shippingQuote?.options.map((option) => {
            const selected = option.id === selectedShippingOptionId;
            const deliveryEstimate = option.estimatedDeliveryMinMinutes && option.estimatedDeliveryMaxMinutes
              ? `${option.estimatedDeliveryMinMinutes}–${option.estimatedDeliveryMaxMinutes} min estimate`
              : null;
            return (
              <label
                key={option.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  selected
                    ? 'border-[#239459] bg-[#239459]/5'
                    : 'border-gray-200 hover:border-gray-300 dark:border-[#3f3f46] dark:hover:border-[#52525b]'
                } ${shippingQuoteLoading ? 'opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="seller-shipping-option"
                  value={option.id}
                  checked={selected}
                  disabled={shippingQuoteLoading}
                  onChange={() => setSelectedShippingOptionId(option.id)}
                  className="mt-1 accent-[#239459]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {option.type === 'pickup' ? 'Seller pickup' : option.name}
                    </span>
                    <span className="whitespace-nowrap font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(option.fee)}
                    </span>
                  </span>
                  {deliveryEstimate && (
                    <span className="mt-1 block text-xs text-gray-500 dark:text-[#a1a1aa]">{deliveryEstimate}</span>
                  )}
                  {option.type === 'pickup' && option.pickupInstructions && (
                    <span className="mt-1 block text-xs text-gray-500 dark:text-[#a1a1aa]">
                      {option.pickupInstructions}
                    </span>
                  )}
                  {option.type === 'pickup' && shippingQuote?.pickupLocation && (
                    <span className="mt-1 block text-xs text-gray-500 dark:text-[#a1a1aa]">
                      Pickup from: {shippingQuote.pickupLocation}
                    </span>
                  )}
                </span>
              </label>
            );
          })}

          {!isAddressReady && <p role="status" className="text-sm text-gray-500">Loading address and shipping choices…</p>}
          {!shippingQuoteLoading && !shippingQuoteError && !shippingQuote?.options.length && isAddressReady && !isLoading && merchantItems.length > 0 && (
            <p className="text-sm text-gray-500">
              {activeAddressId
                ? 'No seller delivery or pickup option is available for the selected address.'
                : 'Select an address for delivery, or continue with pickup if the seller offers it.'}
            </p>
          )}
        </section>

        <div className="bg-white dark:bg-[#111111] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-[#262626] space-y-3 h-full">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Order summary</h2>
            <span className="text-xs text-gray-500">
              {merchantItems.length} {merchantItems.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="space-y-2">
            {merchantItems.map((item) => {
              const pricedLine = shippingQuote?.items.find((line) => line.cartItemId === String(item.id));
              return (
              <div key={item.id} className="flex items-start gap-3 text-sm">
                <div className="h-16 w-16 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden border border-gray-200">
                  {item.imageUrl ? (
                    <ImageWrapper
                      src={item.imageUrl}
                      alt={item.productName || 'Product'}
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-400">
                      <i className="fas fa-image" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between">
                    <div className="font-medium text-gray-900 line-clamp-2">
                      {(pricedLine?.quantity ?? item.quantity)}x {pricedLine?.productName || item.productName || 'Product'}
                    </div>
                    <div className="text-gray-900 font-semibold ml-2">
                      {formatCurrency(pricedLine?.totalPrice ?? item.subtotal ?? 0)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Qty {item.quantity}</div>
                </div>
              </div>
              );
            })}
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(shippingSubtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span>{displayedShippingType === 'pickup' ? 'Pickup fee' : 'Delivery fee'}</span>
              <span>{selectedShippingOption || preparedCheckout ? formatCurrency(displayedDeliveryFee) : '—'}</span>
            </div>
            {displayedShippingType === 'seller_delivery' && displayedShippingName && (
              <p className="text-xs text-gray-500">
                Seller-arranged delivery · {displayedShippingName}
              </p>
            )}
            <div className="flex items-center justify-between font-semibold text-gray-900">
              <span>Total</span>
              <span>{formatCurrency(orderTotal)}</span>
            </div>
          </div>
        </div>

        {isBelowPayMongoMinimum && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-4">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Checkout total is below PHP 1.00</p>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
              PayMongo rejects payments below PHP 1.00. This usually means one of the items in the cart has an incomplete or underpriced configuration.
            </p>
          </div>
        )}

        {(isCheckingPaymentState || hasPendingRecovery) && (
          <div className="bg-white dark:bg-[#111111] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-[#262626] space-y-2">
            <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <i className="fas fa-shield-alt" style={{ color: '#239459' }} />
              {hasPendingRecovery ? 'Payment confirmation in progress' : 'Checking payment status'}
            </p>
            <p className="text-xs text-gray-500">
              {hasPendingRecovery
                ? 'We found an existing payment attempt for this checkout. Once PayMongo confirms it, this screen will move automatically to your thank-you page.'
                : 'Please wait while we verify whether this checkout already has a completed payment.'}
            </p>
            {hasPendingRecovery && (
              <button
                type="button"
                onClick={dismissPendingRecovery}
                className="w-full py-2 bg-gray-100 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-200"
              >
                Start a new payment
              </button>
            )}
          </div>
        )}

        <div className="bg-white dark:bg-[#111111] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-[#262626] space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Payment method</h2>
          <div className="grid grid-cols-1 gap-2">
            {payMethods == null ? (
              // Skeleton rows while options resolve from the API.
              [0, 1, 2].map((i) => (
                <div key={i} className="w-full rounded-lg border border-gray-200 dark:border-[#3f3f46] bg-white dark:bg-[#1c1c1c] animate-pulse">
                  <div className="flex items-center gap-3 px-3 py-2">
                    <div className="h-6 w-24 bg-gray-200 rounded" />
                    <div className="h-4 w-20 bg-gray-100 rounded" />
                  </div>
                </div>
              ))
            ) : (
              payMethods.map((method) => {
                const logos = logosFor(method.id);
                const selected = paymentMethod === method.id;
                // Single-logo marks are self-describing (the artwork carries
                // the brand) — render them alone with an accessible name so
                // the label isn't duplicated ("GCash GCash"). Multi-logo
                // groups keep the API label for clarity.
                const showLabel = logos.srcs.length !== 1;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                    aria-label={method.label}
                    title={method.hint ?? method.label}
                    className="w-full rounded-lg border bg-white dark:bg-[#1c1c1c] hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors text-left"
                    style={{
                      borderColor: selected ? '#239459' : '#e5e7eb',
                      boxShadow: selected ? '0 0 0 2px rgba(235,162,54,0.15)' : undefined,
                    }}
                  >
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="flex items-center gap-2">
                        {logos.srcs.map(({ src, alt }) => (
                          <div key={src} className="h-6 w-auto flex items-center">
                            <ImageWrapper src={src} alt={alt} width={72} height={24} className="object-contain" />
                          </div>
                        ))}
                      </div>
                      {showLabel && (
                        <span className="text-sm font-semibold text-gray-900">{method.label}</span>
                      )}
                      {selected && (
                        <i className="fas fa-check-circle ml-auto" style={{ color: '#239459' }} />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#111111] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-[#262626] space-y-3">
          <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(orderTotal)}</span>
          </div>
          <button
            type="button"
            onClick={handlePayNow}
            disabled={
              !isFormValid ||
              isPaying ||
              isBelowPayMongoMinimum
            }
            className="w-full text-white rounded-full py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#239459' }}
          >
            {isPaying
              ? 'Processing payment...'
              : `Pay ${formatCurrency(orderTotal)}`}
          </button>
          {qrImage && (
            <div className="mt-3 p-3 border border-gray-200 dark:border-[#3f3f46] rounded-lg bg-gray-50 dark:bg-[#1c1c1c]">
              <p className="text-sm font-bold text-gray-900 mb-1 text-center">Scan QR Code to Pay</p>
              <p className="text-xs text-gray-500 mb-2 text-center">
                Scan this QR code using your preferred banking or e-wallet app (Maya, GCash, BDO, BPI, etc.) to complete your payment.
              </p>
              <div className="flex justify-center">
                <img src={qrImage} alt="QR Ph" className="w-56 h-56 object-contain" />
              </div>
              <button
                type="button"
                onClick={dismissQr}
                className="mt-3 w-full py-2 bg-gray-100 dark:bg-[#262626] rounded-xl text-sm font-bold text-gray-700 dark:text-[#e4e4e7] hover:bg-gray-200 dark:hover:bg-[#333333]"
              >
                Cancel Payment
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
