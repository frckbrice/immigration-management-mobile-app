import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useAppTheme } from "@/lib/hooks/useAppTheme";
import { withOpacity } from "@/styles/theme";

type ToastType = "info" | "success" | "error";
type ToastDismiss = () => void;

export interface ToastOptions {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
  exiting: boolean;
  duration: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => ToastDismiss;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
};

const TOAST_DURATION_DEFAULT = 2500;
const TOAST_IN_DURATION = 220;
const TOAST_OUT_DURATION = 200;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const finalizeRemove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const markExiting = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((toast) =>
        toast.id === id ? { ...toast, exiting: true } : toast,
      ),
    );
  }, []);

  const showToast = useCallback(
    ({
      title,
      message,
      type = "info",
      duration = TOAST_DURATION_DEFAULT,
    }: ToastOptions): ToastDismiss => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [
        ...prev,
        { id, title, message, type, duration, exiting: false },
      ]);

      const timeout = setTimeout(() => {
        markExiting(id);
      }, duration);

      return () => {
        clearTimeout(timeout);
        markExiting(id);
      };
    },
    [markExiting],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={styles.host}>
        {toasts.map((toast) => (
          <ToastCard
            key={toast.id}
            toast={toast}
            onFinished={() => finalizeRemove(toast.id)}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onFinished: () => void }> = ({
  toast,
  onFinished,
}) => {
  const theme = useAppTheme();
  const colors = theme.colors;
  const translateY = useSharedValue(16);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: TOAST_IN_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(1, { duration: TOAST_IN_DURATION });
  }, [opacity, translateY]);

  useEffect(() => {
    if (!toast.exiting) {
      return;
    }

    translateY.value = withTiming(
      -12,
      { duration: TOAST_OUT_DURATION, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(onFinished)();
        }
      },
    );
    opacity.value = withTiming(0, { duration: TOAST_OUT_DURATION });
  }, [opacity, onFinished, toast.exiting, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: translateY.value,
      },
    ],
    opacity: opacity.value,
  }));

  const { backgroundColor, borderColor, textColor } = useMemo(() => {
    switch (toast.type) {
      case "success":
        return {
          backgroundColor: "#13dd6e",
          borderColor: "transparent",
          textColor: "#FFFFFF",
        };
      case "error":
        return {
          backgroundColor: "#FCA5A5",
          borderColor: "transparent",
          textColor: "#FFFFFF",
        };
      default:
        // Info toast: use white text on primary background for better readability
        return {
          backgroundColor: colors.primary,
          borderColor: withOpacity(colors.primary, theme.dark ? 0.55 : 0.85),
          textColor: "#FFFFFF",
        };
    }
  }, [colors.primary, theme.dark, toast.type]);

  return (
    <Animated.View
      style={[styles.toast, animatedStyle, { backgroundColor, borderColor }]}
    >
      {toast.title ? (
        <Text style={[styles.toastTitle, { color: textColor }]}>
          {toast.title}
        </Text>
      ) : null}
      <Text style={[styles.toastMessage, { color: textColor }]}>
        {toast.message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    maxWidth: 420,
    width: "100%",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 8,
  },
  toastTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  toastMessage: {
    fontSize: 14,
    lineHeight: 18,
  },
});
