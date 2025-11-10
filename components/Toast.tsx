import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/lib/hooks/useAppTheme';
import { withOpacity } from '@/styles/theme';

type ToastType = 'info' | 'success' | 'error';

export interface ToastOptions {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, message, type = 'info', duration = 1500 }: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const toast: ToastItem = { id, title, message, type, duration };
      setToasts((prev) => [...prev, toast]);

      const timeout = setTimeout(() => {
        removeToast(id);
      }, duration);

      return () => {
        clearTimeout(timeout);
        removeToast(id);
      };
    },
    [removeToast],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={styles.toastHost}>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onHide={() => removeToast(toast.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onHide: () => void }> = ({ toast, onHide }) => {
  const theme = useAppTheme();
  const colors = theme.colors;
  const animated = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animated, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    return () => {
      Animated.timing(animated, {
        toValue: 0,
        duration: 1500,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(onHide);
    };
  }, [animated, onHide]);

  const containerStyle = useMemo(() => {
    switch (toast.type) {
      case 'success':
        return {
          backgroundColor: theme.dark ? withOpacity(colors.success, 0.7) : colors.success,
          borderColor: withOpacity(colors.success, theme.dark ? 0.6 : 0.4),
        };
      case 'error':
        return {
          backgroundColor: theme.dark ? withOpacity(colors.danger, 0.4) : colors.danger,
          borderColor: withOpacity(colors.danger, theme.dark ? 0.65 : 0.45),
        };
      default:
        return {
          backgroundColor: theme.dark ? colors.surfaceElevated : colors.surface,
          borderColor: withOpacity(colors.borderStrong, theme.dark ? 0.6 : 0.25),
        };
    }
  }, [toast.type, colors.success, colors.danger, colors.surface, colors.surfaceElevated, colors.borderStrong, theme.dark]);

  const textColor = useMemo(() => {
    switch (toast.type) {
      case 'success':
      case 'error':
        return '#000000';
      default:
        return theme.dark ? colors.onSurface : colors.text;
    }
  }, [colors.onSurface, colors.text, theme.dark, toast.type]);

  const translateY = animated.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const opacity = animated;

  return (
    <Animated.View
      style={[
        styles.toastCard,
        containerStyle,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {toast.title ? <Text style={[styles.toastTitle, { color: 'white' }]}>{toast.title}</Text> : null}
      <Text style={[styles.toastMessage, { color: 'white' }]}>{toast.message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastHost: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1000,
    elevation: 1000,
  },
  toastCard: {
    maxWidth: 420,
    width: '100%',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 8,
  },
  toastTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  toastMessage: {
    fontSize: 14,
    lineHeight: 18,
  },
});


