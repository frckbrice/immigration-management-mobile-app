import { DarkTheme, DefaultTheme, Theme } from "@react-navigation/native";

type ExtendedColorKeys =
  | "secondary"
  | "surface"
  | "surfaceAlt"
  | "surfaceElevated"
  | "backdrop"
  | "onPrimary"
  | "onSurface"
  | "muted"
  | "mutedAlt"
  | "borderStrong"
  | "success"
  | "warning"
  | "danger"
  | "accent";

export type AppThemeColors = Theme["colors"] &
  Record<ExtendedColorKeys, string>;

export type AppTheme = Omit<Theme, "colors"> & {
  colors: AppThemeColors;
};

// export const palette = {
//     primary: "#2196F3",
//     primaryDark: "#1D4ED8",
//     primaryLight: "#64B5F6",
//     background: "#F5F7FB",
//     backgroundDark: "#0B1220",
//     backgroundMutedLight: "#E2E8F0",
//     backgroundMutedDark: "#1E293B",
//     surface: "#FFFFFF",
//     surfaceAltLight: "#F1F5F9",
//     surfaceAltDark: "#111827",
//     text: "#0F172A",
//     textSecondary: "#475569",
//     textMuted: "#64748B",
//     textDark: "#E2E8F0",
//     borderLight: "#CBD5F5",
//     borderDark: "#334155",
//     borderStrongLight: "#94A3B8",
//     borderStrongDark: "#475569",
//     success: "#22C55E",
//     warning: "#FACC15",
//     danger: "#EF4444",
//     accent: "#0EA5E9",
// };

export const palette = {
  // Primary - Messenger Blue
  primary: "#0084FF",
  primaryDark: "#0066CC",
  primaryLight: "#44A3FF",

  // Backgrounds - Clean & Modern
  background: "#FFFFFF",
  backgroundDark: "#000000",
  backgroundMutedLight: "#F0F2F5",
  backgroundMutedDark: "#18191A",

  // Surface - Messenger-inspired
  surface: "#FFFFFF",
  surfaceAltLight: "#F5F6F7",
  surfaceAltDark: "#242526",

  // Text - High contrast for readability
  text: "#050505",
  textSecondary: "#65676B",
  textMuted: "#8A8D91",
  textDark: "#E4E6EB",

  // Borders - Subtle & clean
  borderLight: "#E4E6EB",
  borderDark: "#3E4042",
  borderStrongLight: "#CED0D4",
  borderStrongDark: "#5E6163",

  // Status colors - Modern & vibrant
  success: "#00C853",
  warning: "#FF9800",
  danger: "#F02849",

  // Accent - Messenger gradient start
  accent: "#00B2FF",

  // Additional Messenger-inspired colors
  gradient: {
    start: "#00B2FF",
    end: "#0084FF",
  },

  // Chat bubbles
  messageReceived: "#E4E6EB",
  messageReceivedDark: "#3E4042",
  messageSent: "#0084FF",
  messageSentDark: "#0084FF",

  // Active states
  activeLight: "#E7F3FF",
  activeDark: "#263951",

  // Hover states
  hoverLight: "#F2F3F5",
  hoverDark: "#2C2D2F",
};

export const lightTheme: AppTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.primary,
    background: palette.background,
    card: palette.surface,
    text: palette.text,
    border: palette.borderLight,
    notification: palette.danger,
    secondary: palette.primaryDark,
    surface: palette.surface,
    surfaceAlt: palette.surfaceAltLight,
    surfaceElevated: palette.surface,
    backdrop: "rgba(15, 23, 42, 0.35)",
    onPrimary: "#FFFFFF",
    onSurface: palette.text,
    muted: palette.textMuted,
    mutedAlt: palette.textSecondary,
    borderStrong: palette.borderStrongLight,
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    accent: palette.accent,
  },
};

export const darkTheme: AppTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: palette.primaryLight,
    background: palette.backgroundDark,
    card: palette.surfaceAltDark,
    text: palette.textDark,
    border: palette.borderDark,
    notification: palette.danger,
    secondary: palette.primary,
    surface: palette.surfaceAltDark,
    surfaceAlt: "#141C2A",
    surfaceElevated: "#1F2937",
    backdrop: "rgba(8, 15, 26, 0.6)",
    onPrimary: "#FFFFFF",
    onSurface: palette.textDark,
    muted: "#9CA3AF",
    mutedAlt: "#94A3B8",
    borderStrong: palette.borderStrongDark,
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    accent: palette.accent,
  },
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
};

export type ThemeMode = keyof typeof themes;

const FALLBACK_RGB = { r: 0, g: 0, b: 0 };

const hexToRgb = (hex: string | undefined | null) => {
  if (typeof hex !== "string") {
    return FALLBACK_RGB;
  }

  const normalized = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3,8}$/.test(normalized)) {
    return FALLBACK_RGB;
  }

  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized.length === 4
        ? normalized
            .split("")
            .map((char) => char + char)
            .join("")
        : normalized;

  const bigint = parseInt(expanded, 16);

  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
};

const parseRgbString = (color: string) => {
  const match = color
    .replace(/\s+/g, "")
    .match(/^rgba?\((\d{1,3}),(\d{1,3}),(\d{1,3})(?:,\d*\.?\d+)?\)$/i);

  if (!match) {
    return FALLBACK_RGB;
  }

  const [, r, g, b] = match;

  return {
    r: Math.min(255, parseInt(r, 10)),
    g: Math.min(255, parseInt(g, 10)),
    b: Math.min(255, parseInt(b, 10)),
  };
};

export const withOpacity = (
  color: string | undefined | null,
  opacity: number,
) => {
  if (!color) {
    const { r, g, b } = FALLBACK_RGB;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  const normalized = color.trim();

  if (normalized.toLowerCase() === "transparent") {
    const { r, g, b } = FALLBACK_RGB;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  if (normalized.startsWith("rgb")) {
    const { r, g, b } = parseRgbString(normalized);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  const { r, g, b } = hexToRgb(normalized);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
