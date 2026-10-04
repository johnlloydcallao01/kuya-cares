'use client';

import React, { memo } from 'react';
import Image from '@/components/ui/ImageWrapper';
import { rewardCategoryStyle, type RewardUI } from '@/types/loyalty';

interface RewardCardProps {
  reward: RewardUI;
  balance: number;
  redeemingId?: string | number | null;
  /** Global mutation lock: while ANY redeem/claim is in flight, all cards
      go inert so stale-balance double-taps on different rewards can't both
      pass the affordability check. */
  mutating?: boolean;
  onRedeem: (reward: RewardUI) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  food: 'fas fa-utensils',
  delivery: 'fas fa-motorcycle',
  discount: 'fas fa-percent',
  exclusive: 'fas fa-crown',
};

export default memo(function RewardCard({ reward, balance, redeemingId, mutating = false, onRedeem }: RewardCardProps) {
  const busy = redeemingId != null && String(redeemingId) === String(reward.id);
  const need = Math.max(0, reward.pointsCost - balance);
  const canRedeem = reward.isAvailable && need === 0 && !mutating;

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 bg-green-50 border border-green-100">
            {reward.imageUrl ? (
              <Image src={reward.imageUrl} alt={reward.title} width={48} height={48} className="object-cover w-full h-full" />
            ) : (
              <i className={`${CATEGORY_ICONS[reward.category] || 'fas fa-gift'} text-lg`} style={{ color: '#239459' }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-extrabold text-gray-900 truncate">{reward.title}</p>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize flex-shrink-0 ${rewardCategoryStyle(reward.category)}`}>
                {reward.category}
              </span>
            </div>
            {reward.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{reward.description}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-extrabold" style={{ color: '#239459' }}>
            <i className="fas fa-coins text-xs" />
            {reward.pointsCost.toLocaleString()} pts
          </span>
          {reward.stock != null && (
            <span className="text-[11px] text-gray-400">{reward.stock} left</span>
          )}
        </div>

        {reward.terms.length > 0 && (
          <ul className="mt-2.5 space-y-1">
            {reward.terms.slice(0, 3).map((t, i) => (
              <li key={i} className="flex gap-2 text-[11px] text-gray-500">
                <span className="w-1 h-1 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        )}
        {reward.hasVoucher && (
          <p className="mt-2 text-[11px] font-bold text-green-700">
            <i className="fas fa-ticket-alt mr-1" />
            Issues a voucher to your wallet
          </p>
        )}

        <button
          type="button"
          onClick={() => onRedeem(reward)}
          disabled={!canRedeem || busy}
          className={`mt-4 w-full py-2.5 rounded-xl font-bold text-[13px] transition-all active:scale-[0.98] ${
            canRedeem
              ? 'bg-white text-[#239459] border border-[#239459] hover:bg-[#239459] hover:text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {busy ? (
            <span><i className="fas fa-spinner fa-spin mr-2" />Redeeming…</span>
          ) : !reward.isAvailable ? (
            'Not Available'
          ) : need > 0 ? (
            `Need ${need.toLocaleString()} more pts`
          ) : (
            'Redeem Now'
          )}
        </button>
      </div>
    </article>
  );
})
