/**
 * UI Slice
 * 
 * Manages global UI state including theme, notifications, modals,
 * loading states, and error handling for the Encreasl platform.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { 
  UIState, 
  Notification, 
  ModalOptions,
  NotificationAction 
} from '../types';

// ============================================================================
// Initial State
// ============================================================================

const initialState: UIState = {
  theme: 'system',
  sidebarOpen: true,
  mobileMenuOpen: false,
  notifications: [],
  modals: {},
  loading: {
    global: false,
  },
  errors: {
    global: null,
  },
};

// ============================================================================
// UI Slice
// ============================================================================

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // ========================================================================
    // Theme Actions
    // ========================================================================
    
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },
    
    toggleTheme: (state) => {
      if (state.theme === 'light') {
        state.theme = 'dark';
      } else if (state.theme === 'dark') {
        state.theme = 'light';
      } else {
        // If system, detect current and toggle
        const isDark = typeof window !== 'undefined' 
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
          : false;
        state.theme = isDark ? 'light' : 'dark';
      }
    },
    
    // ========================================================================
    // Sidebar Actions
    // ========================================================================
    
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    
    setMobileMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.mobileMenuOpen = action.payload;
    },
    
    toggleMobileMenu: (state) => {
      state.mobileMenuOpen = !state.mobileMenuOpen;
    },
    
    // ========================================================================
    // Notification Actions
    // ========================================================================
    
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'createdAt'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        createdAt: Date.now(),
      };
      
      state.notifications.push(notification);
      
      // Auto-remove non-persistent notifications after duration
      if (!notification.persistent && notification.duration) {
        // In a real app, you'd set up a timer here
        // For now, we'll rely on the component to handle removal
      }
    },
    
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
    },
    
    clearNotifications: (state) => {
      state.notifications = [];
    },
    
    clearNotificationsByType: (state, action: PayloadAction<Notification['type']>) => {
      state.notifications = state.notifications.filter(
        notification => notification.type !== action.payload
      );
    },
    
    updateNotification: (state, action: PayloadAction<{ id: string; updates: Partial<Notification> }>) => {
      const { id, updates } = action.payload;
      const index = state.notifications.findIndex(notification => notification.id === id);
      
      if (index !== -1) {
        state.notifications[index] = {
          ...state.notifications[index],
          ...updates,
        };
      }
    },
    
    // ========================================================================
    // Modal Actions
    // ========================================================================
    
    openModal: (state, action: PayloadAction<{
      id: string;
      data?: any;
      options?: ModalOptions;
    }>) => {
      const { id, data, options } = action.payload;
      state.modals[id] = {
        isOpen: true,
        data,
        options: {
          closable: true,
          backdrop: true,
          size: 'md',
          position: 'center',
          ...options,
        },
      };
    },
    
    closeModal: (state, action: PayloadAction<string>) => {
      const modalId = action.payload;
      if (state.modals[modalId]) {
        state.modals[modalId].isOpen = false;
      }
    },
    
    closeAllModals: (state) => {
      Object.keys(state.modals).forEach(modalId => {
        state.modals[modalId].isOpen = false;
      });
    },
    
    updateModalData: (state, action: PayloadAction<{ id: string; data: any }>) => {
      const { id, data } = action.payload;
      if (state.modals[id]) {
        state.modals[id].data = data;
      }
    },
    
    updateModalOptions: (state, action: PayloadAction<{ id: string; options: Partial<ModalOptions> }>) => {
      const { id, options } = action.payload;
      if (state.modals[id]) {
        state.modals[id].options = {
          ...state.modals[id].options,
          ...options,
        };
      }
    },
    
    // ========================================================================
    // Loading Actions
    // ========================================================================
    
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },
    
    setLoading: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      const { key, loading } = action.payload;
      state.loading[key] = loading;
    },
    
    clearLoading: (state, action: PayloadAction<string>) => {
      delete state.loading[action.payload];
    },
    
    clearAllLoading: (state) => {
      state.loading = { global: false };
    },
    
    // ========================================================================
    // Error Actions
    // ========================================================================
    
    setGlobalError: (state, action: PayloadAction<string | null>) => {
      state.errors.global = action.payload;
    },
    
    setError: (state, action: PayloadAction<{ key: string; error: string | null }>) => {
      const { key, error } = action.payload;
      state.errors[key] = error;
    },
    
    clearError: (state, action: PayloadAction<string>) => {
      delete state.errors[action.payload];
    },
    
    clearAllErrors: (state) => {
      state.errors = { global: null };
    },
    
    // ========================================================================
    // Utility Actions
    // ========================================================================
    
    resetUI: (state) => {
      // Reset to initial state but preserve theme and sidebar preferences
      const { theme, sidebarOpen } = state;
      Object.assign(state, {
        ...initialState,
        theme,
        sidebarOpen,
      });
    },
    
    // Batch actions for performance
    batchUIUpdates: (state, action: PayloadAction<{
      theme?: UIState['theme'];
      sidebarOpen?: boolean;
      mobileMenuOpen?: boolean;
      loading?: Record<string, boolean>;
      errors?: Record<string, string | null>;
    }>) => {
      const updates = action.payload;
      
      if (updates.theme !== undefined) {
        state.theme = updates.theme;
      }
      
      if (updates.sidebarOpen !== undefined) {
        state.sidebarOpen = updates.sidebarOpen;
      }
      
      if (updates.mobileMenuOpen !== undefined) {
        state.mobileMenuOpen = updates.mobileMenuOpen;
      }
      
      if (updates.loading) {
        Object.assign(state.loading, updates.loading);
      }
      
      if (updates.errors) {
        Object.assign(state.errors, updates.errors);
      }
    },
  },
});

// ============================================================================
// Action Creators for Complex Operations
// ============================================================================

// Show success notification
export const showSuccessNotification = (message: string, title?: string) => 
  uiSlice.actions.addNotification({
    type: 'success',
    title: title || 'Success',
    message,
    duration: 4000,
  });

// Show error notification
export const showErrorNotification = (message: string, title?: string) => 
  uiSlice.actions.addNotification({
    type: 'error',
    title: title || 'Error',
    message,
    duration: 6000,
  });

// Show warning notification
export const showWarningNotification = (message: string, title?: string) => 
  uiSlice.actions.addNotification({
    type: 'warning',
    title: title || 'Warning',
    message,
    duration: 5000,
  });

// Show info notification
export const showInfoNotification = (message: string, title?: string) => 
  uiSlice.actions.addNotification({
    type: 'info',
    title: title || 'Information',
    message,
    duration: 4000,
  });

// Show notification with actions
export const showActionNotification = (
  message: string,
  actions: NotificationAction[],
  title?: string,
  type: Notification['type'] = 'info'
) => 
  uiSlice.actions.addNotification({
    type,
    title: title || 'Action Required',
    message,
    actions,
    persistent: true,
  });

// Show loading with automatic cleanup
export const showLoadingWithTimeout = (key: string, timeout: number = 30000) => 
  (dispatch: any) => {
    dispatch(uiSlice.actions.setLoading({ key, loading: true }));
    
    // Auto-clear loading after timeout
    setTimeout(() => {
      dispatch(uiSlice.actions.clearLoading(key));
    }, timeout);
  };

// ============================================================================
// Export actions and reducer
// ============================================================================

export const {
  setTheme,
  toggleTheme,
  setSidebarOpen,
  toggleSidebar,
  setMobileMenuOpen,
  toggleMobileMenu,
  addNotification,
  removeNotification,
  clearNotifications,
  clearNotificationsByType,
  updateNotification,
  openModal,
  closeModal,
  closeAllModals,
  updateModalData,
  updateModalOptions,
  setGlobalLoading,
  setLoading,
  clearLoading,
  clearAllLoading,
  setGlobalError,
  setError,
  clearError,
  clearAllErrors,
  resetUI,
  batchUIUpdates,
} = uiSlice.actions;

export default uiSlice;
