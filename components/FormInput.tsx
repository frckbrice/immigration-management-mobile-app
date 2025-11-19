import React, { forwardRef, useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    TextInputProps,
    StyleProp,
    ViewStyle,
} from 'react-native';
import { useAppTheme, useThemeColors } from "@/lib/hooks/useAppTheme";
import { withOpacity } from "@/styles/theme";
import { IconSymbol } from './IconSymbol';

type FormInputProps = TextInputProps & {
    label?: string;
    helperText?: string;
    errorText?: string;
    containerStyle?: StyleProp<ViewStyle>;
    labelRight?: React.ReactNode;
    enablePasswordToggle?: boolean;
};

const FormInput = forwardRef<TextInput, FormInputProps>((
    {
        label,
        helperText,
        errorText,
        containerStyle,
        labelRight,
        style,
        enablePasswordToggle,
        secureTextEntry,
        onFocus,
        onBlur,
        ...rest
    },
    ref,
) => {
    const theme = useAppTheme();
    const colors = useThemeColors();
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setPasswordVisible] = useState(false);

    const showPasswordToggle = useMemo(() => {
        if (enablePasswordToggle) {
            return true;
        }
        return Boolean(secureTextEntry || rest.textContentType === 'password');
    }, [enablePasswordToggle, rest.textContentType, secureTextEntry]);

    const resolvedSecureEntry = showPasswordToggle ? !isPasswordVisible : secureTextEntry;

    const palette = useMemo(() => {
        const baseText = colors.text;
        const softFill = theme.dark
            ? withOpacity(colors.surfaceAlt ?? colors.surface, 0.6)
            : withOpacity(baseText, 0.05);
        const borderNeutral = theme.dark
            ? withOpacity(colors.onSurface ?? baseText, 0.2)
            : withOpacity(baseText, 0.08);

        return {
            borderDefault: borderNeutral,
            borderFocused: colors.primary,
            borderError: colors.danger,
            surface: colors.surface,
            surfaceSoft: softFill,
            textMuted: colors.muted,
            placeholder: withOpacity(
                theme.dark ? (colors.onSurface ?? baseText) : baseText,
                theme.dark ? 0.45 : 0.35,
            ),
        };
    }, [colors, theme.dark]);

    const borderColor = errorText
        ? palette.borderError
        : isFocused
            ? palette.borderFocused
            : palette.borderDefault;

    return (
        <View style={[styles.container, containerStyle]}>
            {label ? (
                <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
                    {labelRight ? <View style={styles.labelRight}>{labelRight}</View> : null}
                </View>
            ) : null}

            <View
                style={[
                    styles.inputWrapper,
                    {
                        borderColor,
                        borderWidth: StyleSheet.hairlineWidth * 2,
                        backgroundColor: isFocused ? palette.surface : palette.surfaceSoft,
                        shadowOpacity: isFocused ? 0.08 : 0,
                    },
                ]}
            >
                <TextInput
                    ref={ref}
                    style={[
                        styles.input,
                        { color: colors.text },
                        style,
                    ]}
                    placeholderTextColor={palette.placeholder}
                    onFocus={(event) => {
                        setIsFocused(true);
                        onFocus?.(event);
                    }}
                    onBlur={(event) => {
                        setIsFocused(false);
                        onBlur?.(event);
                    }}
                    secureTextEntry={resolvedSecureEntry}
                    {...rest}
                />

                {showPasswordToggle ? (
                    <Pressable
                        style={styles.iconButton}
                        onPress={() => setPasswordVisible((v) => !v)}
                        hitSlop={10}
                    >
                        <IconSymbol
                            name={isPasswordVisible ? 'eye.slash.fill' : 'eye.fill'}
                            size={18}
                            color={palette.placeholder}
                        />
                    </Pressable>
                ) : null}
            </View>

            {errorText ? (
                <Text style={[styles.errorText, { color: palette.borderError }]}>{errorText}</Text>
            ) : helperText ? (
                <Text style={[styles.helperText, { color: palette.textMuted }]}>{helperText}</Text>
            ) : null}
        </View>
    );
});

FormInput.displayName = 'FormInput';

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 20,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    labelRight: {
        marginLeft: 12,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 18,
        minHeight: 56,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 24,
        elevation: 0,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        letterSpacing: 0.2,
    },
    iconButton: {
        marginLeft: 12,
        paddingVertical: 6,
        paddingLeft: 6,
    },
    helperText: {
        fontSize: 13,
        marginTop: 6,
    },
    errorText: {
        fontSize: 13,
        marginTop: 6,
    },
});

export default FormInput;

