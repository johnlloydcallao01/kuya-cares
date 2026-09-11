/**
 * @file packages/client-services/src/types/auth.ts
 * @description Authentication types for PayloadCMS integration
 */

// ========================================
// USER TYPES
// ========================================

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  phone?: string | null;
  nameExtension?: string | null;
  username?: string | null;
  role: 'admin' | 'instructor' | 'customer';
  isActive?: boolean | null;
  createdAt: string;
  updatedAt: string;
  loginAttempts?: number | null;
  lockUntil?: string | null;
  lastLogin?: string | null;
  // Additional fields from PayloadCMS users collection
  nationality?: string | null;
  birthDate?: string | null;
  placeOfBirth?: string | null;
  completeAddress?: string | null;
  gender?: ('male' | 'female' | 'other' | 'prefer_not_to_say') | null;
  civilStatus?: ('single' | 'married' | 'divorced' | 'widowed' | 'separated') | null;
  profilePicture?: {
    id: number;
    alt?: string | null;
    url: string;
    cloudinaryURL?: string;
    filename: string;
    mimeType: string;
    filesize: number;
    width: number;
    height: number;
  } | null;
  // PayloadCMS auth fields
  resetPasswordToken?: string | null;
  resetPasswordExpiration?: string | null;
  salt?: string | null;
  hash?: string | null;
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
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  token?: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  checkAuthStatus: () => Promise<boolean>;
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

export interface PayloadMeResponse {
  user: User;
  collection: string;
  token?: string;
  exp?: number;
}

export interface SessionInfo {
  token: string;
  user: User;
  expiresAt: number;
}
