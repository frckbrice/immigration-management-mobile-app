import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import BottomSheetModal, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type BottomSheetAlertAction = {
  text: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
};

export type BottomSheetAlertOptions = {
  title?: string;
  message?: string;
  actions?: BottomSheetAlertAction[];
};

type BottomSheetAlertContextType = {
  showAlert: (opts: BottomSheetAlertOptions) => void;
  hideAlert: () => void;
};

const BottomSheetAlertContext = createContext<BottomSheetAlertContextType | undefined>(undefined);

export const useBottomSheetAlert = (): BottomSheetAlertContextType => {
  const ctx = useContext(BottomSheetAlertContext);
  if (!ctx) throw new Error('useBottomSheetAlert must be used within BottomSheetAlertProvider');
  return ctx;
};

export const BottomSheetAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  // Add extra bottom padding to account for tab bar (typically 60-80px) + safe area
  const bottomPadding = Platform.OS === 'ios' ? Math.max(insets.bottom, 20) + 80 : 100;
  // Use dynamic sizing instead of fixed snap points for content-based height
  const snapPoints = useMemo(() => ['50%'], []);

  const [content, setContent] = useState<BottomSheetAlertOptions | null>(null);

  const hideAlert = useCallback(() => {
    try {
      if (sheetRef.current && typeof sheetRef.current.dismiss === 'function') {
        sheetRef.current.dismiss();
      }
    } catch (error) {
      console.warn('Failed to dismiss bottom sheet:', error);
    }
    setContent(null);
  }, []);

  const showAlert = useCallback((opts: BottomSheetAlertOptions) => {
    setContent({
      title: opts.title,
      message: opts.message,
      actions: opts.actions && opts.actions.length > 0 ? opts.actions : [{ text: t('common.close') }],
    });
  }, [t]);

  // Present sheet when content is set
  useEffect(() => {
    if (content) {
      // Use a small delay to ensure ref is attached
      const timer = setTimeout(() => {
        try {
          if (sheetRef.current && typeof sheetRef.current.present === 'function') {
            sheetRef.current.present();
          }
        } catch (error) {
          console.warn('Failed to present bottom sheet:', error);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [content]);

  const backdrop = useCallback((props: any) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.5}
    />
  ), []);

  const value = useMemo(() => ({ showAlert, hideAlert }), [showAlert, hideAlert]);

  return (
    <BottomSheetAlertContext.Provider value={value}>
      {children}

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        enableDynamicSizing
        backdropComponent={content ? backdrop : undefined}
        handleIndicatorStyle={{ backgroundColor: theme.dark ? '#666' : '#CCC' }}
        backgroundStyle={{ backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }}
        bottomInset={bottomPadding}
        android_keyboardInputMode="adjustResize"
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onDismiss={() => {
          setContent(null);
        }}
        index={-1}
        enableContentPanningGesture={false}
      >
        <BottomSheetView style={{ paddingBottom: bottomPadding }}>
          {content && (
            <View style={styles.container}>
              {content.title ? (
                <Text style={[styles.title, { color: theme.colors.text }]}>{content.title}</Text>
              ) : null}
              {content.message ? (
                <Text style={[styles.message, { color: theme.dark ? '#98989D' : '#666' }]}>{content.message}</Text>
              ) : null}

              <View style={styles.actionsRow}>
                {(content.actions || []).map((action, idx) => (
                  <Pressable
                    key={`${action.text}-${idx}`}
                    onPress={() => {
                      hideAlert();
                      action.onPress?.();
                    }}
                    style={[
                      styles.actionButton,
                      action.variant === 'primary' && styles.actionPrimary,
                      action.variant === 'destructive' && styles.actionDestructive,
                    ]}
                  >
                    <Text style={[
                      styles.actionText,
                      action.variant === 'primary' ? styles.actionTextPrimary : undefined,
                      action.variant === 'destructive' ? styles.actionTextDestructive : undefined,
                    ]}>
                      {action.text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    </BottomSheetAlertContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
    minWidth: 80,
    alignItems: 'center',
  },
  actionPrimary: {
    backgroundColor: '#2196F3',
  },
  actionDestructive: {
    backgroundColor: '#FF3B30',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionTextPrimary: {
    color: '#fff',
  },
  actionTextDestructive: {
    color: '#fff',
  },
});
