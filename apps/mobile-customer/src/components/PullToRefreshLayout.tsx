import React, { ReactNode, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';

interface PullToRefreshLayoutProps extends Omit<ScrollViewProps, 'refreshControl'> {
  children: ReactNode;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean; // Controlled refreshing state (optional)
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * A reusable wrapper component that provides consistent Pull-to-Refresh functionality.
 * 
 * Usage:
 * <PullToRefreshLayout onRefresh={fetchData}>
 *   <YourContent />
 * </PullToRefreshLayout>
 */
export const PullToRefreshLayout: React.FC<PullToRefreshLayoutProps> = ({
  children,
  onRefresh,
  isRefreshing: externalRefreshing,
  style,
  contentContainerStyle,
  ...scrollViewProps
}) => {
  const colors = useThemeColors();
  const [internalRefreshing, setInternalRefreshing] = useState(false);

  // Determine if we are using controlled or uncontrolled refreshing state
  const isRefreshing = externalRefreshing !== undefined ? externalRefreshing : internalRefreshing;

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;

    // If uncontrolled, set internal state
    if (externalRefreshing === undefined) {
      setInternalRefreshing(true);
    }

    try {
      await onRefresh();
    } finally {
      // If uncontrolled, reset internal state
      if (externalRefreshing === undefined) {
        setInternalRefreshing(false);
      }
    }
  }, [onRefresh, externalRefreshing]);

  return (
    <ScrollView
      style={style}
      contentContainerStyle={contentContainerStyle}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]} // Android
            progressBackgroundColor={colors.background} // Android background
          />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  );
};

export default PullToRefreshLayout;
