/**
 * @encreasl/redux - Enterprise Redux Toolkit Package
 * 
 * Centralized state management solution for the Encreasl monorepo.
 * Provides type-safe Redux Toolkit integration with RTK Query,
 * persistence, and optimized developer experience.
 * 
 * @version 0.1.0
 * @author Encreasl Team
 */

// ============================================================================
// Store Exports
// ============================================================================

export {
  store,
  persistor,
  createStore,
} from './store';

export type {
  RootState,
  AppDispatch,
  AppStore,
} from './store';

// ============================================================================
// Selectors Exports
// ============================================================================

export {
  // Auth selectors
  selectAuth,
  selectAuthUser,
  selectAuthToken,
  selectAuthIsAuthenticated,
  selectAuthIsLoading,
  selectAuthError,
  selectUserFullName,
  selectUserInitials,
  selectUserPermissions,
  selectUserRole,
  selectIsAdmin,
  selectIsInstructor,
  selectIsStudent,
  selectUserPreferences,
  selectSessionExpiry,
  selectIsSessionExpired,
  selectTimeUntilExpiry,
  
  // UI selectors
  selectUI,
  selectUITheme,
  selectUISidebarOpen,
  selectUIMobileMenuOpen,
  selectUINotifications,
  selectUIModals,
  selectUILoading,
  selectUIErrors,
  selectUnreadNotifications,
  selectUnreadNotificationCount,
  selectNotificationsByType,
  selectActiveModals,
  selectIsAnyModalOpen,
  selectModalState,
  selectGlobalLoading,
  selectLoadingState,
  selectGlobalError,
  selectErrorState,
  selectIsLoading,
  selectHasErrors,
  
  // Combined selectors
  selectUserTheme,
  selectEffectiveTheme,
  selectUserNotificationPreferences,
  selectUserAccessibilityPreferences,
  selectShouldShowNotification,
  
  // API selectors
  selectApiState,
  selectApiQueries,
  selectApiMutations,
  selectApiSubscriptions,
  selectPendingQueries,
  selectFailedQueries,
  selectCachedQueries,
  
  // Utility selectors
  createDynamicSelector,
  selectUserById,
} from './store/selectors';

// ============================================================================
// Hooks Exports
// ============================================================================

export {
  // Basic hooks
  useAppDispatch,
  useAppSelector,
  useAppStore,
  
  // Auth hooks
  useAuth,
  useCurrentUser,
  useUserPreferences,
  usePermissions,
  
  // UI hooks
  useUI,
  useTheme,
  useNotifications,
  useModal,
  useLoading,
  useError,
  
  // Utility hooks
  useSession,
  useResponsive,
} from './hooks';

// ============================================================================
// Slices and Actions Exports
// ============================================================================

export {
  // Slices
  authSlice,
  uiSlice,
  
  // Action collections
  authActions,
  uiActions,
  actions,
  reducers,
  
  // Individual auth actions
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
  
  // Individual UI actions
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
} from './slices';

// ============================================================================
// API Exports
// ============================================================================

export {
  api,
  
  // Auth API hooks
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  
  // User API hooks
  useGetCurrentUserQuery,
  useGetUserByIdQuery,
  useUpdateUserMutation,
  useUpdateUserPreferencesMutation,
  useUploadAvatarMutation,
  
  // File API hooks
  useUploadFileMutation,
  useDeleteFileMutation,
  
  // Search API hooks
  useSearchQuery,
  useGetSearchSuggestionsQuery,
  
  // Notification API hooks
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useSendNotificationMutation,
  
  // Analytics API hooks
  useTrackEventsMutation,
  useGetAnalyticsEventsQuery,
} from './api';

// ============================================================================
// Provider Exports
// ============================================================================

