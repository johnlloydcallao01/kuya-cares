"use client";

/**
 * Thin client façade over address server actions (BFF pattern).
 * The browser never holds the service key and never queries raw
 * collections — it calls server actions, which own user resolution
 * and CMS aggregation.
 */

import {
  createAddressAction,
  deleteAddressAction,
  getAddressBook,
  setActiveAddressAction,
  updateAddressAction,
  type AddressInput,
} from '@/app/actions/addresses';
import type { AddressBook } from '@/types/address';

export type { AddressBook, AddressInput };

export async function fetchAddressBook(input: {
  q?: string;
  type?: string;
  page?: number;
  limit?: number;
} = {}): Promise<AddressBook> {
  return getAddressBook(input);
}

export async function saveAddress(input: AddressInput) {
  return createAddressAction(input);
}

export async function editAddress(id: string | number, input: Partial<AddressInput>) {
  return updateAddressAction(id, input);
}

export async function removeAddress(id: string | number) {
  return deleteAddressAction(id);
}

export async function activateAddress(id: string | number) {
  return setActiveAddressAction(id);
}
