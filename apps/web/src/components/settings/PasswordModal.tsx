'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PasswordModalProps {
  isOpen: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (currentPassword: string, newPassword: string) => void;
}

function passwordScore(pw: string): { score: number; label: string; bar: string } {
  if (!pw) return { score: 0, label: 'Empty', bar: 'bg-gray-200' };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: 20, label: 'Very weak', bar: 'bg-red-500' };
  if (s === 2) return { score: 40, label: 'Weak', bar: 'bg-orange-500' };
  if (s === 3) return { score: 60, label: 'Fair', bar: 'bg-yellow-500' };
  if (s === 4) return { score: 80, label: 'Strong', bar: 'bg-emerald-500' };
  return { score: 100, label: 'Very strong', bar: 'bg-emerald-600' };
}

export default function PasswordModal({ isOpen, submitting, onClose, onSubmit }: PasswordModalProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setShow(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const mismatch = next !== '' && confirm !== '' && next !== confirm;
  const canSubmit = !submitting && current !== '' && next.length >= 8 && !mismatch;
  const score = passwordScore(next);

  const inputCls =
    'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:bg-white';
  const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5';

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-extrabold text-gray-900">Change password</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          8–40 characters with uppercase, number and special character. All other devices sign out.
        </p>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Current password</label>
            <input
              type={show ? 'text' : 'password'}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={inputCls}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className={labelCls}>New password</label>
            <input
              type={show ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={inputCls}
              autoComplete="new-password"
            />
          </div>
          {next !== '' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Strength</span>
                <span className="text-xs font-bold text-gray-700">{score.label}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${score.bar} transition-all duration-300`} style={{ width: `${score.score}%` }} />
              </div>
            </div>
          )}
          <div>
            <label className={labelCls}>Confirm new password</label>
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`${inputCls} ${mismatch ? 'border-red-300' : ''}`}
              autoComplete="new-password"
            />
            {mismatch && <p className="text-xs text-red-600 mt-1">Passwords do not match.</p>}
          </div>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-600 cursor-pointer">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="w-4 h-4 accent-green-700" />
            Show passwords
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={() => canSubmit && onSubmit(current, next)}
            disabled={!canSubmit}
            className="flex-1 py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#239459' }}
          >
            {submitting ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-key mr-2" />}
            Update password
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
