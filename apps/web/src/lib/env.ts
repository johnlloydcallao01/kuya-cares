import { validateWebEnv, type WebEnv } from '@encreasl/env';

// Validate environment variables at startup
export const env: WebEnv = validateWebEnv();

// Export commonly used environment variables for easy access
export const {
  NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_APP_URL,

  NEXT_PUBLIC_CONTACT_EMAIL,
  NEXT_PUBLIC_CONTACT_PHONE,
  NEXT_PUBLIC_ENABLE_CONTACT_FORM,
  NEXT_PUBLIC_ENABLE_NEWSLETTER,
  NEXT_PUBLIC_DEBUG_MODE,
} = env;

// Helper functions for common environment checks
export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isTest = process.env.NODE_ENV === 'test';



// Social media links (only include if defined)
export const socialLinks = {
  ...(env.NEXT_PUBLIC_SOCIAL_TWITTER && { twitter: env.NEXT_PUBLIC_SOCIAL_TWITTER }),
  ...(env.NEXT_PUBLIC_SOCIAL_LINKEDIN && { linkedin: env.NEXT_PUBLIC_SOCIAL_LINKEDIN }),
  ...(env.NEXT_PUBLIC_SOCIAL_FACEBOOK && { facebook: env.NEXT_PUBLIC_SOCIAL_FACEBOOK }),
  ...(env.NEXT_PUBLIC_SOCIAL_INSTAGRAM && { instagram: env.NEXT_PUBLIC_SOCIAL_INSTAGRAM }),
};

// Feature flags
export const features = {
  contactForm: env.NEXT_PUBLIC_ENABLE_CONTACT_FORM,
  newsletter: env.NEXT_PUBLIC_ENABLE_NEWSLETTER,
  blog: env.NEXT_PUBLIC_ENABLE_BLOG,
  pwa: env.NEXT_PUBLIC_ENABLE_PWA,
  serviceWorker: env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER,
  debug: env.NEXT_PUBLIC_DEBUG_MODE,
};

// Contact information
export const contactInfo = {
  email: env.NEXT_PUBLIC_CONTACT_EMAIL,
  phone: env.NEXT_PUBLIC_CONTACT_PHONE,
  address: env.NEXT_PUBLIC_BUSINESS_ADDRESS,
};

// Marketing & Analytics
export const analytics = {
  facebookPixel: env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID,
  linkedinInsight: env.NEXT_PUBLIC_LINKEDIN_INSIGHT_TAG,
  googleSiteVerification: env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
};

// Lead generation
export const leadGeneration = {
  hubspotPortalId: env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID,
  mailchimpListId: env.NEXT_PUBLIC_MAILCHIMP_LIST_ID,
};
