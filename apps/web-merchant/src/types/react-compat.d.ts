/**
 * React 19 compatibility types for Next.js
 * This file helps resolve type conflicts between React 19 and Next.js 15.4.2
 */

declare global {
  namespace React {
    // Ensure React.ReactNode is compatible with Next.js expectations
    type ReactNode = import('react').ReactNode;
  }
}

export {};
