'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface RateOrderModalProps {
  isOpen: boolean;
  restaurantName: string;
  orderNumber: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
}

export default function RateOrderModal({
  isOpen,
  restaurantName,
  orderNumber,
  submitting,
  onClose,
  onSubmit,
}: RateOrderModalProps) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRating(5);
      setHover(0);
      setComment('');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#171717] rounded-2xl w-full max-w-md shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Rate your order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {restaurantName} • {orderNumber}
        </p>

        <div className="flex items-center justify-center gap-1.5 mb-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(s)}
              className="text-3xl transition-transform hover:scale-110"
              aria-label={`${s} star`}
            >
              <i
                className={`${s <= (hover || rating) ? 'fas' : 'far'} fa-star ${
                  s <= (hover || rating)                   ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'
                }`}
              />
            </button>
          ))}
        </div>
        <p className="text-center text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">
          {rating === 5 ? 'Excellent!' : rating === 4 ? 'Good' : rating === 3 ? 'Okay' : rating === 2 ? 'Poor' : 'Terrible'}
        </p>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Tell us about the food, packaging, delivery… (optional)"
          className="w-full px-3 py-2.5 bg-white dark:bg-[#202020] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 border border-gray-200 dark:border-[#383838] rounded-xl text-sm focus:ring-2 focus:border-transparent outline-none resize-none"
        />

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 bg-gray-100 dark:bg-[#292929] text-gray-700 dark:text-gray-200 rounded-xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-[#383838] disabled:opacity-60"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => onSubmit(rating, comment.trim())}
            disabled={submitting || rating < 1}
            className="flex-1 py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#239459' }}
          >
            {submitting ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-paper-plane mr-2" />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