export {
  ReduxProvider,
  MinimalReduxProvider,
  DevReduxProvider,
  ProductionReduxProvider,
  withRedux,
  getStore,
  getPersistor,
  resetReduxStore,
} from './providers';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Core types
  User,
  UserRole,
  Permission,
  UserPreferences,
  NotificationPreferences,
  AccessibilityPreferences,
  UserProfile,
  SocialLinks,
  EmergencyContact,
  
  // State types
  AuthState,
  UIState,
  
  // UI types
  Notification,
  NotificationAction,
  ModalState,
  ModalOptions,
  LoadingState,
  ErrorState,
  
  // API types
  ApiResponse,
  ApiError,
  PaginatedResponse,
  AsyncThunkConfig,
  
  // Form types
  LoginCredentials,
  RegisterData,
  
  // API request/response types
  BaseApiResponse,
  ApiErrorResponse,
  PaginationParams,
  PaginationMeta,
  PaginatedApiResponse,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  GetUserRequest,
  UpdateUserRequest,
  UpdateUserPreferencesRequest,
  FileUploadRequest,
  FileUploadResponse,
  SearchRequest,
  SearchResult,
  SearchResponse,
  AnalyticsEvent,
  AnalyticsTrackRequest,
  NotificationRequest,
  GetNotificationsRequest,
  MarkNotificationReadRequest,
  ApiTag,
  EndpointConfig,
  ApiEndpoints,
} from './types';

// ============================================================================
// Utility Exports
// ============================================================================

export {
  API_TAGS,
} from './types/api';

// ============================================================================
// Constants and Configuration
// ============================================================================

export const REDUX_PACKAGE_VERSION = '0.1.0';
export const REDUX_PACKAGE_NAME = '@encreasl/redux';

// Default configuration values
export const DEFAULT_CONFIG = {
  PERSISTENCE_KEY: 'encreasl-root',
  TOKEN_STORAGE_KEY: 'encreasl_token',
  REFRESH_TOKEN_STORAGE_KEY: 'encreasl_refresh_token',
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes
  API_TIMEOUT: 30000, // 30 seconds
  NOTIFICATION_DEFAULT_DURATION: 4000, // 4 seconds
  CACHE_DURATION: 60, // 60 seconds
} as const;

// ============================================================================
// Development Utilities
// ============================================================================

if (process.env.NODE_ENV === 'development') {
  // Export development utilities
  console.log(`🚀 ${REDUX_PACKAGE_NAME} v${REDUX_PACKAGE_VERSION} loaded`);

  // Make utilities available globally for debugging
  if (typeof window !== 'undefined') {
    const { store: storeInstance, persistor: persistorInstance } = require('./store');
    (window as any).__ENCREASL_REDUX__ = {
      store: storeInstance,
      persistor: persistorInstance,
      version: REDUX_PACKAGE_VERSION,
      config: DEFAULT_CONFIG,
    };
  }
}

// ============================================================================
// Default Export
// ============================================================================

// Import for default export
import { store as storeInstance, persistor as persistorInstance } from './store';
import { ReduxProvider as ReduxProviderComponent } from './providers';
import {
  useAppDispatch as useAppDispatchHook,
  useAppSelector as useAppSelectorHook,
  useAuth as useAuthHook,
  useCurrentUser as useCurrentUserHook,
  useTheme as useThemeHook,
  useNotifications as useNotificationsHook
} from './hooks';
import { authActions as authActionsExport, uiActions as uiActionsExport } from './slices';
import { api as apiInstance } from './api';

export default {
  // Core
  store: storeInstance,
  persistor: persistorInstance,

  // Providers
  ReduxProvider: ReduxProviderComponent,

  // Hooks
  useAppDispatch: useAppDispatchHook,
  useAppSelector: useAppSelectorHook,
  useAuth: useAuthHook,
  useCurrentUser: useCurrentUserHook,
  useTheme: useThemeHook,
  useNotifications: useNotificationsHook,

  // Actions
  authActions: authActionsExport,
  uiActions: uiActionsExport,

  // API
  api: apiInstance,

  // Types (for convenience)
  version: REDUX_PACKAGE_VERSION,
  config: DEFAULT_CONFIG,
};
