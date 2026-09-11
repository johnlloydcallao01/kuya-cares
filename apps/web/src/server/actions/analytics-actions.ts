/**
 * @file apps/web/src/server/actions/analytics-actions.ts
 * @description Server actions for analytics tracking and event handling
 */

'use server';

import 'server-only';
import { z } from 'zod';
import type { ServerActionResult, AnalyticsEventData } from '../types/server-types';
import { validateServerRequest, handleServerError } from '../utils/server-utils';

// ========================================
// VALIDATION SCHEMAS
// ========================================

const AnalyticsEventSchema = z.object({
  event: z.string().min(1, 'Event name is required'),
  properties: z.record(z.unknown()).default({}),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  page: z.string().optional(),
  referrer: z.string().optional(),
});

const PageViewSchema = z.object({
  page: z.string().min(1, 'Page path is required'),
  title: z.string().optional(),
  referrer: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
});

const ConversionEventSchema = z.object({
  type: z.enum(['contact_form', 'newsletter_signup', 'download', 'custom']),
  value: z.number().optional(),
  currency: z.string().optional(),
  properties: z.record(z.unknown()).default({}),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
});

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
export type PageViewEvent = z.infer<typeof PageViewSchema>;
export type ConversionEvent = z.infer<typeof ConversionEventSchema>;

// ========================================
// SERVER ACTIONS
// ========================================

/**
 * Track a page view
 */
export async function trackPageView(
  pageViewData: PageViewEvent
): Promise<ServerActionResult<AnalyticsEventData>> {
  try {
    // Validate page view data
    const validatedData = PageViewSchema.parse(pageViewData);
    
    // Get request context
    const context = await validateServerRequest();
    
    // Create analytics event
    const analyticsEvent: AnalyticsEventData = {
      event: 'page_view',
      properties: {
        page: validatedData.page,
        title: validatedData.title,
        referrer: validatedData.referrer,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
      userId: validatedData.userId,
      sessionId: validatedData.sessionId || context.sessionId,
      timestamp: new Date().toISOString(),
    };

    // Here you would typically send to your analytics service
    // For example: Google Analytics, Mixpanel, Amplitude, etc.
    console.log('Page view tracked:', analyticsEvent);

    return {
      success: true,
      data: analyticsEvent,
      message: 'Page view tracked successfully',
    };

  } catch (error) {
    return handleServerError(error, 'ANALYTICS_PAGE_VIEW_ERROR');
  }
}

/**
 * Track a custom event
 */
export async function trackEvent(
  eventData: AnalyticsEvent
): Promise<ServerActionResult<AnalyticsEventData>> {
  try {
    // Validate event data
    const validatedData = AnalyticsEventSchema.parse(eventData);
    
    // Get request context
    const context = await validateServerRequest();
    
    // Create analytics event
    const analyticsEvent: AnalyticsEventData = {
      event: validatedData.event,
      properties: {
        ...validatedData.properties,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
      userId: validatedData.userId,
      sessionId: validatedData.sessionId || context.sessionId,
      timestamp: new Date().toISOString(),
    };

    // Here you would typically send to your analytics service
    console.log('Custom event tracked:', analyticsEvent);

    return {
      success: true,
      data: analyticsEvent,
      message: 'Event tracked successfully',
    };

  } catch (error) {
    return handleServerError(error, 'ANALYTICS_EVENT_ERROR');
  }
}

/**
 * Track a conversion event
 */
export async function trackConversion(
  conversionData: ConversionEvent
): Promise<ServerActionResult<AnalyticsEventData>> {
  try {
    // Validate conversion data
    const validatedData = ConversionEventSchema.parse(conversionData);
    
    // Get request context
    const context = await validateServerRequest();
    
    // Create analytics event
    const analyticsEvent: AnalyticsEventData = {
      event: 'conversion',
      properties: {
        conversionType: validatedData.type,
        value: validatedData.value,
        currency: validatedData.currency,
        ...validatedData.properties,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
      userId: validatedData.userId,
      sessionId: validatedData.sessionId || context.sessionId,
      timestamp: new Date().toISOString(),
    };

    // Here you would typically send to your analytics service
    console.log('Conversion tracked:', analyticsEvent);

    return {
      success: true,
      data: analyticsEvent,
      message: 'Conversion tracked successfully',
    };

  } catch (error) {
    return handleServerError(error, 'ANALYTICS_CONVERSION_ERROR');
  }
}
