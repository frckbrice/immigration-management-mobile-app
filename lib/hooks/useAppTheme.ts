import { useTheme } from "@react-navigation/native";
import { AppTheme } from "@/styles/theme";

export const useAppTheme = () => useTheme() as AppTheme;

export const useThemeColors = () => useAppTheme().colors;
