'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getFullName } from '@/hooks/useAuth';

/**
 * Admin Session Debug Page
 * 
 * Debug interface for testing admin functionality.
 * Shows real session state and provides testing utilities.
 */
export default function AdminSessionDebugPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, isLoading, error } = useAuth();
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);
  const [testResults, setTestResults] = useState<string[]>([]);

  // Refresh debug info
  const updateDebugInfo = useCallback(() => {
    const info = {
      timestamp: new Date().toISOString(),
      cookies: typeof document !== 'undefined' ? document.cookie : 'N/A',
      localStorage: typeof localStorage !== 'undefined' ? {
        merchant_auth_token: localStorage.getItem('merchant_auth_token') ? 'present' : null,
        merchant_auth_expires: localStorage.getItem('merchant_auth_expires') || null,
        merchant_auth_user: localStorage.getItem('merchant_auth_user') || null,
      } : 'N/A',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      protocol: typeof window !== 'undefined' ? window.location.protocol : 'N/A',
    };

    setDebugInfo(info);
  }, []);

  // Test session
  const testSession = () => {
    const results: string[] = [];

    try {
      results.push('🔄 Testing session...');
      results.push(`✅ Authenticated: ${isAuthenticated}`);
      results.push(`✅ Initialized: ${isInitialized}`);
      results.push(`✅ Loading: ${isLoading}`);
      if (user) {
        results.push(`✅ User: ${getFullName(user)} (${user.email})`);
        results.push(`✅ Role: ${user.role}`);
      } else {
        results.push('⚠️ No authenticated user');
      }

      updateDebugInfo();
    } catch (error) {
      results.push(`❌ Session test failed: ${error}`);
    }

    setTestResults(results);
  };

  // Test logout
  const testLogout = () => {
    const results: string[] = [];

    try {
      results.push('🔄 Testing logout...');
      results.push(`✅ Authenticated: ${isAuthenticated}`);
      results.push(`✅ Session data: ${localStorage.getItem('merchant_auth_token') ? 'present' : 'none'}`);

      updateDebugInfo();
    } catch (error) {
      results.push(`❌ Logout test failed: ${error}`);
    }

    setTestResults(results);
  };

  // Clear stored auth data
  const clearAuthData = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('merchant_auth_token');
      localStorage.removeItem('merchant_auth_expires');
      localStorage.removeItem('merchant_auth_user');
    }
    updateDebugInfo();
    setTestResults(['✅ Auth data cleared from localStorage']);
  };

  useEffect(() => {
    updateDebugInfo();
  }, [updateDebugInfo]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Admin Session Debug</h1>
            <p className="text-gray-600 mt-1">Debug interface for testing admin authentication</p>
          </div>

          <div className="p-6 space-y-8">
            {/* Session Info */}
            <div className={`border rounded-lg p-4 ${isAuthenticated ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <h2 className={`text-lg font-semibold mb-3 ${isAuthenticated ? 'text-green-900' : 'text-yellow-900'}`}>
                Session Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-700">Status:</span>
                  <span className={`ml-2 text-sm ${isAuthenticated ? 'text-green-600' : 'text-yellow-600'}`}>
                    {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Initialized:</span>
                  <span className="ml-2 text-sm text-gray-600">{isInitialized ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Loading:</span>
                  <span className="ml-2 text-sm text-gray-600">{isLoading ? 'Yes' : 'No'}</span>
                </div>
                {user && (
                  <>
                    <div>
                      <span className="text-sm font-medium text-gray-700">User:</span>
                      <span className="ml-2 text-sm text-gray-600">{getFullName(user)}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Role:</span>
                      <span className="ml-2 text-sm text-gray-600">{user.role}</span>
                    </div>
                  </>
                )}
                {error && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Error:</span>
                    <span className="ml-2 text-sm text-red-600">{error}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={testSession}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Test Session
              </button>
              <button
                onClick={testLogout}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Test Logout
              </button>
              <button
                onClick={clearAuthData}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Clear Auth Data
              </button>
            </div>

            {/* Test Results */}
            {testResults.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Test Results</h3>
                <div className="space-y-1">
                  {testResults.map((result, index) => (
                    <div key={index} className="text-sm font-mono text-gray-700">
                      {result}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Debug Information */}
            {debugInfo && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Debug Information</h3>
                <pre className="text-xs text-gray-600 overflow-auto bg-white p-3 rounded border">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center pt-6 border-t border-gray-200">
              <button
                onClick={() => router.push('/dashboard/overview')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Back to Dashboard
              </button>
              <button
                onClick={updateDebugInfo}
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Refresh Debug Info
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}