'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  progress: number;
  setLoading: (loading: boolean) => void;
  setProgress: (progress: number) => void;
  showLoadingScreen: () => void;
  hideLoadingScreen: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

interface LoadingProviderProps {
  children: ReactNode;
}

/**
 * Loading Screen Provider
 *
 * Manages the global loading state for the Facebook Meta-style loading screen.
 * This provider:
 * - Shows loading screen on ALL full page reloads (authenticated AND non-authenticated)
 * - Does NOT show during signin/authentication process
 * - Does NOT interfere with SPA navigation
 * - Integrates with authentication flow for smooth transitions
 */
export function LoadingProvider({ children }: LoadingProviderProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Check if this is a full page reload or direct URL visit
    const navigationEntries = window.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const isFullPageLoad = !navigationEntries[0] ||
      navigationEntries[0].type === 'reload' ||
      navigationEntries[0].type === 'navigate';

    // Show loading screen on all full page loads (authenticated AND non-authenticated)
    if (isFullPageLoad) {
      console.log('🔄 LOADING PROVIDER: Full page reload detected, showing loading screen');
      setIsLoading(true);
      setProgress(10); // Start with some progress

      // Simulate initial loading progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90; // Stop at 90%, wait for authentication
          }
          return prev + Math.random() * 10;
        });
      }, 200);

      // Auto-hide after a reasonable time if not manually hidden
      const autoHideTimeout = setTimeout(() => {
        setProgress(100);
        setTimeout(() => {
          setIsLoading(false);
          setProgress(0);
        }, 500);
      }, 3000); // 3 seconds max

      return () => {
        clearInterval(progressInterval);
        clearTimeout(autoHideTimeout);
      };
    } else {
      console.log('🔄 LOADING PROVIDER: No loading screen needed (SPA navigation)');
      setIsLoading(false);
    }
  }, []); // Run once on mount

  const showLoadingScreen = () => {
    console.log('🔄 LOADING PROVIDER: Manually showing loading screen');
    setIsLoading(true);
    setProgress(10);
  };

  const hideLoadingScreen = () => {
    console.log('🔄 LOADING PROVIDER: Hiding loading screen');
    setProgress(100);
    
    // Smooth fade out after reaching 100%
    setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
    }, 500);
  };

  const setLoadingState = (loading: boolean) => {
    if (loading) {
      showLoadingScreen();
    } else {
      hideLoadingScreen();
    }
  };

  const contextValue: LoadingContextType = {
    isLoading,
    progress,
    setLoading: setLoadingState,
    setProgress,
    showLoadingScreen,
    hideLoadingScreen,
  };

  return (
    /* @ts-ignore -- React 19 Context Provider type issue */
    <LoadingContext.Provider value={contextValue}>
      {children}
    </LoadingContext.Provider>
  );
}

/**
 * Hook to use the Loading Context
 */
export function useLoading(): LoadingContextType {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}

export default LoadingProvider;