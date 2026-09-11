/**
 * Enterprise Redux Store Configuration
 * 
 * This file configures the main Redux store with RTK Query, persistence,
 * middleware, and development tools for the Encreasl monorepo.
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// Import slices
import authSlice from '../slices/auth';
import uiSlice from '../slices/ui';

// Import API
import { api } from '../api';

// ============================================================================
// Persistence Configuration
// ============================================================================

// Auth-specific persistence config
const authPersistConfig = {
  key: 'encreasl-auth',
  storage,
  // Only persist essential auth data
  whitelist: ['user', 'token', 'refreshToken', 'isAuthenticated'],
  // Don't persist temporary states
  blacklist: ['isLoading', 'error', 'loginAttempts'],
};

// UI-specific persistence config  
const uiPersistConfig = {
  key: 'encreasl-ui',
  storage,
  // Only persist user preferences
  whitelist: ['theme', 'sidebarOpen'],
  // Don't persist temporary UI states
  blacklist: ['notifications', 'modals', 'loading', 'errors', 'mobileMenuOpen'],
};

// Create persisted reducers
const persistedAuthReducer = persistReducer(authPersistConfig, authSlice.reducer);
const persistedUiReducer = persistReducer(uiPersistConfig, uiSlice.reducer);

const persistedRootReducer = combineReducers({
  auth: persistedAuthReducer,
  ui: persistedUiReducer,
  api: api.reducer,
});

// ============================================================================
// Store Configuration
// ============================================================================

export const createStore = (preloadedState?: any) => {
  const store = configureStore({
    reducer: persistedRootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore redux-persist actions
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
          // Ignore non-serializable values in specific paths
          ignoredActionsPaths: ['meta.arg', 'payload.timestamp'],
          ignoredPaths: ['items.dates'],
        },
        // Enable immutability and serializability checks in development
        immutableCheck: process.env.NODE_ENV === 'development',
      })
        // Add RTK Query middleware
        .concat(api.middleware)
        // Add custom middleware
        .concat(authMiddleware)
        .concat(errorMiddleware)
        .concat(analyticsMiddleware),
    
    // Enable Redux DevTools in development
    devTools: process.env.NODE_ENV === 'development' && {
      name: 'Encreasl Redux Store',
      trace: true,
      traceLimit: 25,
      actionSanitizer: (action: any) => ({
        ...action,
        // Sanitize sensitive data in dev tools
        payload: action.type.includes('auth') && action.payload?.password
          ? { ...action.payload, password: '[REDACTED]' }
          : action.payload,
      }),
      stateSanitizer: (state: any) => ({
        ...state,
        // Sanitize sensitive data in dev tools
        auth: {
          ...state.auth,
          token: state.auth.token ? '[REDACTED]' : null,
          refreshToken: state.auth.refreshToken ? '[REDACTED]' : null,
        },
      }),
    },
    
    // Enhanced store configuration
    enhancers: (getDefaultEnhancers) =>
      getDefaultEnhancers({
        autoBatch: { type: 'tick' },
      }),
  });

  // Setup RTK Query listeners for automatic refetching
  setupListeners(store.dispatch);

  return store;
};

// ============================================================================
// Custom Middleware
// ============================================================================

// Authentication middleware for token management
const authMiddleware = (store: any) => (next: any) => (action: any) => {
  // Handle token expiration
  if (action.type.endsWith('/rejected') && action.payload?.status === 401) {
    // Dispatch logout action to clear auth state
    store.dispatch({ type: 'auth/logout' });
  }
  
  return next(action);
};

// Error handling middleware
const errorMiddleware = (store: any) => (next: any) => (action: any) => {
  // Log errors in development
  if (process.env.NODE_ENV === 'development' && action.type.endsWith('/rejected')) {
    console.error('Redux Error:', action.payload);
  }
  
  // Handle global errors
  if (action.type.endsWith('/rejected') && action.payload?.status >= 500) {
    store.dispatch({
      type: 'ui/addNotification',
      payload: {
        id: Date.now().toString(),
        type: 'error',
        title: 'System Error',
        message: 'An unexpected error occurred. Please try again.',
        duration: 5000,
      },
    });
  }
  
  return next(action);
};

// Analytics middleware for tracking user actions
const analyticsMiddleware = (_store: any) => (next: any) => (action: any) => {
  const result = next(action);

  // Track important user actions
  const trackableActions = [
    'auth/login/fulfilled',
    'auth/logout',
    'auth/register/fulfilled',
  ];

  if (trackableActions.includes(action.type)) {
    // In a real app, you would send this to your analytics service
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', action.type.replace('/', '_'), {
        event_category: 'redux_action',
        event_label: action.type,
      });
    }
  }

  return result;
};

// ============================================================================
// Store Instance and Persistor
// ============================================================================

const store = createStore();
export const persistor = persistStore(store);

// ============================================================================
// Type Definitions
// ============================================================================

export type RootState = ReturnType<typeof persistedRootReducer>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

// Export store after types are defined
export { store };

// ============================================================================
// Store Utilities
// ============================================================================

// Reset store to initial state
export const resetStore = () => {
  persistor.purge();
  store.dispatch({ type: 'RESET_STORE' });
};

// Get current auth state
export const getAuthState = () => store.getState().auth;

// Get current UI state  
export const getUIState = () => store.getState().ui;

// Check if user is authenticated
export const isAuthenticated = () => store.getState().auth.isAuthenticated;

// Get current user
export const getCurrentUser = () => store.getState().auth.user;

// ============================================================================
// Development Utilities
// ============================================================================

if (process.env.NODE_ENV === 'development') {
  // Make store available in browser console for debugging
  if (typeof window !== 'undefined') {
    (window as any).__ENCREASL_STORE__ = store;
    (window as any).__ENCREASL_PERSISTOR__ = persistor;
  }
  
  // Log store state changes in development
  store.subscribe(() => {
    const state = store.getState();
    console.log('🔄 Store updated:', {
      auth: {
        isAuthenticated: state.auth.isAuthenticated,
        user: state.auth.user?.email,
        loading: state.auth.isLoading,
      },
      ui: {
        theme: state.ui.theme,
        notifications: state.ui.notifications.length,
        modals: Object.keys(state.ui.modals).filter(key => state.ui.modals[key].isOpen),
      },
    });
  });
}

// ============================================================================
// Export everything
// ============================================================================

export default store;
export * from './selectors';
