'use client';

import React from 'react';
import Image from 'next/image';

interface FacebookLoadingScreenProps {
  isVisible: boolean;
  progress?: number;
}

/**
 * Meta-style Full Page Loading Screen with Calsiter Inc Branding
 *
 * Features:
 * - Full-screen overlay that covers entire viewport
 * - Meta-style logo animation with company branding
 * - Smooth progress indicator
 * - Only shows on full page reloads, not SPA navigation
 * - Integrates with authentication flow
 * - Uses brand colors: #ab3b43 (accent) and #201a7c (primary)
 */
export function FacebookLoadingScreen({ isVisible, progress = 0 }: FacebookLoadingScreenProps): React.ReactNode {
  if (!isVisible) return null;

  return (
    <div className="facebook-loading-screen">
      {/* Full Screen Overlay */}
      <div className="facebook-loading-overlay">
        <div className="facebook-bg-grid"></div>
        {/* Main Content Container */}
        <div className="facebook-loading-content">
          {/* Company Logo Animation */}
          <div className="facebook-logo-container">
            <div className="facebook-logo">
              {/* @ts-ignore -- Next.js Image component type issue with React 19 */}
              <Image
                src="/logo.png"
                alt="Calsiter Inc Logo"
                width={64}
                height={64}
                className="facebook-logo-image"
                priority
                style={{ objectFit: 'contain' }}
              />
            </div>

            {/* Pulsing Ring Animation */}
            <div className="facebook-pulse-ring"></div>
            <div className="facebook-pulse-ring facebook-pulse-ring-delay"></div>
          </div>

          {/* Loading Text */}
          <div className="facebook-loading-text">
            <h2>Tap2go</h2>
            <p>Loading your experience...</p>
          </div>

          {/* Progress Bar */}
          <div className="facebook-progress-container">
            <div className="facebook-progress-bar">
              <div 
                className="facebook-progress-fill"
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
            <div className="facebook-progress-dots">
              <div className="facebook-dot facebook-dot-1"></div>
              <div className="facebook-dot facebook-dot-2"></div>
              <div className="facebook-dot facebook-dot-3"></div>
            </div>
          </div>
        </div>

        {/* Background Pattern */}
        <div className="facebook-bg-pattern">
          <div className="facebook-bg-circle facebook-bg-circle-1"></div>
          <div className="facebook-bg-circle facebook-bg-circle-2"></div>
          <div className="facebook-bg-circle facebook-bg-circle-3"></div>
        </div>
      </div>
    </div>
  );
}

export default FacebookLoadingScreen;
