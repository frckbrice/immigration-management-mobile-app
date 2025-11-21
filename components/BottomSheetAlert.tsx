import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetModal as BottomSheetModalType } from "@gorhom/bottom-sheet";
import { useAppTheme, useThemeColors } from "@/lib/hooks/useAppTheme";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "./IconSymbol";

export type BottomSheetAlertAction = {
  text: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "destructive";
};

export type BottomSheetAlertOptions = {
  title?: string;
  message?: string;
  actions?: BottomSheetAlertAction[];
  icon?: string;
  iconColor?: string;
  type?: "success" | "error" | "info" | "warning";
};

type BottomSheetAlertContextType = {
  showAlert: (opts: BottomSheetAlertOptions) => void;
  hideAlert: () => void;
};

const BottomSheetAlertContext = createContext<
  BottomSheetAlertContextType | undefined
>(undefined);

export const useBottomSheetAlert = (): BottomSheetAlertContextType => {
  const ctx = useContext(BottomSheetAlertContext);
  if (!ctx)
    throw new Error(
      "useBottomSheetAlert must be used within BottomSheetAlertProvider",
    );
  return ctx;
};

const MaybeBottomSheetModalProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  if (typeof BottomSheetModalProvider === "function") {
    return <BottomSheetModalProvider>{children}</BottomSheetModalProvider>;
  }
  return <>{children}</>;
};

