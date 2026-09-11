/**
 * CMS integration utilities for web-admin
 * Now using Redux RTK Query for consistency with apps/web
 */

import { env } from './env';

// ========================================
// CMS CONFIGURATION
// ========================================

export const cmsConfig = {
  apiUrl: env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api',
  serverUrl: env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'https://cms.tap2goph.com',
  collections: {
    posts: 'posts',
    media: 'media',
    users: 'users',
  },
  endpoints: {
    posts: '/posts',
    media: '/media',
    users: '/users',
  },
} as const;

// ========================================
// AUTHENTICATED CMS FETCH (reference pattern)
// ========================================

/**
 * Authenticated CMS fetch mirroring the reference pattern: attach the mirrored
 * client token as `Authorization: JWT ...`, never `credentials: 'include'`
 * (ambient cookies conflict cross-origin with the CMS domain).
 */
export async function cmsApiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    token =
      localStorage.getItem('tap2go_auth_token_admin') ?? localStorage.getItem('admin_auth_token');
  }

  const headers = new Headers(options.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `JWT ${token}`);
  }

  return fetch(`${cmsConfig.apiUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
  });
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

export function getCMSImageUrl(filename: string): string {
  if (!filename) return '';
  
  // If it's already a full URL, return as-is
  if (filename.startsWith('http')) return filename;
  
  // Construct URL from CMS server
  return `${cmsConfig.serverUrl}/media/${filename}`;
}

export function formatCMSDate(dateString: string): string {
  if (!dateString) return '';
  
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatCMSDateTime(dateString: string): string {
  if (!dateString) return '';
  
  try {
    return new Date(dateString).toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}
