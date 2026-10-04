'use client';

import React, { memo } from 'react';
import type { AchievementUI } from '@/types/loyalty';

interface AchievementCardProps {
  achievement: AchievementUI;
  claimingId?: string | number | null;
  /** Global mutation lock — see RewardCard. */
  mutating?: boolean;
  onClaim: (achievement: AchievementUI) => void;
}

const ICONS: Record<string, string> = {
  target: 'fas fa-bullseye',
  utensils: 'fas fa-utensils',
  star: 'fas fa-star',
  crown: 'fas fa-crown',
};

export default memo(function AchievementCard({ achievement, claimingId, mutating = false, onClaim }: AchievementCardProps) {
  const busy = claimingId != null && String(claimingId) === String(achievement.id);
  const pct = Math.min(100, achievement.progressPct);

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
            achievement.isCompleted ? 'bg-green-100' : 'bg-gray-100'
          }`}
        >
          <i
            className={`${ICONS[achievement.icon] || 'fas fa-trophy'} text-lg ${
              achievement.isCompleted ? '' : 'text-gray-400'
            }`}
            style={achievement.isCompleted ? { color: '#239459' } : {}}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-extrabold text-gray-900 truncate">{achievement.title}</p>
            {achievement.isCompleted && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-green-100 text-green-800 flex-shrink-0">
                {achievement.isClaimed ? 'CLAIMED' : 'COMPLETED'}
              </span>
            )}
          </div>
          {achievement.description && <p className="text-xs text-gray-500 mt-0.5">{achievement.description}</p>}
          <p className="text-xs font-bold mt-1" style={{ color: '#239459' }}>
            <i className="fas fa-coins mr-1" />
            +{achievement.pointsReward.toLocaleString()} pts
          </p>
        </div>
      </div>

      {!achievement.isCompleted && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
            <span>{achievement.progress.toLocaleString()} / {achievement.target.toLocaleString()}</span>
            <span className="font-bold">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#239459' }} />
          </div>
        </div>
      )}

      {achievement.isCompleted && !achievement.isClaimed && (
        <button
          type="button"
          onClick={() => onClaim(achievement)}
          disabled={busy || mutating}
          className="mt-3 w-full py-2.5 text-white rounded-xl font-bold text-[13px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
          style={{ backgroundColor: '#239459' }}
        >
          {busy ? (
            <span><i className="fas fa-spinner fa-spin mr-2" />Claiming…</span>
          ) : (
            <span><i className="fas fa-gift mr-2" />Claim {achievement.pointsReward.toLocaleString()} pts</span>
          )}
        </button>
      )}
    </article>
  );
})
