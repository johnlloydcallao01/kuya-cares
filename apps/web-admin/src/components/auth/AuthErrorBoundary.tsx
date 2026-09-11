/**
 * @file apps/web-admin/src/components/auth/AuthErrorBoundary.tsx
 * @description Error boundary for authentication-related errors.
 *
 * Reference logic: generic render-error boundary only (Try Again / Reload).
 * It never performs auth redirects itself — route guards own navigation —
 * so a transient render error cannot nuke the session or lose the
 * `auth:redirectAfterLogin` target.
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

    console.error('Authentication Error Boundary caught an error:', error, errorInfo);

    emitAuthEvent('auth_error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

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
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Only label genuine auth failures as authentication errors.
      // Anything else (e.g. "No QueryClient set") is a render bug and
      // must not masquerade as an auth problem.
      const message = this.state.error?.message || '';
      const isAuthError = /auth|session|token|unauthorized|forbidden|sign.?in|login/i.test(message);

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa fa-exclamation-triangle text-red-600 text-2xl"></i>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">{isAuthError ? 'Authentication Error' : 'Something went wrong'}</h2>

            <p className="text-gray-600 mb-6">{isAuthError ? 'Something went wrong with the authentication system. Please try again.' : 'The page failed to render. Please try again.'}</p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                <h3 className="text-sm font-medium text-red-800 mb-2">Error Details:</h3>
                <pre className="text-xs text-red-700 whitespace-pre-wrap break-words">{this.state.error.message}</pre>
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

            <p className="text-xs text-gray-500 mt-4">If this problem persists, please contact support.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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

/**
 * Higher-order component version of AuthErrorBoundary
 */
export function withAuthErrorBoundary<P extends object>(Component: React.ComponentType<P>, errorBoundaryProps?: Omit<Props, 'children'>) {
  const WrappedComponent = (props: P) => (
    <AuthErrorBoundary {...errorBoundaryProps}>{React.createElement(Component, props)}</AuthErrorBoundary>
  );

  WrappedComponent.displayName = `withAuthErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

export default AuthErrorBoundary;
