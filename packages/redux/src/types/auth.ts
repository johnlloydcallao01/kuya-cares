/**
 * Authentication-related types
 */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthSession {
  id: string;
  userId: string;
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
}

export interface AuthProvider {
  id: string;
  name: string;
  type: 'oauth' | 'saml' | 'local';
  enabled: boolean;
  config?: Record<string, any>;
}

export interface TwoFactorAuth {
  enabled: boolean;
  method: 'sms' | 'email' | 'authenticator';
  backupCodes?: string[];
  lastUsed?: string;
}

export interface SecuritySettings {
  twoFactorAuth: TwoFactorAuth;
  passwordLastChanged: string;
  loginNotifications: boolean;
  sessionTimeout: number;
  allowedDevices?: string[];
}

export interface AuthAuditLog {
  id: string;
  userId: string;
  action: 'login' | 'logout' | 'password_change' | 'profile_update' | 'permission_change';
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  success: boolean;
}
