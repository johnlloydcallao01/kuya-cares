/**
 * @file apps/web/src/lib/sanitizeUser.ts
 * @description Sanitizes raw PayloadCMS user documents into the typed customer User shape.
 * Ported from the proven apps/web-admin pattern (lib/sanitizeUser.ts) so the
 * server action never leaks credential fields down to the client.
 */

import type { User } from '@/types/auth';

const USER_ROLES = ['admin', 'customer', 'service', 'vendor', 'driver', 'instructor', 'trainee'] as const;

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function sanitizeProfilePicture(value: unknown): User['profilePicture'] {
  if (!value || typeof value !== 'object') return null;
  const src = value as Record<string, unknown>;
  const id = Number(src.id);
  const cloudinaryURL = optionalString(src.cloudinaryURL);
  const url = cloudinaryURL || optionalString(src.url);
  if (!id || !url) return null;
  const alt = optionalString(src.alt);
  const filename = optionalString(src.filename);
  const mimeType = optionalString(src.mimeType);
  return {
    id,
    alt,
    url,
    ...(cloudinaryURL ? { cloudinaryURL } : {}),
    filename: filename || '',
    mimeType: mimeType || '',
    filesize: typeof src.filesize === 'number' ? src.filesize : 0,
    width: typeof src.width === 'number' ? src.width : 0,
    height: typeof src.height === 'number' ? src.height : 0,
  };
}

export function sanitizeUser(value: unknown): User | null {
  if (!value || typeof value !== 'object') return null;

  const source = value as Record<string, unknown>;
  const id = Number(source.id);
  const role = source.role;
  if (!Number.isInteger(id) || !USER_ROLES.includes(role as (typeof USER_ROLES)[number])) return null;

  return {
    id,
    email: optionalString(source.email) || '',
    firstName: optionalString(source.firstName) || '',
    lastName: optionalString(source.lastName) || '',
    middleName: optionalString(source.middleName),
    nameExtension: optionalString(source.nameExtension),
    username: optionalString(source.username),
    role: role as User['role'],
    isActive: typeof source.isActive === 'boolean' ? source.isActive : null,
    nationality: optionalString(source.nationality),
    birthDate: optionalString(source.birthDate),
    placeOfBirth: optionalString(source.placeOfBirth),
    completeAddress: optionalString(source.completeAddress),
    gender: optionalString(source.gender) as User['gender'],
    civilStatus: optionalString(source.civilStatus) as User['civilStatus'],
    profilePicture: sanitizeProfilePicture(source.profilePicture),
    lastLogin: optionalString(source.lastLogin),
    createdAt: optionalString(source.createdAt) || '',
    updatedAt: optionalString(source.updatedAt) || '',
  };
}