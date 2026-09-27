'use client';

import React from 'react';
import Link from 'next/link';
import Image from '@/components/ui/ImageWrapper';
import { formatPHP, formatOrderDateTime, getStatusMeta, type OrderUI } from '@/types/order';

interface OrderCardProps {
  order: OrderUI;
  rawPlacedAt?: string;
  onTrack: (order: OrderUI) => void;
  onReorder: (order: OrderUI) => void;
  onRate: (order: OrderUI) => void;
  onCancel: (order: OrderUI) => void;
  onReceipt: (order: OrderUI) => void;
  onCopy: (order: OrderUI) => void;
  reorderingId?: string | null;
  cancellingId?: string | null;
}

export default function OrderCard({
  order,
  onTrack,
  onReorder,
  onRate,
  onCancel,
  onReceipt,
  onCopy,
  reorderingId,
  cancellingId,
}: OrderCardProps) {
  const meta = getStatusMeta(order.status);
  const isActive = meta.group === 'active';
  const isDelivered = order.status === 'delivered';
  const isCancellable = order.status === 'pending' || order.status === 'accepted';
  const visibleItems = order.items.slice(0, 5);
  const extraCount = Math.max(0, order.items.length - visibleItems.length);
  const totalQty = order.items.reduce((s, i) => s + (i.quantity || 0), 0);
  const isBusy = reorderingId === order.orderId || cancellingId === order.orderId;

  return (
    <article
      className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all duration-300 ${
        isActive ? 'border-green-100 ring-1 ring-green-50' : 'border-gray-100'
      }`}
    >
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
              {order.merchantLogo ? (
                <Image
                  src={order.merchantLogo}
                  alt={order.restaurant}
                  width={44}
                  height={44}
                  className="object-contain"
                />
              ) : (
                <i className="fas fa-store text-gray-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{order.restaurant}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                <button
                  type="button"
                  onClick={() => onCopy(order)}
                  title="Copy order number"
                  className="text-[11px] text-gray-500 hover:text-gray-800 font-medium"
                >
                  {order.orderNumber} <i className="far fa-copy ml-0.5 text-[10px]" />
                </button>
                <span className="text-[11px] text-gray-300">•</span>
                <span className="text-[11px] text-gray-500">
                  {order.placedAt || formatOrderDateTime(String(order.placedAtTs))}
                </span>
                <span className="text-[11px] text-gray-300">•</span>
                <span className="text-[11px] text-gray-500 capitalize">
                  <i className={`fas ${order.fulfillmentType === 'pickup' ? 'fa-shopping-bag' : 'fa-motorcycle'} mr-1`} />
                  {order.fulfillmentType}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${meta.dot} ${isActive ? 'animate-pulse' : ''}`} />
              {meta.label}
            </span>
            {order.isPaid && (
              <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                <i className="fas fa-lock mr-1" />Paid
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <Link href={`/orders/${order.orderId}`} className="block">
        <div className="p-4">
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {visibleItems.map((item) => (
              <div key={item.id} className="flex-shrink-0 w-[76px]">
                <div className="relative">
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={76}
                    height={76}
                    className="w-[76px] h-[76px] object-cover rounded-xl bg-gray-100 border border-gray-100"
                  />
                  {item.quantity > 1 && (
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                      x{item.quantity}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-700 mt-1.5 line-clamp-2 leading-tight font-medium">
                  {item.quantity}x {item.name}
                </p>
                <p className="text-[10px] text-gray-900 font-bold mt-0.5">{formatPHP(item.totalPrice)}</p>
              </div>
            ))}
            {extraCount > 0 && (
              <div className="flex-shrink-0 w-[76px]">
                <div className="w-[76px] h-[76px] rounded-xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-500">
                  <span className="text-sm font-bold">+{extraCount}</span>
                  <span className="text-[10px]">more</span>
                </div>
              </div>
            )}
            {order.items.length === 0 && (
              <p className="text-xs text-gray-400 py-4">No items found for this order.</p>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-gray-200">
            <span className="text-xs text-gray-500">
              {totalQty} item{totalQty === 1 ? '' : 's'}
              {order.paymentMethod ? ` • ${order.paymentMethod.replace(/_/g, ' ')}` : ''}
            </span>
            <span className="text-right">
              <span className="text-[11px] text-gray-500 mr-1.5">Total</span>
              <span className="font-extrabold text-gray-900 text-base">{formatPHP(order.total)}</span>
            </span>
          </div>
        </div>
      </Link>

      {/* Actions — Shopee / Foodpanda style */}
      <div className="px-4 pb-4 flex flex-wrap gap-2">
        {isActive && (
          <button
            type="button"
            onClick={() => onTrack(order)}
            className="flex-1 min-w-[130px] py-2.5 px-4 text-white rounded-xl font-bold text-[13px] shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
            style={{ backgroundColor: '#239459' }}
          >
            <i className="fas fa-map-marker-alt mr-2" />
            {order.status === 'pending' ? 'View Status' : 'Track Order'}
          </button>
        )}
        {(isDelivered || order.status === 'cancelled') && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onReorder(order)}
            className="flex-1 min-w-[130px] py-2.5 px-4 text-white rounded-xl font-bold text-[13px] shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
            style={{ backgroundColor: '#239459' }}
          >
            {reorderingId === order.orderId ? (
              <span><i className="fas fa-spinner fa-spin mr-2" />Adding…</span>
            ) : (
              <span><i className="fas fa-redo mr-2" />Buy Again</span>
            )}
          </button>
        )}
        <Link
          href={`/orders/${order.orderId}`}
          className="flex-1 min-w-[110px] py-2.5 px-4 bg-gray-100 text-gray-800 rounded-xl font-bold text-[13px] text-center hover:bg-gray-200 active:scale-[0.98] transition-all"
        >
          Details
        </Link>
        <button
          type="button"
          onClick={() => onReceipt(order)}
          className="py-2.5 px-3.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-[13px] hover:bg-gray-50 active:scale-[0.98] transition-all"
          title="View receipt"
        >
          <i className="fas fa-receipt" />
        </button>
        {isDelivered && (
          <button
            type="button"
            onClick={() => onRate(order)}
            className="py-2.5 px-3.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl font-bold text-[13px] hover:bg-amber-100 active:scale-[0.98] transition-all"
            title="Rate order"
          >
            <i className="fas fa-star mr-1" />Rate
          </button>
        )}
        {isCancellable && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onCancel(order)}
            className="py-2.5 px-3.5 bg-white border border-red-200 text-red-600 rounded-xl font-bold text-[13px] hover:bg-red-50 active:scale-[0.98] transition-all disabled:opacity-60"
            title="Cancel order"
          >
            {cancellingId === order.orderId ? (
              <i className="fas fa-spinner fa-spin" />
            ) : (
              'Cancel'
            )}
          </button>
        )}
      </div>
    </article>
  );
}
