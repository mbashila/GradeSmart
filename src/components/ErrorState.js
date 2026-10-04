import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import { useColors } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useReducedMotion } from './skeletons/shimmer';
import { typography } from '../theme/typography';
import { ErrorCategory, normalizeError } from '../utils/errors';

/**
 * Shared error display with three sizes:
 *   compact    – one line inside a section ("Couldn't sync. [Try Again]")
 *   (default)  – card inside the section that failed
 *   fullScreen – only when the whole screen cannot work
 *
 * Pass `error` to get category-specific copy/icon (offline, timeout, 403, ...);
 * `title` / `message` override it. `onRetry` may return a promise: the button
 * stays disabled showing "Trying again..." until it settles.
 */
export default function ErrorState({
  error,
  action,
  title,
  message,
  icon,
  onRetry,
  retrying = false,
  retryLabel = 'Try Again',
  secondaryAction,
  compact = false,
  fullScreen = false,
  style,
}) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { expireSession } = useAuth();
  const reduceMotion = useReducedMotion();
  const [pending, setPending] = useState(false);
  const mountedRef = useRef(true);
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => () => { mountedRef.current = false; }, []);
  useEffect(() => {
    if (reduceMotion) {
      appear.setValue(1);
      return;
    }
    Animated.timing(appear, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [appear, reduceMotion]);

  const normalized = error ? normalizeError(error, { action }) : null;
  const isSession = normalized?.category === ErrorCategory.SESSION;
  const resolvedTitle = title || normalized?.title || 'Unable to load this';
  const resolvedMessage = (isSession ? normalized.message : message) || normalized?.message
    || "We couldn't load this right now. Check your connection and try again.";
  const resolvedIcon = icon || normalized?.icon || 'alert-circle-outline';
  const tint = normalized?.tone === 'warning' ? colors.warning : colors.error;
  const busy = retrying || pending;

  const handleRetry = useCallback(async () => {
    if (!onRetry || busy) return;
    setPending(true);
    try {
      await onRetry();
    } finally {
      if (mountedRef.current) setPending(false);
    }
  }, [onRetry, busy]);

  // An expired session can't be fixed by retrying the request.
  const primary = isSession
    ? { label: normalized.actionLabel, onPress: expireSession, icon: 'log-in-outline' }
    : onRetry && (normalized ? normalized.retryable : true)
      ? { label: busy ? 'Trying again...' : retryLabel, onPress: handleRetry, icon: 'refresh' }
      : null;

  const renderButton = (btn, { secondary = false } = {}) => (
    <TouchableOpacity
      key={btn.label}
      style={[
        styles.btn,
        compact && styles.btnCompact,
        secondary && styles.btnSecondary,
        !secondary && busy && styles.btnBusy,
      ]}
      onPress={btn.onPress}
      disabled={!secondary && busy}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={btn.accessibilityLabel || btn.label}
      accessibilityState={{ disabled: !secondary && busy, busy: !secondary && busy }}
      hitSlop={compact ? { top: 8, bottom: 8, left: 8, right: 8 } : undefined}
    >
      {!secondary && busy && !isSession ? (
        <ActivityIndicator size="small" color={colors.secondary} />
      ) : btn.icon ? (
        <Ionicons name={btn.icon} size={16} color={secondary ? colors.textSecondary : colors.secondary} />
      ) : null}
      <Text style={[styles.btnText, secondary && { color: colors.textSecondary }]}>{btn.label}</Text>
    </TouchableOpacity>
  );

  const animatedStyle = {
    opacity: appear,
    transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }],
  };

  const a11yLabel = compact ? resolvedMessage : `${resolvedTitle}. ${resolvedMessage}`;

  if (compact) {
    return (
      <Animated.View style={[styles.compact, animatedStyle, style]}>
        <View
          style={styles.compactBody}
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={a11yLabel}
        >
          <Ionicons name={resolvedIcon} size={16} color={tint} importantForAccessibility="no" />
          <Text style={styles.compactText}>{resolvedMessage}</Text>
        </View>
        {primary && renderButton(primary)}
      </Animated.View>
    );
  }

  const body = (
    <View style={styles.inner}>
      <View
        style={styles.inner}
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={a11yLabel}
      >
        <View style={[styles.iconWrap, { backgroundColor: tint + '1A' }]}>
          <Ionicons name={resolvedIcon} size={fullScreen ? 36 : 28} color={tint} importantForAccessibility="no" />
        </View>
        <Text style={[styles.title, fullScreen && styles.titleLarge]}>{resolvedTitle}</Text>
        <Text style={styles.message}>{resolvedMessage}</Text>
      </View>
      {(primary || secondaryAction) && (
        <View style={styles.actions}>
          {primary && renderButton(primary)}
          {secondaryAction && renderButton(secondaryAction, { secondary: true })}
        </View>
      )}
    </View>
  );

  if (fullScreen) {
    return <Animated.View style={[styles.fullScreen, animatedStyle, style]}>{body}</Animated.View>;
  }

  return (
    <Animated.View style={animatedStyle}>
      <Card style={[styles.card, style]}>{body}</Card>
    </Animated.View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  inner: {
    alignItems: 'center',
  },
  iconWrap: {
    padding: 12,
    borderRadius: 999,
  },
  title: {
    ...typography.h4,
    color: colors.text,
    marginTop: 10,
    textAlign: 'center',
  },
  titleLarge: {
    ...typography.h3,
  },
  message: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.secondary,
  },
  btnCompact: {
    minHeight: 32,
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  btnSecondary: {
    borderColor: colors.border,
  },
  btnBusy: {
    opacity: 0.7,
  },
  btnText: {
    ...typography.bodySmall,
    color: colors.secondary,
    fontWeight: '600',
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  compactBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
});
