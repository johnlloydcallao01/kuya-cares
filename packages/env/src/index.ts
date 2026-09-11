import { z } from 'zod';

// ========================================
// LEGACY SCHEMAS (For backward compatibility)
// ========================================

// Legacy shared schema - now empty for compatibility
const sharedEnvSchema = z.object({});

// Legacy web schema - now points to client schema for compatibility
const webEnvSchema = sharedEnvSchema.extend({
  // App Identity
  NEXT_PUBLIC_APP_NAME: z.string().default('Encreasl Marketing'),
  NEXT_PUBLIC_APP_VERSION: z.string().default('1.0.0'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Web Features
  NEXT_PUBLIC_ENABLE_CONTACT_FORM: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_NEWSLETTER: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_BLOG: z.string().transform(val => val === 'true').default('true'),

  // Marketing & SEO
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: z.string().optional(),
  NEXT_PUBLIC_FACEBOOK_PIXEL_ID: z.string().optional(),
  NEXT_PUBLIC_LINKEDIN_INSIGHT_TAG: z.string().optional(),

  // Contact Information
  NEXT_PUBLIC_CONTACT_EMAIL: z.string().email().optional(),
  NEXT_PUBLIC_CONTACT_PHONE: z.string().optional(),
  NEXT_PUBLIC_BUSINESS_ADDRESS: z.string().optional(),

  // Social Media
  NEXT_PUBLIC_SOCIAL_TWITTER: z.string().url().optional(),
  NEXT_PUBLIC_SOCIAL_LINKEDIN: z.string().url().optional(),
  NEXT_PUBLIC_SOCIAL_FACEBOOK: z.string().url().optional(),
  NEXT_PUBLIC_SOCIAL_INSTAGRAM: z.string().url().optional(),

  // Lead Generation
  NEXT_PUBLIC_HUBSPOT_PORTAL_ID: z.string().optional(),
  NEXT_PUBLIC_MAILCHIMP_LIST_ID: z.string().optional(),

  // Performance
  NEXT_PUBLIC_ENABLE_PWA: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_SERVICE_WORKER: z.string().transform(val => val === 'true').default('true'),

  // Development
  NEXT_PUBLIC_DEBUG_MODE: z.string().transform(val => val === 'true').default('false'),
});

// ========================================
// CLIENT-SIDE SCHEMAS (Available in browser)
// ========================================

const sharedClientEnvSchema = z.object({});

const webClientEnvSchema = sharedClientEnvSchema.extend({
  // App Identity
  NEXT_PUBLIC_APP_NAME: z.string().default('Encreasl Marketing'),
  NEXT_PUBLIC_APP_VERSION: z.string().default('1.0.0'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Web Features
  NEXT_PUBLIC_ENABLE_CONTACT_FORM: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_NEWSLETTER: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_BLOG: z.string().transform(val => val === 'true').default('true'),

  // Marketing & SEO
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: z.string().optional(),
  NEXT_PUBLIC_FACEBOOK_PIXEL_ID: z.string().optional(),
  NEXT_PUBLIC_LINKEDIN_INSIGHT_TAG: z.string().optional(),

  // Contact Information
  NEXT_PUBLIC_CONTACT_EMAIL: z.string().email().optional(),
  NEXT_PUBLIC_CONTACT_PHONE: z.string().optional(),
  NEXT_PUBLIC_BUSINESS_ADDRESS: z.string().optional(),

  // Social Media
  NEXT_PUBLIC_SOCIAL_TWITTER: z.string().url().optional(),
  NEXT_PUBLIC_SOCIAL_LINKEDIN: z.string().url().optional(),
  NEXT_PUBLIC_SOCIAL_FACEBOOK: z.string().url().optional(),
  NEXT_PUBLIC_SOCIAL_INSTAGRAM: z.string().url().optional(),

  // Lead Generation
  NEXT_PUBLIC_HUBSPOT_PORTAL_ID: z.string().optional(),
  NEXT_PUBLIC_MAILCHIMP_LIST_ID: z.string().optional(),

  // Performance
  NEXT_PUBLIC_ENABLE_PWA: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_SERVICE_WORKER: z.string().transform(val => val === 'true').default('true'),

  // Development
  NEXT_PUBLIC_DEBUG_MODE: z.string().transform(val => val === 'true').default('false'),
});

const adminClientEnvSchema = sharedClientEnvSchema.extend({
  // App Identity
  NEXT_PUBLIC_APP_NAME: z.string().default('Encreasl Admin Dashboard'),
  NEXT_PUBLIC_APP_VERSION: z.string().default('1.0.0'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Admin Features
  NEXT_PUBLIC_ENABLE_USER_MANAGEMENT: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_ANALYTICS_DASHBOARD: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_CONTENT_MANAGEMENT: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_CAMPAIGN_MANAGEMENT: z.string().transform(val => val === 'true').default('true'),

  // Security
  NEXT_PUBLIC_REQUIRE_2FA: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_SESSION_TIMEOUT: z.string().transform(val => parseInt(val, 10)).default('3600'),
  NEXT_PUBLIC_MAX_LOGIN_ATTEMPTS: z.string().transform(val => parseInt(val, 10)).default('5'),

  // Admin API
  NEXT_PUBLIC_ADMIN_API_BASE_URL: z.string().url().optional(),

  // Development
  NEXT_PUBLIC_DEBUG_MODE: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_SHOW_DEV_TOOLS: z.string().transform(val => val === 'true').default('true'),
});

// ========================================
// SERVER-SIDE SCHEMAS (Server-only)
// ========================================

const serverEnvSchema = z.object({});

const adminServerEnvSchema = serverEnvSchema.extend({
  // Admin API
  ADMIN_API_BASE_URL: z.string().url().optional(),

  // Database (Admin only)
  ADMIN_DATABASE_URL: z.string().optional(),
  ADMIN_DATABASE_POOL_SIZE: z.string().transform(val => parseInt(val, 10)).default('10'),

  // Admin Services
  ADMIN_SLACK_WEBHOOK_URL: z.string().url().optional(),
  ADMIN_DISCORD_WEBHOOK_URL: z.string().url().optional(),

  // Monitoring
  ADMIN_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ADMIN_ENABLE_AUDIT_LOGS: z.string().transform(val => val === 'true').default('true'),

  // Admin Notifications
  ADMIN_NOTIFICATION_EMAIL: z.string().email().optional(),
  ADMIN_ALERT_EMAIL: z.string().email().optional(),

  // Security Headers
  ADMIN_ENABLE_CSP: z.string().transform(val => val === 'true').default('true'),
  ADMIN_ENABLE_HSTS: z.string().transform(val => val === 'true').default('true'),
});

// ========================================
// COMBINED SCHEMAS (For server-side validation)
// ========================================

const adminEnvSchema = adminClientEnvSchema.merge(adminServerEnvSchema);

// ========================================
// VALIDATION FUNCTIONS
// ========================================

export function validateWebEnv() {
  try {
    return webEnvSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid web environment variables:', error);
    throw new Error('Invalid web environment variables');
  }
}

export function validateWebClientEnv() {
  try {
    return webClientEnvSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid web client environment variables:', error);
    throw new Error('Invalid web client environment variables');
  }
}

export function validateAdminEnv() {
  try {
    return adminEnvSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid admin environment variables:', error);
    throw new Error('Invalid admin environment variables');
  }
}

export function validateAdminClientEnv() {
  try {
    return adminClientEnvSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid admin client environment variables:', error);
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as { issues: Array<{ path: string[]; message: string }> };
      console.error('Validation issues:');
      zodError.issues.forEach((issue, index) => {
        console.error(`  ${index + 1}. ${issue.path.join('.')}: ${issue.message}`);
      });
    }
    throw error;
  }
}

export function validateAdminServerEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('validateAdminServerEnv() can only be called on the server side');
  }
  try {
    return adminServerEnvSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid admin server environment variables:', error);
    throw new Error('Invalid admin server environment variables');
  }
}

export function validateSharedEnv() {
  try {
    return sharedEnvSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid shared environment variables:', error);
    throw new Error('Invalid shared environment variables');
  }
}

// ========================================
// TYPE EXPORTS
// ========================================

export type WebEnv = z.infer<typeof webEnvSchema>;
export type WebClientEnv = z.infer<typeof webClientEnvSchema>;
export type AdminEnv = z.infer<typeof adminEnvSchema>;
export type AdminClientEnv = z.infer<typeof adminClientEnvSchema>;
export type AdminServerEnv = z.infer<typeof adminServerEnvSchema>;
export type SharedEnv = z.infer<typeof sharedEnvSchema>;
export type SharedClientEnv = z.infer<typeof sharedClientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

// ========================================
// UTILITY FUNCTIONS
// ========================================

export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value || defaultValue || '';
}

export function getBooleanEnvVar(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

export function getNumberEnvVar(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
}
