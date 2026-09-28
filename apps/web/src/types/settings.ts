/**
 * Central account/settings domain types for apps/web.
 * Mirrors CMS /api/customer/account/* BFF shapes.
 * @file src/types/settings.ts
 */

export interface AccountUser {
  id: string | number;
  email: string;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  nameExtension?: string | null;
  username?: string | null;
  phone?: string | null;
  gender?: string | null;
  civilStatus?: string | null;
  nationality?: string | null;
  birthDate?: string | null;
  placeOfBirth?: string | null;
  preferredLanguage: string;
  timezone: string;
  currency: string;
  marketingOptIn: boolean;
  dataConsentAt?: string | null;
  isActive: boolean;
  lastLogin?: string | null;
  profilePicture?: { id: number | string; url: string | null } | null;
  createdAt?: string;
}

export interface NotificationPrefs {
  orderEmail: boolean;
  orderPush: boolean;
  orderSms: boolean;
  promoEmail: boolean;
  promoPush: boolean;
  promoSms: boolean;
  accountEmail: boolean;
  marketingOptIn: boolean;
}

export interface SavedPaymentMethod {
  id: string | number;
  provider?: string | null;
  brand?: string | null;
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  nickname?: string | null;
  isDefault: boolean;
  createdAt?: string;
}

export interface AccountDevice {
  id: string | number;
  platform?: string | null;
  appVersion?: string | null;
  createdAt?: string;
}

export interface ActivityEvent {
  id: string | number;
  eventType: string;
  eventData?: any;
  createdAt?: string;
}

export interface AccountSummary {
  user: AccountUser;
  customer: { id: string | number; email?: string } | null;
  preferences: NotificationPrefs | null;
  paymentMethods: SavedPaymentMethod[];
  devices: AccountDevice[];
  recentActivity: ActivityEvent[];
  counts: { addresses: number; orders: number };
}

export const GENDERS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const CIVIL_STATUSES = [
  { id: 'single', label: 'Single' },
  { id: 'married', label: 'Married' },
  { id: 'divorced', label: 'Divorced' },
  { id: 'widowed', label: 'Widowed' },
  { id: 'separated', label: 'Separated' },
];

export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'fil', label: 'Filipino' },
];

export function eventLabel(type: string): { label: string; icon: string } {
  switch (type) {
    case 'PASSWORD_CHANGED':
      return { label: 'Password changed', icon: 'fas fa-key' };
    case 'PROFILE_UPDATED':
      return { label: 'Profile updated', icon: 'fas fa-user-edit' };
    case 'USER_CREATED':
      return { label: 'Account created', icon: 'fas fa-user-plus' };
    case 'USER_DEACTIVATED':
      return { label: 'Account deactivated', icon: 'fas fa-user-slash' };
    case 'USER_REACTIVATED':
      return { label: 'Account reactivated', icon: 'fas fa-user-check' };
    case 'LOGIN_SUCCESS':
      return { label: 'Signed in', icon: 'fas fa-sign-in-alt' };
    case 'LOGIN_FAILED':
      return { label: 'Failed sign-in', icon: 'fas fa-exclamation-triangle' };
    case 'ROLE_CHANGED':
      return { label: 'Role changed', icon: 'fas fa-user-tag' };
    default:
      return { label: type.replace(/_/g, ' ').toLowerCase(), icon: 'fas fa-circle' };
  }
}
