/**
 * @file apps/web-merchant/src/types/auth.ts
 * @description TypeScript types for vendor authentication
 */

import React from 'react';

// ========================================
// USER TYPES
// ========================================

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  nameExtension?: string | null;
  username?: string | null;
  role: 'admin' | 'customer' | 'service' | 'vendor' | 'driver';
  isActive?: boolean | null;
  gender?: string | null;
  civilStatus?: string | null;
  nationality?: string | null;
  birthDate?: string | null;
  placeOfBirth?: string | null;
  completeAddress?: string | null;
  phone?: string | null;
  lastLogin?: string | null;
  profilePicture?: {
    id: number;
    filename: string;
    url: string;
    alt?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

// Vendor user type (subset of User with the CMS vendor role)
export interface VendorUser extends User {
  role: 'vendor';
}

// ========================================
// AUTHENTICATION RESPONSE TYPES
// ========================================

export interface AuthResponse {
  message: string;
  user: User;
  token?: string;
  exp?: number;
}

export interface VendorAuthResponse extends AuthResponse {
  user: VendorUser;
}

export interface AuthError {
  message: string;
  errors?: Array<{
    message: string;
    field?: string;
  }>;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ========================================
// AUTHENTICATION STATE TYPES
// ========================================

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  checkAuthStatus: () => Promise<boolean>;
  updateUser: (user: User) => void;
}

// ========================================
// API RESPONSE TYPES
// ========================================

export interface PayloadAuthResponse {
  message: string;
  user: User;
  token?: string;
  exp?: number;
}

export interface PayloadErrorResponse {
  errors: Array<{
    message: string;
    field?: string;
  }>;
}

export interface PayloadMeResponse {
  user: User | null;
  exp?: number;
}

// ========================================
// SESSION TYPES
// ========================================

export interface SessionInfo {
  isValid: boolean;
  expiresAt?: Date;
  user?: User;
}

// ========================================
// ROUTE PROTECTION TYPES
// ========================================

export interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

// ========================================
// AUTHENTICATION HOOK TYPES
// ========================================

export interface UseAuthReturn extends AuthContextType {}

// ========================================
// ERROR HANDLING TYPES
// ========================================

export type AuthErrorType = 
  | 'INVALID_CREDENTIALS'
  | 'NETWORK_ERROR'
  | 'SESSION_EXPIRED'
  | 'ACCOUNT_LOCKED'
  | 'VALIDATION_ERROR'
  | 'ACCESS_DENIED'
  | 'UNKNOWN_ERROR';

export interface AuthErrorDetails {
  type: AuthErrorType;
  message: string;
  field?: string;
  retryable?: boolean;
}

// ========================================
// AUTHENTICATION EVENTS
// ========================================

export type AuthEvent = 
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'SESSION_EXPIRED'
  | 'SESSION_REFRESHED'
  | 'AUTH_ERROR'
  | 'ACCESS_DENIED';

export interface AuthEventData {
  event: AuthEvent;
  user?: User;
  error?: AuthErrorDetails;
  timestamp: Date;
}

// ========================================
// VENDOR-SPECIFIC TYPES
// ========================================



// ========================================
// ROLE CHECKING UTILITIES
// ========================================

export type UserRole = User['role'];

export interface RolePermissions {
  canAccessMerchantPortal: boolean;
  canManageUsers: boolean;
  canManageContent: boolean;
  canViewAnalytics: boolean;
  canManageSettings: boolean;
}