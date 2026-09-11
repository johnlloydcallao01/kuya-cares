/**
 * Professional Responsive Design System for React Native
 * Based on Google Play Store requirements and Android Developer Guidelines
 * 
 * Breakpoints follow Material Design and Android guidelines:
 * - Mobile: < 600dp
 * - Tablet: 600dp - 840dp  
 * - Large Tablet: 840dp - 1200dp
 * - Desktop: > 1200dp
 */

import { useWindowDimensions } from 'react-native';

// Professional breakpoints based on Android Developer Guidelines
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 600,
  largeTablet: 840,
  desktop: 1200,
} as const;

// Device types for better semantic naming
export type DeviceType = 'mobile' | 'tablet' | 'largeTablet' | 'desktop';

// Screen size categories
export interface ScreenInfo {
  width: number;
  height: number;
  deviceType: DeviceType;
  isTablet: boolean;
  isLargeScreen: boolean;
  orientation: 'portrait' | 'landscape';
}

/**
 * Custom hook for responsive design
 * Returns screen information and device type detection
 */
export const useResponsive = (): ScreenInfo => {
  const { width, height } = useWindowDimensions();
  
  const getDeviceType = (screenWidth: number): DeviceType => {
    if (screenWidth >= BREAKPOINTS.desktop) return 'desktop';
    if (screenWidth >= BREAKPOINTS.largeTablet) return 'largeTablet';
    if (screenWidth >= BREAKPOINTS.tablet) return 'tablet';
    return 'mobile';
  };

  const deviceType = getDeviceType(width);
  const isTablet = deviceType === 'tablet' || deviceType === 'largeTablet';
  const isLargeScreen = deviceType === 'largeTablet' || deviceType === 'desktop';
  const orientation = width > height ? 'landscape' : 'portrait';

  return {
    width,
    height,
    deviceType,
    isTablet,
    isLargeScreen,
    orientation,
  };
};

/**
 * Responsive value selector
 * Returns different values based on device type
 */
export const responsive = <T>(deviceType: DeviceType, values: {
  mobile: T;
  tablet?: T;
  largeTablet?: T;
  desktop?: T;
}) => {
  switch (deviceType) {
    case 'desktop':
      return values.desktop ?? values.largeTablet ?? values.tablet ?? values.mobile;
    case 'largeTablet':
      return values.largeTablet ?? values.tablet ?? values.mobile;
    case 'tablet':
      return values.tablet ?? values.mobile;
    default:
      return values.mobile;
  }
};

export const useResponsiveValue = <T>(values: {
  mobile: T;
  tablet?: T;
  largeTablet?: T;
  desktop?: T;
}) => {
  const { deviceType } = useResponsive();
  return responsive(deviceType, values);
};

/**
 * Responsive spacing system
 * Based on Material Design spacing guidelines
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

/**
 * Get responsive spacing based on device type
 */
export const getResponsiveSpacing = (
  size: keyof typeof spacing,
  screenInfo: Pick<ScreenInfo, 'isTablet' | 'isLargeScreen'>
) => {
  const { isTablet, isLargeScreen } = screenInfo;
  const baseSpacing = spacing[size];
  
  if (isLargeScreen) {
    return baseSpacing * 1.5; // 50% larger for large screens
  }
  
  if (isTablet) {
    return baseSpacing * 1.25; // 25% larger for tablets
  }
  
  return baseSpacing;
};

export const useResponsiveSpacing = (size: keyof typeof spacing) => {
  const screenInfo = useResponsive();
  return getResponsiveSpacing(size, screenInfo);
};

/**
 * Responsive font sizes
 * Following Material Design typography scale
 */
export const typography = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
} as const;

/**
 * Get responsive font size based on device type
 */
export const getResponsiveFontSize = (
  size: keyof typeof typography,
  screenInfo: Pick<ScreenInfo, 'isTablet' | 'isLargeScreen'>
) => {
  const { isTablet, isLargeScreen } = screenInfo;
  const baseFontSize = typography[size];
  
  if (isLargeScreen) {
    return baseFontSize * 1.2; // 20% larger for large screens
  }
  
  if (isTablet) {
    return baseFontSize * 1.1; // 10% larger for tablets
  }
  
  return baseFontSize;
};

export const useResponsiveFontSize = (size: keyof typeof typography) => {
  const screenInfo = useResponsive();
  return getResponsiveFontSize(size, screenInfo);
};

/**
 * Responsive layout dimensions
 */
export const layout = {
  // Maximum content width for readability
  maxContentWidth: {
    mobile: '100%',
    tablet: 768,
    largeTablet: 1024,
    desktop: 1200,
  },
  
  // Grid columns for different screen sizes
  gridColumns: {
    mobile: 1,
    tablet: 2,
    largeTablet: 3,
    desktop: 4,
  },
  
  // Header heights
  headerHeight: {
    mobile: 56,
    tablet: 64,
    largeTablet: 72,
    desktop: 80,
  },
} as const;

/**
 * Get responsive layout value
 */
export const getResponsiveLayout = <K extends keyof typeof layout>(
  property: K,
  deviceType: DeviceType
): any => {
  return layout[property][deviceType];
};

export const useResponsiveLayout = <K extends keyof typeof layout>(property: K) => {
  const { deviceType } = useResponsive();
  return getResponsiveLayout(property, deviceType);
};
