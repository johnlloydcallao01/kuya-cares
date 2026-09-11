/**
 * UI-related types
 */

export interface UITheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  fonts: {
    primary: string;
    secondary: string;
    mono: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
}

export interface UILayout {
  sidebarWidth: number;
  headerHeight: number;
  footerHeight: number;
  containerMaxWidth: number;
  breakpoints: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
}

export interface UIAnimation {
  duration: {
    fast: number;
    normal: number;
    slow: number;
  };
  easing: {
    linear: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
  };
}

export interface UIAccessibility {
  focusVisible: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  screenReaderOnly: boolean;
  keyboardNavigation: boolean;
}

export interface UIPreferences {
  theme: 'light' | 'dark' | 'system';
  layout: 'compact' | 'comfortable' | 'spacious';
  animations: boolean;
  sounds: boolean;
  accessibility: UIAccessibility;
}
