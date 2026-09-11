'use client';

import { useEffect } from 'react';

/**
 * Client-side controller for the instant loading screen
 * Handles showing/hiding logic without causing hydration mismatches
 */
export function InstantLoadingController() {
  useEffect(() => {
    // Only show loading screen on full page loads (not SPA navigation)
    const navigationEntries = window.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const isFullPageLoad = !navigationEntries[0] ||
      (navigationEntries[0].type === 'reload') ||
      (navigationEntries[0].type === 'navigate');

    const isAuthPage = window.location.pathname.includes('/signin') ||
                      window.location.pathname.includes('/register');

    const loadingScreen = document.getElementById('instant-loading-screen');
    
    if (!loadingScreen) return;

    // Hide loading screen only if not a full page load or on auth pages
    if (!isFullPageLoad || isAuthPage) {
      loadingScreen.style.display = 'none';
    } else {
      // Show the loading screen for full page loads
      loadingScreen.style.display = 'block';
      
      // Auto-hide after 3 seconds max
      const autoHideTimeout = setTimeout(() => {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.5s ease-out';
        setTimeout(() => {
          loadingScreen.style.display = 'none';
        }, 500);
      }, 3000);

      return () => {
        clearTimeout(autoHideTimeout);
      };
    }
  }, []);

  return null; // This component doesn't render anything
}