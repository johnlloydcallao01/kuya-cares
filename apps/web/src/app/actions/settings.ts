/**
 * @file apps/web/src/app/actions/settings.ts
 * @description Server-side account actions (BFF pattern).
 *
 * The /settings page calls only these actions. They forward the customer's
 * own JWT (httpOnly cookie) to the CMS self-service account BFF, which
 * operates strictly on the token owner. No localStorage, no raw
 * collection fetching, no service key in the browser.
 */

'use server';

import type {
  AccountSummary,
  AccountUser,
  ActivityEvent,
  NotificationPrefs,
  SavedPaymentMethod,
} from '@/types/settings';
import { getServerToken, getServerUserId, serverLogout } from './auth';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');

async function userHeaders(): Promise<Record<string, string>> {
  const token = await getServerToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `JWT ${token}` } : {}),
  };
}

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function requireAuth(token: string | null): asserts token is string {
  if (!token) throw new Error('SETTINGS_NO_SESSION');
}

export async function getAccountSummary(): Promise<AccountSummary> {
  const userId = await getServerUserId();
  if (!userId) throw new Error('SETTINGS_NO_SESSION');
  const headers = await userHeaders();
  const res = await fetch(`${API_BASE_URL}/customer/account/summary`, {
    headers,
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Account unavailable (${res.status})`));
  const d = json?.data ?? {};
  return {
    user: d.user as AccountUser,
    customer: d.customer ?? null,
    preferences: (d.preferences as NotificationPrefs) ?? null,
    paymentMethods: (d.paymentMethods as SavedPaymentMethod[]) ?? [],
    devices: d.devices ?? [],
    recentActivity: (d.recentActivity as ActivityEvent[]) ?? [],
    counts: { addresses: d.counts?.addresses ?? 0, orders: d.counts?.orders ?? 0 },
  };
}

export async function updateProfileAction(input: Record<string, unknown>): Promise<AccountUser> {
  const token = await getServerToken();
  requireAuth(token);
  const res = await fetch(`${API_BASE_URL}/customer/account/profile`, {
    method: 'PUT',
    headers: await userHeaders(),
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Update failed (${res.status})`));
  return json?.data?.user as AccountUser;
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ message: string; sessionsRevoked: boolean }> {
  const token = await getServerToken();
  requireAuth(token);
  const res = await fetch(`${API_BASE_URL}/customer/account/password`, {
    method: 'POST',
    headers: await userHeaders(),
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Password change failed (${res.status})`));
  // Sessions are revoked server-side — sign out locally too.
  await serverLogout();
  return { message: String(json?.message || 'Password changed.'), sessionsRevoked: !!json?.sessionsRevoked };
}

export async function requestEmailChangeAction(newEmail: string): Promise<string> {
  const token = await getServerToken();
  requireAuth(token);
  const res = await fetch(`${API_BASE_URL}/customer/account/email/request`, {
    method: 'POST',
    headers: await userHeaders(),
    body: JSON.stringify({ newEmail }),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Request failed (${res.status})`));
  return String(json?.message || 'Verification sent.');
}

export async function confirmEmailChangeAction(tokenValue: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/customer/account/email/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: tokenValue }),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Confirm failed (${res.status})`));
  return String(json?.message || 'Email updated.');
}

export async function uploadAvatarAction(formData: FormData): Promise<AccountUser> {
  const token = await getServerToken();
  requireAuth(token);
  const res = await fetch(`${API_BASE_URL}/customer/account/avatar`, {
    method: 'POST',
    headers: { Authorization: `JWT ${token}` },
    body: formData,
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Upload failed (${res.status})`));
  return json?.user as AccountUser;
}

export async function removeAvatarAction(): Promise<AccountUser> {
  const token = await getServerToken();
  requireAuth(token);
  const res = await fetch(`${API_BASE_URL}/customer/account/avatar`, {
    method: 'DELETE',
    headers: await userHeaders(),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Remove failed (${res.status})`));
  return json?.user as AccountUser;
}

export async function updatePreferencesAction(prefs: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
  const token = await getServerToken();
  requireAuth(token);
  const res = await fetch(`${API_BASE_URL}/customer/account/preferences`, {
    method: 'PUT',
    headers: await userHeaders(),
    body: JSON.stringify(prefs),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Save failed (${res.status})`));
  return json?.data as NotificationPrefs;
}

export async function addPaymentMethodAction(input: {
  providerMethodId: string;
  provider?: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  nickname?: string;
  isDefault?: boolean;
}): Promise<SavedPaymentMethod> {
  const token = await getServerToken();
  requireAuth(token);
  const res = await fetch(`${API_BASE_URL}/customer/account/payment-methods`, {
    method: 'POST',
    headers: await userHeaders(),
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Save failed (${res.status})`));
  return json?.data as SavedPaymentMethod;
}

export async function removePaymentMethodAction(id: string | number): Promise<{ promotedId: string | null }> {
  const token = await getServerToken();
  requireAuth(token);
  const res = await fetch(`${API_BASE_URL}/customer/account/payment-methods/${id}`, {
    method: 'DELETE',
    headers: await userHeaders(),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Remove failed (${res.status})`));
  return { promotedId: json?.data?.promotedId ?? null };
}

export async function getAccountActivityAction(page = 1, limit = 20) {
  const token = await getServerToken();
  requireAuth(token);
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await fetch(`${API_BASE_URL}/customer/account/activity?${params.toString()}`, {
    headers: await userHeaders(),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Activity unavailable (${res.status})`));
  return json?.data as { docs: ActivityEvent[]; pagination: any };
}

export async function clearHistoryAction(): Promise<Record<string, number>> {
  const token = await getServerToken();
  requireAuth(token);
  const res = await fetch(`${API_BASE_URL}/customer/account/privacy`, {
    method: 'POST',
    headers: await userHeaders(),
    body: JSON.stringify({ action: 'clear_history' }),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Clear failed (${res.status})`));
  return json?.data?.cleared ?? {};
}

export async function exportDataAction(): Promise<any> {
  const token = await getServerToken();
  requireAuth(token);
  const res = await fetch(`${API_BASE_URL}/customer/account/privacy`, {
    method: 'POST',
    headers: await userHeaders(),
    body: JSON.stringify({ action: 'export' }),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Export failed (${res.status})`));
  return json?.data;
}

export async function deactivateAccountAction(password: string): Promise<string> {
  const token = await getServerToken();
  requireAuth(token);
  const res = await fetch(`${API_BASE_URL}/customer/account/deactivate`, {
    method: 'POST',
    headers: await userHeaders(),
    body: JSON.stringify({ password }),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Deactivate failed (${res.status})`));
  await serverLogout();
  return String(json?.message || 'Account deactivated.');
}

export async function deleteAccountAction(password: string): Promise<string> {
  const token = await getServerToken();
  requireAuth(token);
  const res = await fetch(`${API_BASE_URL}/customer/account/delete`, {
    method: 'POST',
    headers: await userHeaders(),
    body: JSON.stringify({ password }),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Request failed (${res.status})`));
  await serverLogout();
  return String(json?.message || 'Deletion requested.');
}
