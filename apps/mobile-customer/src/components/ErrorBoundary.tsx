import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CrashReporter from '../utils/crashReporting';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 ErrorBoundary caught an error:', error);
    console.error('🚨 Error Info:', errorInfo);
    console.error('🚨 Error Stack:', error.stack);
    console.error('🚨 Component Stack:', errorInfo.componentStack);

    // Report crash to our crash reporting system
    try {
      CrashReporter.getInstance().logCrash(error, errorInfo);
    } catch (crashReportError) {
      console.error('Failed to report crash:', crashReportError);
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  handleRestart = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 24,
              width: '100%',
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 3,
            }}>
              <Text style={{
                fontSize: 48,
                textAlign: 'center',
                marginBottom: 16,
              }}>😵</Text>
              
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                textAlign: 'center',
                marginBottom: 8,
                color: '#1f2937',
              }}>
                Oops! Something went wrong
              </Text>
              
              <Text style={{
                fontSize: 16,
                textAlign: 'center',
                marginBottom: 24,
                color: '#6b7280',
                lineHeight: 24,
              }}>
                The app encountered an unexpected error. Don{"'"}t worry, this helps us improve the app!
              </Text>

              <TouchableOpacity
                onPress={this.handleRestart}
                style={{
                  backgroundColor: '#f3a823',
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <Text style={{
                  color: 'white',
                  fontSize: 16,
                  fontWeight: '600',
                  textAlign: 'center',
                }}>
                  Try Again
                </Text>
              </TouchableOpacity>

              {__DEV__ && (
                <ScrollView style={{ maxHeight: 200 }}>
                  <Text style={{
                    fontSize: 12,
                    color: '#ef4444',
                    fontFamily: 'monospace',
                    backgroundColor: '#fef2f2',
                    padding: 12,
                    borderRadius: 6,
                  }}>
                    {this.state.error?.toString()}
                    {'\n\n'}
                    {this.state.errorInfo?.componentStack}
                  </Text>
                </ScrollView>
              )}
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}
