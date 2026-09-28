'use client';

import React from 'react';
import Image from '@/components/ui/ImageWrapper';
import { discountIcon, discountLabel, expiryLabel, type VoucherUI } from '@/types/voucher';
import { formatPHP } from '@/types/order';

interface VoucherCardProps {
  voucher: VoucherUI;
  claimingId?: string | number | null;
  onClaim: (voucher: VoucherUI) => void;
  onCopy: (voucher: VoucherUI) => void;
  onDetail: (voucher: VoucherUI) => void;
}

export default function VoucherCard({ voucher, claimingId, onClaim, onCopy, onDetail }: VoucherCardProps) {
  const busy = claimingId != null && String(claimingId) === String(voucher.id);
  const dimmed = voucher.used || voucher.isExpired;

  return (
    <article
      className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all relative ${
        dimmed ? 'border-gray-100 opacity-75' : 'border-gray-100'
      }`}
    >
      <div
        className="absolute top-0 right-0 w-28 h-28 opacity-10 rounded-bl-full pointer-events-none"
        style={{ background: 'linear-gradient(to bottom right, #239459, #f59e0b)' }}
      />
      <div className="p-5 relative">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 bg-green-50 border border-green-100">
            {voucher.imageUrl ? (
              <Image src={voucher.imageUrl} alt={voucher.title} width={48} height={48} className="object-cover w-full h-full" />
            ) : (
              <i className={`${discountIcon(voucher.discountType, voucher.freeDelivery)} text-lg`} style={{ color: '#239459' }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-base font-extrabold text-gray-900 truncate">{voucher.title}</p>
              {voucher.featured && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 flex-shrink-0">
                  FEATURED
                </span>
              )}
            </div>
            <p className="text-lg font-bold" style={{ color: '#239459' }}>
              {discountLabel(voucher)}
            </p>
            {voucher.shortCopy && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{voucher.shortCopy}</p>}
            {voucher.vendorName && <p className="text-[11px] text-gray-400 mt-0.5">{voucher.vendorName}</p>}
          </div>
          {(voucher.used || voucher.isExpired) && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                voucher.used ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700'
              }`}
            >
              {voucher.used ? 'USED' : 'EXPIRED'}
            </span>
          )}
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

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-gray-500">
          <span>
            <i className="fas fa-calendar mr-1" />
            {expiryLabel(voucher)}
          </span>
          {voucher.minBasket != null && (
            <span>
              <i className="fas fa-shopping-basket mr-1" />
              Min {formatPHP(voucher.minBasket)}
            </span>
          )}
          {voucher.usesLeftForUser != null && (
            <span>
              <i className="fas fa-cut mr-1" />
              {voucher.usesLeftForUser} use{voucher.usesLeftForUser === 1 ? '' : 's'} left
            </span>
          )}
          {voucher.firstOrderOnly && (
            <span className="font-bold text-amber-700">First order only</span>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          {!voucher.claimed && !dimmed ? (
            <button
              type="button"
              onClick={() => onClaim(voucher)}
              disabled={busy}
              className="flex-1 py-2.5 text-white rounded-xl font-bold text-[13px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
              style={{ backgroundColor: '#239459' }}
            >
              {busy ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-plus-circle mr-2" />}
              Claim
            </button>
          ) : voucher.claimed && !dimmed ? (
            <div className="flex-1 py-2.5 bg-green-50 border border-green-200 text-green-800 rounded-xl font-bold text-[13px] text-center">
              <i className="fas fa-check-circle mr-2" />
              Claimed
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => onDetail(voucher)}
            className={`py-2.5 px-4 rounded-xl font-bold text-[13px] border transition-all ${
              !voucher.claimed && !dimmed
                ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                : 'flex-1 bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Details
          </button>
        </div>
      </div>
    </article>
  );
}
