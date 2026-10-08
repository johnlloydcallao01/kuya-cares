'use client';

import React from 'react';
import Image from '@/components/ui/ImageWrapper';

interface OrderHeaderProps {
  onBack: () => void;
  merchantLogo?: string | null;
  restaurantName: string;
  status: string;
  placedAt: string;
  orderNumber: string;
}

import { getStatusColor, getStatusIcon } from '@/types/order';

export { getStatusColor, getStatusIcon };

export default function OrderHeader({
  onBack,
  merchantLogo,
  restaurantName,
  status,
  placedAt,
  orderNumber,
}: OrderHeaderProps) {
  return (
    <div className="bg-white dark:bg-[#111111] shadow-sm">
      <div className="w-full px-4 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#262626] transition-colors"
              aria-label="Back"
            >
              <i className="fas fa-arrow-left text-gray-600 dark:text-gray-300"></i>
            </button>
            {merchantLogo && (
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#202020] flex items-center justify-center overflow-hidden flex-shrink-0">
                <Image
                  src={merchantLogo}
                  alt={restaurantName || 'Restaurant logo'}
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  {restaurantName}
                </h1>
                <div
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${getStatusColor(
                    status
                  )}`}
                >
                  <i className={`${getStatusIcon(status)} mr-1`}></i>
                  {status
                    .split('_')
                    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')}
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Ordered on {placedAt} • {orderNumber}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
