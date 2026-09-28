'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface EmailModalProps {
  isOpen: boolean;
  currentEmail: string;
  verified: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (newEmail: string) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailModal({ isOpen, currentEmail, verified, submitting, onClose, onSubmit }: EmailModalProps) {
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const valid = EMAIL_RE.test(email.trim()) && email.trim().toLowerCase() !== currentEmail.toLowerCase();

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-extrabold text-gray-900">Change email</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Current: <span className="font-bold text-gray-800">{currentEmail}</span>{' '}
          {verified ? (
            <span className="text-green-700 font-bold">(verified)</span>
          ) : (
            <span className="text-amber-700 font-bold">(unverified)</span>
          )}
          . A verification link goes to the new address — nothing changes until you confirm it.
        </p>

        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">New email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:bg-white"
        />

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={() => valid && onSubmit(email.trim())}
            disabled={!valid || submitting}
            className="flex-1 py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#239459' }}
          >
            {submitting ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-paper-plane mr-2" />}
            Send verification
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
