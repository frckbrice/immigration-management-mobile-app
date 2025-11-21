import type { AppTheme } from "@/styles/theme";

declare global {
  namespace ReactNavigation {
    interface Theme extends AppTheme {}
  }
}

export {};
