'use client';

import React, { memo } from 'react';
import { shortAddress, typeBadge, type AddressUI } from '@/types/address';

interface AddressCardProps {
  address: AddressUI;
  activatingId?: string | null;
  onSetActive: (address: AddressUI) => void;
  onEdit: (address: AddressUI) => void;
  onDelete: (address: AddressUI) => void;
}

export default memo(function AddressCard({ address, activatingId, onSetActive, onEdit, onDelete }: AddressCardProps) {
  const badge = typeBadge(address.addressType);
  const busy = activatingId === address.id;

  return (
    <article
      className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all hover:shadow-md ${
        address.isActive ? 'border-green-200 ring-1 ring-green-100' : 'border-gray-100'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => onSetActive(address)}
            disabled={busy || address.isActive}
            title={address.isActive ? 'Active delivery address' : 'Set as active'}
            className={`w-6 h-6 mt-0.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
              address.isActive ? 'border-transparent text-white' : 'border-gray-300 hover:border-gray-400'
            }`}
            style={address.isActive ? { backgroundColor: '#239459' } : {}}
          >
            {busy ? (
              <i className="fas fa-spinner fa-spin text-[10px] text-gray-500" />
            ) : (
              address.isActive && <i className="fas fa-check text-[10px]" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.pill}`}>
                <i className={`${badge.icon} mr-1`} />
                {address.label || badge.label}
              </span>
              {address.isActive && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white"
                  style={{ backgroundColor: '#239459' }}
                >
                  ACTIVE
                </span>
              )}
              {address.isVerified && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                  <i className="fas fa-badge-check mr-1" />
                  Verified
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-gray-900 mt-1.5 leading-snug">{shortAddress(address)}</p>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{address.formattedAddress}</p>
            {(address.floorUnitRoom || address.deliveryInstructions) && (
              <p className="text-[11px] text-gray-400 mt-1 truncate">
                {[address.floorUnitRoom, address.deliveryInstructions].filter(Boolean).join(' • ')}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 flex gap-2">
        {!address.isActive && (
          <button
            type="button"
            onClick={() => onSetActive(address)}
            disabled={busy}
            className="flex-1 py-2 text-white rounded-xl font-bold text-[13px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
            style={{ backgroundColor: '#239459' }}
          >
            {busy ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-check mr-2" />}
            Set Active
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(address)}
          className="flex-1 py-2 bg-gray-100 text-gray-800 rounded-xl font-bold text-[13px] hover:bg-gray-200 active:scale-[0.98] transition-all"
        >
          <i className="fas fa-pen mr-2" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(address)}
          title="Delete address"
          className="py-2 px-3.5 bg-white border border-red-200 text-red-600 rounded-xl font-bold text-[13px] hover:bg-red-50 active:scale-[0.98] transition-all"
        >
          <i className="fas fa-trash" />
        </button>
      </div>
    </article>
  );
})
