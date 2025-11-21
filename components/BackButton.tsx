import React, { useMemo } from "react";
import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";

import { IconSymbol } from "@/components/IconSymbol";
import { useAppTheme } from "@/lib/hooks/useAppTheme";
import { withOpacity } from "@/styles/theme";

type BackButtonProps = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  hitSlop?:
    | number
    | { top?: number; right?: number; bottom?: number; left?: number };
  iconSize?: number;
  iconColor?: string;
};

export const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  style,
  hitSlop = 10,
  iconSize = 22,
  iconColor,
}) => {
  const theme = useAppTheme();
  const colors = theme.colors;

  const backgroundColor = useMemo(
    () => withOpacity(colors.primary, theme.dark ? 0.22 : 0.12),
    [colors.primary, theme.dark],
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={hitSlop}
      style={[styles.button, { backgroundColor }, style]}
    >
      <IconSymbol
        name="chevron.left"
        size={iconSize}
        color={iconColor ?? colors.text}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
