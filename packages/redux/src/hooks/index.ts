'use client';

/**
 * Typed Redux Hooks
 *
 * Pre-configured, type-safe hooks for accessing Redux state and dispatch
 * functions. These hooks provide better TypeScript integration and
 * eliminate the need for type assertions in components.
 */

import { useDispatch, useSelector, useStore } from 'react-redux';
import { useCallback, useEffect, useMemo } from 'react';
import type { RootState, AppDispatch, AppStore } from '../store';
import type { User, Notification } from '../types';

// ============================================================================
// Basic Typed Hooks
// ============================================================================

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();

// ============================================================================
// Auth Hooks
// ============================================================================

/**
 * Hook for accessing authentication state
 */
export const useAuth = () => {
  const auth = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();

  return useMemo(() => ({
    // State
    user: auth.user,
    token: auth.token,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
    loginAttempts: auth.loginAttempts,
    lastActivity: auth.lastActivity,
    sessionExpiry: auth.sessionExpiry,
    
    // Computed values
    isSessionExpired: auth.sessionExpiry ? Date.now() > auth.sessionExpiry : false,
    timeUntilExpiry: auth.sessionExpiry ? Math.max(0, auth.sessionExpiry - Date.now()) : null,
    
    // Actions (will be imported from slices)
    dispatch,
  }), [auth, dispatch]);
};

/**
 * Hook for accessing current user information
 */
export const useCurrentUser = () => {
  const user = useAppSelector((state) => state.auth.user);
  
  return useMemo(() => {
    if (!user) return null;
    
    const fullName = [user.firstName, user.middleName, user.lastName, user.nameExtension]
      .filter(Boolean)
      .join(' ');
    
    const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
    
    return {
      ...user,
      fullName,
      initials,
      isAdmin: user.role === 'admin',
      isInstructor: user.role === 'instructor',
      isStudent: user.role === 'student',
    };
  }, [user]);
};

/**
 * Hook for managing user preferences
 */
export const useUserPreferences = () => {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  
  const preferences = useMemo(() => user?.preferences || {
    theme: 'system',
    language: 'en',
    timezone: 'UTC',
    notifications: {
      email: true,
      push: true,
      sms: false,
      inApp: true,
      marketing: false,
    },
    accessibility: {
      reducedMotion: false,
      highContrast: false,
      fontSize: 'medium',
      screenReader: false,
    },
  }, [user?.preferences]);
  
  const updatePreferences = useCallback((updates: Partial<User['preferences']>) => {
    // This will be implemented when we add the action
    dispatch({ type: 'auth/updateUserPreferences', payload: updates });
  }, [dispatch]);
  
  return {
    preferences,
    updatePreferences,
  };
};

/**
 * Hook for checking user permissions
 */
export const usePermissions = () => {
  const user = useAppSelector((state) => state.auth.user);
  
  const hasPermission = useCallback((resource: string, action: string) => {
    if (!user?.permissions) return false;

    return user.permissions.some(
      (permission: any) => permission.resource === resource && permission.action === action
    );
  }, [user?.permissions]);
  
  const hasRole = useCallback((role: User['role']) => {
    return user?.role === role;
  }, [user?.role]);
  
  const hasAnyRole = useCallback((roles: User['role'][]) => {
    return user?.role ? roles.includes(user.role) : false;
  }, [user?.role]);
  
  return {
    permissions: user?.permissions || [],
    role: user?.role || 'guest',
    hasPermission,
    hasRole,
    hasAnyRole,
    isAdmin: user?.role === 'admin',
    isInstructor: user?.role === 'instructor',
    isStudent: user?.role === 'student',
  };
};

// ============================================================================
// UI Hooks
// ============================================================================

/**
 * Hook for accessing UI state
 */
