/**
 * Redux Providers
 * 
 * React components that provide Redux context to applications.
 * These providers handle store initialization, persistence, and
 * development tools integration.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor, type AppStore } from '../store';
import { loadUserFromToken } from '../slices/auth';

// ============================================================================
// Types
// ============================================================================

export interface ReduxProviderProps {
  children: React.ReactNode;
  customStore?: AppStore;
  enablePersistence?: boolean;
  enableDevTools?: boolean;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
}

interface StoreInitializerProps {
  children: React.ReactNode;
  store: AppStore;
}

// ============================================================================
// Store Initializer Component
// ============================================================================

/**
 * Component that handles initial store setup and user authentication
 */
const StoreInitializer = ({ children, store }: StoreInitializerProps): React.JSX.Element => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initializeStore = async () => {
      try {
        // Check if we have a stored token and try to load user
        const token = localStorage.getItem('encreasl_token');

        if (token) {
          // Dispatch action to load user from token
          await store.dispatch(loadUserFromToken());
        }

        // Mark as initialized
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize store:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown error');
        setIsInitialized(true); // Still mark as initialized to prevent infinite loading
      }
    };

    initializeStore();
  }, [store]);

  // Show loading state during initialization
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing application...</p>
        </div>
      </div>
    );
  }

  // Show error state if initialization failed
  if (initError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Initialization Error
          </h2>
          <p className="text-gray-600 mb-4">
            Failed to initialize the application. Please refresh the page or contact support.
          </p>
          <p className="text-sm text-gray-500 bg-gray-100 p-2 rounded">
            {initError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// ============================================================================
// Loading Component
// ============================================================================

const DefaultLoadingComponent = (): React.JSX.Element => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading application state...</p>
    </div>
  </div>
);

// ============================================================================
// Error Component
// ============================================================================

const DefaultErrorComponent = ({ error }: { error?: string }): React.JSX.Element => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center max-w-md mx-auto p-6">
      <div className="text-red-500 text-6xl mb-4">❌</div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Application Error
      </h2>
      <p className="text-gray-600 mb-4">
        Something went wrong while loading the application.
      </p>
      {error && (
        <p className="text-sm text-gray-500 bg-gray-100 p-2 rounded mb-4">
          {error}
        </p>
      )}
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        Reload Application
      </button>
    </div>
  </div>
);

// ============================================================================
// Main Redux Provider
// ============================================================================

/**
 * Main Redux Provider component that wraps applications with Redux context
 *
 * Features:
 * - Redux store provider
 * - Redux Persist integration
 * - Automatic store initialization
 * - User authentication restoration
 * - Development tools integration
 * - Error boundary handling
 * - Loading states
 */
export const ReduxProvider = ({
  children,
  customStore,
  enablePersistence = true,
  loadingComponent,
  errorComponent,
}: ReduxProviderProps): React.JSX.Element => {
  const [hydrationError] = useState<string | null>(null);

  const storeToUse = customStore || store;
  const LoadingComponent = loadingComponent || <DefaultLoadingComponent />;
  const ErrorComponent = errorComponent || <DefaultErrorComponent error={hydrationError || undefined} />;

  // Handle persistence errors (for future use)
  // const handlePersistError = (error: Error) => {
  //   console.error('Redux Persist Error:', error);
  //   setHydrationError(error.message);
  //
  //   // In development, show the error
  //   if (process.env.NODE_ENV === 'development') {
  //     console.error('Persistence failed, clearing storage and reloading...');
  //     localStorage.clear();
  //     sessionStorage.clear();
  //   }
  // };

  // If persistence is disabled, just use the basic provider
  if (!enablePersistence) {
    return (
      <Provider store={storeToUse}>
        <StoreInitializer store={storeToUse}>
          {children as any}
        </StoreInitializer>
      </Provider>
    );
  }

  // Show error component if hydration failed
  if (hydrationError) {
    return ErrorComponent as React.JSX.Element;
  }

  return (
    <Provider store={storeToUse}>
      {React.createElement(PersistGate as any, {
        loading: LoadingComponent,
        persistor: persistor,
        onBeforeLift: () => {
          // Optional: Perform any actions before rehydration
          console.log('🔄 Rehydrating Redux store...');
        },
        children: (
          <StoreInitializer store={storeToUse}>
            {children as any}
          </StoreInitializer>
        )
      })}
    </Provider>
  );
};

// ============================================================================
// Specialized Providers
// ============================================================================

/**
 * Minimal Redux Provider without persistence (useful for testing or SSR)
 */
export const MinimalReduxProvider = ({
  children,
  store: customStore,
}: { children: React.ReactNode; store?: AppStore }): React.JSX.Element => {
  const storeToUse = customStore || store;

  return (
    <Provider store={storeToUse}>
      {children}
    </Provider>
  );
};

/**
 * Development Redux Provider with enhanced debugging
 */
export const DevReduxProvider = ({ children }: { children: React.ReactNode }): React.JSX.Element => {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Add global store access for debugging
      (window as any).__REDUX_STORE__ = store;
      (window as any).__REDUX_PERSISTOR__ = persistor;

      console.log('🔧 Development Redux Provider loaded');
      console.log('📦 Store:', store.getState());
    }
  }, []);

  return (
    <ReduxProvider enableDevTools={true}>
      {children}
    </ReduxProvider>
  );
};

/**
 * Production Redux Provider with optimized settings
 */
export const ProductionReduxProvider = ({ children }: { children: React.ReactNode }): React.JSX.Element => {
  return (
    <ReduxProvider
      enableDevTools={false}
      loadingComponent={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      }
    >
      {children}
    </ReduxProvider>
  );
};

// ============================================================================
// HOC for Redux Integration
// ============================================================================

/**
 * Higher-Order Component that wraps a component with Redux Provider
 */
export const withRedux = <P extends object>(
  Component: React.ComponentType<P>,
  options?: Partial<ReduxProviderProps>
) => {
  const WrappedComponent = (props: P): React.JSX.Element => (
    <ReduxProvider {...options}>
      {React.createElement(Component, props)}
    </ReduxProvider>
  );

  WrappedComponent.displayName = `withRedux(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the current store instance (useful for testing or advanced use cases)
 */
export const getStore = () => store;

/**
 * Get the current persistor instance
 */
export const getPersistor = () => persistor;

/**
 * Reset the entire Redux store and persistence
 */
export const resetReduxStore = async () => {
  try {
    // Purge persisted state
    await persistor.purge();
    
    // Clear localStorage
    localStorage.removeItem('encreasl_token');
    localStorage.removeItem('encreasl_refresh_token');
    
    // Dispatch reset action
    store.dispatch({ type: 'RESET_STORE' });
    
    console.log('✅ Redux store reset successfully');
  } catch (error) {
    console.error('❌ Failed to reset Redux store:', error);
    throw error;
  }
};

// ============================================================================
// Default Export
// ============================================================================

export default ReduxProvider;
