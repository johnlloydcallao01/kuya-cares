/**
 * Redux Slices Index
 * 
 * Central export point for all Redux slices and their actions.
 * This provides a clean API for consuming applications.
 */

// Import slices
import authSlice, {
  loginUser,
  registerUser,
  logoutUser,
  refreshToken,
  loadUserFromToken,
  updateUserProfile,
  clearError as clearAuthError,
  updateLastActivity,
  setSessionExpiry,
  incrementLoginAttempts,
  resetLoginAttempts,
  updateUserPreferences,
  forceLogout,
} from './auth';

import uiSlice, {
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
  clearError as clearUIError,
  clearAllErrors,
  resetUI,
  batchUIUpdates,
  showSuccessNotification,
  showErrorNotification,
  showWarningNotification,
  showInfoNotification,
  showActionNotification,
  showLoadingWithTimeout,
} from './ui';

// ============================================================================
// Slice Exports
// ============================================================================

export { authSlice, uiSlice };

// ============================================================================
// Auth Action Exports
// ============================================================================

export const authActions = {
  // Async thunks
  loginUser,
  registerUser,
  logoutUser,
  refreshToken,
  loadUserFromToken,
  updateUserProfile,
  
  // Sync actions
  clearError: clearAuthError,
  updateLastActivity,
  setSessionExpiry,
  incrementLoginAttempts,
  resetLoginAttempts,
  updateUserPreferences,
  forceLogout,
};

// ============================================================================
// UI Action Exports
// ============================================================================

export const uiActions = {
  // Theme actions
  setTheme,
  toggleTheme,
  
  // Sidebar actions
  setSidebarOpen,
  toggleSidebar,
  setMobileMenuOpen,
  toggleMobileMenu,
  
  // Notification actions
  addNotification,
  removeNotification,
  clearNotifications,
  clearNotificationsByType,
  updateNotification,
  
  // Modal actions
  openModal,
  closeModal,
  closeAllModals,
  updateModalData,
  updateModalOptions,
  
  // Loading actions
  setGlobalLoading,
  setLoading,
  clearLoading,
  clearAllLoading,
  
  // Error actions
  setGlobalError,
  setError,
  clearError: clearUIError,
  clearAllErrors,
  
  // Utility actions
  resetUI,
  batchUIUpdates,
  
  // Helper action creators
  showSuccessNotification,
  showErrorNotification,
  showWarningNotification,
  showInfoNotification,
  showActionNotification,
  showLoadingWithTimeout,
};

// ============================================================================
// Combined Actions Export
// ============================================================================

export const actions = {
  auth: authActions,
  ui: uiActions,
};

// ============================================================================
// Individual Action Exports (for convenience)
// ============================================================================

// Auth actions
export {
  loginUser,
  registerUser,
  logoutUser,
  refreshToken,
  loadUserFromToken,
  updateUserProfile,
  clearAuthError,
  updateLastActivity,
  setSessionExpiry,
  incrementLoginAttempts,
  resetLoginAttempts,
  updateUserPreferences,
  forceLogout,
};

// UI actions
export {
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
  clearUIError,
  clearAllErrors,
  resetUI,
  batchUIUpdates,
  showSuccessNotification,
  showErrorNotification,
  showWarningNotification,
  showInfoNotification,
  showActionNotification,
  showLoadingWithTimeout,
};

// ============================================================================
// Reducer Exports
// ============================================================================

export const reducers = {
  auth: authSlice.reducer,
  ui: uiSlice.reducer,
};

// ============================================================================
// Default Export
// ============================================================================

export default {
  slices: {
    auth: authSlice,
    ui: uiSlice,
  },
  actions,
  reducers,
};
