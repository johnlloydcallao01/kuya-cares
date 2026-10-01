'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DeleteAddressDialogProps {
  open: boolean;
  addressText?: string | null;
  deleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Professional delete confirmation — same visual language as the
 * addresses-page dialog. Replaces window.confirm in quick flows
 * (LocationSelector modal, checkout section). tap2go parity: explicit
 * Cancel vs destructive Delete choice.
 */
export default function DeleteAddressDialog({
  open,
  addressText,
  deleting = false,
  onCancel,
  onConfirm,
}: DeleteAddressDialogProps) {
  useEffect(() => {
    if (!open || deleting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, deleting, onCancel]);

  if (!open || typeof document === 'undefined') return null;

  // Portaled to body: escapes transformed ancestors (desktop modal wrapper
  // uses translate-x, which would otherwise contain this fixed overlay) and
  // sits above every modal. Parent modals must ignore clicks/Escape inside
  // [data-delete-dialog] (see LocationSelector guards).
  return createPortal(
    <div
      data-delete-dialog
      className="fixed inset-0 z-[100002] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
      aria-label="Delete address confirmation"
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <i className="fa fa-trash text-red-600 text-sm" />
          </div>
          <h3 className="text-base font-extrabold text-gray-900">Delete this address?</h3>
        </div>
        {!!addressText && (
          <p className="text-sm text-gray-500 mb-1 line-clamp-2">{addressText}</p>
        )}
        <p className="text-xs text-gray-400 mb-5">This action cannot be undone.</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-60"
          >
            Keep
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? <i className="fas fa-spinner fa-spin mr-2" /> : null}
            Yes, delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
