'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatPHP } from '@/types/order';

interface WithdrawModalProps {
  isOpen: boolean;
  balance: number;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (amount: number, destination: string) => void;
}

const DESTINATIONS = [
  { id: 'gcash', label: 'GCash', icon: 'fas fa-mobile-alt' },
  { id: 'maya', label: 'Maya', icon: 'fas fa-money-bill-wave' },
  { id: 'bank', label: 'Bank transfer', icon: 'fas fa-university' },
];

export default function WithdrawModal({ isOpen, balance, submitting, onClose, onSubmit }: WithdrawModalProps) {
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('gcash');
  const [account, setAccount] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setDestination('gcash');
      setAccount('');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const parsed = Number(String(amount).replace(/[^0-9.]/g, ''));
  const valid = Number.isFinite(parsed) && parsed >= 100 && parsed <= balance && account.trim().length >= 4;

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-extrabold text-gray-900">Withdraw funds</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Available: <span className="font-bold text-gray-800">{formatPHP(balance)}</span> • Min ₱100.00 • Manual review
        </p>

        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Destination</label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {DESTINATIONS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDestination(d.id)}
              className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-[12px] font-bold border transition-all ${
                destination === d.id ? 'text-white border-transparent shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
              style={destination === d.id ? { backgroundColor: '#239459' } : {}}
            >
              <i className={d.icon} />
              {d.label}
            </button>
          ))}
        </div>

        <input
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="Account number / mobile number"
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:bg-white mb-3"
        />
        <div className="relative mb-4">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₱</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Amount (min ₱100)"
            className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-extrabold outline-none focus:ring-2 focus:bg-white"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => valid && onSubmit(parsed, `${destination}:${account.trim()}`)}
            disabled={!valid || submitting}
            className="flex-1 py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#239459' }}
          >
            {submitting ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-arrow-up mr-2" />}
            Withdraw
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
