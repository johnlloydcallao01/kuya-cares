'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { TOPUP_METHODS, type TopupMethod } from '@/types/wallet';
import {
  attachPaymongoMethod,
  createPaymongoPaymentMethod,
  requestTopup,
} from '@/lib/client-services/wallet-service';

interface TopupModalProps {
  isOpen: boolean;
  customerName: string;
  customerEmail: string;
  onClose: (refresh?: boolean) => void;
}

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

type Step = 'form' | 'working' | 'qr' | 'done';

export default function TopupModal({ isOpen, customerName, customerEmail, onClose }: TopupModalProps) {
  const [amount, setAmount] = useState('500');
  const [method, setMethod] = useState<TopupMethod>('gcash');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [statusMsg, setStatusMsg] = useState('');
  const [qrImage, setQrImage] = useState<string | null>(null);
  // Synchronous in-flight lock (§4 double-submit): setState alone leaves a
  // same-tick window where two taps create two PayMongo intents (double
  // charge). The ref flips before the first await, so re-entry is dead.
  const submittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setAmount('500');
      setMethod('gcash');
      setCardNumber('');
      setExpiry('');
      setCvc('');
      setStep('form');
      setStatusMsg('');
      setQrImage(null);
      submittingRef.current = false;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const parsedAmount = Number(String(amount).replace(/[^0-9.]/g, ''));
  const cardValid =
    method !== 'card' ||
    (cardNumber.replace(/\D/g, '').length >= 15 &&
      /^\d{2}\/\d{2}$/.test(expiry) &&
      cvc.replace(/\D/g, '').length >= 3);
  const canSubmit =
    Number.isFinite(parsedAmount) && parsedAmount >= 1 && cardValid && step === 'form';

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!canSubmit) {
      if (parsedAmount < 1) toast.error('Minimum top-up is ₱1.00');
      return;
    }
    // Never send placeholder PII to PayMongo: the page passes '' before auth
    // resolves, and the old fallback shipped customer@example.com as a real
    // billing email. Require the signed-in email instead.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      toast.error('Please sign in with a verified email to top up');
      return;
    }
    submittingRef.current = true;
    setStep('working');
    setStatusMsg('Creating top-up…');
    try {
      const topup = await requestTopup({ amount: parsedAmount });
      if (topup.gateway === 'manual' || !topup.paymentIntentId || !topup.clientKey) {
        setStep('done');
        setStatusMsg('Top-up request recorded. Balance updates after confirmation.');
        toast.success('Top-up request recorded');
        return;
      }
      setStatusMsg('Preparing payment…');
      let card: { number: string; expMonth: number; expYear: number; cvc: string } | undefined;
      if (method === 'card') {
        const [mm, yy] = expiry.split('/');
        card = {
          number: cardNumber,
          expMonth: parseInt(mm, 10),
          expYear: parseInt(`20${yy}`, 10),
          cvc,
        };
      }
      const pmId = await createPaymongoPaymentMethod({
        type: method,
        name: customerName || 'KuyaCares Customer',
        email: customerEmail,
        card,
      });
      setStatusMsg('Confirming payment…');
      const returnUrl =
        typeof window !== 'undefined' ? `${window.location.origin}/wallets?topup=return` : 'https://app.kuyacares.com/wallets';
      const result = await attachPaymongoMethod({
        paymentMethodId: pmId,
        intentId: topup.paymentIntentId,
        clientKey: topup.clientKey,
        returnUrl,
      });
      if (result.kind === 'redirect') {
        setStatusMsg('Redirecting to payment…');
        window.location.assign(result.url);
        return;
      }
      if (result.kind === 'qr') {
        setQrImage(result.imageUrl);
        setStep('qr');
        toast.success('Scan the QR to complete payment');
        return;
      }
      if (result.kind === 'succeeded') {
        setStep('done');
        setStatusMsg('Payment completed! Balance updates shortly.');
        toast.success('Top-up paid — balance updating');
        return;
      }
      setStep('done');
      setStatusMsg('Payment processing. Balance updates after confirmation.');
      toast('Top-up processing');
    } catch (e: any) {
      submittingRef.current = false;
      setStep('form');
      setStatusMsg('');
      toast.error(e?.message || 'Top-up failed');
    }
  };

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => onClose(step === 'done')}>
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-extrabold text-gray-900">Top up wallet</h2>
          <button onClick={() => onClose(step === 'done')} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Via PayMongo — card, GCash, GrabPay, Maya, QR Ph</p>

        {step === 'qr' && qrImage ? (
          <div className="text-center">
            <img src={qrImage} alt="Scan to pay" className="w-56 h-56 mx-auto rounded-xl border border-gray-100" />
            <p className="text-sm font-bold text-gray-800 mt-3">Scan to complete ₱{parsedAmount.toFixed(2)} top-up</p>
            <p className="text-xs text-gray-500 mt-1">Balance updates automatically after payment.</p>
            <button
              onClick={() => onClose(true)}
              className="mt-4 w-full py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90"
              style={{ backgroundColor: '#239459' }}
            >
              Done
            </button>
          </div>
        ) : step === 'done' ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 mx-auto mb-3 bg-green-50 rounded-full flex items-center justify-center">
              <i className="fas fa-check text-green-600 text-xl" />
            </div>
            <p className="text-sm font-bold text-gray-800">{statusMsg}</p>
            <button
              onClick={() => onClose(true)}
              className="mt-4 w-full py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90"
              style={{ backgroundColor: '#239459' }}
            >
              Back to wallet
            </button>
          </div>
        ) : (
          <>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Amount (PHP)</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className={`py-2 rounded-xl text-sm font-extrabold border transition-all ${
                    parsedAmount === q ? 'text-white border-transparent' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                  style={parsedAmount === q ? { backgroundColor: '#239459' } : {}}
                >
                  ₱{q.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="relative mb-4">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₱</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="Enter amount"
                className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-extrabold text-gray-900 outline-none focus:ring-2 focus:bg-white"
              />
            </div>

            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Payment method</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {TOPUP_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-bold border transition-all ${
                    method === m.id ? 'border-transparent text-white shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  style={method === m.id ? { backgroundColor: '#239459' } : {}}
                >
                  <i className={m.icon} />
                  {m.label}
                </button>
              ))}
            </div>

            {method === 'card' && (
              <div className="space-y-2.5 mb-4">
                <input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  inputMode="numeric"
                  placeholder="Card number"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:bg-white"
                />
                <div className="flex gap-2.5">
                  <input
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    placeholder="MM/YY"
                    className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:bg-white"
                  />
                  <input
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    inputMode="numeric"
                    placeholder="CVC"
                    className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:bg-white"
                  />
                </div>
              </div>
            )}

            {statusMsg && step === 'working' && (
              <p className="text-xs text-gray-500 mb-3">
                <i className="fas fa-spinner fa-spin mr-2" />
                {statusMsg}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onClose(false)}
                disabled={step === 'working'}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#239459' }}
              >
                {step === 'working' ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-plus-circle mr-2" />}
                Top up ₱{Number.isFinite(parsedAmount) ? parsedAmount.toFixed(2) : '0.00'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
