import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from '@gorhom/bottom-sheet';
import type { BottomSheetModal as BottomSheetModalType } from '@gorhom/bottom-sheet';
import { useAppTheme, useThemeColors } from '@/lib/hooks/useAppTheme';
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

const MaybeBottomSheetModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (typeof BottomSheetModalProvider === 'function') {
    return <BottomSheetModalProvider>{children}</BottomSheetModalProvider>;
  }
  return <>{children}</>;
};

export const BottomSheetAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useAppTheme();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModalType>(null);
  // Add extra bottom padding to account for tab bar (typically 60-80px) + safe area
  const bottomPadding = Platform.OS === 'ios' ? Math.max(insets.bottom, 20) + 80 : 100;
  // Use dynamic sizing instead of fixed snap points for content-based height
  const snapPoints = useMemo(() => ['50%'], []);

  const [content, setContent] = useState<BottomSheetAlertOptions | null>(null);

  const hideAlert = useCallback(() => {
    try {
      sheetRef.current?.dismiss();
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
          sheetRef.current?.present();
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
    <MaybeBottomSheetModalProvider>
      <BottomSheetAlertContext.Provider value={value}>
        {children}

        <BottomSheetModal
          ref={sheetRef}
          snapPoints={snapPoints}
          enablePanDownToClose
          enableDynamicSizing
          backdropComponent={content ? backdrop : undefined}
          handleIndicatorStyle={{ backgroundColor: colors.muted }}
          backgroundStyle={{ backgroundColor: colors.surface }}
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
                  <Text style={[styles.title, { color: colors.text }]}>{content.title}</Text>
                ) : null}
                {content.message ? (
                  <Text style={[styles.message, { color: colors.muted }]}>{content.message}</Text>
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
                        action.variant === 'primary' && { backgroundColor: colors.primary },
                        action.variant === 'secondary' && { borderColor: colors.borderStrong, borderWidth: 1 },
                        action.variant === 'destructive' && { backgroundColor: colors.danger },
                      ]}
                    >
                      <Text style={[
                        styles.actionText,
                        { color: colors.text },
                        action.variant === 'primary' && { color: colors.onPrimary },
                        action.variant === 'secondary' && { color: colors.primary },
                        action.variant === 'destructive' && { color: colors.onPrimary },
                        !action.variant && { color: colors.primary },
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
    </MaybeBottomSheetModalProvider>
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
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
