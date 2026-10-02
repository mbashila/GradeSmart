import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useFormScroll } from './FormScrollView';

function defaultPropsFor({ keyboardType, secureTextEntry }) {
  if (secureTextEntry) {
    return { autoCapitalize: 'none', autoCorrect: false, spellCheck: false, autoComplete: 'password', textContentType: 'password' };
  }
  if (keyboardType === 'email-address') {
    return { autoCapitalize: 'none', autoCorrect: false, spellCheck: false, autoComplete: 'email', textContentType: 'emailAddress' };
  }
  if (keyboardType === 'phone-pad') {
    return { autoComplete: 'tel', textContentType: 'telephoneNumber' };
  }
  return {};
}

const Input = forwardRef(function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  success,
  keyboardType = 'default',
  multiline = false,
  secureTextEntry = false,
  editable = true,
  disabled = false,
  loading = false,
  style,
  inputStyle,
  icon,
  iconName,
  iconColor,
  focusAccessory,
  onFocus,
  onBlur,
  onSelectionChange,
  accessibilityLabel,
  accessibilityHint,
  ...props
}, ref) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const formScroll = useFormScroll();
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const selection = useRef(null);
  const visibilityToggled = useRef(false);
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const isDisabled = disabled || editable === false;
  const errorText = typeof error === 'string' ? error : '';
  const hasError = !!error;
  const hasRightAccessory = secureTextEntry || loading;

  const setInputRef = useCallback((node) => {
    inputRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  useEffect(() => {
    if (!visibilityToggled.current) return;
    visibilityToggled.current = false;
    const sel = selection.current;
    if (sel && inputRef.current?.isFocused?.()) {
      inputRef.current.setSelection?.(sel.start, sel.end);
    }
  }, [revealed]);

  const handleFocus = (e) => {
    setFocused(true);
    formScroll?.focus(containerRef.current);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setFocused(false);
    formScroll?.blur(containerRef.current);
    onBlur?.(e);
  };

  const handleSelectionChange = (e) => {
    selection.current = e.nativeEvent.selection;
    onSelectionChange?.(e);
  };

  const handleContainerLayout = () => {
    if (focused) formScroll?.scrollIntoView(containerRef.current);
  };

  const toggleVisibility = () => {
    visibilityToggled.current = true;
    setRevealed((r) => !r);
  };

  const effectiveKeyboardType = secureTextEntry && revealed && Platform.OS === 'android'
    ? 'visible-password'
    : keyboardType;

  const borderColor = hasError ? colors.error : focused ? colors.secondary : colors.border;
  const leadingIconColor = iconColor || (hasError ? colors.error : focused ? colors.secondary : colors.textLight);

  return (
    <View ref={containerRef} style={[styles.container, style]} onLayout={handleContainerLayout}>
      {label ? (
        <Text style={styles.label} importantForAccessibility="no" accessibilityElementsHidden>
          {label}
        </Text>
      ) : null}
      <View style={[styles.inputWrapper, isDisabled && styles.inputWrapperDisabled]}>
        {icon || (iconName && (
          <View style={styles.iconContainer} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Ionicons name={iconName} size={20} color={leadingIconColor} />
          </View>
        ))}
        <TextInput
          ref={setInputRef}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            (icon || iconName) && styles.inputWithIcon,
            hasRightAccessory && styles.inputWithRightAccessory,
            { borderColor },
            isDisabled && styles.inputDisabled,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          multiline={multiline}
          {...defaultPropsFor({ keyboardType, secureTextEntry })}
          {...props}
          keyboardType={effectiveKeyboardType}
          secureTextEntry={secureTextEntry && !revealed}
          editable={!isDisabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSelectionChange={handleSelectionChange}
          accessibilityLabel={accessibilityLabel || label || placeholder}
          accessibilityHint={errorText || accessibilityHint || helperText}
          accessibilityState={{ disabled: isDisabled, busy: loading }}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={toggleVisibility}
            disabled={isDisabled}
            style={styles.rightAccessory}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={focused ? colors.secondary : colors.textSecondary}
            />
          </Pressable>
        ) : loading ? (
          <View style={styles.rightAccessory} pointerEvents="none">
            <ActivityIndicator size="small" color={colors.secondary} />
          </View>
        ) : null}
      </View>
      {errorText ? (
        <View style={styles.messageRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={colors.error} style={styles.messageIcon} />
          <Text style={styles.error}>{errorText}</Text>
        </View>
      ) : success ? (
        <View style={styles.messageRow} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={14} color={colors.success} style={styles.messageIcon} />
          <Text style={styles.success}>{success}</Text>
        </View>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
      {focused && focusAccessory ? focusAccessory : null}
    </View>
  );
});

const makeStyles = (colors) => StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    ...typography.bodySmall,
    color: colors.text,
    marginBottom: 8,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapperDisabled: {
    opacity: 0.6,
  },
  iconContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    color: colors.text,
    minHeight: 56,
    flex: 1,
  },
  inputWithIcon: {
    paddingLeft: 48,
  },
  inputWithRightAccessory: {
    paddingRight: 52,
  },
  inputMultiline: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  inputDisabled: {
    backgroundColor: colors.surface,
  },
  rightAccessory: {
    position: 'absolute',
    right: 4,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  messageIcon: {
    marginRight: 6,
    marginTop: 1,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '500',
    flex: 1,
  },
  success: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '500',
    flex: 1,
  },
  helper: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 6,
  },
});

export default Input;
