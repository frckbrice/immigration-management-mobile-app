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

export type AppThemeColors = Theme["colors"] & Record<ExtendedColorKeys, string>;

export type AppTheme = Omit<Theme, "colors"> & {
    colors: AppThemeColors;
};

export const palette = {
    primary: "#2196F3",
    primaryDark: "#1D4ED8",
    primaryLight: "#64B5F6",
    background: "#F5F7FB",
    backgroundDark: "#0B1220",
    backgroundMutedLight: "#E2E8F0",
    backgroundMutedDark: "#1E293B",
    surface: "#FFFFFF",
    surfaceAltLight: "#F1F5F9",
    surfaceAltDark: "#111827",
    text: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#64748B",
    textDark: "#E2E8F0",
    borderLight: "#CBD5F5",
    borderDark: "#334155",
    borderStrongLight: "#94A3B8",
    borderStrongDark: "#475569",
    success: "#22C55E",
    warning: "#FACC15",
    danger: "#EF4444",
    accent: "#0EA5E9",
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

const hexToRgb = (hex: string) => {
    const normalized = hex.replace("#", "");
    const bigint = parseInt(normalized, 16);
    if (normalized.length === 3) {
        const r = (bigint >> 8) & 0xf;
        const g = (bigint >> 4) & 0xf;
        const b = bigint & 0xf;
        return {
            r: (r << 4) | r,
            g: (g << 4) | g,
            b: (b << 4) | b,
        };
    }

    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255,
    };
};

export const withOpacity = (hexColor: string, opacity: number) => {
    const { r, g, b } = hexToRgb(hexColor);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};


