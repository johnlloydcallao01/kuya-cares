'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Order success / thank-you page — mirrors mobile OrderSuccessScreen.
 * Reached from checkout (direct success) and the return page (after payment
 * confirmation + finalize). Static: no fetch, no polling. orderId and
 * merchantId arrive as query params.
 */
export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<OrderSuccessShell />}>
      <OrderSuccessContent />
    </Suspense>
  );
}

function OrderSuccessShell() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center animate-pulse">
        <div className="w-16 h-16 mx-auto mb-4 bg-green-50 rounded-full" />
        <div className="h-6 w-48 bg-gray-200 rounded mx-auto mb-2" />
        <div className="h-4 w-64 bg-gray-100 rounded mx-auto" />
      </div>
    </div>
  );
}

function OrderSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const merchantId = searchParams.get('merchantId') || '';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 pb-20">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-green-50 rounded-full flex items-center justify-center">
          <i className="fas fa-check-circle text-green-600 text-3xl" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Thank you for your order</h1>
        <p className="text-sm text-gray-500 mb-4">
          Your payment has been confirmed and your order is now with the merchant.
        </p>
        {orderId && (
          <span className="inline-block px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm font-bold mb-5">
            Order #{orderId}
          </span>
        )}

        <div className="text-left bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3 mb-6">
          <div className="flex items-start gap-3">
            <i className="fas fa-receipt text-gray-400 mt-0.5" />
            <p className="text-[13px] text-gray-600">Your order is recorded successfully.</p>
          </div>
          <div className="flex items-start gap-3">
            <i className="fas fa-shopping-cart text-gray-400 mt-0.5" />
            <p className="text-[13px] text-gray-600">Your cart for this order has been cleared.</p>
          </div>
          <div className="flex items-start gap-3">
            <i className="fas fa-clock text-gray-400 mt-0.5" />
            <p className="text-[13px] text-gray-600">You can monitor updates from the Orders tab.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.replace('/orders' as any)}
            className="w-full py-3 text-white rounded-xl font-bold text-sm hover:opacity-90"
            style={{ backgroundColor: '#eba236' }}
          >
            View Orders
          </button>
          <Link
            href={'/' as any}
            className="w-full py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-50 text-center"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
