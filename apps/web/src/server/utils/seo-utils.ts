/**
 * @file apps/web/src/server/utils/seo-utils.ts
 * @description Web app specific SEO utilities and metadata generation
 */

import 'server-only';

// ========================================
// WEB APP SEO TYPES
// ========================================

export type WebSEOMetadata = {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  canonicalUrl?: string;
  structuredData?: Record<string, unknown>;
};

// ========================================
// WEB APP SEO UTILITIES
// ========================================

/**
 * Generate metadata for web app pages
 */
export function generateWebMetadata(params: {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  path?: string;
}): WebSEOMetadata {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://encreasl.com';
  
  return {
    title: `${params.title} | Encreasl - Ecommerce Marketing Agency`,
    description: params.description,
    keywords: params.keywords || ['ecommerce', 'marketing', 'agency', 'digital marketing'],
    ogImage: params.image || `${baseUrl}/og-image.jpg`,
    canonicalUrl: params.path ? `${baseUrl}${params.path}` : baseUrl,
    structuredData: generateWebStructuredData({
      title: params.title,
      description: params.description,
      path: params.path,
      image: params.image,
    }),
  };
}

/**
 * Generate structured data for web app
 */
export function generateWebStructuredData(params: {
  title: string;
  description: string;
  path?: string;
  image?: string;
}): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://encreasl.com';
  
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: params.title,
    description: params.description,
    url: params.path ? `${baseUrl}${params.path}` : baseUrl,
    image: params.image || `${baseUrl}/og-image.jpg`,
    publisher: {
      '@type': 'Organization',
      name: 'Encreasl',
      url: baseUrl,
      logo: `${baseUrl}/logo.png`,
      description: 'Ecommerce Marketing Agency',
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: process.env.NEXT_PUBLIC_CONTACT_PHONE || '',
        contactType: 'customer service',
        email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@encreasl.com',
      },
    },
  };
}

/**
 * Generate breadcrumb structured data for web app
 */
export function generateWebBreadcrumbs(breadcrumbs: Array<{
  name: string;
  path: string;
}>): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://encreasl.com';
  
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${baseUrl}${crumb.path}`,
    })),
  };
}

/**
 * Generate FAQ structured data for web app
 */
export function generateWebFAQStructuredData(faqs: Array<{
  question: string;
  answer: string;
}>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate service structured data for web app
 */
export function generateWebServiceStructuredData(service: {
  name: string;
  description: string;
  provider: string;
  areaServed?: string;
  serviceType?: string;
}): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://encreasl.com';
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description,
    provider: {
      '@type': 'Organization',
      name: service.provider,
      url: baseUrl,
    },
    areaServed: service.areaServed || 'Worldwide',
    serviceType: service.serviceType || 'Digital Marketing',
  };
}
