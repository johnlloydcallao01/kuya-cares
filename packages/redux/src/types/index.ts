/**
 * Core Redux Types for Encreasl Applications
 * 
 * This file contains all the TypeScript type definitions for our Redux store,
 * including state shapes, action types, and utility types.
 */

// ============================================================================
// User & Authentication Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  nameExtension?: string;
  avatar?: string;
  role: UserRole;
  permissions: Permission[];
  preferences: UserPreferences;
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export type UserRole = 'admin' | 'instructor' | 'student' | 'moderator' | 'guest';

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
  accessibility: AccessibilityPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
  marketing: boolean;
}

export interface AccessibilityPreferences {
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  screenReader: boolean;
}

export interface UserProfile {
  bio?: string;
  website?: string;
  location?: string;
  birthDate?: string;
  phoneNumber?: string;
  socialLinks: SocialLinks;
  emergencyContact?: EmergencyContact;
}

export interface SocialLinks {
  linkedin?: string;
  twitter?: string;
  github?: string;
  facebook?: string;
}

export interface EmergencyContact {
  firstName: string;
  middleName?: string;
  lastName: string;
  relationship: string;
  phoneNumber: string;
  email?: string;
  address: string;
}

// ============================================================================
// Authentication State Types
// ============================================================================

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  loginAttempts: number;
  lastActivity: number;
  sessionExpiry: number | null;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  notifications: Notification[];
  modals: ModalState;
  loading: LoadingState;
  errors: ErrorState;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  actions?: NotificationAction[];
  createdAt: number;
}

export interface NotificationAction {
  label: string;
  action: string;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface ModalState {
  [key: string]: {
    isOpen: boolean;
    data?: any;
    options?: ModalOptions;
  };
}

export interface ModalOptions {
  closable?: boolean;
  backdrop?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  position?: 'center' | 'top' | 'bottom';
}

export interface LoadingState {
  global: boolean;
  [key: string]: boolean;
}

export interface ErrorState {
  global: string | null;
  [key: string]: string | null;
}

// ============================================================================
// API Types
// ============================================================================

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
  timestamp: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// Store Types
// ============================================================================

export interface RootState {
  auth: AuthState;
  ui: UIState;
  // Additional slices will be added here as needed
}

// ============================================================================
// Utility Types
// ============================================================================

export type AppDispatch = any; // Will be properly typed in store configuration
export type AppThunk = any; // Will be properly typed in store configuration

export interface AsyncThunkConfig {
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: ApiError;
}

// ============================================================================
// Form Types
// ============================================================================

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  // Personal Information
  firstName: string;
  middleName?: string;
  lastName: string;
  nameExtension?: string;
  gender: string;
  civilStatus: string;
  srn: string;
  nationality: string;
  birthDate: string;
  placeOfBirth: string;
  completeAddress: string;
  
  // Contact Information
  email: string;
  phoneNumber: string;
  
  // Username & Password
  username: string;
  password: string;
  confirmPassword: string;
  
  // Marketing
  couponCode?: string;
  
  // Emergency Contact
  emergencyFirstName: string;
  emergencyMiddleName?: string;
  emergencyLastName: string;
  emergencyContactNumber: string;
  emergencyRelationship: string;
  emergencyCompleteAddress: string;
  
  // Terms
  agreeToTerms: boolean;
}

// ============================================================================
// Export all types
// ============================================================================

export * from './api';
export * from './auth';
export * from './ui';
