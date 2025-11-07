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
import { useTheme } from '@react-navigation/native';
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
    const theme = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setPasswordVisible] = useState(false);

    const showPasswordToggle = useMemo(() => {
        if (enablePasswordToggle) {
            return true;
        }
        return Boolean(secureTextEntry || rest.textContentType === 'password');
    }, [enablePasswordToggle, rest.textContentType, secureTextEntry]);

    const resolvedSecureEntry = showPasswordToggle ? !isPasswordVisible : secureTextEntry;

    const palette = useMemo(() => ({
        borderDefault: theme.dark ? '#2C2C2E' : '#E5E7EB',
        borderFocused: theme.colors.primary ?? '#2196F3',
        borderError: '#EF4444',
        surface: theme.dark ? '#111113' : '#F8FAFC',
        textMuted: theme.dark ? '#8E8E93' : '#6B7280',
        placeholder: theme.dark ? '#6C6C70' : '#9CA3AF',
    }), [theme]);

    const borderColor = errorText
        ? palette.borderError
        : isFocused
            ? palette.borderFocused
            : palette.borderDefault;

    return (
        <View style={[styles.container, containerStyle]}>
            {label ? (
                <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
                    {labelRight ? <View style={styles.labelRight}>{labelRight}</View> : null}
                </View>
            ) : null}

            <View
                style={[
                    styles.inputWrapper,
                    {
                        borderColor,
                        backgroundColor: palette.surface,
                        shadowOpacity: isFocused ? 0.08 : 0,
                    },
                ]}
            >
                <TextInput
                    ref={ref}
                    style={[
                        styles.input,
                        { color: theme.colors.text },
                        theme.dark ? styles.inputDark : undefined,
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
                <Text style={styles.errorText}>{errorText}</Text>
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
    inputWrapperError: {
        borderColor: '#EF4444',
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        letterSpacing: 0.2,
    },
    inputDark: {
        color: '#F2F2F7',
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
        color: '#EF4444',
        marginTop: 6,
    },
});

export default FormInput;

