// Constants
export const COLORS = {
  // Primary Palette
  primary: "#2563EB",
  secondary: "#22C55E",
  accent: "#F97316",

  // Status Colors
  error: "#EF4444",
  success: "#22C55E",
  warning: "#F59E0B",
  info: "#3B82F6",

  // Neutral Palette
  background: "#F5F6F7",
  surface: "#FFFFFF",
  card: "#FAFBFC",

  // Text Colors
  text: "#2C3E50",
  textSecondary: "#7D8A96",
  textTertiary: "#A8B2BD",

  // UI Elements
  border: "#E1E4E8",
  divider: "#EDF0F2",
  disabled: "#C4CDD5",
  overlay: "rgba(44, 62, 80, 0.6)",
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// AsyncStorage Keys
export const STORAGE_KEYS = {
  GET_STARTED_COMPLETED: "get_started_completed",
  ONBOARDING_COMPLETED: "onboarding_completed",
  BIOMETRIC_ENABLED: "biometric_enabled",
  LANGUAGE_PREFERENCE: "language_preference",
  THEME_PREFERENCE: "theme_preference",
} as const;
