'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import Image from '@/components/ui/ImageWrapper';
import { formatPHP, getStatusMeta, type OrderUI } from '@/types/order';

interface OrderReceiptModalProps {
  order: OrderUI | null;
  onClose: () => void;
  onTrack: (order: OrderUI) => void;
}

export default function OrderReceiptModal({ order, onClose, onTrack }: OrderReceiptModalProps) {
  React.useEffect(() => {
    if (order) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [order]);

  if (!order) return null;
  const meta = getStatusMeta(order.status);

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#171717] rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-3 border-b border-dashed border-gray-200 dark:border-[#383838]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">Receipt</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{order.orderNumber} • {order.placedAt}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.pill}`}>
              <i className={`${meta.icon} mr-1.5`} />{meta.label}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 capitalize">{order.fulfillmentType} • {order.paymentMethod?.replace(/_/g, ' ') || 'Cash'}</span>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{order.restaurant}</p>
          <div className="space-y-3 mb-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <Image src={item.image} alt={item.name} width={44} height={44} className="w-11 h-11 rounded-lg object-cover bg-gray-100 dark:bg-[#252525] border border-gray-100 dark:border-[#333333] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {item.quantity}x {item.name}
                  </p>
                  {item.options.length > 0 && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {item.options.map((o) => `+ ${o.name}`).join(', ')}
                    </p>
                  )}
                </div>
                <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 flex-shrink-0">{formatPHP(item.totalPrice)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-200 dark:border-[#383838] pt-3 space-y-1.5 text-[13px]">
            <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>Subtotal</span><span>{formatPHP(order.subtotal)}</span></div>
            <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>Delivery fee</span><span>{formatPHP(order.deliveryFee)}</span></div>
            <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>Service fee</span><span>{formatPHP(order.platformFee)}</span></div>
            {(order.priorityFee ?? 0) > 0 && (
              <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>Priority fee</span><span>{formatPHP(order.priorityFee ?? 0)}</span></div>
            )}
            {(order.discountTotal ?? 0) > 0 && (
              <div className="flex justify-between text-green-700 dark:text-green-300 font-semibold"><span>Discount</span><span>-{formatPHP(order.discountTotal ?? 0)}</span></div>
            )}
            <div className="flex justify-between text-[15px] font-extrabold text-gray-900 dark:text-white pt-2 border-t border-gray-100 dark:border-[#383838]">
              <span>Total</span><span>{formatPHP(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-[#383838] flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-[#292929] rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#383838]">
            Close
          </button>
          {meta.group === 'active' && (
            <button
              onClick={() => { onTrack(order); onClose(); }}
              className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold hover:opacity-90"
              style={{ backgroundColor: '#239459' }}
            >
              Track Order
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
