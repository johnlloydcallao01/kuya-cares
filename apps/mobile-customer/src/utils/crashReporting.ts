import { Platform } from 'react-native';

interface CrashReport {
  error: Error;
  errorInfo?: any;
  timestamp: string;
  platform: string;
  appVersion: string;
  userId?: string;
}

class CrashReporter {
  private static instance: CrashReporter;
  private crashes: CrashReport[] = [];

  static getInstance(): CrashReporter {
    if (!CrashReporter.instance) {
      CrashReporter.instance = new CrashReporter();
    }
    return CrashReporter.instance;
  }

  logCrash(error: Error, errorInfo?: any, userId?: string) {
    const crashReport: CrashReport = {
      error,
      errorInfo,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      appVersion: '1.0.0', // You can get this from app.json
      userId,
    };

    this.crashes.push(crashReport);
    
    // Log to console for debugging
    console.error('🚨 CRASH DETECTED:', {
      message: error.message,
      stack: error.stack,
      timestamp: crashReport.timestamp,
      platform: crashReport.platform,
    });

    // In a real app, you would send this to a crash reporting service
    // like Sentry, Bugsnag, or Firebase Crashlytics
    this.sendCrashReport(crashReport);
  }

  private async sendCrashReport(crashReport: CrashReport) {
    try {
      // For now, just log to console
      // In production, replace with actual crash reporting service
      console.log('📤 Sending crash report:', crashReport);
      
      // Example: Send to your backend or crash reporting service
      // await fetch('https://your-api.com/crash-reports', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(crashReport),
      // });
    } catch (reportingError) {
      console.error('Failed to send crash report:', reportingError);
    }
  }

  getCrashes(): CrashReport[] {
    return this.crashes;
  }

  clearCrashes() {
    this.crashes = [];
  }
}

export default CrashReporter;
