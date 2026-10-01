'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldAlert,
  Store,
  User,
} from '@/components/ui/IconWrapper';
import { useAuth } from '@/hooks/useAuth';

// Exact CMS enum (apps/cms register route BUSINESS_TYPES). Values must match
// 'restaurant'|'fast_food'|'grocery'|'pharmacy'|'convenience'|'bakery'|'coffee_shop'|'other'.
const BUSINESS_TYPES: { value: string; label: string }[] = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'fast_food', label: 'Fast Food' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'convenience', label: 'Convenience Store' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'coffee_shop', label: 'Coffee Shop' },
  { value: 'other', label: 'Other' },
];

const BUSINESS_TYPE_VALUES = new Set(BUSINESS_TYPES.map((t) => t.value));
const BUSINESS_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  BUSINESS_TYPES.map((t) => [t.value, t.label]),
);

// CMS billing intervals are exactly 'month'|'year'|'one_time'.
function normalizeInterval(raw: unknown): 'month' | 'year' | 'one_time' {
  const v = String(raw ?? 'month').trim().toLowerCase();
  if (v === 'year' || v === 'yearly' || v === 'annual') return 'year';
  if (v === 'one_time' || v === 'onetime' || v === 'one-time') return 'one_time';
  return 'month';
}

export type MembershipPlan = {
  id?: string | number;
  slug?: string;
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  billing_interval?: string;
  trial_days?: number;
  commission_percent?: number;
  transaction_fee?: number;
  limits?: Record<string, number | null>;
  capabilities?: Record<string, boolean | number | string | null>;
  status?: string;
};

function planSlugOf(p: MembershipPlan): string {
  const s = p.slug ?? p.id;
  return s == null || s === '' ? '' : String(s);
}

