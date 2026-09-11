/**
 * @file apps/web/src/components/auth/AuthErrorBoundary.tsx
 * @description Error boundary for authentication-related errors
 */

'use client';

import React, { Component, ReactNode } from 'react';
import { emitAuthEvent } from '@/lib/auth';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error for debugging
    console.error('Authentication Error Boundary caught an error:', error, errorInfo);

    // Emit auth error event
    emitAuthEvent('auth_error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa fa-exclamation-triangle text-red-600 text-2xl"></i>
            </div>
            
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Authentication Error
            </h2>
            
            <p className="text-gray-600 mb-6">
              Something went wrong with the authentication system. Please try again.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                <h3 className="text-sm font-medium text-red-800 mb-2">Error Details:</h3>
                <pre className="text-xs text-red-700 whitespace-pre-wrap break-words">
                  {this.state.error.message}
                </pre>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Reload Page
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              If this problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ========================================
// HOOK VERSION
// ========================================

interface UseAuthErrorBoundaryReturn {
  hasError: boolean;
  error: Error | null;
  resetError: () => void;
}

export function useAuthErrorBoundary(): UseAuthErrorBoundaryReturn {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const handleAuthError = (event: CustomEvent) => {
      if (event.type === 'auth:auth_error') {
        setHasError(true);
        setError(new Error(event.detail?.error || 'Authentication error occurred'));
      }
    };

    window.addEventListener('auth:auth_error', handleAuthError as EventListener);

    return () => {
      window.removeEventListener('auth:auth_error', handleAuthError as EventListener);
    };
  }, []);

  const resetError = React.useCallback(() => {
    setHasError(false);
    setError(null);
  }, []);

  return {
    hasError,
    error,
    resetError,
  };
}

// ========================================
// NETWORK ERROR COMPONENT
// ========================================

interface NetworkErrorProps {
  onRetry?: () => void;
  className?: string;
}

export const NetworkError = ({ onRetry, className = '' }: NetworkErrorProps): JSX.Element => {
  return (
    <div className={`text-center p-6 ${className}`}>
      <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <i className="fa fa-wifi text-yellow-600 text-2xl"></i>
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Connection Problem
      </h3>
      
      <p className="text-gray-600 mb-4">
        Unable to connect to the authentication server. Please check your internet connection.
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

// ========================================
// SESSION EXPIRED COMPONENT
// ========================================

interface SessionExpiredProps {
  onLogin?: () => void;
  className?: string;
}

export const SessionExpired = ({ onLogin, className = '' }: SessionExpiredProps): JSX.Element => {
  const handleLogin = () => {
    if (onLogin) {
      onLogin();
    } else {
      window.location.href = '/signin';
    }
  };

  return (
    <div className={`text-center p-6 ${className}`}>
      <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <i className="fa fa-clock text-orange-600 text-2xl"></i>
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Session Expired
      </h3>
      
      <p className="text-gray-600 mb-4">
        Your session has expired for security reasons. Please sign in again to continue.
      </p>

      <button
        onClick={handleLogin}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Sign In Again
      </button>
    </div>
  );
}

// ========================================
// EXPORTS
// ========================================

export default AuthErrorBoundary;
