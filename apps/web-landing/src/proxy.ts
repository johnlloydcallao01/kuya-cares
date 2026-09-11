import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - logo.webp (logo file)
     * - maintenance (the maintenance page itself)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|logo.webp|maintenance).*)',
  ],
};

export default async function proxy(req: NextRequest) {
  // 1. Skip if it's already the maintenance page (handled by matcher, but good to be safe)
  if (req.nextUrl.pathname.startsWith('/maintenance')) {
    return NextResponse.next();
  }

  // 2. Check Maintenance Mode
  try {
    const isInMaintenanceMode = await checkMaintenanceMode();
    
    // Log for debugging in Vercel Logs
    if (process.env.NODE_ENV === 'production') {
      console.log(`[Proxy] Checking maintenance mode: ${isInMaintenanceMode}`);
    }

    if (isInMaintenanceMode) {
      const url = req.nextUrl.clone();
      url.pathname = '/maintenance';
      return NextResponse.rewrite(url);
    }
  } catch (error) {
    console.error('[Proxy] Maintenance check failed:', error);
  }

  return NextResponse.next();
}

async function checkMaintenanceMode() {
  // Always check the backend, regardless of environment
  try {
    // Priority: Env Var -> Production URL -> Localhost
    let apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      if (process.env.NODE_ENV === 'production') {
        apiUrl = 'https://cms.tap2goph.com/api';
      } else {
        apiUrl = 'http://localhost:3001/api';
      }
    }
    
    // Ensure no double slash or missing slash issues
    if (apiUrl.endsWith('/')) {
      apiUrl = apiUrl.slice(0, -1);
    }
    
    // Robust approach to construct full URL
    const endpoint = '/globals/system-settings';
    let fullUrl = '';
    
    if (apiUrl.endsWith('/api')) {
       fullUrl = `${apiUrl}${endpoint}`;
    } else {
       // If it doesn't end in /api, append it only if the base URL doesn't have it
       // But assuming the standard format, we'll just append the endpoint if it looks like a base URL
       // For safety, let's assume if it doesn't end in /api, we treat it as base and check response
       // BUT to keep it simple and consistent with user instruction:
       fullUrl = `${apiUrl}${endpoint}`;
    }

    // Use a short timeout to prevent blocking the request for too long
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Add API Key if present (good practice, though SystemSettings is public)
    const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
    if (apiKey) {
        headers['Authorization'] = `users API-Key ${apiKey}`;
    }

    const res = await fetch(fullUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
      next: { revalidate: 0 } // Disable cache to get real-time status
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`[Proxy] Failed to fetch system settings from ${fullUrl}: ${res.status}`);
      return false;
    }

    const data = await res.json();
    return data?.maintenanceMode === true;
  } catch (error) {
    console.error('[Proxy] Error fetching maintenance status:', error);
    return false;
  }
}
