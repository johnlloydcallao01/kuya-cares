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
