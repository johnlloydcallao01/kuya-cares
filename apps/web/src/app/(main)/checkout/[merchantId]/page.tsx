'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useAuthContext } from '@/contexts/AuthContext';
import ImageWrapper from '@/components/ui/ImageWrapper';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from 'react-hot-toast';
import { CheckoutAddressSection } from '@/components/checkout/CheckoutAddressSection';

type PaymentMethod =
  | 'card'
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
  const methodLogos: Record<
    PaymentMethod,
    { srcs: string[]; alt: string; label: string }
  > = {
    card: {
      srcs: ['/payment-logos/visa.svg', '/payment-logos/mastercard.svg'],
      alt: 'Cards',
      label: 'Cards (Visa/Mastercard)',
    },
    gcash: {
      srcs: ['/payment-logos/gcash.svg'],
      alt: 'GCash',
      label: 'GCash',
    },
    grab_pay: {
      srcs: ['/payment-logos/grabpay.svg'],
      alt: 'GrabPay',
      label: 'GrabPay',
    },
    paymaya: {
      srcs: ['/payment-logos/maya.svg'],
      alt: 'Maya',
      label: 'Maya',
    },
    billease: {
      srcs: ['/payment-logos/billease.svg'],
      alt: 'BillEase',
      label: 'BillEase (BNPL)',
    },
    dob: {
      srcs: ['/payment-logos/bpi.svg', '/payment-logos/unionbank.svg'],
      alt: 'Online Banking',
      label: 'Online Banking (BPI/UBP)',
    },
    brankas: {
      srcs: [
        '/payment-logos/bdo.svg',
        '/payment-logos/metrobank.svg',
        '/payment-logos/landbank.svg',
      ],
      alt: 'Online Banking',
      label: 'Online Banking (BDO/Metrobank/LandBank)',
    },
    qrph: {
      srcs: ['/payment-logos/qrph.svg'],
      alt: 'QR Ph',
      label: 'QR Ph',
    },
  };
  const params = useParams() as { merchantId?: string };
  const merchantIdParam = params?.merchantId || '';
  const merchantId = merchantIdParam ? Number(merchantIdParam) : NaN;
  const router = useRouter();
  const { items, isLoading } = useCart();
  const { user } = useAuthContext();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  // Card Payment State (validated via expiry string)
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState(''); // MM/YY
  const [cvc, setCvc] = useState('');
  
  const [isPaying, setIsPaying] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [clientKey, setClientKey] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);

  const isFormValid = useMemo(() => {
    if (!paymentMethod) return false;
    if (paymentMethod !== 'card') return true;

    const cleanCard = cardNumber.replace(/\D/g, '');
    if (cleanCard.length < 13 || cleanCard.length > 19) return false;

    if (!expiry || expiry.length < 5) return false;
    const [expMonth, expYear] = expiry.split('/');

    const month = parseInt(expMonth, 10);
    if (isNaN(month) || month < 1 || month > 12) return false;

    const year = parseInt(expYear, 10);
    if (isNaN(year)) return false;

    // Convert YY to YYYY
    const fullYear = 2000 + year;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    if (fullYear < currentYear) return false;
    if (fullYear === currentYear && month < currentMonth) return false;

    const cleanCvc = cvc.replace(/\D/g, '');
    if (cleanCvc.length < 3 || cleanCvc.length > 4) return false;

    return true;
  }, [paymentMethod, cardNumber, expiry, cvc]);

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
  const total = subtotal;

  const createPaymentMethod = async (): Promise<string | null> => {
    try {
      const pk = process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY_LIVE;
      if (!pk) {
        toast.error('Missing PayMongo public key');
        return null;
      }
      const billing = {
        name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Tap2Go Customer',
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

      if (paymentMethod === 'card') {
        const [expMonth, expYear] = expiry.split('/');
        payload.data.attributes.details = {
          card_number: cardNumber.replace(/\D/g, ''),
          exp_month: parseInt(expMonth, 10),
          exp_year: parseInt('20' + expYear, 10),
          cvc: cvc.replace(/\D/g, ''),
        };
      }

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

  const attachPaymentMethod = async (pmId: string, intentId: string, cKey: string) => {
    try {
      const pk = process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY_LIVE;
      if (!pk) throw new Error('Missing PayMongo public key');
      const returnUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/checkout/${merchantId}/return`
          : `https://app.tap2goph.com/checkout/${merchantId}/return`;
      const resp = await fetch(
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
        }
      );
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.errors?.[0]?.detail || 'Failed to attach payment method');
      }
      const attrs = data?.data?.attributes || {};
      const status = attrs?.status;
      const nextAction = attrs?.next_action;
      if (status === 'awaiting_next_action' && nextAction) {
        if (nextAction?.redirect?.url) {
          window.location.assign(nextAction.redirect.url);
          return;
        }
        if (nextAction?.code?.image_url) {
          setQrImage(nextAction.code.image_url);
          toast.success('Scan the QR to pay');
          return;
        }
      }
      if (status === 'succeeded') {
        toast.success('Payment completed');
        return;
      }
      toast('Payment processing started');
    } catch (e: any) {
      toast.error(e?.message || 'Attach failed');
    }
  };

  const handlePayNow = async () => {
    if (!Number.isFinite(subtotal) || subtotal <= 0 || isPaying || !isFormValid) return;
    setIsPaying(true);
    setPaymentIntentId(null);
    setClientKey(null);
    setQrImage(null);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
      console.log('Using API_BASE:', API_BASE); // Debug log

      const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers.Authorization = `users API-Key ${apiKey}`;
      }
      const amount = Math.round(subtotal * 100);
      const payload = { amount, currency: 'PHP' };
      console.log('Sending payload:', payload); // Debug log

      const response = await fetch(`${API_BASE}/create-payment-intent`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      console.log('Response status:', response.status); // Debug log
      
      const data = await response.json();
      console.log('Response data:', data); // Debug log

      if (!response.ok) {
        const payMongoErrors = data?.details?.errors;
        if (payMongoErrors && payMongoErrors.length > 0) {
          throw new Error(getPayMongoErrorMessage(payMongoErrors[0]));
        }
        const detail = data?.details ? JSON.stringify(data.details) : '';
        throw new Error((data?.error || 'Failed to create payment intent') + (detail ? ` ${detail}` : ''));
      }
      const intentId = data?.data?.id ? String(data.data.id) : null;
      const cKey = data?.data?.attributes?.client_key ? String(data.data.attributes.client_key) : null;
      setPaymentIntentId(intentId);
      setClientKey(cKey);
      toast.success('Payment intent created');

      if (!intentId || !cKey) {
        throw new Error('Missing intent/client_key from PayMongo');
      }
      const pmId = await createPaymentMethod();
      if (!pmId) return;
      await attachPaymentMethod(pmId, intentId, cKey);
    } catch (error: any) {
      toast.error(error?.message || 'Checkout failed');
    } finally {
      setIsPaying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm">
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
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
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
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm">
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="px-2.5 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/carts/${merchantId}` as any)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
          >
            <i className="fas fa-arrow-left text-gray-700 text-sm" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CheckoutAddressSection className="h-full" />
          
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3 h-full">
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
                        {item.productName || 'Product'}
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
              <div className="flex items-center justify-between font-semibold text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Payment method</h2>
          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(methodLogos) as PaymentMethod[])
              .filter((key) => key !== 'card') // Disable card payment temporarily
              .map((key: PaymentMethod) => {
              const logos = methodLogos[key];
              const selected = paymentMethod === key;
              return (
                <div key={key} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod(key)}
                    className="w-full rounded-lg border bg-white hover:bg-gray-50 transition-colors text-left"
                    style={{
                      borderColor: selected ? '#eba236' : '#e5e7eb',
                      boxShadow: selected ? '0 0 0 2px rgba(235,162,54,0.15)' : undefined,
                    }}
                  >
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="flex items-center gap-2">
                        {logos.srcs.map((src) => (
                          <div key={src} className="h-6 w-auto flex items-center">
                            <ImageWrapper src={src} alt={logos.alt} width={72} height={24} className="object-contain" />
                          </div>
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{logos.label}</span>
                    </div>
                  </button>

                  {selected && key === 'card' && (
                    <div className="p-4 border border-gray-100 rounded-lg bg-gray-50 space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">Card number</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={cardNumber}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              const formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
                              if (val.length <= 19) setCardNumber(formatted);
                            }}
                            placeholder="0000 0000 0000 0000"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                            maxLength={23} // 19 digits + 4 spaces
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-700">Expiry date</label>
                          <input
                            type="text"
                            value={expiry}
                            onChange={(e) => {
                              let val = e.target.value.replace(/\D/g, '');
                              if (val.length >= 3) {
                                val = val.slice(0, 2) + '/' + val.slice(2);
                              }
                              if (val.length <= 5) setExpiry(val);
                            }}
                            placeholder="MM/YY"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-700">CVC</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={cvc}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                if (val.length <= 4) setCvc(val);
                              }}
                              placeholder="123"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                              maxLength={4}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <button
            type="button"
            onClick={handlePayNow}
            disabled={isPaying || total <= 0 || !isFormValid}
            className="w-full text-white rounded-full py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#eba236' }}
          >
            {isPaying ? 'Processing payment...' : 'Pay now'}
          </button>
          {paymentIntentId && (
            <div className="text-xs text-gray-500 text-center">
              Payment intent: {paymentIntentId}
            </div>
          )}
          {qrImage && (
            <div className="mt-3 p-3 border rounded-lg bg-gray-50">
              <p className="text-xs text-gray-700 mb-2 text-center">Scan the QR Ph code to complete payment</p>
              <div className="flex justify-center">
                <img src={qrImage} alt="QR Ph" className="w-56 h-56 object-contain" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
