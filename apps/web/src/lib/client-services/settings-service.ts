"use client";

/**
 * Thin client façade over account server actions (BFF pattern).
 * The browser never holds credentials beyond its own session cookie —
 * user resolution and CMS access live server-side.
 */

import {
  addPaymentMethodAction,
  changePasswordAction,
  clearHistoryAction,
  confirmEmailChangeAction,
  deactivateAccountAction,
  deleteAccountAction,
  exportDataAction,
  getAccountActivityAction,
  getAccountSummary,
  removeAvatarAction,
  removePaymentMethodAction,
  requestEmailChangeAction,
  updatePreferencesAction,
  updateProfileAction,
  uploadAvatarAction,
} from '@/app/actions/settings';
import type { AccountSummary } from '@/types/settings';

export type { AccountSummary };

export async function fetchAccountSummary() {
  return getAccountSummary();
}

export async function saveProfile(input: Record<string, unknown>) {
  return updateProfileAction(input);
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  return changePasswordAction(input);
}

export async function requestEmailChange(newEmail: string) {
  return requestEmailChangeAction(newEmail);
}

export async function confirmEmailChange(tokenValue: string) {
  return confirmEmailChangeAction(tokenValue);
}

export async function uploadAvatar(file: File) {
  const form = new FormData();
  form.append('file', file);
  return uploadAvatarAction(form);
}

export async function removeAvatar() {
  return removeAvatarAction();
}

export async function savePreferences(prefs: Record<string, boolean>) {
  return updatePreferencesAction(prefs);
}

export async function savePaymentMethod(input: {
  providerMethodId: string;
  provider?: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  nickname?: string;
  isDefault?: boolean;
}) {
  return addPaymentMethodAction(input);
}

export async function deletePaymentMethod(id: string | number) {
  return removePaymentMethodAction(id);
}

export async function fetchActivity(page = 1, limit = 20) {
  return getAccountActivityAction(page, limit);
}

export async function clearBrowsingHistory() {
  return clearHistoryAction();
}

export async function exportAccountData() {
  return exportDataAction();
}

export async function deactivateAccount(password: string) {
  return deactivateAccountAction(password);
}

export async function requestAccountDeletion(password: string) {
  return deleteAccountAction(password);
}