export const BottomSheetAlertProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const theme = useAppTheme();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModalType>(null);
  // Bottom padding for safe area (tab bar is handled by bottomInset)
  const bottomPadding = useMemo(
    () => Math.max(insets.bottom, 20),
    [insets.bottom],
  );
  // Use larger snap points to accommodate multiple tier buttons
  const snapPoints = useMemo(() => ["50%", "70%"], []);

  const [content, setContent] = useState<BottomSheetAlertOptions | null>(null);

  const hideAlert = useCallback(() => {
    try {
      sheetRef.current?.dismiss();
    } catch (error) {
      console.warn("Failed to dismiss bottom sheet:", error);
    }
    setContent(null);
  }, []);

  const showAlert = useCallback(
    (opts: BottomSheetAlertOptions) => {
      const normalized: BottomSheetAlertOptions = {
        title: opts.title,
        message: opts.message,
        actions:
          opts.actions && opts.actions.length > 0
            ? opts.actions
            : [{ text: t("common.close") }],
        icon: opts.icon,
        iconColor: opts.iconColor,
        type: opts.type,
      };

      // Set content first
      setContent(normalized);

      // Use requestAnimationFrame + setTimeout to ensure the state is updated and DOM is ready
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            if (sheetRef.current) {
              // Present the sheet - it will use the first snapPoint
              sheetRef.current.present();
            } else {
              // Retry once after a short delay if ref is not ready
              setTimeout(() => {
                if (sheetRef.current) {
                  sheetRef.current.present();
                }
              }, 100);
            }
          } catch (error) {
            // Silent fail - user will see error in UI if needed
          }
        }, 50);
      });
    },
    [t],
  );

  const backdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
      />
    ),
    [],
  );

  const value = useMemo(
    () => ({ showAlert, hideAlert }),
    [showAlert, hideAlert],
  );

  return (
    <MaybeBottomSheetModalProvider>
      <BottomSheetAlertContext.Provider value={value}>
        {children}

        <BottomSheetModal
          ref={sheetRef}
          snapPoints={snapPoints}
          enablePanDownToClose
          enableDynamicSizing={false}
          backdropComponent={content ? backdrop : undefined}
          handleIndicatorStyle={{
            backgroundColor: theme.dark ? "#666" : "#999",
          }}
          backgroundStyle={{
            backgroundColor: theme.dark ? "#1C1C1E" : "#FFFFFF",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
          bottomInset={bottomPadding}
          android_keyboardInputMode="adjustResize"
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          onDismiss={() => {
            setContent(null);
          }}
          enableContentPanningGesture={false}
        >
          <BottomSheetView
            style={{
              paddingBottom: bottomPadding,
              backgroundColor: theme.dark ? "#1C1C1E" : "#FFFFFF",
            }}
          >
            {content && (
              <View
                style={[styles.container, { backgroundColor: "transparent" }]}
              >
                {/* Icon Container */}
                {(content.icon || content.type) && (
                  <View style={styles.iconContainer}>
                    {content.icon ? (
                      <View
                        style={[
                          styles.iconCircle,
                          content.type === "success" && {
                            backgroundColor: "rgba(76, 175, 80, 0.1)",
                          },
                          content.type === "error" && {
                            backgroundColor: theme.dark
                              ? "rgba(244, 67, 54, 0.1)"
                              : "rgba(244, 67, 54, 0.1)",
                          },
                          content.type === "info" && {
                            backgroundColor: theme.dark
                              ? "rgba(33, 150, 243, 0.1)"
                              : "rgba(33, 150, 243, 0.1)",
                          },
                          !content.type && {
                            backgroundColor: theme.dark
                              ? "rgba(33, 150, 243, 0.1)"
                              : "rgba(33, 150, 243, 0.1)",
                          },
                        ]}
                      >
                        <IconSymbol
                          name={content.icon}
                          size={64}
                          color={
                            content.iconColor ||
                            (content.type === "success"
                              ? "#4CAF50"
                              : content.type === "error"
                                ? colors.danger
                                : colors.primary)
                          }
                        />
                      </View>
                    ) : content.type === "success" ? (
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: "rgba(76, 175, 80, 0.1)" },
                        ]}
                      >
                        <IconSymbol
                          name="checkmark.circle.fill"
                          size={64}
                          color="#4CAF50"
                        />
                      </View>
                    ) : content.type === "error" ? (
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: "rgba(244, 67, 54, 0.1)" },
                        ]}
                      >
                        <IconSymbol
                          name="exclamationmark.triangle.fill"
                          size={64}
                          color={colors.danger}
                        />
                      </View>
                    ) : content.type === "info" ? (
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: "rgba(33, 150, 243, 0.1)" },
                        ]}
                      >
                        <IconSymbol
                          name="info.circle.fill"
                          size={64}
                          color={colors.primary}
                        />
                      </View>
                    ) : null}
                  </View>
                )}
                {content.title ? (
                  <Text
                    style={[
                      styles.title,
                      { color: theme.dark ? "#FFFFFF" : "#000000" },
                    ]}
                  >
                    {content.title}
                  </Text>
                ) : null}
                {content.message ? (
                  <Text
                    style={[
                      styles.message,
                      { color: theme.dark ? "#E4E6EB" : "#65676B" },
                    ]}
                  >
                    {content.message}
                  </Text>
                ) : null}

                {content.actions && content.actions.length > 0 && (
                  <View style={styles.actionsContainer}>
                    {content.actions.map((action, idx) => (
                      <Pressable
                        key={`${action.text}-${idx}`}
                        onPress={() => {
                          hideAlert();
                          // Small delay to ensure alert is dismissed before navigation
                          setTimeout(() => {
                            action.onPress?.();
                          }, 100);
                        }}
                        style={[
                          styles.actionButton,
                          action.variant === "primary" && {
                            backgroundColor: colors.primary,
                            shadowColor: colors.primary,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 4,
                            elevation: 3,
                          },
                          action.variant === "secondary" && {
                            borderColor: colors.borderStrong,
                            borderWidth: 1.5,
                            backgroundColor: theme.dark
                              ? "rgba(255,255,255,0.05)"
                              : "rgba(0,0,0,0.02)",
                          },
                          action.variant === "destructive" && {
                            backgroundColor: colors.danger,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.actionText,
                            !action.variant && { color: colors.primary },
                            action.variant === "primary" && {
                              color: "#FFFFFF",
                            },
                            action.variant === "secondary" && {
                              color: colors.primary,
                            },
                            action.variant === "destructive" && {
                              color: "#FFFFFF",
                            },
                          ]}
                        >
                          {action.text}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
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
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 30,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  actionsContainer: {
    flexDirection: "column",
    gap: 12,
    marginTop: 4,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "transparent",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
