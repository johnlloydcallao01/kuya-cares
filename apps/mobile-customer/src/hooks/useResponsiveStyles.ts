/**
 * Professional Responsive Styling Hook for React Native
 * Provides clean, performant responsive styling based on screen dimensions
 * 
 * Usage:
 * const styles = useResponsiveStyles(createStyles);
 * 
 * Where createStyles is a function that receives screen info and returns styles
 */

import { useMemo } from 'react';
import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { useResponsive, ScreenInfo } from '../utils/responsive';

type Style = ViewStyle | TextStyle | ImageStyle;
type StylesObject = { [key: string]: Style };

/**
 * Creates responsive styles based on screen information
 * This approach ensures styles are only recalculated when screen dimensions change
 */
export const useResponsiveStyles = <T extends StylesObject>(
  createStyles: (screenInfo: ScreenInfo) => T
): T => {
  const screenInfo = useResponsive();

  // Memoize styles to prevent unnecessary recalculations
  const styles = useMemo(() => {
    try {
      const styleObject = createStyles(screenInfo);
      return StyleSheet.create(styleObject);
    } catch (styleError) {
      console.warn('Style creation failed, using empty styles:', styleError);
      return {} as T;
    }
  }, [createStyles, screenInfo]);

  return styles;
};

/**
 * Utility function to create responsive style values
 * Returns different values based on device type
 */
export const createResponsiveValue = <T>(
  screenInfo: ScreenInfo,
  values: {
    mobile: T;
    tablet?: T;
    largeTablet?: T;
    desktop?: T;
  }
): T => {
  switch (screenInfo.deviceType) {
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

/**
 * Helper function for responsive padding/margin
 */
export const createResponsiveSpacing = (
  screenInfo: ScreenInfo,
  baseSpacing: number
): number => {
  if (screenInfo.deviceType === 'desktop' || screenInfo.deviceType === 'largeTablet') {
    return baseSpacing * 1.5;
  }
  if (screenInfo.deviceType === 'tablet') {
    return baseSpacing * 1.25;
  }
  return baseSpacing;
};

/**
 * Helper function for responsive font sizes
 */
export const createResponsiveFontSize = (
  screenInfo: ScreenInfo,
  baseFontSize: number
): number => {
  if (screenInfo.deviceType === 'desktop' || screenInfo.deviceType === 'largeTablet') {
    return baseFontSize * 1.2;
  }
  if (screenInfo.deviceType === 'tablet') {
    return baseFontSize * 1.1;
  }
  return baseFontSize;
};

/**
 * Helper function for responsive dimensions
 */
export const createResponsiveDimension = (
  screenInfo: ScreenInfo,
  baseDimension: number
): number => {
  if (screenInfo.deviceType === 'desktop' || screenInfo.deviceType === 'largeTablet') {
    return baseDimension * 1.3;
  }
  if (screenInfo.deviceType === 'tablet') {
    return baseDimension * 1.15;
  }
  return baseDimension;
};

/**
 * Pre-built responsive style generators for common use cases
 */
export const responsiveStyleGenerators = {
  /**
   * Container with responsive padding
   */
  container: (screenInfo: ScreenInfo) => ({
    paddingHorizontal: createResponsiveSpacing(screenInfo, 16),
    paddingVertical: createResponsiveSpacing(screenInfo, 12),
  }),

  /**
   * Card with responsive styling
   */
  card: (screenInfo: ScreenInfo) => ({
    padding: createResponsiveSpacing(screenInfo, 16),
    borderRadius: createResponsiveValue(screenInfo, {
      mobile: 8,
      tablet: 12,
      largeTablet: 16,
    }),
    marginBottom: createResponsiveSpacing(screenInfo, 16),
  }),

  /**
   * Button with responsive styling
   */
  button: (screenInfo: ScreenInfo) => ({
    paddingHorizontal: createResponsiveSpacing(screenInfo, 24),
    paddingVertical: createResponsiveSpacing(screenInfo, 12),
    borderRadius: createResponsiveValue(screenInfo, {
      mobile: 8,
      tablet: 10,
      largeTablet: 12,
    }),
    minHeight: createResponsiveDimension(screenInfo, 44),
  }),

  /**
   * Text with responsive font size
   */
  text: (screenInfo: ScreenInfo, baseFontSize: number = 16) => ({
    fontSize: createResponsiveFontSize(screenInfo, baseFontSize),
    lineHeight: createResponsiveFontSize(screenInfo, baseFontSize) * 1.4,
  }),

  /**
   * Header with responsive height and padding
   */
  header: (screenInfo: ScreenInfo) => ({
    height: createResponsiveValue(screenInfo, {
      mobile: 56,
      tablet: 64,
      largeTablet: 72,
      desktop: 80,
    }),
    paddingHorizontal: createResponsiveSpacing(screenInfo, 16),
    paddingVertical: createResponsiveSpacing(screenInfo, 8),
  }),

  /**
   * Grid item with responsive sizing
   */
  gridItem: (screenInfo: ScreenInfo) => {
    const columns = createResponsiveValue(screenInfo, {
      mobile: 1,
      tablet: 2,
      largeTablet: 3,
      desktop: 4,
    });
    
    const gap = createResponsiveSpacing(screenInfo, 16);
    const width = `${(100 / columns) - (gap * (columns - 1)) / columns}%`;
    
    return {
      width,
      marginBottom: gap,
    };
  },
};

export default useResponsiveStyles;
