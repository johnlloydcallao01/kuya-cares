/**
 * @file apps/web-admin/src/proxy.ts
 * @description Next.js proxy for admin authentication and route protection
 * Based on apps/web middleware but adapted for admin-only access
 * 
 * Note: Renamed from middleware.ts to proxy.ts per Next.js 16 convention
 */

import { NextRequest, NextResponse } from 'next/server';

// ========================================
// CONFIGURATION
// ========================================

// Define route patterns
const AUTH_ROUTES = ['/signin'];

// ========================================
// UTILITY FUNCTIONS
// ========================================

function isAuthRoute(pathname: string): boolean {
    return AUTH_ROUTES.some(route => pathname.startsWith(route));
}

// Note: Server-side authentication functions removed as we now handle
// authentication entirely on the client side to prevent redirect loops

// ========================================
// PROXY FUNCTION
// ========================================

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip middleware for Next.js internal routes and static files
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.includes('.') ||
        pathname.startsWith('/favicon')
    ) {
        return NextResponse.next();
    }

    // For admin app with external PayloadCMS, we can't rely on cookie-based auth in middleware
    // because cookies are domain-specific (cms.grandlinemaritime.com vs localhost:3002).
    // Instead, we'll handle auth protection on the client side with ProtectedRoute components.

    // Handle auth routes (signin, etc.) - always allow access
    if (isAuthRoute(pathname)) {
        return NextResponse.next();
    }

    // For protected routes, let the client-side ProtectedRoute component handle the auth check
    // This prevents redirect loops and allows proper initialization of the auth context

    return NextResponse.next();
}

// ========================================
// PROXY CONFIGURATION
// ========================================

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder files
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
