'use client';

import React from 'react';
import Image from '@/components/ui/ImageWrapper';

type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'on_delivery'
  | 'delivered'
  | 'cancelled';

interface OrderHeaderProps {
  onBack: () => void;
  merchantLogo?: string | null;
  restaurantName: string;
  status: string;
  placedAt: string;
  orderNumber: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'delivered':
      return 'bg-green-100 text-green-800';
    case 'on_delivery':
      return 'bg-blue-100 text-blue-800';
    case 'ready_for_pickup':
      return 'bg-yellow-100 text-yellow-800';
    case 'preparing':
      return 'bg-orange-100 text-orange-800';
    case 'accepted':
      return 'bg-indigo-100 text-indigo-800';
    case 'pending':
      return 'bg-gray-100 text-gray-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'delivered':
      return 'fas fa-check-circle';
    case 'on_delivery':
      return 'fas fa-motorcycle';
    case 'ready_for_pickup':
      return 'fas fa-shopping-bag';
    case 'preparing':
      return 'fas fa-utensils';
    case 'accepted':
      return 'fas fa-clipboard-check';
    case 'pending':
      return 'fas fa-clock';
    case 'cancelled':
      return 'fas fa-times-circle';
    default:
      return 'fas fa-question-circle';
  }
};

export default function OrderHeader({
  onBack,
  merchantLogo,
  restaurantName,
  status,
  placedAt,
  orderNumber,
}: OrderHeaderProps) {
  return (
    <div className="bg-white shadow-sm">
      <div className="w-full px-4 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              aria-label="Back"
            >
              <i className="fas fa-arrow-left text-gray-600"></i>
            </button>
            {merchantLogo && (
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
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
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">
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
              <p className="text-xs sm:text-sm text-gray-500">
                Ordered on {placedAt} • {orderNumber}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
