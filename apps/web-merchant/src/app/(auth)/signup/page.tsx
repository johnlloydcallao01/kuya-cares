import { Suspense } from 'react';
import { Loader2 } from '@/components/ui/IconWrapper';
import { ClientOnly } from '@/components/ClientOnly';
import SignUpForm from './signup-form';
import type { MembershipPlan } from './signup-form';

// Plans are public, identical for every visitor, and change only when an admin
// edits them — so they are server-rendered (ISR) instead of client-fetched.
// No loading spinner, no client fetch on mount.
export const revalidate = 60;

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');

// Vendor-safe shape (mirrors CMS sanitizePlan — strips internal provider refs).
function sanitizePlanDoc(raw: Record<string, unknown>): MembershipPlan {
  return {
    id: (raw.id as string | number | undefined) ?? undefined,
    slug: typeof raw.slug === 'string' ? raw.slug : undefined,
    name: typeof raw.name === 'string' ? raw.name : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    price: typeof raw.price === 'number' ? raw.price : Number(raw.price ?? 0),
    currency: typeof raw.currency === 'string' ? raw.currency : 'PHP',
    billing_interval: typeof raw.billing_interval === 'string' ? raw.billing_interval : 'month',
    trial_days: typeof raw.trial_days === 'number' ? raw.trial_days : 0,
    commission_percent:
      typeof raw.commission_percent === 'number' ? raw.commission_percent : 0,
    transaction_fee: typeof raw.transaction_fee === 'number' ? raw.transaction_fee : 0,
    limits: (raw.limits as Record<string, number | null> | undefined) ?? undefined,
    capabilities:
      (raw.capabilities as Record<string, boolean | number | string | null> | undefined) ??
      undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
  };
}

async function getPlans(): Promise<{ plans: MembershipPlan[]; unavailable: boolean }> {
  try {
    const res = await fetch(
      `${CMS_BASE}/membership-plans?where[status][equals]=active&sort=display_order&limit=100`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return { plans: [], unavailable: true };
    const data = (await res.json().catch(() => ({}))) as { docs?: unknown };
    if (!Array.isArray(data.docs)) return { plans: [], unavailable: true };
    const plans = (data.docs as Record<string, unknown>[])
      .map(sanitizePlanDoc)
      .filter((p) => (p.slug ?? p.id ?? '') !== '');
    return { plans, unavailable: false };
  } catch {
    return { plans: [], unavailable: true };
  }
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <Loader2 className="h-8 w-8 animate-spin text-[#239459]" />
    </div>
  );
}

export default async function SignUpPage() {
  const { plans, unavailable } = await getPlans();
  return (
    <Suspense fallback={<PageFallback />}>
      <ClientOnly fallback={<PageFallback />}>
        <SignUpForm initialPlans={plans} plansUnavailable={unavailable} />
      </ClientOnly>
    </Suspense>
  );
}
