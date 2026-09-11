/**
 * Responsive Container Component
 * Provides responsive padding and max-width based on screen size
 * Following Google Play Store requirements for tablet optimization
 */

import React from 'react';
import { View, ViewStyle, Text, TextStyle, TouchableOpacity } from 'react-native';
import { useResponsiveStyles, createResponsiveValue, createResponsiveSpacing } from '../hooks/useResponsiveStyles';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  maxWidth?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  centered?: boolean;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  style,
  maxWidth = true,
  padding = 'md',
  centered = false,
}) => {
  const styles = useResponsiveStyles((screenInfo) => {
    const paddingValue = {
      none: 0,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    }[padding];

    return {
      container: {
        width: '100%',
        maxWidth: maxWidth ? createResponsiveValue(screenInfo, {
          mobile: '100%',
          tablet: 768,
          largeTablet: 1024,
          desktop: 1200,
        } as any) : '100%',
        paddingHorizontal: createResponsiveSpacing(screenInfo, paddingValue),
        alignSelf: centered ? 'center' : 'stretch',
      },
    };
  });

  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
};

/**
 * Responsive Grid Component
 * Automatically adjusts columns based on screen size
 */
interface ResponsiveGridProps {
  children: React.ReactNode;
  spacing?: number;
  minItemWidth?: number;
  style?: ViewStyle;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  spacing = 16,
  minItemWidth = 250,
  style,
}) => {
  const styles = useResponsiveStyles((screenInfo) => {
    const availableWidth = screenInfo.width - (createResponsiveSpacing(screenInfo, 16) * 2);
    const columns = Math.floor(availableWidth / (minItemWidth + spacing));
    const actualColumns = Math.max(1, Math.min(columns, createResponsiveValue(screenInfo, {
      mobile: 1,
      tablet: 2,
      largeTablet: 3,
      desktop: 4,
    })));

    return {
      container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -spacing / 2,
      },
      item: {
        width: `${100 / actualColumns}%`,
        paddingHorizontal: spacing / 2,
        marginBottom: spacing,
      },
    };
  });

  const childrenArray = React.Children.toArray(children);

  return (
    <View style={[styles.container, style]}>
      {childrenArray.map((child, index) => (
        <View key={index} style={styles.item}>
          {child}
        </View>
      ))}
    </View>
  );
};

/**
 * Responsive Card Component
 * Adapts padding, border radius, and elevation based on screen size
 */
interface ResponsiveCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
}

export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  children,
  style,
  elevation = 'md',
}) => {
  const styles = useResponsiveStyles((screenInfo) => {
    const elevationValue = {
      none: 0,
      sm: 2,
      md: 4,
      lg: 8,
    }[elevation];

    return {
      card: {
        backgroundColor: 'white',
        borderRadius: createResponsiveValue(screenInfo, {
          mobile: 8,
          tablet: 12,
          largeTablet: 16,
        }),
        padding: createResponsiveSpacing(screenInfo, 16),
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: elevationValue / 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: elevationValue,
        elevation: elevationValue,
        borderWidth: 1,
        borderColor: '#f3f4f6',
      },
    };
  });

  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
};

/**
 * Responsive Text Component
 * Automatically adjusts font size based on screen size
 */

interface ResponsiveTextProps {
  children: React.ReactNode;
  variant?: 'caption' | 'body' | 'subtitle' | 'title' | 'headline';
  style?: TextStyle;
}

export const ResponsiveText: React.FC<ResponsiveTextProps> = ({
  children,
  variant = 'body',
  style,
}) => {
  const styles = useResponsiveStyles((screenInfo) => {
    const baseSizes = {
      caption: 12,
      body: 16,
      subtitle: 18,
      title: 24,
      headline: 32,
    };

    const fontSize = baseSizes[variant];
    const responsiveFontSize = createResponsiveValue(screenInfo, {
      mobile: fontSize,
      tablet: fontSize * 1.1,
      largeTablet: fontSize * 1.2,
    });

    return {
      text: {
        fontSize: responsiveFontSize,
        lineHeight: responsiveFontSize * 1.4,
        color: '#1f2937',
      },
    };
  });

  return (
    <Text style={[styles.text, style]}>
      {children}
    </Text>
  );
};

/**
 * Responsive Button Component
 * Adapts size and padding based on screen size
 */

interface ResponsiveButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  disabled?: boolean;
}

export const ResponsiveButton: React.FC<ResponsiveButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  style,
  disabled = false,
}) => {
  const styles = useResponsiveStyles((screenInfo) => {
    const sizeConfig = {
      sm: { padding: 8, fontSize: 14 },
      md: { padding: 12, fontSize: 16 },
      lg: { padding: 16, fontSize: 18 },
    }[size];

    const variantConfig = {
      primary: { backgroundColor: '#f3a823', color: 'white' },
      secondary: { backgroundColor: '#6b7280', color: 'white' },
      outline: { backgroundColor: 'transparent', color: '#f3a823', borderWidth: 1, borderColor: '#f3a823' },
    }[variant];

    return {
      button: {
        ...variantConfig,
        paddingHorizontal: createResponsiveSpacing(screenInfo, sizeConfig.padding * 2),
        paddingVertical: createResponsiveSpacing(screenInfo, sizeConfig.padding),
        borderRadius: createResponsiveValue(screenInfo, {
          mobile: 8,
          tablet: 10,
          largeTablet: 12,
        }),
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: createResponsiveValue(screenInfo, {
          mobile: 44,
          tablet: 48,
          largeTablet: 52,
        }),
        opacity: disabled ? 0.6 : 1,
      },
      text: {
        fontSize: createResponsiveValue(screenInfo, {
          mobile: sizeConfig.fontSize,
          tablet: sizeConfig.fontSize * 1.1,
          largeTablet: sizeConfig.fontSize * 1.2,
        }),
        fontWeight: '600',
        color: variantConfig.color,
      },
    };
  });

  return (
    <TouchableOpacity 
      style={[styles.button, style]} 
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.text}>{children}</Text>
    </TouchableOpacity>
  );
};
