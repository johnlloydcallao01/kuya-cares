'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth, getFullName, getUserInitials } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getProfileData,
  updateProfileAction,
  changePasswordAction,
  uploadAvatarAction,
  removeAvatarAction,
  type VendorRecord,
  type MerchantSummary,
  type UserEventItem,
  type RawUser,
} from '@/app/actions/profile';
import type { User } from '@/types/auth';
import {
  User as UserIcon,
  Shield,
  ShieldCheck,
  KeyRound,
  Settings,
  Edit,
  Upload,
  Trash2,
  Camera,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  BadgeCheck,
  Crown,
  Activity,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Save,
  X,
  Sparkles,
  Fingerprint,
  Globe,
  Smartphone,
  Monitor,
  Bell,
  Palette,
  Info,
  History,
  LogIn,
  RefreshCw,
  Building,
  Building2,
  Store,
  Award,
  Briefcase,
  AtSign,
} from '@/components/ui/IconWrapper';

// ---------- helpers ----------

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
  return new Date(iso).toLocaleDateString('en-PH', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  });
  } catch {
  return iso;
  }
}
function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
  return new Date(iso).toLocaleString('en-PH', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  });
  } catch {
  return iso;
  }
}
function relativeTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}
function completeness(user: User | null): number {
  if (!user) return 0;
  const fields: Array<keyof User> = [
  'firstName',
  'lastName',
  'phone',
  'username',
  'gender',
  'civilStatus',
  'nationality',
  'birthDate',
  'placeOfBirth',
  'completeAddress',
  'profilePicture',
  ];
  let filled = 0;
  for (const f of fields) {
  const v = (user as unknown as Record<string, unknown>)[f];
  if (v !== null && v !== undefined && String(v).trim() !== '') filled++;
  }
  return Math.round((filled / fields.length) * 100);
}
function passwordScore(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: 'Empty', color: 'bg-gray-200 dark:bg-[#262626]' };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: 20, label: 'Very weak', color: 'bg-red-500' };
  if (s === 2) return { score: 40, label: 'Weak', color: 'bg-orange-500' };
  if (s === 3) return { score: 60, label: 'Fair', color: 'bg-yellow-500' };
  if (s === 4) return { score: 80, label: 'Strong', color: 'bg-emerald-500' };
  return { score: 100, label: 'Very strong', color: 'bg-emerald-600' };
}
function verificationBadge(status?: string | null): { label: string; cls: string; dot: string } {
  switch (status) {
    case 'verified':
      return { label: 'Verified', cls: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' };
    case 'pending':
      return { label: 'Pending Verification', cls: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' };
    case 'rejected':
      return { label: 'Rejected', cls: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800', dot: 'bg-red-500' };
    case 'suspended':
      return { label: 'Suspended', cls: 'bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-[#a1a1aa] border-slate-200 dark:border-[#262626]', dot: 'bg-slate-500' };
    default:
      return { label: 'Unknown', cls: 'bg-gray-50 dark:bg-[#262626] text-gray-600 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]', dot: 'bg-gray-400' };
  }
}
function businessTypeLabel(v?: string | null): string {
  const map: Record<string, string> = {
    restaurant: 'Restaurant',
    fast_food: 'Fast Food',
    grocery: 'Grocery Store',
    pharmacy: 'Pharmacy',
    convenience: 'Convenience Store',
    bakery: 'Bakery',
    coffee_shop: 'Coffee Shop',
    other: 'Other',
  };
  return map[v || ''] || v || '—';
}

// ---------- skeleton (mirrors apps/web LocationMerchantCardSkeleton / LocationBasedProductCategoriesCarousel) ----------
function ProfileSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5 animate-pulse">
      {/* banner + header card */}
      <div className="space-y-0">
        <div className="h-[156px] sm:h-[184px] rounded-t-2xl bg-gray-200 dark:bg-[#262626]" />
        <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] border-t-0 rounded-b-2xl p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row gap-6 -mt-14 sm:-mt-16">
            <div className="flex-shrink-0">
              <div className="w-[112px] h-[112px] sm:w-[128px] sm:h-[128px] rounded-2xl bg-gray-200 dark:bg-[#262626] border-4 border-white shadow-xl" />
              <div className="mt-3 flex gap-2">
                <div className="h-7 w-20 bg-gray-200 dark:bg-[#262626] rounded-lg" />
                <div className="h-7 w-16 bg-gray-200 dark:bg-[#262626] rounded-lg" />
              </div>
              <div className="mt-2 h-3 w-36 bg-gray-200 dark:bg-[#262626] rounded" />
            </div>
            <div className="flex-1 space-y-3 pt-2 min-w-0">
              <div className="h-7 bg-gray-200 dark:bg-[#262626] rounded w-1/3" />
              <div className="flex flex-wrap gap-2">
                <div className="h-5 w-28 bg-gray-200 dark:bg-[#262626] rounded-full" />
                <div className="h-5 w-20 bg-gray-200 dark:bg-[#262626] rounded-full" />
                <div className="h-4 w-48 bg-gray-200 dark:bg-[#262626] rounded" />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="h-3 w-32 bg-gray-200 dark:bg-[#262626] rounded" />
                <div className="h-3 w-28 bg-gray-200 dark:bg-[#262626] rounded" />
                <div className="h-3 w-36 bg-gray-200 dark:bg-[#262626] rounded" />
              </div>
            </div>
            <div className="lg:w-[320px] space-y-3 w-full">
              <div className="h-28 bg-gray-100 dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-[#262626] p-4 space-y-2">
                <div className="flex justify-between">
                  <div className="h-3 w-28 bg-gray-200 dark:bg-[#262626] rounded" />
                  <div className="h-3 w-8 bg-gray-200 dark:bg-[#262626] rounded" />
                </div>
                <div className="h-2 bg-gray-200 dark:bg-[#262626] rounded-full" />
                <div className="h-3 w-full bg-gray-200 dark:bg-[#262626] rounded" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 h-10 bg-gray-200 dark:bg-[#262626] rounded-xl" />
                <div className="h-10 w-24 bg-gray-200 dark:bg-[#262626] rounded-xl" />
              </div>
            </div>
          </div>
          <div className="mt-6 flex gap-2 border-t border-gray-100 dark:border-[#262626] pt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 w-28 bg-gray-200 dark:bg-[#262626] rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* quick stats - like LocationMerchantCardSkeleton grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-[#262626] rounded-xl" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-16 bg-gray-200 dark:bg-[#262626] rounded" />
                <div className="h-4 w-24 bg-gray-200 dark:bg-[#262626] rounded" />
              </div>
            </div>
            <div className="h-3 w-full bg-gray-200 dark:bg-[#262626] rounded mt-3" />
          </div>
        ))}
      </div>

      {/* overview grid - snapshot + activity + priv */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 space-y-5">
          <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-5 space-y-4">
            <div className="flex justify-between">
              <div className="h-5 w-32 bg-gray-200 dark:bg-[#262626] rounded" />
              <div className="h-4 w-12 bg-gray-200 dark:bg-[#262626] rounded" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="h-3 w-16 bg-gray-200 dark:bg-[#262626] rounded" />
                <div className="space-y-2">
                  <div className="h-4 w-48 bg-gray-200 dark:bg-[#262626] rounded" />
                  <div className="h-4 w-36 bg-gray-200 dark:bg-[#262626] rounded" />
                  <div className="h-4 w-40 bg-gray-200 dark:bg-[#262626] rounded" />
                </div>
                <div className="h-3 w-full bg-gray-200 dark:bg-[#262626] rounded" />
              </div>
              <div className="space-y-3">
                <div className="h-3 w-16 bg-gray-200 dark:bg-[#262626] rounded" />
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="h-16 bg-gray-100 dark:bg-[#262626] rounded-lg border border-gray-200 dark:border-[#262626]" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-[#262626] flex justify-between">
              <div className="h-5 w-32 bg-gray-200 dark:bg-[#262626] rounded" />
              <div className="h-3 w-32 bg-gray-200 dark:bg-[#262626] rounded" />
            </div>
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, k) => (
                <div key={k} className="px-5 py-3 flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-200 dark:bg-[#262626] rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 bg-gray-200 dark:bg-[#262626] rounded" />
                    <div className="h-3 w-48 bg-gray-200 dark:bg-[#262626] rounded" />
                    <div className="h-2 w-24 bg-gray-200 dark:bg-[#262626] rounded" />
                  </div>
                  <div className="h-3 w-12 bg-gray-200 dark:bg-[#262626] rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-5">
          <div className="h-64 bg-gray-200 dark:bg-[#262626] rounded-xl" />
          <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-5 space-y-3">
            <div className="h-4 w-36 bg-gray-200 dark:bg-[#262626] rounded" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-16 bg-gray-200 dark:bg-[#262626] rounded" />
                <div className="h-3 w-20 bg-gray-200 dark:bg-[#262626] rounded" />
              </div>
            ))}
            <div className="h-10 w-full bg-gray-200 dark:bg-[#262626] rounded-xl" />
          </div>
          <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-5 space-y-2">
            <div className="h-3 w-20 bg-gray-200 dark:bg-[#262626] rounded" />
            <div className="h-3 w-full bg-gray-200 dark:bg-[#262626] rounded" />
            <div className="flex gap-2 mt-3">
              <div className="flex-1 h-9 bg-gray-200 dark:bg-[#262626] rounded-lg" />
              <div className="flex-1 h-9 bg-gray-200 dark:bg-[#262626] rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- tab definition ----------
type TabId = 'overview' | 'personal' | 'business' | 'security' | 'settings';
const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }> = [
  { id: 'overview', label: 'Overview', icon: Sparkles, desc: 'Summary' },
  { id: 'personal', label: 'Personal Info', icon: UserIcon, desc: 'Edit details' },
  { id: 'business', label: 'Business', icon: Building2, desc: 'Vendor & outlets' },
  { id: 'security', label: 'Security', icon: ShieldCheck, desc: 'Password & sessions' },
  { id: 'settings', label: 'Preferences', icon: Settings, desc: 'Appearance' },
];

function ProfileInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: authUser, isLoading: authLoading, isInitialized, updateUser } = useAuth() as ReturnType<typeof useAuth> & { updateUser: (u: User) => void };
  const { theme, setTheme, resolvedTheme } = useTheme();
  const tabParam = (searchParams.get('tab') as TabId | null) || null;
  const activeTab: TabId =
  tabParam && (['overview', 'personal', 'business', 'security', 'settings'] as TabId[]).includes(tabParam as TabId)
  ? (tabParam as TabId)
  : 'overview';

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [rawUser, setRawUser] = useState<RawUser | null>(null);
  const [vendor, setVendor] = useState<VendorRecord | null>(null);
  const [merchants, setMerchants] = useState<MerchantSummary[]>([]);
  const [merchantsCount, setMerchantsCount] = useState(0);
  const [activities, setActivities] = useState<UserEventItem[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // toasts
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const showToast = useCallback((t: typeof toast) => {
  setToast(t);
  if (t) setTimeout(() => setToast(null), 4200);
  }, []);

  // avatar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // personal form state
  const [form, setForm] = useState({
  firstName: '',
  lastName: '',
  middleName: '',
  nameExtension: '',
  username: '',
  email: '',
  phone: '',
  gender: '',
  civilStatus: '',
  nationality: '',
  birthDate: '',
  placeOfBirth: '',
  completeAddress: '',
  });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // security form
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  // settings / preferences (client-only persisted) - theme is device-based via ThemeContext (localStorage tap2go-merchant-theme), not DB
  const [prefs, setPrefs] = useState({
  language: 'en',
  timezone: 'Asia/Manila',
  emailNotif: true,
  browserNotif: true,
  compact: false,
  });

  const displayUser = profileUser || authUser;
  const fullName = displayUser ? getFullName(displayUser) : '—';
  const initials = displayUser ? getUserInitials(displayUser) : '??';
  const pc = completeness(displayUser as User);
  const vb = verificationBadge(vendor?.verificationStatus);

  // load profile data
  const load = useCallback(async () => {
  setLoadingProfile(true);
  setProfileError(null);
  try {
  const data = await getProfileData();
  setProfileUser(data.user);
  setRawUser(data.raw);
  setVendor(data.vendor);
  setMerchants(data.merchants || []);
  setMerchantsCount(data.merchantsCount || 0);
  setActivities(data.activities);
  // hydrate form
  const u = data.user;
  setForm({
  firstName: u.firstName || '',
  lastName: u.lastName || '',
  middleName: (u as unknown as { middleName?: string }).middleName || '',
  nameExtension: (u as unknown as { nameExtension?: string }).nameExtension || '',
  username: (u as unknown as { username?: string }).username || '',
  email: u.email || '',
  phone: (u as unknown as { phone?: string }).phone || '',
  gender: (u as unknown as { gender?: string }).gender || '',
  civilStatus: (u as unknown as { civilStatus?: string }).civilStatus || '',
  nationality: (u as unknown as { nationality?: string }).nationality || '',
  birthDate: (u as unknown as { birthDate?: string }).birthDate
  ? new Date((u as unknown as { birthDate: string }).birthDate).toISOString().slice(0, 10)
  : '',
  placeOfBirth: (u as unknown as { placeOfBirth?: string }).placeOfBirth || '',
  completeAddress: (u as unknown as { completeAddress?: string }).completeAddress || '',
  });
  } catch (e: unknown) {
  setProfileError(e instanceof Error ? e.message : 'Failed to load profile');
  } finally {
  setLoadingProfile(false);
  }
  }, []);

  useEffect(() => {
  if (!isInitialized || authLoading) return;
  if (!authUser) return;
  load();
  }, [isInitialized, authLoading, authUser, load]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('merchant:profile:prefs');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.theme && ['light', 'dark', 'system'].includes(parsed.theme)) {
          setTheme(parsed.theme as 'light' | 'dark' | 'system');
          delete parsed.theme;
          try { localStorage.setItem('merchant:profile:prefs', JSON.stringify(parsed)); } catch {}
        }
        // Only keep non-theme prefs (theme is device-based via tap2go-merchant-theme)
        const { theme: _t, ...rest } = parsed;
        if (Object.keys(rest).length) setPrefs((prev) => ({ ...prev, ...rest }));
      }
    } catch {}
  }, []);

  const persistPrefs = (next: typeof prefs) => {
  setPrefs(next);
  try {
  localStorage.setItem('merchant:profile:prefs', JSON.stringify(next));
  } catch {}
  };

  const switchTab = (id: TabId) => {
  const url = id === 'overview' ? '/profile' : `/profile?tab=${id}`;
  router.push(url as never);
  };

  // derived stats
  const accountAgeDays = useMemo(() => {
  if (!displayUser?.createdAt) return '—';
  const d = Math.floor((Date.now() - new Date(displayUser.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  if (d < 30) return `${d} days`;
  if (d < 365) return `${Math.floor(d / 30)} mo`;
  return `${Math.floor(d / 365)} yr ${Math.floor((d % 365) / 30)} mo`;
  }, [displayUser?.createdAt]);

  // handlers
  const handleFormSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setFormError(null);
  setFormSaving(true);
  try {
  const payload = {
  firstName: form.firstName,
  lastName: form.lastName,
  middleName: form.middleName || null,
  nameExtension: form.nameExtension || null,
  username: form.username || null,
  phone: form.phone || null,
  gender: form.gender || null,
  civilStatus: form.civilStatus || null,
  nationality: form.nationality || null,
  birthDate: form.birthDate || null,
  placeOfBirth: form.placeOfBirth || null,
  completeAddress: form.completeAddress || null,
  email: form.email || null,
  };
  const res = await updateProfileAction(payload);
  if (!res.success) {
  setFormError(res.message);
  showToast({ type: 'error', message: res.message });
  return;
  }
  if (res.user) {
  setProfileUser(res.user);
  try {
  updateUser(res.user as User);
  } catch {}
  }
  showToast({ type: 'success', message: res.message });
  await load();
  } catch (err: unknown) {
  const msg = err instanceof Error ? err.message : 'Update failed';
  setFormError(msg);
  showToast({ type: 'error', message: msg });
  } finally {
  setFormSaving(false);
  }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setPwdError(null);
  setPwdSuccess(null);
  if (!pwd.current || !pwd.next || !pwd.confirm) {
  setPwdError('All password fields are required.');
  return;
  }
  if (pwd.next !== pwd.confirm) {
  setPwdError('New password and confirmation do not match.');
  return;
  }
  setPwdSaving(true);
  try {
  const res = await changePasswordAction({ currentPassword: pwd.current, newPassword: pwd.next });
  if (!res.success) {
  setPwdError(res.message);
  showToast({ type: 'error', message: res.message });
  return;
  }
  setPwdSuccess(res.message);
  setPwd({ current: '', next: '', confirm: '' });
  showToast({ type: 'success', message: res.message });
  } catch (err: unknown) {
  const msg = err instanceof Error ? err.message : 'Password change failed';
  setPwdError(msg);
  } finally {
  setPwdSaving(false);
  }
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setAvatarUploading(true);
  try {
  const fd = new FormData();
  fd.append('file', file);
  const res = await uploadAvatarAction(fd);
  if (!res.success) {
  showToast({ type: 'error', message: res.message });
  return;
  }
  if (res.user) {
  setProfileUser(res.user);
  try { updateUser(res.user as User); } catch {}
  }
  showToast({ type: 'success', message: res.message });
  await load();
  } catch (err: unknown) {
  showToast({ type: 'error', message: err instanceof Error ? err.message : 'Upload failed' });
  } finally {
  setAvatarUploading(false);
  if (fileInputRef.current) fileInputRef.current.value = '';
  }
  };

  const handleRemoveAvatar = async () => {
  if (!displayUser?.profilePicture) return;
  setAvatarUploading(true);
  try {
  const res = await removeAvatarAction();
  if (!res.success) {
  showToast({ type: 'error', message: res.message });
  return;
  }
  if (res.user) {
  setProfileUser(res.user);
  try { updateUser(res.user as User); } catch {}
  }
  showToast({ type: 'success', message: res.message });
  await load();
  } catch (err: unknown) {
  showToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to remove' });
  } finally {
  setAvatarUploading(false);
  }
  };

  const pwdNextScore = passwordScore(pwd.next);

  if (!isInitialized || authLoading || loadingProfile) {
    return <ProfileSkeleton />;
  }

  if (profileError) {
  return (
  <div className="max-w-3xl mx-auto p-6">
  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
  <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
  <h3 className="font-semibold text-red-800">Failed to load profile</h3>
  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{profileError}</p>
  <button
  onClick={load}
  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
  >
  <RefreshCw className="w-4 h-4" /> Retry
  </button>
  </div>
  </div>
  );
  }

  if (!displayUser) return null;

  const avatarUrl = displayUser.profilePicture?.url || null;

  return (
  <div className="space-y-6 py-5 px-2.5">
  {/* toast */}
  {toast && (
  <div className="fixed top-4 right-4 z-[100] max-w-sm">
  <div
  className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur text-sm font-medium
  ${toast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800' : ''}
  ${toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800' : ''}
  ${toast.type === 'info' ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-200 text-sky-800' : ''}`}
  >
  {toast.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
  {toast.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
  {toast.type === 'info' && <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />}
  <span className="flex-1">{toast.message}</span>
  <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">
  <X className="w-4 h-4" />
  </button>
  </div>
  </div>
  )}

  {/* hidden file input */}
  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

  {/* Cover + Header Card */}
  <div className="space-y-0">
  {/* banner - orange branding with black like apps/web */}
  <div className="relative h-[156px] sm:h-[184px] rounded-t-2xl overflow-hidden bg-gradient-to-br from-black via-[#1a1a1a] to-[#eba236] border border-slate-200 dark:border-[#262626]">
  {/* subtle grid */}
  <div className="absolute inset-0 opacity-[0.08]" style={{
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='g' width='10' height='10' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 10 0 L 0 0 0 10' fill='none' stroke='white' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23g)'/%3E%3C/svg%3E")`
  }} />
  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

  {/* decorative blobs - orange tints */}
  <div className="absolute -right-16 -top-10 w-64 h-64 bg-[#eba236]/20 blur-3xl rounded-full pointer-events-none" />
  <div className="absolute -left-12 bottom-0 w-72 h-72 bg-[#c88a20]/15 blur-3xl rounded-full pointer-events-none" />

  {/* banner actions */}
  <div className="absolute top-4 right-4 flex items-center gap-2">
  <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase bg-white/90 dark:bg-[#171717]/90 text-gray-700 dark:text-white/90 backdrop-blur border border-gray-200/50 dark:border-white/15 px-3 py-1.5 rounded-full">
  <span className={`w-2 h-2 rounded-full ${displayUser.isActive === false ? 'bg-red-400' : 'bg-emerald-400'} animate-pulse`} />
  {displayUser.isActive === false ? 'Inactive' : 'Active account'}
  </span>
  <span className="inline-flex items-center gap-1.5 bg-white dark:bg-[#171717]/95 text-slate-800 dark:text-gray-200 px-3 py-1.5 rounded-full text-xs font-semibold shadow">
  <Fingerprint className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
  ID • {displayUser.id}
  </span>
  </div>
  </div>

  {/* header card */}
  <div className="relative bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] border-t-0 rounded-b-2xl shadow-sm">
  <div className="px-6 sm:px-8 pb-6">
  <div className="flex flex-col lg:flex-row lg:items-end gap-6 -mt-14 sm:-mt-16 relative">
  {/* avatar */}
  <div className="flex-shrink-0">
  <div className="relative group">
  <div className="w-[112px] h-[112px] sm:w-[128px] sm:h-[128px] rounded-2xl overflow-hidden bg-white dark:bg-[#171717] border-4 border-white shadow-xl">
  {avatarUrl ? (
  <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
  ) : (
  <div className="w-full h-full bg-gradient-to-br from-black to-[#eba236] flex items-center justify-center text-white text-3xl font-bold">
  {initials}
  </div>
  )}
  </div>
  <button
  onClick={handleAvatarClick}
  disabled={avatarUploading}
  className="absolute -bottom-2 -right-2 w-9 h-9 bg-black dark:bg-[#eba236] hover:bg-[#1a1a1a] dark:hover:bg-[#c88a20] text-white dark:text-black rounded-xl shadow-lg border-2 border-white dark:border-[#171717] flex items-center justify-center disabled:opacity-60 transition-colors"
  title="Change avatar"
  >
  {avatarUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
  </button>
  </div>
  {/* avatar actions beneath */}
  <div className="mt-3 flex items-center gap-2 text-xs">
  <button
  onClick={handleAvatarClick}
  disabled={avatarUploading}
  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-[#eba236] text-white dark:text-black rounded-lg font-medium hover:bg-[#1a1a1a] dark:hover:bg-[#c88a20] disabled:opacity-50 transition-colors"
  >
  <Upload className="w-3.5 h-3.5" /> Upload
  </button>
  {avatarUrl && (
  <button
  onClick={handleRemoveAvatar}
  disabled={avatarUploading}
  className="inline-flex items-center gap-1 px-2 py-1.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-lg font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 transition-colors"
  >
  <Trash2 className="w-3.5 h-3.5" /> Remove
  </button>
  )}
  </div>
  <p className="text-[11px] text-gray-400 dark:text-[#a1a1aa] mt-2 max-w-[150px] leading-relaxed">JPG, PNG, WebP up to 5 MB. Ideal square 512×512.</p>
  </div>

  {/* name + meta */}
  <div className="flex-1 min-w-0 pt-2 lg:pt-0 lg:pb-2">
  <div className="flex flex-wrap items-start gap-3">
  <div className="min-w-0">
  <div className="flex flex-wrap items-center gap-2">
  <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900 dark:text-[#ededed] truncate">{fullName}</h1>
  {displayUser.isActive !== false && <span title="Verified vendor"><BadgeCheck className="w-5 h-5 text-sky-500 flex-shrink-0" /></span>}
  </div>
  <div className="flex flex-wrap items-center gap-2 mt-2">
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide border bg-gradient-to-r from-black to-[#eba236] text-white border-[#eba236]/20`}>
  <Store className="w-3.5 h-3.5" /> Vendor • {vendor ? businessTypeLabel(vendor.businessType) : '—'}
  </span>
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${vb.cls}`}>
  <span className={`w-2 h-2 rounded-full ${vb.dot}`} /> {vb.label}
  </span>
  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-[#171717] border border-slate-200 dark:border-[#262626] text-xs font-medium text-slate-700 dark:text-[#a1a1aa]">
  <span className="w-2 h-2 rounded-full bg-emerald-500" /> {displayUser.role.toUpperCase()}
  </span>
  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">
  <Mail className="w-3.5 h-3.5" /> {displayUser.email}
  </span>
  </div>
  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">
  <span className="inline-flex items-center gap-1.5">
  <Calendar className="w-3.5 h-3.5" /> Joined {formatDate(displayUser.createdAt)} • {relativeTime(displayUser.createdAt)}
  </span>
  <span className="inline-flex items-center gap-1.5">
  <Clock className="w-3.5 h-3.5" /> Last login {formatDateTime(displayUser.lastLogin || rawUser?.lastLogin)}
  </span>
  <span className="inline-flex items-center gap-1.5">
  <Globe className="w-3.5 h-3.5" /> {displayUser.completeAddress ? displayUser.completeAddress.slice(0, 40) + (displayUser.completeAddress.length > 40 ? '…' : '') : 'No address set'}
  </span>
  </div>
  </div>
  </div>
  </div>

  {/* completeness + actions */}
  <div className="lg:ml-auto flex flex-col sm:flex-row lg:flex-col gap-4 w-full lg:w-[320px]">
  <div className="flex-1 bg-slate-50 dark:bg-[#171717] border border-slate-200 dark:border-[#262626] rounded-xl p-4">
  <div className="flex items-center justify-between mb-2">
  <span className="text-xs font-semibold text-slate-700 dark:text-[#a1a1aa] flex items-center gap-1.5">
  <Sparkles className="w-3.5 h-3.5 text-[#c88a20]" /> Profile completeness
  </span>
  <span className="text-xs font-bold text-[#c88a20]">{pc}%</span>
  </div>
  <div className="h-2 bg-white dark:bg-[#171717] border border-slate-200 dark:border-[#262626] rounded-full overflow-hidden">
  <div
  className="h-full bg-gradient-to-r from-black to-[#eba236] transition-all duration-700"
  style={{ width: `${pc}%` }}
  />
  </div>
  <p className="text-[11px] text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mt-2 leading-relaxed">
  {pc === 100 ? 'Excellent — your profile is complete.' : pc > 70 ? 'Almost there! Fill remaining fields in Personal Info.' : 'Add phone, address and personal details to improve trust.'}
  </p>
  </div>
  <div className="flex gap-2">
  <button
  onClick={() => switchTab('personal')}
  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black hover:bg-[#1a1a1a] text-white rounded-xl text-sm font-semibold shadow-sm border border-[#eba236]/20 transition-colors"
  >
  <Edit className="w-4 h-4 text-[#eba236]" /> Edit profile
  </button>
  <button
  onClick={() => switchTab('security')}
  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-semibold text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors"
  >
  <ShieldCheck className="w-4 h-4" /> Security
  </button>
  </div>
  </div>
  </div>
  </div>

  {/* tabs */}
  <div className="px-2 sm:px-6 border-t border-gray-100 dark:border-[#262626]">
  <nav className="flex gap-1 sm:gap-2 overflow-x-auto scrollbar-none py-2" aria-label="Profile tabs">
  {TABS.map((t) => {
  const Icon = t.icon;
  const isActive = activeTab === t.id;
  return (
  <button
  key={t.id}
  onClick={() => switchTab(t.id)}
  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors
  ${isActive ? 'bg-gray-100 dark:bg-[#262626] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] hover:text-gray-900 dark:hover:text-[#ededed]'}`}
  >
  <Icon className={`w-4 h-4 ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-[#a1a1aa]'}`} />
  {t.label}
  <span className={`hidden sm:inline text-[11px] font-medium px-1.5 py-0.5 rounded-full ${isActive ? 'bg-gray-200 dark:bg-[#171717]/15 text-gray-700 dark:text-white' : 'bg-gray-100 dark:bg-[#262626] text-gray-500 dark:text-[#a1a1aa]'}`}>
  {t.desc}
  </span>
  </button>
  );
  })}
  </nav>
  </div>
  </div>
  </div>

  {/* main content */}
  <div>
  {/* OVERVIEW */}
  {activeTab === 'overview' && (
  <div className="grid grid-cols-12 gap-5">
  {/* left */}
  <div className="col-span-12 lg:col-span-8 space-y-5">
  {/* quick stats */}
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-4">
  <div className="flex items-center gap-3">
  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center">
  <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
  </div>
  <div>
  <p className="text-[11px] font-semibold tracking-wide uppercase text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Last login</p>
  <p className="text-sm font-bold text-gray-900 dark:text-[#ededed]">{formatDateTime(displayUser.lastLogin || rawUser?.lastLogin)}</p>
  </div>
  </div>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mt-3">Your last successful authentication to the vendor portal.</p>
  </div>
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-4">
  <div className="flex items-center gap-3">
  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center">
  <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
  </div>
  <div>
  <p className="text-[11px] font-semibold tracking-wide uppercase text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Account age</p>
  <p className="text-sm font-bold text-gray-900 dark:text-[#ededed]">{accountAgeDays}</p>
  </div>
  </div>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mt-3">Member since {formatDate(displayUser.createdAt)}</p>
  </div>
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-4">
  <div className="flex items-center gap-3">
  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 flex items-center justify-center">
  <Store className="w-5 h-5 text-amber-600 dark:text-amber-400" />
  </div>
  <div>
  <p className="text-[11px] font-semibold tracking-wide uppercase text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Business</p>
  <p className="text-sm font-bold text-gray-900 dark:text-[#ededed]">{merchantsCount} outlet{merchantsCount !== 1 ? 's' : ''}</p>
  </div>
  </div>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mt-3">
  {vendor ? `${vendor.businessName} • ${businessTypeLabel(vendor.businessType)}` : 'No business linked'}
  </p>
  </div>
  </div>

  {/* account snapshot */}
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl overflow-hidden">
  <div className="px-5 py-4 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between">
  <h3 className="font-semibold text-gray-900 dark:text-[#ededed] flex items-center gap-2">
  <UserIcon className="w-4 h-4 text-gray-400 dark:text-[#a1a1aa]" /> Account snapshot
  </h3>
  <button onClick={() => switchTab('personal')} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">
  Edit →
  </button>
  </div>
  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
  <div className="space-y-4">
  <div>
  <p className="text-[11px] font-semibold tracking-wide uppercase text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mb-1">Contact</p>
  <div className="space-y-2 text-sm">
  <div className="flex items-center gap-2 text-gray-700 dark:text-[#a1a1aa]">
  <Mail className="w-4 h-4 text-gray-400 dark:text-[#a1a1aa]" /> {displayUser.email}
  </div>
  <div className="flex items-center gap-2 text-gray-700 dark:text-[#a1a1aa]">
  <Phone className="w-4 h-4 text-gray-400 dark:text-[#a1a1aa]" /> {displayUser.phone || <span className="text-gray-400 dark:text-[#a1a1aa] italic">No phone</span>}
  </div>
  <div className="flex items-center gap-2 text-gray-700 dark:text-[#a1a1aa]">
  <AtSign className="w-4 h-4 text-gray-400 dark:text-[#a1a1aa]" /> {displayUser.username || <span className="text-gray-400 dark:text-[#a1a1aa] italic">No username</span>}
  </div>
  </div>
  </div>
  <div>
  <p className="text-[11px] font-semibold tracking-wide uppercase text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mb-1">Location & identity</p>
  <div className="space-y-1.5 text-sm text-gray-700 dark:text-[#a1a1aa]">
  <div>{displayUser.completeAddress || <span className="text-gray-400 dark:text-[#a1a1aa] italic">No address</span>}</div>
  <div className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">
  {displayUser.nationality ? `Nationality: ${displayUser.nationality}` : 'Nationality not set'} •{' '}
  {displayUser.placeOfBirth ? `Born in ${displayUser.placeOfBirth}` : 'Birth place not set'}
  </div>
  </div>
  </div>
  </div>
  <div className="space-y-4">
  <div>
  <p className="text-[11px] font-semibold tracking-wide uppercase text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mb-1">Personal</p>
  <div className="grid grid-cols-2 gap-3 text-sm">
  <div className="bg-slate-50 dark:bg-[#171717] border border-slate-100 dark:border-[#262626] rounded-lg p-3">
  <p className="text-[11px] uppercase font-semibold text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Gender</p>
  <p className="font-medium capitalize text-gray-900 dark:text-[#ededed]">{displayUser.gender || '—'}</p>
  </div>
  <div className="bg-slate-50 dark:bg-[#171717] border border-slate-100 dark:border-[#262626] rounded-lg p-3">
  <p className="text-[11px] uppercase font-semibold text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Civil status</p>
  <p className="font-medium capitalize text-gray-900 dark:text-[#ededed]">{displayUser.civilStatus || '—'}</p>
  </div>
  <div className="bg-slate-50 dark:bg-[#171717] border border-slate-100 dark:border-[#262626] rounded-lg p-3">
  <p className="text-[11px] uppercase font-semibold text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Birth date</p>
  <p className="font-medium text-gray-900 dark:text-[#ededed]">{displayUser.birthDate ? formatDate(displayUser.birthDate) : '—'}</p>
  </div>
  <div className="bg-slate-50 dark:bg-[#171717] border border-slate-100 dark:border-[#262626] rounded-lg p-3">
  <p className="text-[11px] uppercase font-semibold text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Name ext.</p>
  <p className="font-medium text-gray-900 dark:text-[#ededed]">{displayUser.nameExtension || '—'}</p>
  </div>
  </div>
  </div>
  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 rounded-lg px-3 py-2">
  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
  Keep your contact details current for platform notifications.
  </div>
  </div>
  </div>
  </div>

  {/* activity */}
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl overflow-hidden">
  <div className="px-5 py-4 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between">
  <h3 className="font-semibold text-gray-900 dark:text-[#ededed] flex items-center gap-2">
  <Activity className="w-4 h-4 text-gray-400 dark:text-[#a1a1aa]" /> Recent activity
  </h3>
  <span className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Last 8 events • {displayUser.email}</span>
  </div>
  <div className="divide-y divide-gray-50">
  {activities.length === 0 ? (
  <div className="p-8 text-center text-sm text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">
  <History className="w-6 h-6 mx-auto mb-2 text-gray-300" />
  No recent user events. Activity will appear here once audit logging records actions.
  </div>
  ) : (
  activities.map((a) => (
  <div key={a.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-[#262626] dark:bg-[#171717]/60 transition-colors">
  <div
  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
  ${a.eventType.includes('LOGIN') ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' : ''}
  ${a.eventType === 'PASSWORD_CHANGED' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : ''}
  ${a.eventType === 'PROFILE_UPDATED' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : ''}
  ${!['LOGIN_SUCCESS', 'PASSWORD_CHANGED', 'PROFILE_UPDATED'].some((k) => a.eventType.includes(k)) ? 'bg-gray-50 dark:bg-[#171717] text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]' : ''}`}
  >
  {a.eventType.includes('LOGIN') ? <LogIn className="w-4 h-4" /> : a.eventType === 'PASSWORD_CHANGED' ? <KeyRound className="w-4 h-4" /> : <History className="w-4 h-4" />}
  </div>
  <div className="flex-1 min-w-0">
  <p className="text-sm font-medium text-gray-900 dark:text-[#ededed]">{a.eventType.split('_').join(' ')}</p>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] truncate">{a.timestamp ? formatDateTime(a.timestamp) : formatDateTime(a.createdAt)}</p>
  {a.ipAddress && <p className="text-[11px] text-gray-400 dark:text-[#a1a1aa]">IP {a.ipAddress} • {String(a.userAgent || '').slice(0, 44)}</p>}
  </div>
  <span className="text-[11px] font-medium text-gray-400 dark:text-[#a1a1aa] whitespace-nowrap">{relativeTime(a.timestamp || a.createdAt)}</span>
  </div>
  ))
  )}
  </div>
  <div className="px-5 py-3 bg-slate-50 dark:bg-[#171717] border-t border-gray-100 dark:border-[#262626] flex items-center justify-between">
  <span className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Audit log powered by user-events collection</span>
  <a href="/settings/audit" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">
  View business →
  </a>
  </div>
  </div>
  </div>

  {/* right column */}
  <div className="col-span-12 lg:col-span-4 space-y-5">
  <div className="bg-gradient-to-br from-black via-[#1a1a1a] to-[#eba236] rounded-xl p-5 text-white relative overflow-hidden border border-[#eba236]/20">
  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
  <div className="relative">
  <p className="text-xs font-semibold tracking-wide uppercase opacity-80 flex items-center gap-1.5">
  <Building2 className="w-4 h-4 text-[#eba236]" /> Business identity
  </p>
  <h3 className="text-lg font-bold mt-1 truncate">{vendor?.businessName || 'No business linked'}</h3>
  <p className="text-sm opacity-85 mt-1 leading-relaxed">
  {vendor
  ? vendor.verificationStatus === 'verified'
  ? 'Your business is verified and live on the platform.'
  : vendor.verificationStatus === 'pending'
  ? 'Your business is pending verification. You will be notified once approved.'
  : `Status: ${vendor.verificationStatus}`
  : 'No vendor record found. Contact support to link your business.'}
  </p>
  <div className="mt-4 space-y-2 text-xs">
  <div className="flex items-center justify-between bg-white dark:bg-[#171717]/10 rounded-lg px-3 py-2 backdrop-blur">
  <span className="opacity-80">Type</span>
  <span className="font-semibold">{vendor ? businessTypeLabel(vendor.businessType) : '—'}</span>
  </div>
  <div className="flex items-center justify-between bg-white dark:bg-[#171717]/10 rounded-lg px-3 py-2 backdrop-blur">
  <span className="opacity-80">Outlets</span>
  <span className="font-semibold">{merchantsCount}</span>
  </div>
  <div className="flex items-center justify-between bg-white dark:bg-[#171717]/10 rounded-lg px-3 py-2 backdrop-blur">
  <span className="opacity-80">Verified</span>
  <span className="font-semibold capitalize">{vendor?.verificationStatus || '—'}</span>
  </div>
  <div className="flex items-center justify-between bg-white dark:bg-[#171717]/10 rounded-lg px-3 py-2 backdrop-blur">
  <span className="opacity-80">Updated</span>
  <span className="font-medium text-white">{formatDate(displayUser.updatedAt)}</span>
  </div>
  </div>
  <button
  onClick={() => switchTab('business')}
  className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black hover:bg-[#1a1a1a] text-white rounded-xl text-sm font-semibold shadow-sm border border-[#eba236]/20 transition-colors w-full"
  >
  View business details <span>→</span>
  </button>
  </div>
  </div>

  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-5">
  <h4 className="font-semibold text-gray-900 dark:text-[#ededed] flex items-center gap-2 text-sm">
  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Security quick check
  </h4>
  <ul className="mt-3 space-y-3">
  <li className="flex items-center justify-between">
  <span className="text-sm text-gray-700 dark:text-[#a1a1aa] flex items-center gap-2">
  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Password strength
  </span>
  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 border border-emerald-200 dark:border-emerald-800">Managed</span>
  </li>
  <li className="flex items-center justify-between">
  <span className="text-sm text-gray-700 dark:text-[#a1a1aa] flex items-center gap-2">
  <span className={`w-2 h-2 rounded-full ${avatarUrl ? 'bg-emerald-500' : 'bg-amber-500'}`} /> Profile picture
  </span>
  <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${avatarUrl ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 border-amber-200 dark:border-amber-800'}`}>
  {avatarUrl ? 'Set' : 'Missing'}
  </span>
  </li>
  <li className="flex items-center justify-between">
  <span className="text-sm text-gray-700 dark:text-[#a1a1aa] flex items-center gap-2">
  <span className="w-2 h-2 rounded-full bg-sky-500" /> 2FA
  </span>
  <span className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Coming soon</span>
  </li>
  <li className="flex items-center justify-between">
  <span className="text-sm text-gray-700 dark:text-[#a1a1aa] flex items-center gap-2">
  <span className="w-2 h-2 rounded-full bg-indigo-500" /> Session
  </span>
  <span className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">JWT • 30 days</span>
  </li>
  </ul>
  <button onClick={() => switchTab('security')} className="mt-4 w-full py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-[#1a1a1a] border border-[#eba236]/30 hover:border-[#eba236]/60 transition-colors">
  Harden security
  </button>
  </div>

  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-5">
  <h4 className="font-semibold text-gray-900 dark:text-[#ededed] text-sm flex items-center gap-2">
  <MapPin className="w-4 h-4 text-gray-400 dark:text-[#a1a1aa]" /> System
  </h4>
  <div className="mt-3 space-y-2 text-sm">
  <div className="flex items-center justify-between">
  <span className="text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Lockouts</span>
  <span className="font-medium text-gray-900 dark:text-[#ededed]">{(rawUser as unknown as { loginAttempts?: number })?.loginAttempts ?? 0} attempts</span>
  </div>
  <div className="flex items-center justify-between">
  <span className="text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Lock until</span>
  <span className="font-medium text-xs text-gray-900 dark:text-[#ededed]">{rawUser?.lockUntil ? formatDateTime(rawUser.lockUntil) : '—'}</span>
  </div>
  <div className="flex items-center justify-between">
  <span className="text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Sessions</span>
  <span className="font-medium text-gray-900 dark:text-[#ededed]">{rawUser?.sessions?.length ?? '—'} active</span>
  </div>
  <div className="flex items-center justify-between">
  <span className="text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">User ID</span>
  <span className="font-mono text-xs bg-slate-50 dark:bg-[#171717] text-gray-900 dark:text-[#ededed] border px-2 py-1 rounded">{displayUser.id}</span>
  </div>
  </div>
  <div className="mt-4 flex gap-2">
  <a href="/settings/security" className="flex-1 text-center py-2 rounded-lg border border-gray-200 dark:border-[#262626] text-sm font-semibold text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] dark:bg-[#171717] dark:bg-[#262626] hover:text-gray-900 dark:text-[#ededed] dark:hover:text-gray-100 dark:text-[#ededed]">
  Security settings
  </a>
  <a href="/settings/audit" className="flex-1 text-center py-2 rounded-lg border border-gray-200 dark:border-[#262626] text-sm font-semibold text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] dark:bg-[#171717] dark:bg-[#262626] hover:text-gray-900 dark:text-[#ededed] dark:hover:text-gray-100 dark:text-[#ededed]">
  Audit logs
  </a>
  </div>
  </div>
  </div>
  </div>
  )}

  {/* PERSONAL */}
  {activeTab === 'personal' && (
  <div className="grid grid-cols-12 gap-5">
  <div className="col-span-12 xl:col-span-8">
  <form onSubmit={handleFormSubmit} className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl overflow-hidden">
  <div className="px-6 py-5 border-b border-gray-100 dark:border-[#262626]">
  <h3 className="font-semibold text-gray-900 dark:text-[#ededed] flex items-center gap-2">
  <UserIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Personal information
  </h3>
  <p className="text-sm text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mt-1">Update your identity & contact details. Changes sync instantly to the CMS Users collection.</p>
  </div>

  {formError && (
  <div className="mx-6 mt-6 flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 text-sm">
  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
  <span>{formError}</span>
  </div>
  )}

  {/* Section: Basic identity */}
  <div className="px-6 py-6 space-y-6">
  <div>
  <h4 className="text-xs font-bold tracking-widest uppercase text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mb-4 flex items-center gap-2">
  <span className="w-6 h-0.5 bg-indigo-600 rounded-full" /> Basic identity
  </h4>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <label className="space-y-1.5">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">
  First name <span className="text-red-500">*</span>
  </span>
  <input
  value={form.firstName}
  onChange={(e) => setForm((s) => ({ ...s, firstName: e.target.value }))}
  required
  placeholder="Juan"
  className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] focus:border-[#c88a20] text-sm"
  />
  </label>
  <label className="space-y-1.5">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">
  Last name <span className="text-red-500">*</span>
  </span>
  <input
  value={form.lastName}
  onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))}
  required
  placeholder="Dela Cruz"
  className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] focus:border-[#c88a20] text-sm"
  />
  </label>
  <label className="space-y-1.5">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Middle name</span>
  <input
  value={form.middleName}
  onChange={(e) => setForm((s) => ({ ...s, middleName: e.target.value }))}
  placeholder="Optional"
  className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] text-sm"
  />
  </label>
  <label className="space-y-1.5">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Name extension</span>
  <input
  value={form.nameExtension}
  onChange={(e) => setForm((s) => ({ ...s, nameExtension: e.target.value }))}
  placeholder="Jr., Sr., III"
  className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] text-sm"
  />
  </label>
  <label className="space-y-1.5 sm:col-span-2">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Username</span>
  <div className="flex items-center gap-2">
  <span className="hidden sm:inline-flex items-center px-3 py-2.5 bg-slate-50 dark:bg-[#171717] border border-gray-300 dark:border-[#262626] rounded-xl text-sm text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">@</span>
  <input
  value={form.username}
  onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
  placeholder="unique_username"
  pattern="^[a-zA-Z0-9._-]+$"
  className="flex-1 px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] text-sm"
  />
  </div>
  <span className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">3–30 chars, letters, numbers, dot, dash, underscore. Must be unique.</span>
  </label>
  </div>
  </div>

  {/* Contact */}
  <div className="pt-6 border-t border-gray-100 dark:border-[#262626]">
  <h4 className="text-xs font-bold tracking-widest uppercase text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mb-4 flex items-center gap-2">
  <span className="w-6 h-0.5 bg-emerald-500 rounded-full" /> Contact
  </h4>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <label className="space-y-1.5">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Email address</span>
  <input
  type="email"
  value={form.email}
  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
  placeholder="vendor@business.com"
  className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] text-sm"
  />
  <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
  <AlertTriangle className="w-3 h-3" /> Changing email will require re-login.
  </span>
  </label>
  <label className="space-y-1.5">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Phone number</span>
  <input
  value={form.phone}
  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
  placeholder="+63 9xx xxx xxxx"
  className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] text-sm"
  />
  </label>
  </div>
  </div>

  {/* Personal details */}
  <div className="pt-6 border-t border-gray-100 dark:border-[#262626]">
  <h4 className="text-xs font-bold tracking-widest uppercase text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mb-4 flex items-center gap-2">
  <span className="w-6 h-0.5 bg-violet-500 rounded-full" /> Personal details
  </h4>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <label className="space-y-1.5">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Gender</span>
  <select
  value={form.gender}
  onChange={(e) => setForm((s) => ({ ...s, gender: e.target.value }))}
  className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] text-sm"
  >
  <option value="">Select gender</option>
  <option value="male">Male</option>
  <option value="female">Female</option>
  <option value="other">Other</option>
  <option value="prefer_not_to_say">Prefer not to say</option>
  </select>
  </label>
  <label className="space-y-1.5">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Civil status</span>
  <select
  value={form.civilStatus}
  onChange={(e) => setForm((s) => ({ ...s, civilStatus: e.target.value }))}
  className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] text-sm"
  >
  <option value="">Select status</option>
  <option value="single">Single</option>
  <option value="married">Married</option>
  <option value="divorced">Divorced</option>
  <option value="widowed">Widowed</option>
  <option value="separated">Separated</option>
  </select>
  </label>
  <label className="space-y-1.5">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Nationality</span>
  <input
  value={form.nationality}
  onChange={(e) => setForm((s) => ({ ...s, nationality: e.target.value }))}
  placeholder="Filipino"
  className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] text-sm"
  />
  </label>
  <label className="space-y-1.5">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Birth date</span>
  <input
  type="date"
  value={form.birthDate}
  onChange={(e) => setForm((s) => ({ ...s, birthDate: e.target.value }))}
  max={new Date().toISOString().slice(0, 10)}
  className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] text-sm"
  />
  </label>
  <label className="space-y-1.5 sm:col-span-2">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Place of birth</span>
  <input
  value={form.placeOfBirth}
  onChange={(e) => setForm((s) => ({ ...s, placeOfBirth: e.target.value }))}
  placeholder="Manila, Philippines"
  className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] text-sm"
  />
  </label>
  </div>
  </div>

  {/* Address */}
  <div className="pt-6 border-t border-gray-100 dark:border-[#262626]">
  <h4 className="text-xs font-bold tracking-widest uppercase text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mb-4 flex items-center gap-2">
  <span className="w-6 h-0.5 bg-sky-500 rounded-full" /> Address
  </h4>
  <label className="space-y-1.5">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Complete address</span>
  <textarea
  value={form.completeAddress}
  onChange={(e) => setForm((s) => ({ ...s, completeAddress: e.target.value }))}
  rows={3}
  placeholder="House no., street, barangay, city, province, ZIP"
  className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] text-sm resize-none"
  />
  <span className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">{form.completeAddress.length}/500</span>
  </label>
  </div>
  </div>

  <div className="px-6 py-4 bg-slate-50 dark:bg-[#171717] border-t border-gray-200 dark:border-[#262626] flex items-center justify-between">
  <button
  type="button"
  onClick={load}
  disabled={formSaving}
  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] text-sm font-semibold text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 transition-colors"
  >
  Reset
  </button>
  <button
  type="submit"
  disabled={formSaving}
  className="inline-flex items-center gap-2 px-6 py-2.5 bg-black hover:bg-[#1a1a1a] disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow border border-[#eba236]/20 transition-colors"
  >
  {formSaving ? <Loader2 className="w-4 h-4 animate-spin text-[#eba236]" /> : <Save className="w-4 h-4 text-[#eba236]" />}
  Save changes
  </button>
  </div>
  </form>
  </div>

  <div className="col-span-12 xl:col-span-4 space-y-5">
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-5">
  <h4 className="font-semibold text-gray-900 dark:text-[#ededed] text-sm flex items-center gap-2">
  <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Avatar
  </h4>
  <div className="mt-4 flex flex-col items-center">
  <div className="w-28 h-28 rounded-2xl overflow-hidden border-4 border-white shadow bg-slate-100 dark:bg-[#262626]">
  {avatarUrl ? (
  <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
  ) : (
  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-black to-[#eba236] text-white text-2xl font-bold">{initials}</div>
  )}
  </div>
  <p className="text-sm font-semibold text-gray-900 dark:text-[#ededed] mt-3">{fullName}</p>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">{displayUser.email}</p>
  <div className="mt-4 grid grid-cols-2 gap-2 w-full">
  <button onClick={handleAvatarClick} disabled={avatarUploading} className="py-2 rounded-xl bg-black dark:bg-[#eba236] text-white dark:text-black text-sm font-semibold hover:bg-[#1a1a1a] dark:hover:bg-[#c88a20] disabled:opacity-60 flex items-center justify-center gap-1.5 transition-colors">
  {avatarUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
  </button>
  <button
  onClick={handleRemoveAvatar}
  disabled={!avatarUrl || avatarUploading}
  className="py-2 rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] text-sm font-semibold text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] hover:text-gray-900 dark:text-[#ededed] dark:hover:text-gray-100 dark:text-[#ededed] disabled:opacity-40"
  >
  Remove
  </button>
  </div>
  <p className="text-[11px] text-gray-400 dark:text-[#a1a1aa] mt-3 text-center leading-relaxed">Stored in Media collection via Cloudinary. Changes reflect immediately in header.</p>
  </div>
  </div>

  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-5">
  <h4 className="font-semibold text-gray-900 dark:text-[#ededed] text-sm flex items-center gap-2">
  <Info className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Tips
  </h4>
  <ul className="mt-3 space-y-2.5 text-sm text-gray-600 dark:text-[#a1a1aa] dark:text-[#a1a1aa] list-disc pl-5 marker:text-indigo-300">
  <li>Username must be unique — you’ll get an error if taken.</li>
  <li>Phone helps for recovery and emergency contacts.</li>
  <li>Address is used only for profile display, not delivery.</li>
  <li>System auto-generates initials fallback if no picture.</li>
  </ul>
  <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 text-xs text-amber-800 flex gap-2">
  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
  <div>
  <p className="font-semibold">Read-only fields</p>
  <p className="opacity-80 mt-0.5">Role, ID, isActive are managed by system and cannot be edited here.</p>
  </div>
  </div>
  </div>

  <div className="bg-black text-white rounded-xl p-5 relative overflow-hidden border border-[#eba236]/20">
  <div className="absolute inset-0 bg-gradient-to-br from-[#eba236]/15 via-transparent to-[#c88a20]/10 pointer-events-none" />
  <div className="relative">
  <h4 className="font-semibold flex items-center gap-2">
  <Sparkles className="w-4 h-4 text-[#eba236]" /> Need help?
  </h4>
  <p className="text-sm opacity-80 mt-1 leading-relaxed">Contact support to change business details or reactivate a locked account.</p>
  <a href="mailto:support@tap2goph.com" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold bg-white dark:bg-[#eba236] text-black px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#c88a20] transition-colors">
  <Mail className="w-4 h-4" /> Contact support
  </a>
  </div>
  </div>
  </div>
  </div>
  )}

  {/* BUSINESS — vendor-only, styled exactly like admin cards */}
  {activeTab === 'business' && (
  <div className="grid grid-cols-12 gap-5">
  <div className="col-span-12 lg:col-span-8 space-y-5">
  {!vendor ? (
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-8 text-center">
  <Building2 className="w-10 h-10 text-gray-300 dark:text-[#a1a1aa] mx-auto mb-3" />
  <h3 className="font-semibold text-gray-900 dark:text-[#ededed]">No business linked</h3>
  <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md mx-auto">Your user account is not yet linked to a vendor business. Contact platform support to onboard your business and enable outlet management.</p>
  </div>
  ) : (
  <>
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl overflow-hidden">
  <div className="px-6 py-5 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between">
  <h3 className="font-semibold text-gray-900 dark:text-[#ededed] flex items-center gap-2">
  <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Company information
  </h3>
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${vb.cls}`}>
  <span className={`w-2 h-2 rounded-full ${vb.dot}`} /> {vb.label}
  </span>
  </div>
  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
  <div>
  <p className="text-[11px] font-semibold tracking-wide uppercase text-gray-500 dark:text-[#a1a1aa]">Business name</p>
  <p className="font-semibold text-gray-900 dark:text-[#ededed] mt-1">{vendor.businessName}</p>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">{vendor.legalName}</p>
  </div>
  <div>
  <p className="text-[11px] font-semibold tracking-wide uppercase text-gray-500 dark:text-[#a1a1aa]">Business type</p>
  <p className="font-medium text-gray-900 dark:text-[#ededed] mt-1">{businessTypeLabel(vendor.businessType)}</p>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">{Array.isArray(vendor.cuisineTypes) ? (vendor.cuisineTypes as string[]).join(', ') : vendor.cuisineTypes ? String(vendor.cuisineTypes) : '—'}</p>
  </div>
  <div>
  <p className="text-[11px] font-semibold tracking-wide uppercase text-gray-500 dark:text-[#a1a1aa]">Registration</p>
  <p className="font-mono text-xs text-gray-900 dark:text-[#ededed] mt-1">{vendor.businessRegistrationNumber || '—'}</p>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">TIN: {vendor.taxIdentificationNumber || '—'}</p>
  </div>
  <div>
  <p className="text-[11px] font-semibold tracking-wide uppercase text-gray-500 dark:text-[#a1a1aa]">Contact</p>
  <p className="text-gray-900 dark:text-[#a1a1aa] mt-1 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400 dark:text-[#a1a1aa]" /> {vendor.primaryContactEmail}</p>
  <p className="text-gray-900 dark:text-[#a1a1aa] flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400 dark:text-[#a1a1aa]" /> {vendor.primaryContactPhone}</p>
  {vendor.websiteUrl && <p className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {vendor.websiteUrl}</p>}
  </div>
  {vendor.description && (
  <div className="sm:col-span-2">
  <p className="text-[11px] font-semibold tracking-wide uppercase text-gray-500 dark:text-[#a1a1aa]">Description</p>
  <p className="text-gray-700 dark:text-[#a1a1aa] mt-1 leading-relaxed">{vendor.description}</p>
  </div>
  )}
  <div className="sm:col-span-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 rounded-lg px-3 py-2">
  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
  Business details are verified by admin. To update registration or legal name, contact support — changes require re-verification.
  </div>
  </div>
  </div>
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl overflow-hidden">
  <div className="px-6 py-4 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between">
  <h3 className="font-semibold text-gray-900 dark:text-[#ededed] flex items-center gap-2">
  <Store className="w-4 h-4 text-gray-400 dark:text-[#a1a1aa]" /> Outlets ({merchantsCount})
  </h3>
  <a href="/outlets" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">Manage outlets →</a>
  </div>
  {merchants.length === 0 ? (
  <div className="p-8 text-center text-sm text-gray-500 dark:text-[#a1a1aa]">
  <Store className="w-6 h-6 mx-auto mb-2 text-gray-300" />
  No outlets yet. Create your first outlet to start accepting orders.
  </div>
  ) : (
  <div className="divide-y divide-gray-100 dark:divide-[#262626]">
  {merchants.map((m) => (
  <div key={m.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#262626] transition-colors">
  <div className="min-w-0">
  <p className="text-sm font-semibold text-gray-900 dark:text-[#ededed] truncate">{m.outletName}</p>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">ID {m.id} • {m.operationalStatus} {m.isAcceptingOrders ? '• Accepting orders' : '• Not accepting'} • ★ {m.averageRating.toFixed(1)} ({m.totalReviews})</p>
  </div>
  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border ${m.isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-gray-50 dark:bg-[#262626] text-gray-600 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>
  <span className={`w-1.5 h-1.5 rounded-full ${m.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} /> {m.isActive ? 'Active' : 'Inactive'}
  </span>
  </div>
  ))}
  </div>
  )}
  </div>
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-5">
  <h4 className="font-semibold text-gray-900 dark:text-[#ededed] text-sm flex items-center gap-2">
  <Briefcase className="w-4 h-4 text-gray-400 dark:text-[#a1a1aa]" /> Documents
  </h4>
  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
  <div className="border border-gray-200 dark:border-[#262626] rounded-lg p-3">
  <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa]">Business License</p>
  {vendor.businessLicense?.url ? (
  <a href={vendor.businessLicense.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1 inline-block">View document →</a>
  ) : (
  <p className="text-xs text-gray-400 dark:text-[#a1a1aa] mt-1 italic">Not uploaded</p>
  )}
  </div>
  <div className="border border-gray-200 dark:border-[#262626] rounded-lg p-3">
  <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa]">Tax Certificate</p>
  {vendor.taxCertificate?.url ? (
  <a href={vendor.taxCertificate.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1 inline-block">View document →</a>
  ) : (
  <p className="text-xs text-gray-400 dark:text-[#a1a1aa] mt-1 italic">Not uploaded</p>
  )}
  </div>
  <div className="border border-gray-200 dark:border-[#262626] rounded-lg p-3">
  <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa]">Logo</p>
  {vendor.logo?.url ? (
  <img src={vendor.logo.url} alt="Logo" className="w-12 h-12 object-contain mt-2 border border-gray-100 dark:border-[#262626] rounded" />
  ) : (
  <p className="text-xs text-gray-400 dark:text-[#a1a1aa] mt-1 italic">No logo</p>
  )}
  </div>
  </div>
  </div>
  </>
  )}
  </div>
  <div className="col-span-12 lg:col-span-4 space-y-5">
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-5">
  <h4 className="font-semibold text-gray-900 dark:text-[#ededed] text-sm flex items-center gap-2">
  <Award className="w-4 h-4 text-amber-500" /> Verification
  </h4>
  <div className="mt-3 space-y-3">
  <div className="flex items-center justify-between">
  <span className="text-sm text-gray-600 dark:text-[#a1a1aa]">Status</span>
  <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${vb.cls}`}>{vb.label}</span>
  </div>
  <div className="flex items-center justify-between text-sm">
  <span className="text-gray-500 dark:text-[#a1a1aa]">Onboarding</span>
  <span className="font-medium text-gray-900 dark:text-[#ededed]">{vendor?.onboardingDate ? formatDate(vendor.onboardingDate) : '—'}</span>
  </div>
  <div className="flex items-center justify-between text-sm">
  <span className="text-gray-500 dark:text-[#a1a1aa]">Rating</span>
  <span className="font-medium text-gray-900 dark:text-[#ededed]">★ {vendor?.averageRating?.toFixed(1) || '0.0'} ({vendor?.totalReviews || 0} reviews)</span>
  </div>
  <div className="flex items-center justify-between text-sm">
  <span className="text-gray-500 dark:text-[#a1a1aa]">Total orders</span>
  <span className="font-medium text-gray-900 dark:text-[#ededed]">{vendor?.totalOrders || 0}</span>
  </div>
  </div>
  {vendor?.verificationStatus === 'pending' && (
  <div className="mt-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
  Your business is under review. You will be notified by email once verified.
  </div>
  )}
  </div>
  <div className="bg-slate-900 dark:bg-black text-white rounded-xl p-5 border border-transparent dark:border-[#262626]">
  <h4 className="font-semibold text-sm flex items-center gap-2">
  <Building2 className="w-4 h-4 text-[#eba236]" /> Need help?
  </h4>
  <p className="text-xs text-slate-300 dark:text-[#a1a1aa] mt-2 leading-relaxed">
  For changes to business registration, verification, or outlet onboarding, contact the operations team via the support channel.
  </p>
  <div className="mt-3 grid grid-cols-2 gap-2">
  <a href="/business/profile" className="text-center py-2 bg-white dark:bg-[#171717] text-slate-900 dark:text-white border border-gray-200 dark:border-[#262626] rounded-lg text-xs font-semibold">Business profile</a>
  <a href="/business/verification" className="text-center py-2 bg-white/10 dark:bg-[#262626] text-white border border-white/20 rounded-lg text-xs font-semibold">Verification</a>
  </div>
  </div>
  </div>
  </div>
  )}

  {/* SECURITY */}
  {activeTab === 'security' && (
  <div className="grid grid-cols-12 gap-5">
  <div className="col-span-12 lg:col-span-7 space-y-5">
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl overflow-hidden">
  <div className="px-6 py-5 border-b border-gray-100 dark:border-[#262626]">
  <h3 className="font-semibold text-gray-900 dark:text-[#ededed] flex items-center gap-2">
  <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Change password
  </h3>
  <p className="text-sm text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mt-1">Keep your account safe with a strong, unique password. 30-day JWT will be refreshed after success.</p>
  </div>

  {(pwdError || pwdSuccess) && (
  <div className={`mx-6 mt-6 flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${pwdError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700'}`}>
  {pwdError ? <AlertCircle className="w-4 h-4 mt-0.5" /> : <CheckCircle className="w-4 h-4 mt-0.5" />}
  <span>{pwdError || pwdSuccess}</span>
  </div>
  )}

  <form onSubmit={handlePasswordSubmit} className="px-6 py-6 space-y-5">
  <label className="space-y-1.5 block">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Current password</span>
  <div className="relative">
  <input
  type={showPwd.current ? 'text' : 'password'}
  value={pwd.current}
  onChange={(e) => setPwd((s) => ({ ...s, current: e.target.value }))}
  placeholder="Enter current password"
  autoComplete="current-password"
  className="w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] text-sm"
  />
  <button type="button" onClick={() => setShowPwd((s) => ({ ...s, current: !s.current }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 dark:text-[#a1a1aa]">
  {showPwd.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
  </button>
  </div>
  </label>

  <label className="space-y-1.5 block">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">New password</span>
  <div className="relative">
  <input
  type={showPwd.next ? 'text' : 'password'}
  value={pwd.next}
  onChange={(e) => setPwd((s) => ({ ...s, next: e.target.value }))}
  placeholder="At least 8 chars, uppercase, number, special"
  autoComplete="new-password"
  className="w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] text-sm"
  />
  <button type="button" onClick={() => setShowPwd((s) => ({ ...s, next: !s.next }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 dark:text-[#a1a1aa]">
  {showPwd.next ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
  </button>
  </div>
  {pwd.next && (
  <div className="space-y-2">
  <div className="h-2 bg-gray-100 dark:bg-[#262626] rounded-full overflow-hidden">
  <div className={`h-full ${pwdNextScore.color} transition-all`} style={{ width: `${pwdNextScore.score}%` }} />
  </div>
  <div className="flex items-center justify-between text-xs">
  <span className="font-medium text-gray-600 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">{pwdNextScore.label}</span>
  <span className="text-gray-400 dark:text-[#a1a1aa]">{pwd.next.length}/40</span>
  </div>
  </div>
  )}
  <ul className="grid grid-cols-2 gap-1.5 text-xs">
  <li className={`flex items-center gap-1.5 ${pwd.next.length >= 8 && pwd.next.length <= 40 ? 'text-emerald-600' : 'text-gray-400 dark:text-[#a1a1aa]'}`}>
  <CheckCircle className="w-3.5 h-3.5" /> 8–40 characters
  </li>
  <li className={`flex items-center gap-1.5 ${/[A-Z]/.test(pwd.next) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-[#a1a1aa]'}`}>
  <CheckCircle className="w-3.5 h-3.5" /> Uppercase
  </li>
  <li className={`flex items-center gap-1.5 ${/[0-9]/.test(pwd.next) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-[#a1a1aa]'}`}>
  <CheckCircle className="w-3.5 h-3.5" /> Number
  </li>
  <li className={`flex items-center gap-1.5 ${/[^A-Za-z0-9]/.test(pwd.next) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-[#a1a1aa]'}`}>
  <CheckCircle className="w-3.5 h-3.5" /> Special char
  </li>
  </ul>
  </label>

  <label className="space-y-1.5 block">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Confirm new password</span>
  <div className="relative">
  <input
  type={showPwd.confirm ? 'text' : 'password'}
  value={pwd.confirm}
  onChange={(e) => setPwd((s) => ({ ...s, confirm: e.target.value }))}
  placeholder="Repeat new password"
  autoComplete="new-password"
  className={`w-full px-3 py-2.5 pr-10 border rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] focus:outline-none focus:ring-2 text-sm ${pwd.confirm && pwd.next !== pwd.confirm ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 dark:border-[#262626] focus:ring-[#eba236]'}`}
  />
  <button type="button" onClick={() => setShowPwd((s) => ({ ...s, confirm: !s.confirm }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 dark:text-[#a1a1aa]">
  {showPwd.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
  </button>
  </div>
  {pwd.confirm && pwd.next !== pwd.confirm && <p className="text-xs text-red-600 dark:text-red-400">Passwords do not match</p>}
  </label>

  <button
  type="submit"
  disabled={pwdSaving}
  className="w-full inline-flex items-center justify-center gap-2 py-3 bg-black hover:bg-[#1a1a1a] disabled:opacity-60 text-white rounded-xl font-semibold border border-[#eba236]/30 hover:border-[#eba236]/60 transition-colors"
  >
  {pwdSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
  Update password
  </button>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] text-center">We’ll verify your current password via secure login before updating.</p>
  </form>
  </div>

  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-6">
  <h4 className="font-semibold text-gray-900 dark:text-[#ededed] flex items-center gap-2">
  <Fingerprint className="w-4 h-4 text-gray-400 dark:text-[#a1a1aa]" /> Password tips
  </h4>
  <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">
  <li className="flex gap-2">
  <span className="text-indigo-600 dark:text-indigo-400">•</span> Use a unique password not reused on other sites.
  </li>
  <li className="flex gap-2">
  <span className="text-indigo-600 dark:text-indigo-400">•</span> Consider a passphrase of 3 random words plus number & symbol.
  </li>
  <li className="flex gap-2">
  <span className="text-indigo-600 dark:text-indigo-400">•</span> Rotate every 90 days and never share via email/chat.
  </li>
  </ul>
  </div>
  </div>

  <div className="col-span-12 lg:col-span-5 space-y-5">
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl overflow-hidden">
  <div className="px-5 py-4 border-b border-gray-100 dark:border-[#262626]">
  <h4 className="font-semibold text-gray-900 dark:text-[#ededed] text-sm flex items-center gap-2">
  <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Session & device
  </h4>
  </div>
  <div className="p-5 space-y-4">
  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#171717] border border-slate-200 dark:border-[#262626]">
  <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#171717] border flex items-center justify-center flex-shrink-0">
  <Monitor className="w-4 h-4 text-slate-700 dark:text-[#a1a1aa]" />
  </div>
  <div className="flex-1 min-w-0">
  <p className="text-sm font-semibold text-gray-900 dark:text-[#ededed]">Current browser</p>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] truncate">Web Admin • JWT • 30-day expiry</p>
  <p className="text-xs text-emerald-700 font-medium mt-1 flex items-center gap-1">
  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active now
  </p>
  </div>
  <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 border border-emerald-200 dark:border-emerald-800">You</span>
  </div>

  <div className="grid grid-cols-2 gap-3 text-sm">
  <div className="bg-slate-50 dark:bg-[#171717] border rounded-xl p-3">
  <p className="text-[11px] uppercase font-semibold text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Last login</p>
  <p className="font-medium text-xs mt-1 text-gray-900 dark:text-[#ededed]">{formatDateTime(displayUser.lastLogin || rawUser?.lastLogin)}</p>
  </div>
  <div className="bg-slate-50 dark:bg-[#171717] border rounded-xl p-3">
  <p className="text-[11px] uppercase font-semibold text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Login attempts</p>
  <p className="font-medium text-xs mt-1 text-gray-900 dark:text-[#ededed]">{(rawUser as unknown as { loginAttempts?: number })?.loginAttempts ?? 0} recent</p>
  </div>
  </div>

  <div className="rounded-xl border border-gray-200 dark:border-[#262626] p-3 flex items-center gap-3">
  <Smartphone className="w-5 h-5 text-gray-400 dark:text-[#a1a1aa]" />
  <div>
  <p className="text-sm font-medium text-gray-900 dark:text-[#ededed]">Remembered devices</p>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">JWT via httpOnly cookie + localStorage mirror</p>
  </div>
  </div>

  <div className="flex gap-2">
  <a href="/settings/security" className="flex-1 text-center py-2 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-semibold text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] dark:bg-[#171717] dark:bg-[#262626] hover:text-gray-900 dark:text-[#ededed] dark:hover:text-gray-100 dark:text-[#ededed]">
  Security hub
  </a>
  <button
  onClick={async () => {
  // trigger logout
  try {
  const { logout } = await import('@/lib/auth');
  await logout();
  window.location.href = '/signin';
  } catch {
  window.location.href = '/signin';
  }
  }}
  className="flex-1 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm font-semibold text-red-700 hover:bg-red-100"
  >
  Sign out everywhere
  </button>
  </div>
  </div>
  </div>

  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-5">
  <h4 className="font-semibold text-gray-900 dark:text-[#ededed] text-sm flex items-center gap-2">
  <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Coming soon: 2FA
  </h4>
  <p className="text-sm text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mt-2 leading-relaxed">Two-factor authentication will add an extra layer using authenticator apps. Enabled globally for vendors in a future release.</p>
  <div className="mt-3 flex items-center gap-2 text-xs">
  <span className="px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 font-semibold">Planned</span>
  <span className="text-gray-400 dark:text-[#a1a1aa]">ETA next quarter</span>
  </div>
  </div>

  <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-5">
  <h4 className="font-semibold text-red-800 flex items-center gap-2 text-sm">
  <AlertTriangle className="w-4 h-4" /> Danger zone
  </h4>
  <p className="text-sm text-red-700/80 mt-2 leading-relaxed">Deactivating your vendor account will revoke access immediately. Contact support — self-deactivation is disabled.</p>
  <button disabled className="mt-3 w-full py-2 rounded-xl bg-white dark:bg-[#171717] border border-red-200 dark:border-red-800 text-red-300 text-sm font-semibold cursor-not-allowed">
  Deactivate account — contact owner
  </button>
  </div>
  </div>
  </div>
  )}

  {/* SETTINGS */}
  {activeTab === 'settings' && (
  <div className="grid grid-cols-12 gap-5">
  <div className="col-span-12 lg:col-span-8 space-y-5">
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl overflow-hidden">
  <div className="px-6 py-5 border-b border-gray-100 dark:border-[#262626]">
  <h3 className="font-semibold text-gray-900 dark:text-[#ededed] flex items-center gap-2">
  <Palette className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Appearance
  </h3>
  <p className="text-sm text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mt-1">Tailor the merchant experience. Preferences are stored locally per browser.</p>
  </div>
  <div className="p-6 space-y-6">
  <div>
  <p className="text-sm font-semibold text-gray-700 dark:text-[#a1a1aa] mb-3">Theme <span className="text-xs font-normal text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">— device-based, not stored in DB ({resolvedTheme})</span></p>
  <div className="grid grid-cols-3 gap-3">
  {[
  { id: 'light', label: 'Light', icon: Monitor, themeValue: 'light' as const },
  { id: 'dark', label: 'Dark', icon: Smartphone, themeValue: 'dark' as const },
  { id: 'auto', label: 'Auto', icon: Globe, themeValue: 'system' as const },
  ].map((o) => {
  const Icon = o.icon;
  const active = theme === o.themeValue;
  return (
  <button
  key={o.id}
  onClick={() => setTheme(o.themeValue)}
  className={`p-4 rounded-xl border text-sm font-semibold flex flex-col items-center gap-2 transition-colors ${active ? 'bg-gray-100 text-gray-900 border-gray-300 dark:bg-[#262626] dark:text-white dark:border-[#262626]' : 'bg-white dark:bg-[#171717] border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626] text-gray-700 dark:text-[#a1a1aa]'}`}
  >
  <Icon className="w-5 h-5" />
  {o.label}
  {active && <span className="text-[10px] leading-none opacity-70">{o.themeValue === 'system' ? `· ${resolvedTheme}` : '· active'}</span>}
  </button>
  );
  })}
  </div>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mt-2">Auto follows your device setting via <code className="px-1 py-0.5 bg-gray-100 dark:bg-[#262626] rounded text-[10px]">prefers-color-scheme</code> and is stored in <code className="px-1 py-0.5 bg-gray-100 dark:bg-[#262626] rounded text-[10px]">localStorage tap2go-merchant-theme</code> — no DB.</p>
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <label className="space-y-1.5">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Language</span>
  <select value={prefs.language} onChange={(e) => persistPrefs({ ...prefs, language: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] text-sm">
  <option value="en">English</option>
  <option value="fil">Filipino</option>
  <option value="ja">Japanese</option>
  </select>
  </label>
  <label className="space-y-1.5">
  <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">Timezone</span>
  <select value={prefs.timezone} onChange={(e) => persistPrefs({ ...prefs, timezone: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:placeholder:text-[#a1a1aa] dark:text-[#a1a1aa] text-sm">
  <option value="Asia/Manila">Asia/Manila (PHT)</option>
  <option value="Asia/Singapore">Asia/Singapore</option>
  <option value="UTC">UTC</option>
  <option value="America/New_York">America/New York</option>
  </select>
  </label>
  </div>

  <label className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-[#262626] bg-slate-50 dark:bg-[#171717]">
  <div>
  <p className="text-sm font-semibold text-gray-900 dark:text-[#ededed]">Compact mode</p>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Reduce padding and density across tables</p>
  </div>
  <button
  type="button"
  onClick={() => persistPrefs({ ...prefs, compact: !prefs.compact })}
  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${prefs.compact ? 'bg-black' : 'bg-gray-200 dark:bg-[#262626]'}`}
  >
  <span className={`inline-block h-5 w-5 rounded-full bg-white dark:bg-[#171717] shadow transform transition ${prefs.compact ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
  </label>
  </div>
  </div>

  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl overflow-hidden">
  <div className="px-6 py-5 border-b border-gray-100 dark:border-[#262626]">
  <h3 className="font-semibold text-gray-900 dark:text-[#ededed] flex items-center gap-2">
  <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Notifications
  </h3>
  <p className="text-sm text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa] mt-1">Control how you receive platform alerts. These preferences are local until server sync is available.</p>
  </div>
  <div className="p-6 space-y-4">
  {[
  { key: 'emailNotif', label: 'Email notifications', desc: 'Order issues, payouts, verification requests' },
  { key: 'browserNotif', label: 'Browser push', desc: 'Real-time banner & sound for critical alerts' },
  ].map((row) => (
  <label key={row.key} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-[#262626] hover:bg-slate-50 dark:bg-[#171717] cursor-pointer">
  <div>
  <p className="text-sm font-semibold text-gray-900 dark:text-[#ededed]">{row.label}</p>
  <p className="text-xs text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">{row.desc}</p>
  </div>
  <input
  type="checkbox"
  checked={(prefs as unknown as Record<string, boolean>)[row.key]}
  onChange={(e) => persistPrefs({ ...prefs, [row.key]: e.target.checked })}
  className="w-5 h-5 rounded border-gray-300 dark:border-[#262626] text-indigo-600 dark:text-indigo-400 focus:ring-[#eba236]"
  />
  </label>
  ))}
  <div className="rounded-xl bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800 p-3 text-xs text-sky-800 flex gap-2">
  <Info className="w-4 h-4 flex-shrink-0" /> Server-side notification preferences will sync once Communications &gt; User Notifications exposes per-vendor settings.
  </div>
  </div>
  </div>
  </div>

  <div className="col-span-12 lg:col-span-4 space-y-5">
  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-5">
  <h4 className="font-semibold text-gray-900 dark:text-[#ededed] text-sm flex items-center gap-2">
  <Globe className="w-4 h-4 text-gray-400 dark:text-[#a1a1aa]" /> Quick links
  </h4>
  <div className="mt-3 space-y-2">
  <a href="/settings/configuration" className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626] dark:bg-[#171717] dark:bg-[#262626] text-sm font-medium text-gray-900 dark:text-[#ededed] hover:text-gray-900 dark:text-[#ededed] dark:hover:text-gray-100 dark:text-[#ededed]">
  Configurations <span className="text-gray-400 dark:text-[#a1a1aa]">→</span>
  </a>
  <a href="/settings/security" className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626] dark:bg-[#171717] dark:bg-[#262626] text-sm font-medium text-gray-900 dark:text-[#ededed] hover:text-gray-900 dark:text-[#ededed] dark:hover:text-gray-100 dark:text-[#ededed]">
  Security policies <span className="text-gray-400 dark:text-[#a1a1aa]">→</span>
  </a>
  <a href="/settings/audit" className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626] dark:bg-[#171717] dark:bg-[#262626] text-sm font-medium text-gray-900 dark:text-[#ededed] hover:text-gray-900 dark:text-[#ededed] dark:hover:text-gray-100 dark:text-[#ededed]">
  Audit logs <span className="text-gray-400 dark:text-[#a1a1aa]">→</span>
  </a>
  <a href="/business/profile" className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626] dark:bg-[#171717] dark:bg-[#262626] text-sm font-medium text-gray-900 dark:text-[#ededed] hover:text-gray-900 dark:text-[#ededed] dark:hover:text-gray-100 dark:text-[#ededed]">
  Business profile <span className="text-gray-400 dark:text-[#a1a1aa]">→</span>
  </a>
  </div>
  </div>

  <div className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl p-5">
  <h4 className="text-sm font-semibold text-gray-900 dark:text-[#ededed]">Session summary</h4>
  <div className="mt-3 space-y-2 text-sm">
  <div className="flex justify-between">
  <span className="text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Theme</span>
  <span className="font-medium capitalize text-gray-900 dark:text-[#ededed]">{theme}{theme === 'system' ? ` · ${resolvedTheme}` : ''}</span>
  </div>
  <div className="flex justify-between">
  <span className="text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Timezone</span>
  <span className="font-medium text-gray-900 dark:text-[#ededed]">{prefs.timezone}</span>
  </div>
  <div className="flex justify-between">
  <span className="text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Language</span>
  <span className="font-medium text-gray-900 dark:text-[#ededed]">{prefs.language.toUpperCase()}</span>
  </div>
  <div className="flex justify-between">
  <span className="text-gray-500 dark:text-[#a1a1aa] dark:text-[#a1a1aa]">Account</span>
  <span className="font-medium text-gray-900 dark:text-[#ededed]">{displayUser.email}</span>
  </div>
  </div>
  </div>
  </div>
  </div>
  )}
  </div>

  {/* footer */}
  <div className="text-center text-xs text-gray-400 dark:text-[#a1a1aa]">
  Tap2Go Merchant • Vendor profile powered by Payload CMS Users & Vendors • Media via Cloudinary • Audit via user-events
  </div>
  </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileInner />
    </Suspense>
  );
}