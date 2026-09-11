'use client';

import React, { ReactNode } from 'react';
import { LoadingProvider, useLoading } from './LoadingProvider';
import { FacebookLoadingScreen } from './FacebookLoadingScreen';

interface LoadingScreenWrapperProps {
  children: ReactNode;
}

/**
 * Internal component that renders the loading screen
 */
function LoadingScreenRenderer() {
  const { isLoading, progress } = useLoading();
  
  return (
    <FacebookLoadingScreen 
      isVisible={isLoading} 
      progress={progress} 
    />
  );
}

/**
 * Loading Screen Wrapper Component
 * 
 * This component wraps the entire app and provides:
 * - Loading screen that shows ONLY on full page reloads
 * - Does NOT interfere with SPA navigation
 * - Integrates with authentication flow
 * - Provides global loading state management
 */
export function LoadingScreenWrapper({ children }: LoadingScreenWrapperProps) {
  return (
    <LoadingProvider>
      {children}
      <LoadingScreenRenderer />
    </LoadingProvider>
  );
}

export default LoadingScreenWrapper;
