'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAddressChange } from '@/hooks/useAddressChange';
import { clearAllLocationCaches } from '@/lib/clear-location-caches';
import ImageWrapper from '@/components/ui/ImageWrapper';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from 'react-hot-toast';
import { CheckoutAddressSection } from '@/components/checkout/CheckoutAddressSection';
import { AddressService, LocationBasedMerchantService } from '@encreasl/client-services';
import { getPaymentOptions, type PaymentOption } from '@/app/actions/payments';
import {
  FALLBACK_PAYMENT_METHODS,
  logosFor,
} from '@/lib/payments/catalog';
import {
  PAYMONGO_MINIMUM_AMOUNT_PHP,
  clearPendingCheckoutSession,
  createPendingOrder,
  createPendingTransaction,
  fetchDeliveryQuote,
  findActiveCartLinkedOrder,
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
  const { user } = useAuthContext();
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

  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [priorityFee, setPriorityFee] = useState(0);
  const [deliveryDistanceMeters, setDeliveryDistanceMeters] = useState<number | null>(null);
  const [deliveryFeeLoading, setDeliveryFeeLoading] = useState(false);
  const [deliveryFeeError, setDeliveryFeeError] = useState<string | null>(null);
  const deliveryQuoteCacheKeyRef = useRef<string | null>(null);

  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrIntentId, setQrIntentId] = useState<string | null>(null);

  const reconcileInFlightRef = useRef(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasNavigatedToReturnRef = useRef(false);
  const payGuardRef = useRef(false);

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
  const isBelowPayMongoMinimum = subtotal < PAYMONGO_MINIMUM_AMOUNT_PHP;
  // Total mirrors mobile orderTotal: fees apply only when Lalamove is active.
  const orderTotal = subtotal + (deliveryAvailable ? deliveryFee + priorityFee : 0);

  // ---- identity + active address (mobile useActiveAddress equivalent) ----
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cid = await LocationBasedMerchantService.getCurrentCustomerId().catch(() => null);
        if (!active) return;
        setCustomerId(cid);
        if (!cid) {
          setActiveAddressId(null);
          return;
        }
        const userId = (user as any)?.id;
        if (!userId) {
          setActiveAddressId(null);
          return;
        }
        const res = await AddressService.getActiveAddress(userId, undefined, true);
        if (!active) return;
        setActiveAddressId(res.success && res.address ? String((res.address as any).id) : null);
      } catch {
        if (active) setActiveAddressId(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  // ---- delivery quote (Lalamove, checkout-only like mobile) ----
  const fetchQuote = useCallback(async () => {
    if (!Number.isFinite(merchantId) || !activeAddressId || !customerId) return;
    const cacheKey = `${merchantId}:${activeAddressId}`;
    if (deliveryQuoteCacheKeyRef.current === cacheKey) return;
    deliveryQuoteCacheKeyRef.current = cacheKey;
    setDeliveryFeeLoading(true);
    setDeliveryFeeError(null);
    try {
      const quote = await fetchDeliveryQuote({ merchantId, customerId });
      if (!quote.available) {
        setDeliveryAvailable(false);
        setDeliveryFee(0);
        setPriorityFee(0);
        setDeliveryDistanceMeters(null);
        return;
      }
      setDeliveryAvailable(true);
      setDeliveryFee(quote.deliveryFee);
      setPriorityFee(quote.priorityFee);
      setDeliveryDistanceMeters(quote.distanceMeters);
    } catch (err: any) {
      deliveryQuoteCacheKeyRef.current = null;
      setDeliveryFee(0);
      setDeliveryDistanceMeters(null);
      setDeliveryFeeError(err?.message || 'Could not estimate delivery fee');
    } finally {
      setDeliveryFeeLoading(false);
    }
  }, [merchantId, activeAddressId, customerId]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  // Address change invalidates the quote (mobile handleAddressSelected parity).
  useAddressChange(() => {
    clearAllLocationCaches();
    deliveryQuoteCacheKeyRef.current = null;
    fetchQuote();
  });

  const isFormValid = !!activeAddressId && !!paymentMethod;

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
    if (!customerId || !activeAddressId) {
      toast.error('Please select a delivery address');
      return;
    }
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }
    if (deliveryFeeLoading) {
      toast.error('We are still calculating your delivery fee.');
      return;
    }
    if (deliveryAvailable && deliveryFee <= 0) {
      toast.error(deliveryFeeError || 'We could not calculate your delivery fee. Please try again.');
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
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
      const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers.Authorization = `users API-Key ${apiKey}`;
      }

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

      // 2. Payment intent via CMS (centavos + metadata like mobile).
      const intentResponse = await fetch(`${API_BASE}/create-payment-intent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: Math.round(orderTotal * 100),
          currency: 'PHP',
          description: `Order from ${merchantName}`,
          metadata: {
            userId: (user as any)?.id,
            merchantId,
            addressId: activeAddressId,
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

      // 3-5. Pending order + delivery snapshot + items/cart link, then tx.
      const { orderId: createdOrderId } = await createPendingOrder({
        customerId,
        merchantId,
        activeAddressId,
        items: merchantItems,
        subtotal,
        deliveryFee: deliveryAvailable ? deliveryFee : 0,
        orderTotal,
        customerName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Customer',
        customerPhone: (user as any)?.phone || null,
      });
      await createPendingTransaction({
        orderId: createdOrderId,
        paymentIntentId: intentId,
        paymentMethod: paymentMethod as string,
        amount: orderTotal,
      });
      await savePendingCheckoutSession({
        customerId: String(customerId),
        merchantId: String(merchantId),
        orderId: String(createdOrderId),
        paymentIntentId: intentId,
        createdAt: new Date().toISOString(),
      });

      // 6. Attach → redirect / QR / success.
      const returnUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/checkout/${merchantId}/return?payment_intent_id=${encodeURIComponent(intentId)}&order_id=${encodeURIComponent(String(createdOrderId))}`
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
        redirectToReturn(intentId, String(createdOrderId));
        return;
      }
      throw new Error(`Unexpected payment status: ${status}`);
    } catch (error: any) {
      toast.error(error?.message || 'Checkout failed');
      if (customerId && Number.isFinite(merchantId)) {
        await clearPendingCheckoutSession(String(customerId), String(merchantId));
      }
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

  const distanceKm =
    deliveryDistanceMeters != null ? deliveryDistanceMeters / 1000 : null;

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
        <CheckoutAddressSection className="h-full" />

        <div className="bg-white dark:bg-[#111111] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-[#262626] space-y-3 h-full">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Order summary</h2>
            <span className="text-xs text-gray-500">
              {merchantItems.length} {merchantItems.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="space-y-2">
            {merchantItems.map((item) => (
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
                      {item.quantity}x {item.productName || 'Product'}
                    </div>
                    <div className="text-gray-900 font-semibold ml-2">
                      {formatCurrency(item.subtotal || 0)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Qty {item.quantity}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {deliveryFeeLoading ? (
              <div className="flex items-center justify-between text-gray-600">
                <span>Delivery Fee</span>
                <span className="inline-flex items-center gap-2">
                  <i className="fas fa-spinner fa-spin" /> Calculating…
                </span>
              </div>
            ) : deliveryAvailable ? (
              <>
                <div className="flex items-center justify-between text-gray-600">
                  <span className="inline-flex items-center gap-1.5">
                    Delivery Fee
                    {priorityFee > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                        <i className="fas fa-bolt" /> Priority
                      </span>
                    )}
                  </span>
                  <span>{formatCurrency(deliveryFee + priorityFee)}</span>
                </div>
                {priorityFee > 0 && (
                  <p className="text-[11px] text-gray-500">
                    Priority Delivery — faster rider matching ({formatCurrency(priorityFee)} fee)
                  </p>
                )}
                {distanceKm != null && deliveryFee > 0 && (
                  <p className="text-[11px] text-gray-500">Delivery Distance ~{distanceKm.toFixed(1)} km</p>
                )}
              </>
            ) : deliveryFeeError ? (
              <p className="text-xs text-red-600">Delivery fee unavailable — {deliveryFeeError}</p>
            ) : null}
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
              isBelowPayMongoMinimum ||
              deliveryFeeLoading ||
              (deliveryAvailable && deliveryFee <= 0)
            }
            className="w-full text-white rounded-full py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#239459' }}
          >
            {isPaying
              ? 'Processing payment...'
              : deliveryFeeLoading
                ? 'Calculating delivery fee...'
                : deliveryAvailable && deliveryFee <= 0
                  ? 'Delivery fee unavailable'
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
