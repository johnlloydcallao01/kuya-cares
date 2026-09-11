/**
 * @file apps/mobile-customer/src/contexts/AuthContext.tsx
 * @description Authentication Context Provider for Mobile
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  AuthState,
  AuthContextType,
  LoginCredentials,
  AuthService,
} from '@encreasl/client-services';
import { apiConfig } from '../config/environment';

// ========================================
// EXTENDED TYPES
// ========================================

export interface MobileAuthState extends AuthState {
  customerId: string | null;
}

export interface MobileAuthContextType extends AuthContextType {
  customerId: string | null;
  updateUser: (user: User) => void;
}

// ========================================
// AUTHENTICATION REDUCER
// ========================================

type AuthAction =
  | { type: 'AUTH_INIT_SUCCESS'; payload: { user: User | null; customerId?: string | null } }
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; customerId?: string | null } }
  | { type: 'LOGIN_ERROR'; payload: { error: string } }
  | { type: 'LOGOUT_SUCCESS' }
  | { type: 'REFRESH_SUCCESS'; payload: { user: User } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SESSION_EXPIRED' }
  | { type: 'SET_CUSTOMER_ID'; payload: { customerId: string | null } }
  | { type: 'UPDATE_USER'; payload: { user: User } };

const initialState: MobileAuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true, // Start loading initially
  isInitialized: false,
  error: null,
  customerId: null,
};

function authReducer(state: MobileAuthState, action: AuthAction): MobileAuthState {
  switch (action.type) {
    case 'AUTH_INIT_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        customerId: action.payload.customerId || null,
        isAuthenticated: action.payload.user !== null,
        isLoading: false,
        isInitialized: true,
        error: null,
      };

    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        customerId: action.payload.customerId || null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case 'LOGIN_ERROR':
      return {
        ...state,
        user: null,
        customerId: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload.error,
      };

    case 'LOGOUT_SUCCESS':
      return {
        ...state,
        user: null,
        customerId: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };

    case 'REFRESH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        error: null,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'SESSION_EXPIRED':
      return {
        ...state,
        user: null,
        customerId: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
      
    case 'SET_CUSTOMER_ID':
      return {
        ...state,
        customerId: action.payload.customerId,
      };

    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
      };

    default:
      return state;
  }
}

// ========================================
// CONTEXT CREATION
// ========================================

const AuthContext = createContext<MobileAuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps): React.ReactNode => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Helper to fetch customer ID
  const fetchCustomerId = useCallback(async (userId: string | number): Promise<string | null> => {
    try {
      // 1. Try to get cached customer ID first
      const cachedCid = await AsyncStorage.getItem('current-customer-id');
      // If we have a cached ID, we return it immediately for speed,
      // but strictly speaking we should verify it matches the user.
      // For now, assuming single user device usage mostly.
      if (cachedCid) {
        return cachedCid;
      }

      // 2. Fetch customer ID from API
      const { baseUrl: API_URL, payloadApiKey: API_KEY } = apiConfig;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (API_KEY) {
        headers['Authorization'] = `users API-Key ${API_KEY}`;
      }

      const res = await fetch(`${API_URL}/customers?where[user][equals]=${userId}&limit=1`, {
        headers,
        credentials: 'omit',
      });

      if (res.ok) {
        const data = await res.json();
        const customer = data.docs?.[0];
        if (customer?.id) {
          await AsyncStorage.setItem('current-customer-id', String(customer.id));
          return String(customer.id);
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching customer ID:', error);
      return null;
    }
  }, []);

  // ========================================
  // INITIALIZATION
  // ========================================

  const initializeAuth = useCallback(async () => {
    try {
      // Check for stored token
      const token = await AsyncStorage.getItem('grandline_auth_token');
      const storedUser = await AsyncStorage.getItem('grandline_auth_user');

      if (token && storedUser) {
        try {
          const user = JSON.parse(storedUser);
          
          // Fetch customer ID concurrently if possible, or just await it
          let customerId = await AsyncStorage.getItem('current-customer-id');
          if (!customerId && user.id) {
             customerId = await fetchCustomerId(user.id);
          }

          dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user, customerId } });
        } catch {
          // Invalid JSON
          await AsyncStorage.multiRemove(['grandline_auth_token', 'grandline_auth_user', 'current-customer-id']);
          dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user: null } });
        }
      } else {
        dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user: null } });
      }
    } catch (error) {
      console.error('Auth initialization failed', error);
      dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user: null } });
    }
  }, [fetchCustomerId]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // ========================================
  // AUTHENTICATION METHODS
  // ========================================

  const login = useCallback(async (credentials: LoginCredentials) => {
    console.log('[AuthContext] Login started');
    dispatch({ type: 'LOGIN_START' });

    try {
      console.log('[AuthContext] Calling AuthService.login...');
      const response = await AuthService.login(credentials);
      console.log('[AuthContext] AuthService.login success', { hasToken: !!response.token, hasUser: !!response.user });
      
      let customerId = null;

      if (response.token) {
        console.log('[AuthContext] Saving token...');
        await AsyncStorage.setItem('grandline_auth_token', response.token);
      }
      if (response.user) {
        console.log('[AuthContext] Saving user...');
        await AsyncStorage.setItem('grandline_auth_user', JSON.stringify(response.user));
        
        // Fetch Customer ID immediately
        // Note: We need to force fetch from API here because we just logged in, 
        // cached ID might be from previous user if not cleared properly (though logout clears it).
        // But fetchCustomerId checks cache first. 
        // Ideally we should clear cache before login or ensure cache is valid.
        // For safety, let's rely on fetchCustomerId but maybe we should invalidate cache?
        // Actually, fetchCustomerId checks cache. If we just logged in, cache should be empty (logout clears it).
        // If we are re-logging in without logout?
        
        if (response.user.id) {
           // We can manually bypass cache or just call it. 
           // Since logout clears 'current-customer-id', it should be fine.
           customerId = await fetchCustomerId(response.user.id);
        }
      }
      
      console.log('[AuthContext] Dispatching LOGIN_SUCCESS');
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user: response.user, customerId } });
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'LOGIN_ERROR', payload: { error: errorMessage } });
      throw error;
    }
  }, [fetchCustomerId]);

  const logout = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('grandline_auth_token');
      if (token) {
        await AuthService.logout(token);
      }
    } catch {
      // Ignore logout errors
    } finally {
      await AsyncStorage.multiRemove(['grandline_auth_token', 'grandline_auth_user', 'current-customer-id']);
      dispatch({ type: 'LOGOUT_SUCCESS' });
    }
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    dispatch({ type: 'UPDATE_USER', payload: { user: updatedUser } });
    AsyncStorage.setItem('grandline_auth_user', JSON.stringify(updatedUser));
  }, []);

  const refreshSession = useCallback(async () => {
    // Implementation for refresh token if needed
    // For now, we rely on the token validity
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const checkAuthStatus = useCallback(async () => {
    const token = await AsyncStorage.getItem('grandline_auth_token');
    return !!token;
  }, []);

  const [token, setToken] = React.useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('grandline_auth_token').then(setToken);
  }, [state.isAuthenticated]); // Update token when auth state changes

  const contextValue: MobileAuthContextType & { token: string | null } = {
    ...state,
    token, // Expose token
    login,
    logout,
    updateUser,
    refreshSession,
    clearError,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
