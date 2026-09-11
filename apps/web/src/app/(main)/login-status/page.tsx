'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

/**
 * Login Status Page
 * Shows that authentication has been disabled
 */
export default function LoginStatusPage() {
  const router = useRouter();

  // Authentication disabled - show status
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Authentication Disabled</h3>
          <p className="text-gray-700 mb-4">The authentication system has been completely removed from this application.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
}
