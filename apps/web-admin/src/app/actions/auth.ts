'use server';

import { cookies } from 'next/headers';
import type { AuthResponse, LoginCredentials, User } from '@/types/auth';
import { sanitizeUser } from '@/lib/sanitizeUser';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api').replace(/\/+$/, '');
const AUTH_COOKIE = 'tap2go-admin-token';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function requireAdmin(value: unknown, message: string): User {
  const user = sanitizeUser(value);
  if (!user || user.role !== 'admin') throw new Error(message);
  return user;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export async function serverLogin(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
    cache: 'no-store',
  });
  const data = await readResponse(response);
  const errors = Array.isArray(data.errors) ? data.errors as Array<{ message?: string }> : [];
  if (!response.ok) throw new Error(String(data.message || errors[0]?.message || 'Login failed'));

  const user = requireAdmin(data.user, 'Access denied. Only administrators can access this application.');
  const token = stringValue(data.token);
  if (token) {
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
  }
  return { message: stringValue(data.message) || '', user, token, exp: numberValue(data.exp) };
}

export async function serverLogout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  try {
    await fetch(`${API_BASE_URL}/users/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Ignore CMS logout errors — cookie deletion still logs the browser out.
  }
}

export async function getServerUser(): Promise<User | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/users/me?depth=2`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data = await readResponse(response);
    const user = sanitizeUser(data.user);
    return user?.role === 'admin' ? user : null;
  } catch {
    return null;
  }
}

export async function getServerToken(): Promise<string | null> {
  return (await cookies()).get(AUTH_COOKIE)?.value || null;
}

export async function serverRefresh(): Promise<AuthResponse> {
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(AUTH_COOKIE)?.value;
  if (!currentToken) throw new Error('No authentication token available for refresh');

  const response = await fetch(`${API_BASE_URL}/users/refresh-token`, {
    method: 'POST',
    headers: { Authorization: `JWT ${currentToken}` },
    cache: 'no-store',
  });
  const data = await readResponse(response);
  if (!response.ok) throw new Error(String(data.message || 'Access denied during refresh'));

  const user = requireAdmin(data.user, 'Access denied during refresh');
  const token = stringValue(data.refreshedToken) || stringValue(data.token);
  if (token) {
    cookieStore.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
  }
  return { message: stringValue(data.message) || '', user, token, exp: numberValue(data.exp) };
}
