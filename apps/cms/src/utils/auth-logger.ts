/**
 * @file apps/cms/src/utils/auth-logger.ts
 * @description Enterprise-grade authentication logging utility
 * Provides structured logging for authentication events with security monitoring
 */

interface AuthLogContext {
  requestId: string;
  userId?: string | number;
  email?: string;
  role?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  responseTime?: number;
}

interface SecurityEvent {
  type: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'REFRESH_SUCCESS' | 'REFRESH_FAILURE' | 'ROLE_VIOLATION' | 'RATE_LIMIT_HIT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  context: AuthLogContext;
  additionalData?: Record<string, unknown>;
}

export class AuthLogger {
  private static instance: AuthLogger;
  private logBuffer: SecurityEvent[] = [];
  private readonly MAX_BUFFER_SIZE = 100;

  private constructor() {}

  public static getInstance(): AuthLogger {
    if (!AuthLogger.instance) {
      AuthLogger.instance = new AuthLogger();
    }
    return AuthLogger.instance;
  }

  /**
   * Log authentication success events
   */
  public logLoginSuccess(context: AuthLogContext, additionalData?: Record<string, unknown>): void {
    const event: SecurityEvent = {
      type: 'LOGIN_SUCCESS',
      severity: 'LOW',
      context,
      additionalData
    };

    this.logEvent(event);
  }

  /**
   * Log authentication failure events
   */
  public logLoginFailure(context: AuthLogContext, reason: string, additionalData?: Record<string, unknown>): void {
    const event: SecurityEvent = {
      type: 'LOGIN_FAILURE',
      severity: 'MEDIUM',
      context,
      additionalData: {
        ...additionalData,
        failureReason: reason
      }
    };

    this.logEvent(event);
  }

  /**
   * Log token refresh success events
   */
  public logRefreshSuccess(context: AuthLogContext, additionalData?: Record<string, unknown>): void {
    const event: SecurityEvent = {
      type: 'REFRESH_SUCCESS',
      severity: 'LOW',
      context,
      additionalData
    };

    this.logEvent(event);
  }

  /**
   * Log token refresh failure events
   */
  public logRefreshFailure(context: AuthLogContext, reason: string, additionalData?: Record<string, unknown>): void {
    const event: SecurityEvent = {
      type: 'REFRESH_FAILURE',
      severity: 'MEDIUM',
      context,
      additionalData: {
        ...additionalData,
        failureReason: reason
      }
    };

    this.logEvent(event);
  }

  /**
   * Log role violation attempts (critical security event)
   */
  public logRoleViolation(context: AuthLogContext, attemptedRole: string, actualRole: string): void {
    const event: SecurityEvent = {
      type: 'ROLE_VIOLATION',
      severity: 'CRITICAL',
      context,
      additionalData: {
        attemptedRole,
        actualRole,
        securityIncident: true
      }
    };

    this.logEvent(event);
  }

  /**
   * Log rate limiting events
   */
  public logRateLimitHit(context: AuthLogContext, endpoint: string, additionalData?: Record<string, unknown>): void {
    const event: SecurityEvent = {
      type: 'RATE_LIMIT_HIT',
      severity: 'HIGH',
      context,
      additionalData: {
        ...additionalData,
        endpoint,
        possibleAttack: true
      }
    };

    this.logEvent(event);
  }

  /**
   * Core event logging with structured output
   */
  private logEvent(event: SecurityEvent): void {
    const logEntry = {
      ...event,
      environment: process.env.NODE_ENV || 'unknown',
      service: 'grandline-cms',
      version: '1.0.0',
      logLevel: this.getSeverityLogLevel(event.severity)
    };

    // Console logging with appropriate level
    switch (event.severity) {
      case 'LOW':
        console.log(this.formatLogMessage('✅', event.type, logEntry));
        break;
      case 'MEDIUM':
        console.warn(this.formatLogMessage('⚠️', event.type, logEntry));
        break;
      case 'HIGH':
        console.error(this.formatLogMessage('🚨', event.type, logEntry));
        break;
      case 'CRITICAL':
        console.error(this.formatLogMessage('🔥', event.type, logEntry));
        break;
    }

    // Add to buffer for potential external logging
    this.addToBuffer(event);

    // In production, you would send to external logging service
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalLogger(logEntry);
    }
  }

  /**
   * Format log message for console output
   */
  private formatLogMessage(icon: string, type: string, logEntry: SecurityEvent & { environment: string; service: string; version: string; logLevel: string }): string {
    return `${icon} [${logEntry.context.requestId}] ${type}: ${JSON.stringify({
      userId: logEntry.context.userId,
      email: logEntry.context.email,
      role: logEntry.context.role,
      ipAddress: logEntry.context.ipAddress,
      responseTime: logEntry.context.responseTime,
      timestamp: logEntry.context.timestamp,
      additionalData: logEntry.additionalData
    }, null, 2)}`;
  }

  /**
   * Get log level based on severity
   */
  private getSeverityLogLevel(severity: SecurityEvent['severity']): string {
    switch (severity) {
      case 'LOW': return 'info';
      case 'MEDIUM': return 'warn';
      case 'HIGH': return 'error';
      case 'CRITICAL': return 'error';
      default: return 'info';
    }
  }

  /**
   * Add event to internal buffer
   */
  private addToBuffer(event: SecurityEvent): void {
    this.logBuffer.push(event);
    
    // Maintain buffer size
    if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logBuffer.shift(); // Remove oldest entry
    }
  }

  /**
   * Send to external logging service (Datadog, Splunk, etc.)
   */
  private sendToExternalLogger(logEntry: SecurityEvent & { environment: string; service: string; version: string; logLevel: string }): void {
    // In a real enterprise environment, you would send to:
    // - Datadog
    // - Splunk
    // - ELK Stack
    // - CloudWatch
    // - Custom logging API

    if (process.env.LOGGING_WEBHOOK_URL) {
      fetch(process.env.LOGGING_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LOGGING_API_KEY}`
        },
        body: JSON.stringify(logEntry)
      }).catch(error => {
        console.error('Failed to send log to external service:', error);
      });
    }
  }

  /**
   * Get recent security events (for debugging/monitoring)
   */
  public getRecentEvents(count: number = 10): SecurityEvent[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Get events by severity
   */
  public getEventsBySeverity(severity: SecurityEvent['severity']): SecurityEvent[] {
    return this.logBuffer.filter(event => event.severity === severity);
  }

  /**
   * Clear the log buffer
   */
  public clearBuffer(): void {
    this.logBuffer = [];
  }
}

// Export singleton instance
export const authLogger = AuthLogger.getInstance();

// Define request interface for PayloadCMS Headers
interface PayloadRequestForLogging {
  headers: {
    get(name: string): string | null;
  };
}

// Export helper function to create log context
export function createAuthLogContext(
  requestId: string,
  req: PayloadRequestForLogging,
  userId?: string | number,
  email?: string,
  role?: string,
  responseTime?: number
): AuthLogContext {
  return {
    requestId,
    userId,
    email,
    role,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'Unknown',
    userAgent: req.headers.get('user-agent') || 'Unknown',
    timestamp: new Date().toISOString(),
    responseTime
  };
}
