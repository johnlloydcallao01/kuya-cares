/**
 * Central loyalty/points domain types for apps/web.
 * Mirrors CMS /api/customer/loyalty/* BFF shapes.
 * @file src/types/loyalty.ts
 */

export interface TierInfo {
  name: string;
  multiplier: number;
  deliveredOrders: number;
  next: {
    name: string;
    minOrders: number;
    multiplier: number;
    ordersToNext: number;
    progressPct: number;
  } | null;
}

export interface PointsEntry {
  id: string | number;
  type: 'earn' | 'redeem' | 'expiry';
  points: number;
  pointsAfter: number;
  orderId?: string | number | null;
  expiresAt?: string | null;
  createdAt?: string;
}

export interface EarnRule {
  id: string | number;
  event: string;
  points: number;
  ratePerPeso: number;
  minOrderTotal: number;
  capPoints: number;
}

export interface RewardUI {
  id: string | number;
  title: string;
  description?: string | null;
  pointsCost: number;
  category: string;
  imageUrl?: string | null;
  stock?: number | null;
  isAvailable: boolean;
  terms: string[];
  hasVoucher: boolean;
  affordable: boolean;
}

export interface AchievementUI {
  id: string | number;
  title: string;
  description?: string | null;
  pointsReward: number;
  metric: string;
  target: number;
  progress: number;
  progressPct: number;
  isCompleted: boolean;
  isClaimed: boolean;
  icon: string;
}

export interface LoyaltySummary {
  customerId: string | number;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  thisMonthEarned: number;
  tier: TierInfo;
  recent: PointsEntry[];
}

export function entryMeta(type: string): { label: string; icon: string; amountClass: string } {
  switch (type) {
    case 'earn':
      return { label: 'Earned', icon: 'fas fa-plus-circle', amountClass: 'text-green-700' };
    case 'redeem':
      return { label: 'Redeemed', icon: 'fas fa-gift', amountClass: 'text-gray-900' };
    case 'expiry':
      return { label: 'Expired', icon: 'fas fa-calendar-times', amountClass: 'text-red-600' };
    default:
      return { label: type, icon: 'fas fa-coins', amountClass: 'text-gray-700' };
  }
}

export function rewardCategoryStyle(category: string): string {
  switch (category) {
    case 'food':
      return 'bg-orange-100 text-orange-800';
    case 'delivery':
      return 'bg-blue-100 text-blue-800';
    case 'discount':
      return 'bg-green-100 text-green-800';
    case 'exclusive':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export function tierStyle(name: string): string {
  switch (name) {
    case 'Silver':
      return 'bg-gray-200 text-gray-800';
    case 'Gold':
      return 'bg-amber-100 text-amber-800';
    case 'Platinum':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-orange-100 text-orange-800';
  }
}

export function earnRuleLabel(rule: EarnRule): { title: string; detail: string } {
  if (rule.event === 'order_delivered') {
    const rate = rule.ratePerPeso > 0 ? `1pt / ₱${Math.round(1 / rule.ratePerPeso)}` : `${rule.points} pts`;
    const min = rule.minOrderTotal > 0 ? ` • min ₱${rule.minOrderTotal}` : '';
    return { title: 'Complete orders', detail: `${rate}${min}` };
  }
  if (rule.event === 'review') return { title: 'Write reviews', detail: `${rule.points} pts per review` };
  if (rule.event === 'first_order') return { title: 'First order bonus', detail: `${rule.points} pts` };
  return { title: rule.event.replace(/_/g, ' '), detail: `${rule.points} pts` };
}