function planPriceOf(p: MembershipPlan): number {
  const n = Number(p.price ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmtPeso(v: number): string {
  return `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function limitText(v: number | null | undefined, unit: string): string | null {
  if (v == null) return null;
  if (v === -1) return `Unlimited ${unit}`;
  return `${v} ${unit}`;
}

// Feature rows built ONLY from real plan fields — never invented.
function planFeatures(p: MembershipPlan): string[] {
  const out: string[] = [];
  const limits = p.limits ?? {};
  const caps = p.capabilities ?? {};
  const outlets = limitText(limits.max_merchants as number | null | undefined, 'outlets');
  if (outlets) out.push(outlets);
  const products = limitText(limits.max_products as number | null | undefined, 'products');
  if (products) out.push(products);
  out.push(`${Number(p.commission_percent ?? 0)}% commission per order`);
  if (Number(p.transaction_fee ?? 0) > 0) out.push(`${fmtPeso(Number(p.transaction_fee))} per-order fee`);
  if (Number(p.trial_days ?? 0) > 0) out.push(`${p.trial_days}-day free trial`);
  const seats = Number(limits.staff_seats ?? 1);
  if (Number.isFinite(seats) && seats > 1) out.push(`${seats} staff seats`);
  const flag = (label: string, key: string) => {
    if (caps[key] === true) out.push(label);
  };
  flag('Online storefront', 'microstore');
  flag('Coupons & promos', 'promos');
  flag('Sales analytics', 'analytics');
  flag('Sponsored ads', 'ads');
  flag('API access', 'api_access');
  flag('Custom shipping rates', 'custom_shipping');
  flag('Multi-user access', 'multi_user');
  const boost = Number(caps.visibility_boost ?? 0);
  if (Number.isFinite(boost) && boost > 0) out.push(`Boosted listings +${boost}%`);
  const sla = String(caps.support_sla ?? 'email');
  out.push(sla === 'dedicated' ? 'Dedicated support' : sla === 'priority' ? 'Priority support' : sla === 'none' ? 'Community support' : 'Email support');
  return out;
}

// Growth Monthly is the best-value middle tier → highlighted recommendation.
function isPopularPlan(p: MembershipPlan): boolean {
  return planSlugOf(p) === 'growth-monthly';
}

const inputCls =
  'w-full pl-12 pr-4 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#239459] focus:border-[#215035] transition-all duration-200 text-sm disabled:bg-gray-100 dark:disabled:bg-[#262626] disabled:cursor-not-allowed';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-[#a1a1aa] mb-2';
const fieldErrorCls = 'mt-1 text-xs text-red-600 dark:text-red-400';

type DoneState =
  | { kind: 'idle' }
  | {
      kind: 'paymongo-missing';
      invoiceNumber: string;
      amount: number;
    };

interface StepArrowProps {
  index: number;
  label: string;
  state: 'done' | 'current' | 'todo';
  onClick: () => void;
  disabled: boolean;
}

// Arrow-shaped stepper segment. First segment has a flat left edge, the rest
// notch into the previous one — the standard professional onboarding look.
function StepArrow({ index, label, state, onClick, disabled }: StepArrowProps) {
  const first = index === 0;
  const clip = first
    ? 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)'
    : 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)';
  const bg =
    state === 'done'
      ? 'bg-[#239459] text-white'
      : state === 'current'
        ? 'bg-[#215035] text-white'
        : 'bg-gray-200 dark:bg-[#262626] text-gray-500 dark:text-[#a1a1aa]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state === 'todo'}
      style={{ clipPath: clip }}
      className={`flex-1 flex items-center justify-center gap-2 pl-4 pr-3 py-2.5 text-xs sm:text-sm font-semibold transition ${bg} ${state === 'todo' || disabled ? '' : 'cursor-pointer hover:brightness-110'} disabled:cursor-not-allowed`}
      aria-current={state === 'current' ? 'step' : undefined}
    >
      <span
        className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
          state === 'todo' ? 'bg-white/60 dark:bg-black/30 text-gray-600 dark:text-gray-300' : 'bg-white/20 text-white'
        }`}
      >
        {state === 'done' ? <Check className="w-3 h-3" /> : <span>{index + 1}</span>}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function SignUpForm({
  initialPlans,
  plansUnavailable,
}: {
  initialPlans: MembershipPlan[];
  plansUnavailable: boolean;
}) {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('');
  const [primaryContactEmail, setPrimaryContactEmail] = useState('');
  const [primaryContactPhone, setPrimaryContactPhone] = useState('');
  const [businessType, setBusinessType] = useState('restaurant');
  const [taxIdentificationNumber, setTaxIdentificationNumber] = useState('');

  // Plans arrive server-rendered via props — no client fetch on mount.
  const [plans, setPlans] = useState<MembershipPlan[]>(initialPlans);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState(
    plansUnavailable ? 'Membership plans are currently unavailable. Please try again later.' : '',
  );
  const [selectedPlanSlug, setSelectedPlanSlug] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState<DoneState>({ kind: 'idle' });
  // Once the final button's chain starts, global auth flips (login succeeds)
  // must NOT unmount this flow. This flag suppresses the signed-in panel until
  // the chain settles (success redirect or terminal failure panel).
  const [flowActive, setFlowActive] = useState(false);

  // Explicit user-triggered retry only. No automatic fetching on this page.
  async function retryPlans() {
    setPlansLoading(true);
    setPlansError('');
    try {
      const res = await fetch('/api/membership/plans', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { docs?: unknown };
      if (!res.ok || !Array.isArray(data.docs)) {
        setPlansError('Membership plans are currently unavailable. Please try again later.');
        return;
      }
      setPlans((data.docs as MembershipPlan[]).filter((p) => planSlugOf(p) !== ''));
    } catch {
      setPlansError('Membership plans are currently unavailable. Please try again later.');
    } finally {
      setPlansLoading(false);
    }
  }

  const selectedPlan = plans.find((p) => planSlugOf(p) === selectedPlanSlug) ?? null;
  const selectedInterval = selectedPlan
    ? normalizeInterval((selectedPlan as unknown as Record<string, unknown>).billing_interval)
    : 'month';
  const buttonPrice = selectedPlan ? planPriceOf(selectedPlan) : 0;

  function validateAccount(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (firstName.trim().length < 2) errs.firstName = 'First name is required.';
    if (lastName.trim().length < 2) errs.lastName = 'Last name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (password.length < 8) errs.password = 'Password must be at least 8 characters.';
    return errs;
  }

  function validateBusiness(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (businessName.trim().length < 2) errs.businessName = 'Business name is required.';
    if (legalName.trim().length < 2) errs.legalName = 'Legal name is required.';
    if (businessRegistrationNumber.trim().length < 1) errs.businessRegistrationNumber = 'Registration number is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryContactEmail.trim())) errs.primaryContactEmail = 'Enter a valid contact email.';
    if (primaryContactPhone.trim().length < 1) errs.primaryContactPhone = 'Contact phone is required.';
    if (!BUSINESS_TYPE_VALUES.has(businessType)) errs.businessType = 'Select a valid business type.';
    return errs;
  }

  function validatePlan(): Record<string, string> {
    if (selectedPlanSlug === '' || !selectedPlan) return { plan: 'Choose a membership plan to continue.' };
    return {};
  }

  function goNext() {
    setFormError('');
    setFieldErrors({});
    const errs = step === 0 ? validateAccount() : step === 1 ? validateBusiness() : validatePlan();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setFormError('Please complete the highlighted fields.');
      return;
    }
    setStep((s) => Math.min(s + 1, 3));
  }

  function goBack() {
    setFormError('');
    setFieldErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  function goToStep(i: number) {
    if (i >= step) return;
    setFormError('');
    setFieldErrors({});
    setStep(i);
  }

  // THE ONLY write trigger on this page. Nothing else here fires requests that
  // mutate anything or navigates anywhere. Chain: register -> login -> checkout.
  // If PayMongo is not integrated, checkout returns no checkoutUrl and we show
  // the honest failure panel instead of redirecting.
  async function handleRegisterAndPay(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError('');
    setFieldErrors({});
    const errs = { ...validateAccount(), ...validateBusiness(), ...validatePlan() };
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setFormError(errs.plan ?? 'Please complete the highlighted fields.');
      if (Object.keys(validateAccount()).length > 0) setStep(0);
      else if (Object.keys(validateBusiness()).length > 0) setStep(1);
      else setStep(2);
      return;
    }
    const plan = plans.find((p) => planSlugOf(p) === selectedPlanSlug) ?? null;
    if (!plan) {
      setFieldErrors({ plan: 'Choose a membership plan to continue.' });
      setStep(2);
      return;
    }
    const billingInterval = normalizeInterval(
      (plan as unknown as Record<string, unknown>).billing_interval,
    );

    setIsSubmitting(true);
    setFlowActive(true);
    // Overall deadline: the button can never spin forever. Any unsettled hop is
    // aborted and reported instead of hanging on "Processing...".
    const ctrl = new AbortController();
    const deadline = setTimeout(() => ctrl.abort(), 180000);
    const timedOut = { value: false };
    const withDeadline = (work: Promise<unknown>, label: string): Promise<unknown> => {
      setProgress(label);
      return work.catch((err: unknown) => {
        if (ctrl.signal.aborted) {
          timedOut.value = true;
          throw new Error('TIMEOUT');
        }
        throw err;
      });
    };
    try {
      const idempotencyKey = crypto.randomUUID();
      const regRes = (await withDeadline(
        fetch('/api/membership/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
          signal: ctrl.signal,
          body: JSON.stringify({
            email: email.trim(),
            password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            businessName: businessName.trim(),
            legalName: legalName.trim(),
            businessRegistrationNumber: businessRegistrationNumber.trim(),
            primaryContactEmail: primaryContactEmail.trim(),
            primaryContactPhone: primaryContactPhone.trim(),
            businessType,
            ...(taxIdentificationNumber.trim() ? { taxIdentificationNumber: taxIdentificationNumber.trim() } : {}),
            planSlug: planSlugOf(plan),
            billingInterval,
            idempotencyKey,
          }),
        }),
        'Creating your vendor account...',
      )) as Response;
      const regData = (await regRes.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
        message?: string;
        issues?: { message?: string; path?: (string | number)[] }[];
      };
      if (regRes.status === 429) {
        setFormError('Too many registration attempts. Please try again later.');
        return;
      }
      if (regRes.status === 409) {
        const code = String(regData.code || regData.error || '');
        if (code.includes('DUPLICATE_EMAIL')) {
          setFieldErrors({ email: 'This email is already registered. Try signing in instead.' });
          setStep(0);
          return;
        }
        if (code.includes('DUPLICATE_BRN')) {
          setFieldErrors({ businessRegistrationNumber: 'This registration number is already registered.' });
          setStep(1);
          return;
        }
        setFormError(String(regData.message || regData.error || 'An account with these details already exists.'));
        return;
      }
      if (regRes.status === 400 && Array.isArray(regData.issues) && regData.issues.length > 0) {
        setFormError(String(regData.issues[0]?.message || 'Invalid registration details.'));
        return;
      }
      if (!regRes.ok) {
        setFormError(String(regData.message || regData.error || 'Registration failed. Please try again.'));
        return;
      }

      // Registration is real and succeeded. Log in (same click chain, no navigation).
      try {
        await withDeadline(login({ email: email.trim(), password }), 'Signing you in...');
      } catch {
        if (timedOut.value) {
          setFormError('Request timed out while signing in. Your account was created — please sign in to continue.');
          return;
        }
        setFormError('Account created. Please sign in to continue with payment.');
        return;
      }

      // Start payment for the chosen plan (same click chain).
      const coRes = (await withDeadline(
        fetch('/api/membership/subscriptions/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
          signal: ctrl.signal,
          body: JSON.stringify({ planSlug: planSlugOf(plan), billingInterval }),
        }),
        'Starting payment...',
      )) as Response;
      const coData = (await coRes.json().catch(() => ({}))) as {
        checkoutUrl?: string | null;
        invoiceId?: string | number;
        error?: string;
        message?: string;
        code?: string;
      };
      if (!coRes.ok) {
        setFormError(
          String(coData.message || coData.error || 'Could not start payment. Please try again from Billing.'),
        );
        return;
      }
      if (coData.checkoutUrl) {
        window.location.href = coData.checkoutUrl;
        return;
      }
      // No payment URL: PayMongo is not integrated. Honest terminal state —
      // the membership is NOT active, nothing is faked, nothing redirects.
      setDone({
        kind: 'paymongo-missing',
        invoiceNumber: coData.invoiceId == null ? '' : String(coData.invoiceId),
        amount: planPriceOf(plan),
      });
    } catch (e: unknown) {
      if (timedOut.value || (e instanceof Error && e.message === 'TIMEOUT')) {
        setFormError(
          'Request timed out. Your account may have been created — try signing in, or wait a moment and try again.',
        );
      } else {
        setFormError('Network connection failed. Please check your internet connection and try again.');
      }
    } finally {
      clearTimeout(deadline);
      setProgress('');
      setIsSubmitting(false);
      setFlowActive(false);
    }
  }

  const busy = isSubmitting || authLoading;

  // Already signed in: say so explicitly with links. Never auto-redirect.
  // Suppressed while the final button's chain runs (see flowActive).
  if (isAuthenticated && !flowActive) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white dark:bg-[#171717] rounded-2xl shadow-xl border border-gray-200 dark:border-[#262626] p-8 text-center">
          <BadgeCheck className="w-12 h-12 mx-auto mb-4 text-[#239459]" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">You are already signed in</h2>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mb-6">
            Registration is for new vendors. Manage your membership from Billing.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/billing/subscription"
              className="inline-flex items-center justify-center px-4 py-2.5 bg-[#239459] hover:bg-[#215035] text-white rounded-xl text-sm font-semibold transition"
            >
              Go to my subscription
            </Link>
            <Link
              href="/dashboard/overview"
              className="inline-flex items-center justify-center px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa]"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Honest terminal state: account + invoice exist, but payment cannot start.
  if (done.kind === 'paymongo-missing') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white dark:bg-[#171717] rounded-2xl shadow-xl border border-gray-200 dark:border-[#262626] p-8 text-center">
          <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-amber-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Payment cannot start</h2>
          <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mb-2">
            PayMongo credentials are not integrated yet. Please contact the developer.
          </p>
          <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mb-6">
            Your vendor account was created
            {done.invoiceNumber ? ` and invoice #${done.invoiceNumber} for ${fmtPeso(done.amount)} is pending` : ''}.
            No payment was taken and your membership is not active.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/billing/subscription"
              className="inline-flex items-center justify-center px-4 py-2.5 bg-[#239459] hover:bg-[#215035] text-white rounded-xl text-sm font-semibold transition"
            >
              View my subscription
            </Link>
            <Link
              href="/dashboard/overview"
              className="inline-flex items-center justify-center px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa]"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const stepTitles = ['Your account', 'Your business', 'Pick your plan', 'Review & pay'] as const;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="text-center mb-6">
          <Image
            src="/kuya-cares.png"
            alt="Kuya Cares Logo"
            width={56}
            height={56}
            className="mx-auto mb-3"
            style={{ objectFit: 'contain' }}
          />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Become a selling vendor
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">
            {stepTitles[step]} — step {step + 1} of {stepTitles.length}
          </p>
        </div>

        {/* Arrow progress indicator (unrolled: this project's JSX types reject
            `key` on custom components, so no .map here) */}
        <div className="flex gap-1 mb-8" role="list" aria-label="Signup progress">
          <StepArrow
            index={0}
            label="Account"
            state={0 < step ? 'done' : 0 === step ? 'current' : 'todo'}
            onClick={() => goToStep(0)}
            disabled={busy}
          />
          <StepArrow
            index={1}
            label="Business"
            state={1 < step ? 'done' : 1 === step ? 'current' : 'todo'}
            onClick={() => goToStep(1)}
            disabled={busy}
          />
          <StepArrow
            index={2}
            label="Plan"
            state={2 < step ? 'done' : 2 === step ? 'current' : 'todo'}
            onClick={() => goToStep(2)}
            disabled={busy}
          />
          <StepArrow
            index={3}
            label="Confirm"
            state={3 < step ? 'done' : 3 === step ? 'current' : 'todo'}
            onClick={() => goToStep(3)}
            disabled={busy}
          />
        </div>

        {formError && (
          <div className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mb-6">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{formError}</p>
          </div>
        )}

        <form onSubmit={(e) => void handleRegisterAndPay(e)} className="space-y-6">
          {/* Step 1 — Account */}
          {step === 0 && (
            <section className="bg-white dark:bg-[#171717] rounded-2xl border border-gray-200 dark:border-[#262626] shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Your account</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
                <div>
                  <label htmlFor="firstName" className={labelCls}>First Name</label>
                  <div className="relative">
                    <User className="w-5 h-5 text-gray-400 dark:text-[#a1a1aa] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} placeholder="Juan" disabled={busy} autoComplete="given-name" />
                  </div>
                  {fieldErrors.firstName && <p className={fieldErrorCls}>{fieldErrors.firstName}</p>}
                </div>
                <div>
                  <label htmlFor="lastName" className={labelCls}>Last Name</label>
                  <div className="relative">
                    <User className="w-5 h-5 text-gray-400 dark:text-[#a1a1aa] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} placeholder="Dela Cruz" disabled={busy} autoComplete="family-name" />
                  </div>
                  {fieldErrors.lastName && <p className={fieldErrorCls}>{fieldErrors.lastName}</p>}
                </div>
                <div>
                  <label htmlFor="email" className={labelCls}>Email Address</label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-gray-400 dark:text-[#a1a1aa] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@restaurant.com" disabled={busy} autoComplete="email" />
                  </div>
                  {fieldErrors.email && <p className={fieldErrorCls}>{fieldErrors.email}</p>}
                </div>
                <div>
                  <label htmlFor="password" className={labelCls}>Password</label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-gray-400 dark:text-[#a1a1aa] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-12 pr-12 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#239459] focus:border-[#215035] transition-all duration-200 text-sm disabled:bg-gray-100 dark:disabled:bg-[#262626] disabled:cursor-not-allowed" placeholder="Minimum 8 characters" disabled={busy} autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 dark:hover:text-[#ededed] transition-colors disabled:cursor-not-allowed" disabled={busy} tabIndex={-1}>
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {fieldErrors.password && <p className={fieldErrorCls}>{fieldErrors.password}</p>}
                </div>
              </div>
            </section>
          )}

          {/* Step 2 — Business */}
          {step === 1 && (
            <section className="bg-white dark:bg-[#171717] rounded-2xl border border-gray-200 dark:border-[#262626] shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Your business</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
                <div>
                  <label htmlFor="businessName" className={labelCls}>Business Name</label>
                  <div className="relative">
                    <Store className="w-5 h-5 text-gray-400 dark:text-[#a1a1aa] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input id="businessName" type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputCls} placeholder="Kuya's Kitchen" disabled={busy} autoComplete="organization" />
                  </div>
                  {fieldErrors.businessName && <p className={fieldErrorCls}>{fieldErrors.businessName}</p>}
                </div>
                <div>
                  <label htmlFor="legalName" className={labelCls}>Legal Name</label>
                  <div className="relative">
                    <Building2 className="w-5 h-5 text-gray-400 dark:text-[#a1a1aa] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input id="legalName" type="text" value={legalName} onChange={(e) => setLegalName(e.target.value)} className={inputCls} placeholder="Kuya's Kitchen Inc." disabled={busy} />
                  </div>
                  {fieldErrors.legalName && <p className={fieldErrorCls}>{fieldErrors.legalName}</p>}
                </div>
                <div>
                  <label htmlFor="brn" className={labelCls}>Registration Number</label>
                  <input id="brn" type="text" value={businessRegistrationNumber} onChange={(e) => setBusinessRegistrationNumber(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#239459] focus:border-[#215035] transition-all duration-200 text-sm disabled:bg-gray-100 dark:disabled:bg-[#262626] disabled:cursor-not-allowed" placeholder="SEC / DTI number" disabled={busy} />
                  {fieldErrors.businessRegistrationNumber && <p className={fieldErrorCls}>{fieldErrors.businessRegistrationNumber}</p>}
                </div>
                <div>
                  <label htmlFor="businessType" className={labelCls}>Business Type</label>
                  <select id="businessType" value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] focus:outline-none focus:ring-2 focus:ring-[#239459] focus:border-[#215035] transition-all duration-200 text-sm disabled:bg-gray-100 dark:disabled:bg-[#262626] disabled:cursor-not-allowed" disabled={busy}>
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  {fieldErrors.businessType && <p className={fieldErrorCls}>{fieldErrors.businessType}</p>}
                </div>
                <div>
                  <label htmlFor="primaryContactEmail" className={labelCls}>Contact Email</label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-gray-400 dark:text-[#a1a1aa] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input id="primaryContactEmail" type="email" value={primaryContactEmail} onChange={(e) => setPrimaryContactEmail(e.target.value)} className={inputCls} placeholder="contact@restaurant.com" disabled={busy} />
                  </div>
                  {fieldErrors.primaryContactEmail && <p className={fieldErrorCls}>{fieldErrors.primaryContactEmail}</p>}
                </div>
                <div>
                  <label htmlFor="primaryContactPhone" className={labelCls}>Contact Phone</label>
                  <div className="relative">
                    <Phone className="w-5 h-5 text-gray-400 dark:text-[#a1a1aa] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input id="primaryContactPhone" type="tel" value={primaryContactPhone} onChange={(e) => setPrimaryContactPhone(e.target.value)} className={inputCls} placeholder="+63 9XX XXX XXXX" disabled={busy} autoComplete="tel" />
                  </div>
                  {fieldErrors.primaryContactPhone && <p className={fieldErrorCls}>{fieldErrors.primaryContactPhone}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="tin" className={labelCls}>Tax ID Number <span className="font-normal text-gray-400 dark:text-[#a1a1aa]">(optional)</span></label>
                  <input id="tin" type="text" value={taxIdentificationNumber} onChange={(e) => setTaxIdentificationNumber(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#239459] focus:border-[#215035] transition-all duration-200 text-sm disabled:bg-gray-100 dark:disabled:bg-[#262626] disabled:cursor-not-allowed" placeholder="TIN" disabled={busy} />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#a1a1aa] bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-xl px-4 py-3 mt-5">
                Business documents can be added later from your merchant profile after registration.
              </p>
            </section>
          )}

          {/* Step 3 — Plan (required vertical rectangles, server-rendered) */}
          {step === 2 && (
            <section className="bg-white dark:bg-[#171717] rounded-2xl border border-gray-200 dark:border-[#262626] shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Pick your plan <span className="text-xs font-semibold text-red-600 dark:text-red-400">(required)</span>
              </h2>
              <div className="mt-4 space-y-4">
                {plansLoading && (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500 dark:text-[#a1a1aa]">
                    <Loader2 className="w-5 h-5 animate-spin text-[#239459]" />
                    <span>Loading membership plans...</span>
                  </div>
                )}
                {!plansLoading && plansError && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-700 dark:text-red-400">{plansError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void retryPlans()}
                      disabled={busy}
                      className="mt-3 inline-flex items-center px-4 py-2 bg-white dark:bg-[#171717] border border-red-300 dark:border-red-800 rounded-xl text-sm font-medium text-red-700 dark:text-red-300 disabled:opacity-50"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {!plansLoading && !plansError && plans.length === 0 && (
                  <div className="text-center py-8">
                    <CreditCard className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-[#262626]" />
                    <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">No membership plans are published right now. Please try again later.</p>
                  </div>
                )}
                {!plansLoading && plans.map((plan) => {
                  const slug = planSlugOf(plan);
                  const selected = selectedPlanSlug !== '' && selectedPlanSlug === slug;
                  const popular = isPopularPlan(plan);
                  const price = planPriceOf(plan);
                  const interval = normalizeInterval(
                    (plan as unknown as Record<string, unknown>).billing_interval,
                  );
                  const monthlyEquiv = interval === 'year' ? price / 12 : price;
                  const trial = Number(plan.trial_days ?? 0);
                  const features = planFeatures(plan);
                  return (
                    <article
                      key={slug || plan.name}
                      className={`relative overflow-hidden rounded-xl border p-6 transition-all ${selected ? 'border-[#239459] ring-2 ring-[#239459]/30 bg-emerald-50/40 dark:bg-emerald-900/10' : popular ? 'border-[#239459]/60 bg-white dark:bg-[#171717]' : 'border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717]'}`}
                    >
                      {popular && (
                        <span className="absolute top-4 right-4 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#239459] text-white">
                          Most Popular
                        </span>
                      )}
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                          {plan.description ? (
                            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] max-w-xl">{plan.description}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-start gap-1 md:items-end md:pr-24">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-gray-900 dark:text-white">{fmtPeso(price)}</span>
                            <span className="text-sm text-gray-500 dark:text-[#a1a1aa]">
                              /{interval === 'year' ? 'year' : 'month'}
                            </span>
                          </div>
                          {interval === 'year' && price > 0 ? (
                            <span className="text-xs text-gray-500 dark:text-[#a1a1aa]">
                              {fmtPeso(monthlyEquiv)}/mo billed yearly
                            </span>
                          ) : null}
                          {trial > 0 ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {trial}-day free trial
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-5 grid gap-x-6 gap-y-2 md:grid-cols-2">
                        {features.map((f) => (
                          <div key={f} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-[#239459] flex-shrink-0" />
                            <span className="text-sm text-gray-700 dark:text-[#a1a1aa]">{f}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedPlanSlug(selected ? '' : slug)}
                          disabled={busy}
                          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition border ${selected ? 'bg-[#239459] border-[#239459] text-white' : 'bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-[#262626] text-gray-700 dark:text-[#ededed] hover:border-[#239459]'}`}
                        >
                          {selected ? (
                            <>
                              <CheckCircle className="w-4 h-4" /> Selected
                            </>
                          ) : (
                            'Select plan'
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
                {fieldErrors.plan && <p className={fieldErrorCls}>{fieldErrors.plan}</p>}
              </div>
            </section>
          )}

          {/* Step 4 — Review & pay. The ONLY write trigger lives here. */}
          {step === 3 && (
            <section className="bg-white dark:bg-[#171717] rounded-2xl border border-gray-200 dark:border-[#262626] shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Review & pay</h2>
              <div className="mt-4 rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-200 dark:divide-[#262626] overflow-hidden text-sm">
                <div className="flex items-start justify-between gap-4 px-4 py-2.5">
                  <span className="text-xs text-gray-500 dark:text-[#a1a1aa]">Account</span>
                  <span className="text-right text-gray-900 dark:text-white">{firstName} {lastName} · {email}</span>
                </div>
                <div className="flex items-start justify-between gap-4 px-4 py-2.5">
                  <span className="text-xs text-gray-500 dark:text-[#a1a1aa]">Business</span>
                  <span className="text-right text-gray-900 dark:text-white">{businessName} ({BUSINESS_TYPE_LABELS[businessType] ?? businessType})</span>
                </div>
                <div className="flex items-start justify-between gap-4 px-4 py-2.5">
                  <span className="text-xs text-gray-500 dark:text-[#a1a1aa]">Plan</span>
                  <span className="text-right font-bold text-gray-900 dark:text-white">
                    {selectedPlan?.name} · {fmtPeso(buttonPrice)}/{selectedInterval === 'year' ? 'year' : 'month'}
                  </span>
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="mt-5 w-full bg-[#239459] hover:bg-[#215035] text-white py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed border border-[#239459]/20 flex items-center justify-center space-x-2 text-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                    <span>{progress || 'Processing...'}</span>
                  </>
                ) : (
                  <span>
                    {buttonPrice > 0 ? `Register & Pay ${fmtPeso(buttonPrice)}` : 'Register & Activate'}
                  </span>
                )}
              </button>
              <p className="text-[11px] text-gray-400 dark:text-[#a1a1aa] text-center mt-3">
                Registration creates your vendor account, then starts payment for {selectedPlan?.name ?? 'your plan'}.
              </p>
            </section>
          )}

          {/* Step navigation. The submit button exists ONLY on the Confirm step. */}
          <div className="flex gap-3 pt-1">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                disabled={busy}
                className="px-6 py-3.5 rounded-xl font-semibold transition-all duration-200 border border-gray-300 dark:border-[#262626] text-gray-700 dark:text-[#a1a1aa] bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed text-sm inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < 3 && (
              <button
                type="button"
                onClick={goNext}
                disabled={busy}
                className="flex-1 bg-[#239459] hover:bg-[#215035] text-white py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed border border-[#239459]/20 text-sm inline-flex items-center justify-center gap-2"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">
            Already have an account?{' '}
            <Link href="/signin" className="text-[#239459] hover:text-[#215035] font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
        <p className="text-xs text-gray-400 dark:text-[#a1a1aa] text-center mt-6">
          &copy; {new Date().getFullYear()} Kuya Cares. All rights reserved.
        </p>
      </div>
    </div>
  );
}