export const useUI = () => {
  const ui = useAppSelector((state) => state.ui);
  const dispatch = useAppDispatch();
  
  return useMemo(() => ({
    // State
    theme: ui.theme,
    sidebarOpen: ui.sidebarOpen,
    mobileMenuOpen: ui.mobileMenuOpen,
    notifications: ui.notifications,
    modals: ui.modals,
    loading: ui.loading,
    errors: ui.errors,
    
    // Computed values
    unreadNotifications: ui.notifications.filter((n: any) => !n.persistent),
    unreadCount: ui.notifications.filter((n: any) => !n.persistent).length,
    activeModals: Object.keys(ui.modals).filter(key => ui.modals[key].isOpen),
    isAnyModalOpen: Object.values(ui.modals).some((modal: any) => modal.isOpen),
    isLoading: Object.values(ui.loading).some(Boolean),
    hasErrors: Object.values(ui.errors).some(Boolean),
    
    // Actions
    dispatch,
  }), [ui, dispatch]);
};

/**
 * Hook for managing theme
 */
export const useTheme = () => {
  const theme = useAppSelector((state) => state.ui.theme);
  const userPreferences = useUserPreferences();
  const dispatch = useAppDispatch();
  
  const effectiveTheme = useMemo(() => {
    const preferredTheme = userPreferences.preferences.theme !== 'system' 
      ? userPreferences.preferences.theme 
      : theme;
    
    if (preferredTheme === 'system') {
      if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'light';
    }
    
    return preferredTheme;
  }, [theme, userPreferences.preferences.theme]);
  
  const setTheme = useCallback((newTheme: 'light' | 'dark' | 'system') => {
    dispatch({ type: 'ui/setTheme', payload: newTheme });
  }, [dispatch]);
  
  const toggleTheme = useCallback(() => {
    dispatch({ type: 'ui/toggleTheme' });
  }, [dispatch]);
  
  return {
    theme,
    effectiveTheme,
    isDark: effectiveTheme === 'dark',
    isLight: effectiveTheme === 'light',
    isSystem: theme === 'system',
    setTheme,
    toggleTheme,
  };
};

/**
 * Hook for managing notifications
 */
export const useNotifications = () => {
  const notifications = useAppSelector((state) => state.ui.notifications);
  const dispatch = useAppDispatch();
  
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt'>) => {
    dispatch({ type: 'ui/addNotification', payload: notification });
  }, [dispatch]);
  
  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'ui/removeNotification', payload: id });
  }, [dispatch]);
  
  const clearNotifications = useCallback(() => {
    dispatch({ type: 'ui/clearNotifications' });
  }, [dispatch]);
  
  const showSuccess = useCallback((message: string, title?: string) => {
    addNotification({
      type: 'success',
      title: title || 'Success',
      message,
      duration: 4000,
    });
  }, [addNotification]);
  
  const showError = useCallback((message: string, title?: string) => {
    addNotification({
      type: 'error',
      title: title || 'Error',
      message,
      duration: 6000,
    });
  }, [addNotification]);
  
  const showWarning = useCallback((message: string, title?: string) => {
    addNotification({
      type: 'warning',
      title: title || 'Warning',
      message,
      duration: 5000,
    });
  }, [addNotification]);
  
  const showInfo = useCallback((message: string, title?: string) => {
    addNotification({
      type: 'info',
      title: title || 'Information',
      message,
      duration: 4000,
    });
  }, [addNotification]);
  
  return {
    notifications,
    unreadCount: notifications.filter((n: any) => !n.persistent).length,
    addNotification,
    removeNotification,
    clearNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};

/**
 * Hook for managing modals
 */
export const useModal = (modalId: string) => {
  const modal = useAppSelector((state) => state.ui.modals[modalId]);
  const dispatch = useAppDispatch();
  
  const isOpen = modal?.isOpen || false;
  const data = modal?.data;
  const options = modal?.options;
  
  const openModal = useCallback((modalData?: any, modalOptions?: any) => {
    dispatch({
      type: 'ui/openModal',
      payload: { id: modalId, data: modalData, options: modalOptions },
    });
  }, [dispatch, modalId]);
  
  const closeModal = useCallback(() => {
    dispatch({ type: 'ui/closeModal', payload: modalId });
  }, [dispatch, modalId]);
  
  const updateData = useCallback((newData: any) => {
    dispatch({
      type: 'ui/updateModalData',
      payload: { id: modalId, data: newData },
    });
  }, [dispatch, modalId]);
  
  return {
    isOpen,
    data,
    options,
    openModal,
    closeModal,
    updateData,
  };
};

