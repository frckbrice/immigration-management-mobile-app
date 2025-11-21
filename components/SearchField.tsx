import React, { forwardRef } from "react";
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  Pressable,
  StyleProp,
  ViewStyle,
} from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useAppTheme, useThemeColors } from "@/lib/hooks/useAppTheme";
import { withOpacity } from "@/styles/theme";

interface SearchFieldProps extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
  onClear?: () => void;
  showClear?: boolean;
}

const SearchField = forwardRef<TextInput, SearchFieldProps>(
  (
    { containerStyle, onClear, showClear = true, style, value, ...rest },
    ref,
  ) => {
    const theme = useAppTheme();
    const colors = useThemeColors();

    const hasValue = (value ?? "").length > 0;

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.dark
              ? colors.surfaceElevated
              : colors.surface,
            borderColor: withOpacity(
              colors.borderStrong,
              theme.dark ? 0.5 : 0.7,
            ),
          },
          containerStyle,
        ]}
      >
        <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
        <TextInput
          ref={ref}
          value={value}
          style={[styles.input, { color: colors.text }, style]}
          placeholderTextColor={withOpacity(colors.text, 0.45)}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
        />
        {showClear && hasValue && (
          <Pressable style={styles.clearButton} onPress={onClear}>
            <IconSymbol
              name="xmark.circle.fill"
              size={18}
              color={withOpacity(colors.text, 0.35)}
            />
          </Pressable>
        )}
      </View>
    );
  },
);

SearchField.displayName = "SearchField";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  clearButton: {
    padding: 4,
  },
});

export default SearchField;
