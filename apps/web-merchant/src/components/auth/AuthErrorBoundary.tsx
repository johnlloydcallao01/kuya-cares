/**
 * @file apps/web-admin/src/components/auth/AuthErrorBoundary.tsx
 * @description Error boundary component for authentication-related errors
 * Based on apps/web AuthErrorBoundary but adapted for admin-only access
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AuthErrorDetails, AuthErrorType } from '@/types/auth';
import { formatAuthError, AuthenticationError } from '@/lib/auth';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorDetails: AuthErrorDetails | null;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorDetails: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    let errorDetails: AuthErrorDetails | null = null;

    if (error instanceof AuthenticationError) {
      errorDetails = {
        type: error.type,
        message: error.message,
        field: error.field,
        retryable: error.retryable,
      };
    } else {
      errorDetails = {
        type: 'UNKNOWN_ERROR' as AuthErrorType,
        message: error.message || 'An unexpected error occurred',
        retryable: false,
      };
    }

    return {
      hasError: true,
      error,
      errorDetails,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AuthErrorBoundary caught an error:', error, errorInfo);
    
    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to external error reporting service if available
    if (typeof window !== 'undefined' && 'reportError' in window && typeof (window as Window & { reportError?: (error: Error) => void }).reportError === 'function') {
      (window as Window & { reportError: (error: Error) => void }).reportError(error);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorDetails: null,
    });
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { errorDetails } = this.state;
      const isRetryable = errorDetails?.retryable ?? false;
      const errorMessage = errorDetails ? formatAuthError(errorDetails) : 'An unexpected error occurred';

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            <div className="text-center">
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Authentication Error
              </h1>
              
              <p className="text-gray-600 mb-6">
                {errorMessage}
              </p>

              <div className="space-y-3">
                {isRetryable && (
                  <button
                    onClick={this.handleRetry}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  >
                    Try Again
                  </button>
                )}
                
                <button
                  onClick={this.handleReload}
                  className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Reload Page
                </button>

                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.location.href = '/signin';
                    }
                  }}
                  className="w-full text-blue-600 py-2 px-4 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Go to Login
                </button>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component version of AuthErrorBoundary
 */
export function withAuthErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <AuthErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </AuthErrorBoundary>
  );

  WrappedComponent.displayName = `withAuthErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

export default AuthErrorBoundary;