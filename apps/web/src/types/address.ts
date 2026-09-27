/**
 * Central address-book domain types for apps/web.
 * Mirrors CMS `addresses` collection + /api/addresses/book BFF shape.
 * @file src/types/address.ts
 */

export type AddressType =
  | 'home'
  | 'work'
  | 'partner'
  | 'billing'
  | 'shipping'
  | 'pickup'
  | 'delivery';

export interface AddressUI {
  id: string;
  formattedAddress: string;
  street?: string | null;
  floorUnitRoom?: string | null;
  deliveryInstructions?: string | null;
  label?: string | null;
  addressType: string;
  barangay?: string | null;
  locality?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
  isVerified: boolean;
  isActive: boolean;
  createdAt?: string;
}

export interface AddressBook {
  customerId: string | number;
  activeAddressId: string | null;
  activeAddress: AddressUI | null;
  addresses: AddressUI[];
  stats: { total: number; home: number; work: number; verified: number };
}

export const ADDRESS_TYPES: AddressType[] = [
  'home',
  'work',
  'partner',
  'billing',
  'shipping',
  'pickup',
  'delivery',
];

/** Mobile parity: label chips write `label` + mapped `address_type`. */
export const LABEL_CHIPS = [
  { label: 'Home', addressType: 'home' },
  { label: 'Work', addressType: 'work' },
  { label: 'Partner', addressType: 'partner' },
  { label: 'Other', addressType: 'home' },
] as const;

export function typeBadge(addressType: string): { label: string; pill: string; icon: string } {
  switch (addressType) {
    case 'home':
      return { label: 'Home', pill: 'bg-green-100 text-green-800 border border-green-200', icon: 'fas fa-home' };
    case 'work':
      return { label: 'Work', pill: 'bg-blue-100 text-blue-800 border border-blue-200', icon: 'fas fa-briefcase' };
    case 'partner':
      return { label: 'Partner', pill: 'bg-purple-100 text-purple-800 border border-purple-200', icon: 'fas fa-handshake' };
    default:
      return {
        label: addressType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        pill: 'bg-gray-100 text-gray-700 border border-gray-200',
        icon: 'fas fa-map-marker-alt',
      };
  }
}

export function shortAddress(a: AddressUI): string {
  const parts = [a.street, a.locality, a.province].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return a.formattedAddress || 'Unnamed address';
}
