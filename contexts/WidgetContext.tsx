import * as React from "react";
import { createContext, useCallback, useContext } from "react";

// Safely import ExtensionStorage - it may not be available on all platforms
let ExtensionStorage: any = null;
try {
  ExtensionStorage = require("@bacons/apple-targets").ExtensionStorage;
} catch (error) {
  // ExtensionStorage is only available on iOS with proper configuration
  // Silently fail if not available
}

type WidgetContextType = {
  refreshWidget: () => void;
};

const WidgetContext = createContext<WidgetContextType | null>(null);

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  // Update widget state whenever what we want to show changes
  React.useEffect(() => {
    if (ExtensionStorage) {
      try {
        // Refresh widget - only if ExtensionStorage is available
        ExtensionStorage.reloadWidget();
      } catch (error) {
        // Silently fail - widgets are optional
        console.debug('Widget reload failed (non-critical):', error);
      }
    }
  }, []);

  const refreshWidget = useCallback(() => {
    if (ExtensionStorage) {
      try {
        ExtensionStorage.reloadWidget();
      } catch (error) {
        console.debug('Widget refresh failed (non-critical):', error);
      }
    }
  }, []);

  return (
    <WidgetContext.Provider value={{ refreshWidget }}>
      {children}
    </WidgetContext.Provider>
  );
}

export const useWidget = () => {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("useWidget must be used within a WidgetProvider");
  }
  return context;
};
