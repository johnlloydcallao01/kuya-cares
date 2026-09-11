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
export function LoadingProvider({ children }: LoadingProviderProps): React.ReactNode {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Check if this is a full page reload or direct URL visit
    const navigationEntries = window.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const isFullPageLoad = !navigationEntries[0] ||
      navigationEntries[0].type === 'reload' ||
      navigationEntries[0].type === 'navigate';

    // Only show loading screen for non-authenticated full page loads
    // Skip loading screen if user is already authenticated (has cached data)
    if (isFullPageLoad) {
      const hasAuthToken = localStorage.getItem('grandline_auth_token');
      const hasCachedUser = localStorage.getItem('grandline_auth_user');
      
      // Skip loading screen if user has valid cached authentication
      if (hasAuthToken && hasCachedUser) {
        setIsLoading(false);
        return;
      }

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
      }, 2000); // Reduced from 3 seconds to 2 seconds

      return () => {
        clearInterval(progressInterval);
        clearTimeout(autoHideTimeout);
      };
    } else {
      setIsLoading(false);
    }
  }, []); // Run once on mount

  const showLoadingScreen = () => {
    setIsLoading(true);
    setProgress(10);
  };

  const hideLoadingScreen = () => {
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
