import type { User } from '@/types/auth';

const USER_ROLES = ['admin', 'customer', 'service', 'vendor', 'driver'] as const;

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function sanitizeProfilePicture(value: unknown): User['profilePicture'] {
  if (!value || typeof value !== 'object') return null;
  const src = value as Record<string, unknown>;
  const id = Number(src.id);
  const url = optionalString(src.cloudinaryURL);
  if (!url) return null;
  const alt = optionalString(src.alt);
  return {
    id,
    filename: optionalString(src.filename) || '',
    url,
    ...(alt !== null ? { alt } : {}),
  };
}

export function sanitizeUser(value: unknown): User | null {
  if (!value || typeof value !== 'object') return null;

  const source = value as Record<string, unknown>;
  const id = Number(source.id);
  const role = source.role;
  if (!Number.isInteger(id) || !USER_ROLES.includes(role as typeof USER_ROLES[number])) return null;

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
    gender: optionalString(source.gender),
    civilStatus: optionalString(source.civilStatus),
    nationality: optionalString(source.nationality),
    birthDate: optionalString(source.birthDate),
    placeOfBirth: optionalString(source.placeOfBirth),
    completeAddress: optionalString(source.completeAddress),
    phone: optionalString(source.phone),
    lastLogin: optionalString(source.lastLogin),
    profilePicture: sanitizeProfilePicture(source.profilePicture),
    createdAt: optionalString(source.createdAt) || '',
    updatedAt: optionalString(source.updatedAt) || '',
  };
}