/**
 * Hook for managing loading states
 */
export const useLoading = (key?: string) => {
  const loading = useAppSelector((state) => state.ui.loading);
  const dispatch = useAppDispatch();
  
  const isLoading = key ? loading[key] || false : loading.global;
  
  const setLoading = useCallback((loadingState: boolean) => {
    if (key) {
      dispatch({ type: 'ui/setLoading', payload: { key, loading: loadingState } });
    } else {
      dispatch({ type: 'ui/setGlobalLoading', payload: loadingState });
    }
  }, [dispatch, key]);
  
  const clearLoading = useCallback(() => {
    if (key) {
      dispatch({ type: 'ui/clearLoading', payload: key });
    } else {
      dispatch({ type: 'ui/setGlobalLoading', payload: false });
    }
  }, [dispatch, key]);
  
  return {
    isLoading,
    setLoading,
    clearLoading,
  };
};

/**
 * Hook for managing error states
 */
export const useError = (key?: string) => {
  const errors = useAppSelector((state) => state.ui.errors);
  const dispatch = useAppDispatch();
  
  const error = key ? errors[key] : errors.global;
  
  const setError = useCallback((errorMessage: string | null) => {
    if (key) {
      dispatch({ type: 'ui/setError', payload: { key, error: errorMessage } });
    } else {
      dispatch({ type: 'ui/setGlobalError', payload: errorMessage });
    }
  }, [dispatch, key]);
  
  const clearError = useCallback(() => {
    if (key) {
      dispatch({ type: 'ui/clearError', payload: key });
    } else {
      dispatch({ type: 'ui/setGlobalError', payload: null });
    }
  }, [dispatch, key]);
  
  return {
    error,
    hasError: !!error,
    setError,
    clearError,
  };
};

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook for session management
 */
export const useSession = () => {
  const auth = useAuth();
  const dispatch = useAppDispatch();
  
  // Update last activity on user interaction
  const updateActivity = useCallback(() => {
    if (auth.isAuthenticated) {
      dispatch({ type: 'auth/updateLastActivity' });
    }
  }, [auth.isAuthenticated, dispatch]);
  
  // Auto-refresh token before expiry
  useEffect(() => {
    if (!auth.isAuthenticated || !auth.sessionExpiry) return;
    
    const timeUntilExpiry = auth.sessionExpiry - Date.now();
    const refreshTime = Math.max(0, timeUntilExpiry - 5 * 60 * 1000); // 5 minutes before expiry
    
    if (refreshTime > 0) {
      const timer = setTimeout(() => {
        dispatch({ type: 'auth/refreshToken' });
      }, refreshTime);
      
      return () => clearTimeout(timer);
    }
  }, [auth.isAuthenticated, auth.sessionExpiry, dispatch]);
  
  return {
    isAuthenticated: auth.isAuthenticated,
    isSessionExpired: auth.isSessionExpired,
    timeUntilExpiry: auth.timeUntilExpiry,
    updateActivity,
  };
};

/**
 * Hook for responsive design
 */
export const useResponsive = () => {
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  const mobileMenuOpen = useAppSelector((state) => state.ui.mobileMenuOpen);
  
  return {
    sidebarOpen,
    mobileMenuOpen,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    isTablet: typeof window !== 'undefined' ? window.innerWidth >= 768 && window.innerWidth < 1024 : false,
    isDesktop: typeof window !== 'undefined' ? window.innerWidth >= 1024 : false,
  };
};
