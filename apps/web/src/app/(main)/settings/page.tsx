'use client';

/**
 * Customer settings page — web-admin /profile pattern ported to apps/web:
 * cover banner + overlapping avatar header card + profile completeness +
 * tab nav (?tab=) + overview grid. Thin page: server actions own data.
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import Image from '@/components/ui/ImageWrapper';
import { useAuth, useLogout, useUser } from '@/hooks/useAuth';
import { SettingsPageSkeleton } from '@/components/skeletons/SettingsSkeleton';
import ProfileModal from '@/components/settings/ProfileModal';
import PasswordModal from '@/components/settings/PasswordModal';
import EmailModal from '@/components/settings/EmailModal';
import PaymentMethodModal from '@/components/settings/PaymentMethodModal';
import { eventLabel, type AccountSummary, type AccountUser, type ActivityEvent } from '@/types/settings';
import {
  changePassword,
  clearBrowsingHistory,
  confirmEmailChange,
  deactivateAccount,
  deletePaymentMethod,
  exportAccountData,
  fetchAccountSummary,
  fetchActivity,
  removeAvatar,
  requestAccountDeletion,
  requestEmailChange,
  savePaymentMethod,
  savePreferences,
  saveProfile,
  uploadAvatar,
} from '@/lib/client-services/settings-service';

const BRAND = '#239459';

// ---------- helpers (web-admin /profile pattern) ----------

// Hoisted (§4b item 1): shared formatters instead of a fresh
// toLocaleString options-object per activity row per render.
const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return dateFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return dateTimeFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

function relativeTime(iso?: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function completeness(u: AccountUser | null): number {
  if (!u) return 0;
  const fields: Array<keyof AccountUser> = [
    'firstName',
    'lastName',
    'phone',
    'username',
    'gender',
    'civilStatus',
    'nationality',
    'birthDate',
    'placeOfBirth',
    'preferredLanguage',
    'profilePicture',
  ];
  let filled = 0;
  for (const f of fields) {
    const v = u[f];
    if (v !== null && v !== undefined && String(v).trim() !== '') filled++;
  }
  return Math.round((filled / fields.length) * 100);
}

// ---------- tabs ----------

type TabId = 'overview' | 'profile' | 'security' | 'notifications' | 'payments' | 'privacy' | 'activity';

const TABS: Array<{ id: TabId; label: string; icon: string; desc: string }> = [
  { id: 'overview', label: 'Overview', icon: 'fas fa-sparkles', desc: 'Summary' },
  { id: 'profile', label: 'Profile', icon: 'fas fa-user', desc: 'Edit details' },
  { id: 'security', label: 'Security', icon: 'fas fa-shield-alt', desc: 'Password & access' },
  { id: 'notifications', label: 'Notifications', icon: 'fas fa-bell', desc: 'Preferences' },
  { id: 'payments', label: 'Payments', icon: 'fas fa-credit-card', desc: 'Methods' },
  { id: 'privacy', label: 'Privacy', icon: 'fas fa-lock', desc: 'Data' },
  { id: 'activity', label: 'Activity', icon: 'fas fa-list', desc: 'Audit log' },
];

const TAB_IDS = TABS.map((t) => t.id) as string[];

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: ctxUser } = useUser();
  const { updateUser } = useAuth();
  const { logout } = useLogout();

  const tabParam = searchParams?.get('tab') as TabId | null;
  const activeTab: TabId =
    tabParam && TAB_IDS.includes(tabParam) ? tabParam : 'overview';

  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [pmOpen, setPmOpen] = useState(false);
  const [pmBusy, setPmBusy] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [removingMethodId, setRemovingMethodId] = useState<string | null>(null);
  const [dangerTarget, setDangerTarget] = useState<'deactivate' | 'delete' | null>(null);
  const [dangerPassword, setDangerPassword] = useState('');
  const [dangerBusy, setDangerBusy] = useState(false);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityMore, setActivityMore] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  // The cover card and the profile tab each render a hidden file input;
  // sharing one ref breaks same-file reselect (last mount wins the ref).
  const avatarInputRefSecondary = useRef<HTMLInputElement>(null);
  // Monotonic save guard: overlapping profile saves must not let a stale
  // response reconcile over (or roll back) a newer one.
  const saveSeqRef = useRef(0);
  // Last-known-good preferences per key: rollback restores only the failed
  // key instead of clobbering a concurrently toggled sibling.
  const lastGoodPrefsRef = useRef<Record<string, boolean> | null>(null);

  const load = useCallback(async (opts: { silent?: boolean; reset?: boolean } = {}) => {
    try {
      if (!opts.silent) {
        if (opts.reset) setRefreshing(true);
        else setLoading(true);
      }
      setError(null);
      const s = await fetchAccountSummary();
      setSummary(s);
      lastGoodPrefsRef.current = s.preferences ? { ...(s.preferences as unknown as Record<string, boolean>) } : null;
      setActivity(s.recentActivity);
      setActivityPage(1);
      setActivityMore(s.recentActivity.length >= 10);
    } catch (e: any) {
      if (!opts.silent) setError(e?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadRef = useRef(load);
  loadRef.current = load;
  const mountedOnce = useRef(false);

  useEffect(() => {
    if (mountedOnce.current) return;
    mountedOnce.current = true;
    loadRef.current({});
  }, []);

  // Email verification return (?emailToken=).
  const confirmedToken = useRef<string | null>(null);
  useEffect(() => {
    const token = searchParams?.get('emailToken');
    if (!token || confirmedToken.current === token || loading) return;
    confirmedToken.current = token;
    confirmEmailChange(token)
      .then((msg) => {
        toast.success(msg);
        loadRef.current({ reset: true });
      })
      .catch((e: any) => toast.error(e?.message || 'Verification failed'));
  }, [searchParams, loading]);

  const switchTab = useCallback(
    (id: TabId) => {
      router.push(id === 'overview' ? '/settings' : `/settings?tab=${id}`);
    },
    [router],
  );

  const syncHeader = useCallback(
    (u: AccountSummary['user']) => {
      try {
        updateUser({
          ...(ctxUser as any),
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          profilePicture: u.profilePicture as any,
        } as any);
      } catch {
        /* header sync best-effort */
      }
    },
    [updateUser, ctxUser],
  );

  const handleHardRefresh = useCallback(() => {
    loadRef.current({ reset: true });
  }, []);

  const handleProfileSubmit = useCallback(
    async (input: Record<string, unknown>) => {
      // Optimistic (address-modal pattern): close + patch instantly so a
      // gender-only edit feels <100ms; reconcile with server after.
      const seq = ++saveSeqRef.current;
      const isStale = () => seq !== saveSeqRef.current;
      const prevUser = summary?.user ?? null;
      if (prevUser) {
        const optimistic = { ...prevUser, ...input } as AccountSummary['user'];
        setSummary((s) => (s ? { ...s, user: optimistic } : s));
        syncHeader(optimistic);
      }
      setProfileOpen(false);
      setProfileBusy(true);
      try {
        const u = await saveProfile(input);
        if (isStale()) return;
        setSummary((s) => (s ? { ...s, user: u } : s));
        syncHeader(u);
        toast.success('Profile updated');
      } catch (e: any) {
        if (isStale()) return;
        // Roll back optimistic patch on failure.
        if (prevUser) {
          setSummary((s) => (s ? { ...s, user: prevUser } : s));
          try {
            syncHeader(prevUser);
          } catch {
            /* best-effort */
          }
        }
        toast.error(e?.message || 'Update failed');
      } finally {
        if (!isStale()) setProfileBusy(false);
      }
    },
    [syncHeader, summary?.user],
  );

  const handleAvatarFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be under 5 MB');
        return;
      }
      setAvatarBusy(true);
      try {
        const u = await uploadAvatar(file);
        toast.success('Profile picture updated');
        syncHeader(u);
        setSummary((s) => (s ? { ...s, user: u } : s));
      } catch (e: any) {
        toast.error(e?.message || 'Upload failed');
      } finally {
        setAvatarBusy(false);
        if (avatarInputRef.current) avatarInputRef.current.value = '';
        if (avatarInputRefSecondary.current) avatarInputRefSecondary.current.value = '';
      }
    },
    [syncHeader],
  );

  const handleRemoveAvatar = useCallback(async () => {
    setAvatarBusy(true);
    try {
      const u = await removeAvatar();
      toast.success('Profile picture removed');
      syncHeader(u);
      setSummary((s) => (s ? { ...s, user: u } : s));
    } catch (e: any) {
      toast.error(e?.message || 'Remove failed');
    } finally {
      setAvatarBusy(false);
    }
  }, [syncHeader]);

  const handlePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      setPasswordBusy(true);
      try {
        const res = await changePassword({ currentPassword, newPassword });
        toast.success(res.message);
        setPasswordOpen(false);
        await logout();
        router.push('/signin');
      } catch (e: any) {
        toast.error(e?.message || 'Password change failed');
      } finally {
        setPasswordBusy(false);
      }
    },
    [logout, router],
  );

  const handleEmail = useCallback(async (newEmail: string) => {
    setEmailBusy(true);
    try {
      const msg = await requestEmailChange(newEmail);
      toast.success(msg);
      setEmailOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Request failed');
    } finally {
      setEmailBusy(false);
    }
  }, []);

  const handleToggle = useCallback(
    async (key: string, value: boolean) => {
      setToggling(key);
      setSummary((s) =>
        s && s.preferences ? { ...s, preferences: { ...s.preferences, [key]: value } } : s,
      );
      try {
        const prefs = await savePreferences({ [key]: value });
        lastGoodPrefsRef.current = { ...(prefs as unknown as Record<string, boolean>) };
        setSummary((s) => (s ? { ...s, preferences: prefs } : s));
        toast.success('Preference saved');
      } catch (e: any) {
        // Restore only the failed key from last-known-good — a concurrent
        // sibling toggle keeps its optimistic value.
        const lastGood = lastGoodPrefsRef.current?.[key];
        setSummary((s) => {
          if (!s || !s.preferences || lastGood === undefined) return s;
          return { ...s, preferences: { ...s.preferences, [key]: lastGood } };
        });
        toast.error(e?.message || 'Save failed');
      } finally {
        setToggling(null);
      }
    },
    [],
  );

  const handleVault = useCallback(async (input: Parameters<typeof savePaymentMethod>[0]) => {
    setPmBusy(true);
    try {
      const created = await savePaymentMethod(input);
      toast.success('Payment method saved');
      setPmOpen(false);
      setSummary((s) =>
        s
          ? {
              ...s,
              paymentMethods: [
                created,
                ...s.paymentMethods.map((m) => (created.isDefault ? { ...m, isDefault: false } : m)),
              ],
            }
          : s,
      );
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setPmBusy(false);
    }
  }, []);

  const handleRemoveMethod = useCallback(async (id: string | number) => {
    const idStr = String(id);
    if (removingMethodId != null) return;
    setRemovingMethodId(idStr);
    try {
      const { promotedId } = await deletePaymentMethod(id);
      toast.success('Payment method removed');
      setSummary((s) =>
        s
          ? {
              ...s,
              paymentMethods: s.paymentMethods
                .filter((m) => String(m.id) !== idStr)
                .map((m) => (promotedId && String(m.id) === String(promotedId) ? { ...m, isDefault: true } : m)),
            }
          : s,
      );
    } catch (e: any) {
      toast.error(e?.message || 'Remove failed');
    } finally {
      setRemovingMethodId(null);
    }
  }, [removingMethodId]);

  const handleMoreActivity = useCallback(async () => {
    setActivityLoadingMore(true);
    try {
      const res = await fetchActivity(activityPage + 1);
      setActivity((prev) => [...prev, ...res.docs]);
      setActivityPage(res.pagination?.page ?? activityPage + 1);
      setActivityMore(!!res.pagination?.hasNextPage);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load activity');
    } finally {
      setActivityLoadingMore(false);
    }
  }, [activityPage]);

  const handleClearHistory = useCallback(async () => {
    setPrivacyBusy('clear');
    try {
      const cleared = await clearBrowsingHistory();
      const total = Object.values(cleared).reduce((s: number, n: any) => s + Number(n || 0), 0);
      toast.success(`Cleared ${total} item${total === 1 ? '' : 's'}`);
    } catch (e: any) {
      toast.error(e?.message || 'Clear failed');
    } finally {
      setPrivacyBusy(null);
    }
  }, []);

  const handleExport = useCallback(async () => {
    setPrivacyBusy('export');
    try {
      const data = await exportAccountData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kuyacares-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported');
    } catch (e: any) {
      toast.error(e?.message || 'Export failed');
    } finally {
      setPrivacyBusy(null);
    }
  }, []);

  const dangerSubmittedRef = useRef(false);

  const handleDanger = useCallback(async () => {
    if (!dangerTarget || !dangerPassword || dangerBusy || dangerSubmittedRef.current) return;
    dangerSubmittedRef.current = true;
    setDangerBusy(true);
    try {
      const msg =
        dangerTarget === 'deactivate'
          ? await deactivateAccount(dangerPassword)
          : await requestAccountDeletion(dangerPassword);
      toast.success(msg);
      setDangerTarget(null);
      await logout();
      router.push('/signin');
    } catch (e: any) {
      toast.error(e?.message || 'Request failed');
    } finally {
      setDangerBusy(false);
      setDangerPassword('');
      dangerSubmittedRef.current = false;
    }
  }, [dangerTarget, dangerPassword, dangerBusy, logout, router]);

  const accountAge = useMemo(() => {
    const created = summary?.user.createdAt;
    if (!created) return '—';
    const d = Math.floor((Date.now() - new Date(created).getTime()) / (1000 * 60 * 60 * 24));
    if (d < 30) return `${d} days`;
    if (d < 365) return `${Math.floor(d / 30)} mo`;
    return `${Math.floor(d / 365)} yr ${Math.floor((d % 365) / 30)} mo`;
  }, [summary?.user.createdAt]);

  // Header derivations + row renderers (§4b: memoize BEFORE the early
  // returns below — hooks after conditional returns break hook order).
  // They read summary?.user so first paint (summary null) is safe.
  const displayName = useMemo(
    () => `${summary?.user.firstName ?? ''} ${summary?.user.lastName ?? ''}`.trim(),
    [summary?.user.firstName, summary?.user.lastName],
  );
  const initials = useMemo(() => {
    const u = summary?.user;
    return `${u?.firstName?.[0] || ''}${u?.lastName?.[0] || ''}`.toUpperCase() || '??';
  }, [summary?.user.firstName, summary?.user.lastName]);
  const avatarUrl = summary?.user.profilePicture?.url || null;
  const pc = useMemo(() => completeness(summary?.user ?? null), [summary?.user]);

  const toggleRow = useCallback(
    (key: string, title: string, desc: string) => {
      const prefs = summary?.preferences;
      return (
        <div key={key} className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>
          <button
            type="button"
            disabled={toggling === key || !prefs}
            onClick={() => prefs && handleToggle(key, !(prefs as any)[key])}
            aria-label={title}
            className={`w-11 h-6 rounded-full flex-shrink-0 transition-colors relative disabled:opacity-60 ${
              prefs && (prefs as any)[key] ? '' : 'bg-gray-300'
            }`}
            style={prefs && (prefs as any)[key] ? { backgroundColor: BRAND } : {}}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                prefs && (prefs as any)[key] ? 'left-[22px]' : 'left-0.5'
              }`}
            />
            {toggling === key && (
              <i className="fas fa-spinner fa-spin absolute inset-0 m-auto w-3 h-3 text-white" />
            )}
          </button>
        </div>
      );
    },
    [handleToggle, summary?.preferences, toggling],
  );

  const activityRow = useCallback((a: ActivityEvent) => {
    const meta = eventLabel(a.eventType);
    return (
      <div key={a.id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
        <div className="w-8 h-8 rounded-full bg-gray-50 text-gray-500 flex items-center justify-center flex-shrink-0 mt-0.5">
          <i className={`${meta.icon} text-xs`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 capitalize">{meta.label}</p>
          <p className="text-xs text-gray-500 truncate">{a.createdAt ? formatDateTime(a.createdAt) : ''}</p>
        </div>
        <span className="text-[11px] font-medium text-gray-400 whitespace-nowrap">{relativeTime(a.createdAt)}</span>
      </div>
    );
  }, []);

  if (loading) return <SettingsPageSkeleton />;

  if (error && !summary) {
    const noSession = error.includes('SETTINGS_NO_SESSION');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
            <i className={`fas ${noSession ? 'fa-user-lock' : 'fa-exclamation-triangle'} text-red-500 text-xl`} />
          </div>
          <h2 className="text-lg font-extrabold text-gray-900 mb-2">Couldn&apos;t load settings</h2>
          <p className="text-sm text-gray-500 mb-5">{noSession ? 'Please sign in to manage settings.' : error}</p>
          {noSession ? (
            <Link
              href="/signin"
              className="block w-full py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90"
              style={{ backgroundColor: BRAND }}
            >
              Sign in
            </Link>
          ) : (
            <button
              onClick={handleHardRefresh}
              className="w-full py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90"
              style={{ backgroundColor: BRAND }}
            >
              <i className="fas fa-sync-alt mr-2" />
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const u = summary.user;
  const prefs = summary.preferences;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="w-full px-2.5 py-5 space-y-6">
        {/* Cover + header card (web-admin /profile pattern) */}
        <div className="space-y-0">
          <div className="relative h-[156px] sm:h-[184px] rounded-t-2xl overflow-hidden bg-gradient-to-br from-black via-[#1a1a1a] to-[#239459] border border-gray-200">
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='g' width='10' height='10' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 10 0 L 0 0 0 10' fill='none' stroke='white' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23g)'/%3E%3C/svg%3E")`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute -right-16 -top-10 w-64 h-64 bg-[#a7f3d0]/20 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute -left-12 bottom-0 w-72 h-72 bg-[#a7f3d0]/10 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase bg-white/90 text-gray-700 backdrop-blur border border-gray-200/50 px-3 py-1.5 rounded-full">
                <span className={`w-2 h-2 rounded-full ${u.isActive === false ? 'bg-red-400' : 'bg-emerald-400'} animate-pulse`} />
                {u.isActive === false ? 'Inactive' : 'Active account'}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white text-slate-800 px-3 py-1.5 rounded-full text-xs font-semibold shadow">
                <i className="fas fa-fingerprint text-xs" style={{ color: BRAND }} />
                ID • {u.id}
              </span>
              <button
                onClick={handleHardRefresh}
                disabled={refreshing}
                title="Refresh"
                className="inline-flex items-center justify-center w-8 h-8 bg-white text-slate-800 rounded-full text-xs shadow hover:opacity-90 disabled:opacity-60"
              >
                <i className={`fas fa-sync-alt ${refreshing ? 'fa-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="relative bg-white border border-gray-200 border-t-0 rounded-b-2xl shadow-sm">
            <div className="px-6 sm:px-8 pb-6">
              <div className="flex flex-col lg:flex-row lg:items-end gap-6 -mt-14 sm:-mt-16 relative">
                <div className="flex-shrink-0">
                  <div className="relative group">
                    <div className="w-[112px] h-[112px] sm:w-[128px] sm:h-[128px] rounded-2xl overflow-hidden bg-white border-4 border-white shadow-xl">
                      {avatarUrl ? (
                        <Image src={avatarUrl} alt={displayName} width={128} height={128} className="w-full h-full object-cover" />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-white text-3xl font-bold"
                          style={{ background: `linear-gradient(135deg, ${BRAND}, #12522f)` }}
                        >
                          {initials}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => avatarInputRefSecondary.current?.click()}
                      disabled={avatarBusy}
                      className="absolute -bottom-2 -right-2 w-9 h-9 text-white rounded-xl shadow-lg border-2 border-white flex items-center justify-center disabled:opacity-60 transition-colors hover:opacity-90"
                      style={{ backgroundColor: BRAND }}
                      title="Change photo"
                    >
                      {avatarBusy ? <i className="fas fa-spinner fa-spin text-sm" /> : <i className="fas fa-camera text-sm" />}
                    </button>
                  </div>
                  <input
                    ref={avatarInputRefSecondary}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    className="hidden"
                    onChange={(e) => handleAvatarFile(e.target.files?.[0])}
                  />
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    {avatarUrl && (
                      <button
                        onClick={handleRemoveAvatar}
                        disabled={avatarBusy}
                        className="inline-flex items-center gap-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        <i className="fas fa-trash text-xs" /> Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2 max-w-[150px] leading-relaxed">JPG, PNG, WebP up to 5 MB.</p>
                </div>

                <div className="flex-1 min-w-0 pt-2 lg:pt-0 lg:pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900 truncate">{displayName}</h1>
                    {u.emailVerifiedAt && <i className="fas fa-badge-check text-sky-500" title="Verified" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide text-white"
                      style={{ background: `linear-gradient(to right, ${BRAND}, #12522f)` }}
                    >
                      <i className="fas fa-crown text-xs" /> Customer
                    </span>
                    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> CUSTOMER
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                      <i className="fas fa-envelope text-xs" /> {u.email}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <i className="fas fa-calendar text-xs" /> Joined {formatDate(u.createdAt)} • {relativeTime(u.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <i className="fas fa-clock text-xs" /> Last login {formatDateTime(u.lastLogin)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <i className="fas fa-globe text-xs" /> {u.preferredLanguage === 'fil' ? 'Filipino' : 'English'} • {u.timezone} • {u.currency}
                    </span>
                  </div>
                </div>

                <div className="lg:ml-auto flex flex-col sm:flex-row lg:flex-col gap-4 w-full lg:w-[320px]">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <i className="fas fa-sparkles text-xs" style={{ color: BRAND }} /> Profile completeness
                      </span>
                      <span className="text-xs font-bold" style={{ color: BRAND }}>{pc}%</span>
                    </div>
                    <div className="h-2 bg-white border border-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-700"
                        style={{ width: `${pc}%`, background: `linear-gradient(to right, ${BRAND}, #12522f)` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                      {pc === 100 ? 'Excellent — your profile is complete.' : 'Add phone and personal details to improve trust.'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setProfileOpen(true)}
                      disabled={profileBusy}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60"
                      style={{ backgroundColor: BRAND }}
                    >
                      <i className="fas fa-pen text-xs" /> Edit profile
                    </button>
                    <button
                      onClick={() => switchTab('security')}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <i className="fas fa-shield-alt text-xs" /> Security
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-2 sm:px-6 border-t border-gray-100">
              <nav className="flex gap-1 sm:gap-2 overflow-x-auto scrollbar-none py-2" aria-label="Settings tabs">
                {TABS.map((t) => {
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => switchTab(t.id)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                        isActive ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <i className={`${t.icon} text-xs ${isActive ? '' : 'text-gray-400'}`} style={isActive ? { color: BRAND } : {}} />
                      {t.label}
                      <span className={`hidden sm:inline text-[11px] font-medium px-1.5 py-0.5 rounded-full ${isActive ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-500'}`}>
                        {t.desc}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'overview' && (
            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-12 lg:col-span-8 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Orders', value: String(summary.counts.orders), icon: 'fas fa-receipt', note: 'Lifetime food orders', href: '/orders' as const },
                    { label: 'Addresses', value: String(summary.counts.addresses), icon: 'fas fa-map-marker-alt', note: 'Saved delivery spots', href: '/addresses' as const },
                    { label: 'Payment methods', value: String(summary.paymentMethods.length), icon: 'fas fa-credit-card', note: 'Vaulted for checkout', href: null },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center">
                          <i className={`${s.icon} text-sm`} style={{ color: BRAND }} />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold tracking-wide uppercase text-gray-500">{s.label}</p>
                          <p className="text-sm font-bold text-gray-900">{s.value}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-3">
                        {s.note}{' '}
                        {s.href && (
                          <Link href={s.href} className="font-bold hover:opacity-80" style={{ color: BRAND }}>
                            Manage →
                          </Link>
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <i className="fas fa-user text-xs text-gray-400" /> Account snapshot
                    </h3>
                    <button onClick={() => setProfileOpen(true)} disabled={profileBusy} className="text-xs font-bold hover:opacity-80 disabled:opacity-60" style={{ color: BRAND }}>
                      Edit →
                    </button>
                  </div>
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-[11px] font-semibold tracking-wide uppercase text-gray-500 mb-1">Contact</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-700">
                            <i className="fas fa-envelope text-xs text-gray-400" /> {u.email}
                            {u.emailVerifiedAt ? (
                              <span className="text-[10px] font-bold text-green-700">verified</span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-700">unverified</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <i className="fas fa-phone text-xs text-gray-400" /> {u.phone || <span className="text-gray-400 italic">No phone</span>}
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <i className="fas fa-at text-xs text-gray-400" /> {u.username || <span className="text-gray-400 italic">No username</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[11px] font-semibold tracking-wide uppercase text-gray-500 mb-1">Personal</p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {[
                            ['Gender', u.gender?.replace(/_/g, ' ') || '—'],
                            ['Civil status', u.civilStatus?.replace(/_/g, ' ') || '—'],
                            ['Birth date', u.birthDate ? formatDate(u.birthDate) : '—'],
                            ['Account age', accountAge],
                          ].map(([k, v]) => (
                            <div key={k} className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                              <p className="text-[11px] uppercase font-semibold text-gray-500">{k}</p>
                              <p className="font-medium capitalize text-gray-900">{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                        <i className="fas fa-info-circle text-xs" style={{ color: BRAND }} />
                        Keep your contact details current for order updates.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <i className="fas fa-clock-rotate-left text-xs text-gray-400" /> Recent activity
                    </h3>
                    <button onClick={() => switchTab('activity')} className="text-xs font-bold hover:opacity-80" style={{ color: BRAND }}>
                      View all →
                    </button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {activity.slice(0, 5).map(activityRow)}
                    {activity.length === 0 && (
                      <p className="p-8 text-center text-sm text-gray-500">No recent activity yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-4 space-y-5">
                <div className="bg-white rounded-xl p-5 text-gray-900 relative overflow-hidden border border-green-200">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-transparent to-green-100/60 pointer-events-none" />
                  <div className="relative">
                    <p className="text-xs font-semibold tracking-wide uppercase opacity-80 flex items-center gap-1.5">
                      <i className="fas fa-crown text-xs" style={{ color: BRAND }} /> Membership
                    </p>
                    <h3 className="text-lg font-bold mt-1">Valued Customer</h3>
                    <p className="text-sm opacity-85 mt-1 leading-relaxed">
                      Member for {accountAge}. Enjoy faster checkout with saved addresses and wallet.
                    </p>
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="opacity-80">Status</span>
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <span className={`w-2 h-2 rounded-full ${u.isActive === false ? 'bg-red-400' : 'bg-emerald-500'}`} />
                          {u.isActive === false ? 'Inactive' : 'Active'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="opacity-80">Member since</span>
                        <span className="font-medium">{formatDate(u.createdAt)}</span>
                      </div>
                    </div>
                    <Link
                      href="/orders"
                      className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: BRAND }}
                    >
                      My orders <span>→</span>
                    </Link>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                    <i className="fas fa-shield-alt text-xs" style={{ color: BRAND }} /> Security quick check
                  </h4>
                  <ul className="mt-3 space-y-3">
                    <li className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${u.emailVerifiedAt ? 'bg-emerald-500' : 'bg-amber-500'}`} /> Email verified
                      </span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${u.emailVerifiedAt ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {u.emailVerifiedAt ? 'Yes' : 'No'}
                      </span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${avatarUrl ? 'bg-emerald-500' : 'bg-amber-500'}`} /> Profile picture
                      </span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${avatarUrl ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {avatarUrl ? 'Set' : 'Missing'}
                      </span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-sky-500" /> Session
                      </span>
                      <span className="text-xs font-medium text-gray-500">JWT • 30 days</span>
                    </li>
                  </ul>
                  <button onClick={() => switchTab('security')} className="mt-4 w-full py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: BRAND }}>
                    Harden security
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-base font-extrabold text-gray-900 mb-1">Profile</h2>
              <p className="text-xs text-gray-500 mb-4">How you appear across KuyaCares</p>
              <dl className="divide-y divide-gray-100 text-sm">
                {[
                  ['Full name', displayName],
                  ['Username', u.username || '—'],
                  ['Phone', `${u.phone || '—'}${u.phoneVerifiedAt ? ' (verified)' : ''}`],
                  ['Gender', u.gender?.replace(/_/g, ' ') || '—'],
                  ['Birth date', u.birthDate ? u.birthDate.slice(0, 10) : '—'],
                  ['Language', u.preferredLanguage === 'fil' ? 'Filipino' : 'English'],
                  ['Timezone', u.timezone],
                  ['Currency', u.currency],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 py-2.5">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="font-bold text-gray-900 text-right capitalize">{v}</dd>
                  </div>
                ))}
              </dl>
              <button
                onClick={() => setProfileOpen(true)}
                disabled={profileBusy}
                className="mt-4 w-full sm:w-auto px-6 py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: BRAND }}
              >
                Edit profile
              </button>
            </section>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-base font-extrabold text-gray-900 mb-1">Login & security</h2>
                <p className="text-xs text-gray-500 mb-4">Keep your account safe</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{u.email}</p>
                      <p className="text-xs text-gray-500">
                        {u.emailVerifiedAt ? 'Verified' : 'Unverified'} • Password • Last login {u.lastLogin ? u.lastLogin.slice(0, 10) : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setEmailOpen(true)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-[13px] font-bold text-gray-700">
                      <i className="fas fa-envelope mr-1.5" />
                      Change email
                    </button>
                    <button onClick={() => setPasswordOpen(true)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-[13px] font-bold text-gray-700">
                      <i className="fas fa-key mr-1.5" />
                      Change password
                    </button>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-2xl shadow-sm border border-red-100 p-5">
                <h2 className="text-base font-extrabold text-red-700 mb-1">Close account</h2>
                <p className="text-xs text-gray-500 mb-4">Deactivation is instant and reversible via support. Deletion requests enter review — data purge is manual.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={() => setDangerTarget('deactivate')} className="flex-1 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl font-bold text-sm hover:bg-amber-100">
                    Deactivate account
                  </button>
                  <button onClick={() => setDangerTarget('delete')} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700">
                    Request deletion
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'notifications' && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-base font-extrabold text-gray-900 mb-1">Notifications</h2>
              <p className="text-xs text-gray-500 mb-2">Choose how you hear from us. In-app alerts always stay on.</p>
              {!prefs && (
                <div className="flex items-center justify-between gap-3 py-3">
                  <p className="text-sm text-gray-400">Loading preferences…</p>
                  <button
                    onClick={() => loadRef.current({ reset: true })}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-700"
                  >
                    <i className="fas fa-redo mr-1.5" />
                    Reload
                  </button>
                </div>
              )}
              {prefs && (
                <>
                  <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mt-3">Orders</h3>
                  {toggleRow('orderEmail', 'Email updates', 'Receipts, status changes, delivery news')}
                  {toggleRow('orderPush', 'Push updates', 'Real-time order alerts on your devices')}
                  {toggleRow('orderSms', 'SMS updates', 'Text alerts for critical order events')}
                  <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mt-4">Promotions</h3>
                  {toggleRow('promoEmail', 'Email promos', 'Vouchers, deals and new restaurants')}
                  {toggleRow('promoPush', 'Push promos', 'Flash deals on your devices')}
                  {toggleRow('promoSms', 'SMS promos', 'Text offers (standard rates may apply)')}
                  <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mt-4">Account</h3>
                  {toggleRow('accountEmail', 'Security emails', 'Password changes, receipts — recommended on')}
                  {toggleRow('marketingOptIn', 'Marketing consent', 'Master switch for all marketing')}
                </>
              )}
            </section>
          )}

          {activeTab === 'payments' && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-extrabold text-gray-900">Payment methods</h2>
                <button onClick={() => setPmOpen(true)} className="px-4 py-2 text-white rounded-xl font-bold text-[13px] hover:opacity-90" style={{ backgroundColor: BRAND }}>
                  <i className="fas fa-plus mr-1.5" />
                  Add
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-4">Vaulted securely — only references are stored, never card numbers.</p>
              {summary.paymentMethods.length === 0 && (
                <p className="text-sm text-gray-400 py-3">No saved methods. Add a card or e-wallet for one-tap checkout.</p>
              )}
              {summary.paymentMethods.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-credit-card text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {m.nickname || `${m.brand || 'Card'}${m.last4 ? ` •••• ${m.last4}` : ''}`}
                    </p>
                    <p className="text-[11px] text-gray-500 capitalize">
                      {(m.brand || m.provider || '').replace(/_/g, ' ')}
                      {m.expMonth && m.expYear ? ` • ${m.expMonth}/${m.expYear}` : ''}
                    </p>
                  </div>
                  {m.isDefault && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white flex-shrink-0" style={{ backgroundColor: BRAND }}>
                      DEFAULT
                    </span>
                  )}
                  <button onClick={() => handleRemoveMethod(m.id)} disabled={removingMethodId != null} title="Remove" className="py-1.5 px-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 disabled:opacity-60 flex-shrink-0">
                    {removingMethodId === String(m.id) ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-trash" />}
                  </button>
                </div>
              ))}
            </section>
          )}

          {activeTab === 'privacy' && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-base font-extrabold text-gray-900 mb-1">Privacy & data</h2>
              <p className="text-xs text-gray-500 mb-4">Control your footprint. Consent recorded {u.dataConsentAt ? u.dataConsentAt.slice(0, 10) : '—'}.</p>
              <div className="space-y-2.5">
                <button onClick={handleClearHistory} disabled={privacyBusy === 'clear'} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-bold text-gray-800 disabled:opacity-60">
                  <span><i className="fas fa-broom mr-2 text-gray-400" />Clear browsing history</span>
                  {privacyBusy === 'clear' ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-chevron-right text-gray-300" />}
                </button>
                <button onClick={handleExport} disabled={privacyBusy === 'export'} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-bold text-gray-800 disabled:opacity-60">
                  <span><i className="fas fa-download mr-2 text-gray-400" />Download my data (JSON)</span>
                  {privacyBusy === 'export' ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-chevron-right text-gray-300" />}
                </button>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Link href="/addresses" className="px-3 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-[13px] font-bold text-gray-800 text-center">
                    <i className="fas fa-map-marker-alt mr-1.5" />Addresses
                  </Link>
                  <Link href="/wallets" className="px-3 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-[13px] font-bold text-gray-800 text-center">
                    <i className="fas fa-wallet mr-1.5" />Wallet
                  </Link>
                  <Link href="/orders" className="px-3 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-[13px] font-bold text-gray-800 text-center">
                    <i className="fas fa-receipt mr-1.5" />Orders
                  </Link>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'activity' && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 pb-3">
                <h2 className="text-base font-extrabold text-gray-900 mb-1">Security activity</h2>
                <p className="text-xs text-gray-500">Sign-ins, password and profile changes on your account.</p>
              </div>
              <div className="divide-y divide-gray-50">
                {activity.map(activityRow)}
                {activity.length === 0 && <p className="p-5 text-sm text-gray-400">No activity yet.</p>}
              </div>
              {activityMore && (
                <div className="p-4">
                  <button
                    onClick={handleMoreActivity}
                    disabled={activityLoadingMore}
                    className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold text-gray-700 disabled:opacity-60"
                  >
                    {activityLoadingMore ? <i className="fas fa-spinner fa-spin mr-2" /> : null}
                    Show more
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(e) => {
          handleAvatarFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <ProfileModal
        isOpen={profileOpen}
        user={u}
        submitting={profileBusy}
        avatarBusy={avatarBusy}
        onClose={() => setProfileOpen(false)}
        onSubmit={handleProfileSubmit}
        onAvatar={(f) => handleAvatarFile(f)}
        onRemoveAvatar={handleRemoveAvatar}
      />
      <PasswordModal isOpen={passwordOpen} submitting={passwordBusy} onClose={() => setPasswordOpen(false)} onSubmit={handlePassword} />
      <EmailModal
        isOpen={emailOpen}
        currentEmail={u.email}
        verified={!!u.emailVerifiedAt}
        submitting={emailBusy}
        onClose={() => setEmailOpen(false)}
        onSubmit={handleEmail}
      />
      <PaymentMethodModal
        isOpen={pmOpen}
        customerName={`${u.firstName} ${u.lastName}`.trim()}
        customerEmail={u.email}
        submitting={pmBusy}
        onClose={() => setPmOpen(false)}
        onVault={handleVault}
      />

      {dangerTarget && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDangerTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-gray-900 mb-1">
              {dangerTarget === 'deactivate' ? 'Deactivate account?' : 'Request account deletion?'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {dangerTarget === 'deactivate'
                ? 'You will be signed out immediately. Contact support to reactivate.'
                : 'Your account is deactivated now; data purge follows after review.'}{' '}
              Enter your password to confirm.
            </p>
            <input
              type="password"
              value={dangerPassword}
              onChange={(e) => setDangerPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:bg-white mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => { setDangerTarget(null); setDangerPassword(''); }} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-200">
                Cancel
              </button>
              <button
                onClick={handleDanger}
                disabled={!dangerPassword || dangerBusy}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-60"
              >
                {dangerBusy ? <i className="fas fa-spinner fa-spin mr-2" /> : null}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
