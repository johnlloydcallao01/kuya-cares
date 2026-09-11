import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ProductionErrorHandlerProps {
  children: React.ReactNode;
}

interface ErrorState {
  hasError: boolean;
  errorMessage: string;
  errorStack: string;
  timestamp: string;
}

export default function ProductionErrorHandler({ children }: ProductionErrorHandlerProps) {
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    errorMessage: '',
    errorStack: '',
    timestamp: ''
  });

  useEffect(() => {
    // Set up production-safe error monitoring
    const monitorErrors = () => {
      // Monitor for common crash scenarios
      const checkInterval = setInterval(() => {
        try {
          // Test if React is still responsive
          const testElement = React.createElement('div');
          if (!testElement) {
            throw new Error('React rendering failed');
          }
        } catch (error) {
          console.error('🚨 PRODUCTION ERROR DETECTED:', error);
          setErrorState({
            hasError: true,
            errorMessage: error.message || 'Unknown error',
            errorStack: error.stack || 'No stack trace',
            timestamp: new Date().toISOString()
          });
          clearInterval(checkInterval);
        }
      }, 1000);

      return () => clearInterval(checkInterval);
    };

    const cleanup = monitorErrors();
    return cleanup;
  }, []);

  const handleRestart = () => {
    setErrorState({
      hasError: false,
      errorMessage: '',
      errorStack: '',
      timestamp: ''
    });
  };

  const showErrorDetails = () => {
    Alert.alert(
      'Error Details',
      `Time: ${errorState.timestamp}\nPlatform: ${Platform.OS}\nMessage: ${errorState.errorMessage}\n\nStack: ${errorState.errorStack.substring(0, 500)}...`,
      [{ text: 'OK' }]
    );
  };

  if (errorState.hasError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
        <View style={{ 
          flex: 1, 
          padding: 20, 
          justifyContent: 'center', 
          alignItems: 'center' 
        }}>
          <View style={{
            backgroundColor: '#2a2a2a',
            borderRadius: 12,
            padding: 24,
            width: '100%',
            maxWidth: 400,
            borderWidth: 1,
            borderColor: '#ff4444',
          }}>
            <Text style={{
              fontSize: 48,
              textAlign: 'center',
              marginBottom: 16,
            }}>🚨</Text>
            
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: 8,
              color: '#ffffff',
            }}>
              Production Error Detected
            </Text>
            
            <Text style={{
              fontSize: 14,
              textAlign: 'center',
              marginBottom: 16,
              color: '#cccccc',
              fontFamily: 'monospace',
            }}>
              {errorState.errorMessage}
            </Text>

            <Text style={{
              fontSize: 12,
              textAlign: 'center',
              marginBottom: 24,
              color: '#888888',
            }}>
              Time: {errorState.timestamp}
            </Text>

            <TouchableOpacity
              onPress={handleRestart}
              style={{
                backgroundColor: '#ff4444',
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
                marginBottom: 12,
              }}
            >
              <Text style={{
                color: 'white',
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}>
                Restart App
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={showErrorDetails}
              style={{
                backgroundColor: '#333333',
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
              }}
            >
              <Text style={{
                color: 'white',
                fontSize: 14,
                textAlign: 'center',
              }}>
                Show Details
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}
