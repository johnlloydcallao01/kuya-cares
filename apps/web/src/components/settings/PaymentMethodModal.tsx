'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { TOPUP_METHODS } from '@/types/wallet';
import { createPaymongoPaymentMethod } from '@/lib/client-services/wallet-service';

interface PaymentMethodModalProps {
  isOpen: boolean;
  customerName: string;
  customerEmail: string;
  submitting: boolean;
  onClose: () => void;
  onVault: (input: {
    providerMethodId: string;
    provider: string;
    brand?: string;
    last4?: string;
    expMonth?: number;
    expYear?: number;
    nickname?: string;
    isDefault?: boolean;
  }) => void;
}

function detectBrand(digits: string): string {
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^6/.test(digits)) return 'discover';
  if (/^35/.test(digits)) return 'jcb';
  return 'card';
}

function luhnValid(digits: string): boolean {
  if (digits.length < 15) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (!Number.isFinite(d)) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function expiryValid(expiry: string): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!m) return false;
  const mm = Number(m[1]);
  const yy = Number(m[2]);
  if (!Number.isFinite(mm) || !Number.isFinite(yy) || mm < 1 || mm > 12) return false;
  const now = new Date();
  const endOfMonth = new Date(2000 + yy, mm, 0, 23, 59, 59);
  return endOfMonth.getTime() >= now.getTime();
}

export default function PaymentMethodModal({
  isOpen,
  customerName,
  customerEmail,
  submitting,
  onClose,
  onVault,
}: PaymentMethodModalProps) {
  const [method, setMethod] = useState('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [nickname, setNickname] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMethod('card');
      setCardNumber('');
      setExpiry('');
      setCvc('');
      setNickname('');
      setIsDefault(false);
      setWorking(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const digits = cardNumber.replace(/\D/g, '');
  // Full gate before PayMongo tokenization: Luhn checksum + real calendar
  // month (01–12) + future expiry. The old check (>=15 digits + MM/YY shape)
  // let NaN months and past cards through to a processor round-trip.
  const cardValid =
    method !== 'card' ||
    (luhnValid(digits) && expiryValid(expiry) && cvc.replace(/\D/g, '').length >= 3);
  const canSubmit = !submitting && !working && cardValid;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setWorking(true);
    try {
      let pmId: string;
      let brand = method;
      let last4: string | undefined;
      let expMonth: number | undefined;
      let expYear: number | undefined;
      if (method === 'card') {
        const [mm, yy] = expiry.split('/');
        brand = detectBrand(digits);
        last4 = digits.slice(-4);
        expMonth = parseInt(mm, 10);
        expYear = parseInt(`20${yy}`, 10);
        pmId = await createPaymongoPaymentMethod({
          type: 'card',
          name: customerName || 'KuyaCares Customer',
          email: customerEmail || 'customer@example.com',
          card: { number: cardNumber, expMonth, expYear, cvc },
        });
      } else {
        pmId = await createPaymongoPaymentMethod({
          type: method,
          name: customerName || 'KuyaCares Customer',
          email: customerEmail || 'customer@example.com',
        });
        const label = TOPUP_METHODS.find((m) => m.id === method)?.label;
        brand = (label || method).toLowerCase().replace(/\s/g, '_');
      }
      onVault({
        providerMethodId: pmId,
        provider: 'paymongo',
        brand,
        last4,
        expMonth,
        expYear,
        nickname: nickname.trim() || undefined,
        isDefault,
      });
    } catch (e: any) {
      toast.error(e?.message || 'Card setup failed');
    } finally {
      setWorking(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:bg-white';

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-extrabold text-gray-900">Add payment method</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Vaulted securely with PayMongo — only a reference is stored, never your card number.
        </p>

        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Method</label>
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
          <div className="space-y-2.5 mb-3">
            <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} inputMode="numeric" placeholder="Card number" className={inputCls} />
            <div className="flex gap-2.5">
              <input value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="MM/YY" className={`${inputCls} flex-1`} />
              <input value={cvc} onChange={(e) => setCvc(e.target.value)} inputMode="numeric" placeholder="CVC" className={`${inputCls} flex-1`} />
            </div>
          </div>
        )}

        <div className="space-y-2.5 mb-3">
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Nickname (e.g. Personal Visa)" className={inputCls} />
          <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-600 cursor-pointer">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-4 h-4 accent-green-700" />
            Set as default checkout method
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={submitting || working}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#239459' }}
          >
            {submitting || working ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-credit-card mr-2" />}
            Save method
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
