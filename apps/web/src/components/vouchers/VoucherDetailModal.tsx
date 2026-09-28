'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import Image from '@/components/ui/ImageWrapper';
import { discountIcon, discountLabel, expiryLabel, type VoucherUI } from '@/types/voucher';
import { formatPHP } from '@/types/order';

interface VoucherDetailModalProps {
  voucher: VoucherUI | null;
  claiming: boolean;
  onClose: () => void;
  onClaim: (voucher: VoucherUI) => void;
  onCopy: (voucher: VoucherUI) => void;
}

export default function VoucherDetailModal({ voucher, claiming, onClose, onClaim, onCopy }: VoucherDetailModalProps) {
  React.useEffect(() => {
    if (voucher) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [voucher]);

  if (!voucher) return null;

  const terms: string[] = [];
  if (voucher.minBasket != null) terms.push(`Minimum order of ${formatPHP(voucher.minBasket)}`);
  if (voucher.maxBasket != null) terms.push(`Maximum basket of ${formatPHP(voucher.maxBasket)}`);
  if (voucher.maxDiscount != null && voucher.discountType === 'percent')
    terms.push(`Discount capped at ${formatPHP(voucher.maxDiscount)}`);
  if (voucher.deliveryCap != null) terms.push(`Delivery discount capped at ${formatPHP(voucher.deliveryCap)}`);
  if (voucher.firstOrderOnly) terms.push('Valid for first orders only');
  if (voucher.allowedPaymentMethods?.length)
    terms.push(`Valid for: ${voucher.allowedPaymentMethods.join(', ').replace(/_/g, ' ')}`);
  if (voucher.appliesTo) terms.push(`Applies to: ${voucher.appliesTo.replace(/_/g, ' ')}`);
  if (voucher.expiresAt) terms.push(`Valid until ${new Date(voucher.expiresAt).toLocaleDateString('en-PH')}`);
  if (voucher.usesLeftForUser != null) terms.push(`${voucher.usesLeftForUser} use(s) left for you`);
  else if (voucher.usesLeft != null) terms.push(`${voucher.usesLeft} total redemptions left`);

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 bg-green-50 border border-green-100">
                {voucher.imageUrl ? (
                  <Image src={voucher.imageUrl} alt={voucher.title} width={48} height={48} className="object-cover w-full h-full" />
                ) : (
                  <i className={`${discountIcon(voucher.discountType, voucher.freeDelivery)} text-lg`} style={{ color: '#239459' }} />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-gray-900 truncate">{voucher.title}</h2>
                <p className="text-sm font-bold" style={{ color: '#239459' }}>{discountLabel(voucher)}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0" aria-label="Close">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="mt-3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg p-3 flex items-center justify-between gap-2">
            <span className="font-mono font-bold text-sm text-gray-800 tracking-wider truncate">{voucher.code}</span>
            <button
              type="button"
              onClick={() => onCopy(voucher)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 flex-shrink-0"
            >
              <i className="far fa-copy mr-1" />
              Copy
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {voucher.shortCopy && <p className="text-sm text-gray-600 mb-3">{voucher.shortCopy}</p>}
          <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-2">Terms & conditions</h3>
          {terms.length > 0 ? (
            <ul className="space-y-1.5">
              {terms.map((t, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-gray-400">No additional terms.</p>
          )}
          <p className="text-[11px] text-gray-400 mt-3">
            <i className="fas fa-calendar mr-1" />
            {expiryLabel(voucher)}
            {voucher.vendorName ? ` • ${voucher.vendorName}` : ''}
          </p>
        </div>

        <div className="p-4 border-t border-gray-100">
          {!voucher.claimed && !voucher.used && !voucher.isExpired ? (
            <button
              onClick={() => onClaim(voucher)}
              disabled={claiming}
              className="w-full py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#239459' }}
            >
              {claiming ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-plus-circle mr-2" />}
              Claim voucher
            </button>
          ) : (
            <button onClick={onClose} className="w-full py-2.5 bg-gray-100 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-200">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
