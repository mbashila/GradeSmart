import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';

const ToastContext = createContext({ showToast: () => {} });

const ICONS = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  warning: 'warning',
  info: 'information-circle',
};

// Errors stay up longer than confirmations so they can be read.
const DEFAULT_DURATION = { success: 2000, info: 2500, warning: 3500, error: 3500 };

export function ToastProvider({ children }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const hideTimer = useRef(null);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast((t) => ({ ...t, visible: false })));
  }, [opacity, translateY]);

  const showToast = useCallback((message, type = 'info', duration) => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setToast({ visible: true, message, type });
    opacity.setValue(0);
    translateY.setValue(20);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    AccessibilityInfo.announceForAccessibility?.(message);
    hideTimer.current = setTimeout(hide, duration ?? DEFAULT_DURATION[type] ?? 2500);
  }, [hide, opacity, translateY]);

  useEffect(() => () => hideTimer.current && clearTimeout(hideTimer.current), []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  const bgByType = {
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    info: colors.secondary,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast.visible && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.toast, { backgroundColor: bgByType[toast.type] || colors.secondary, opacity, transform: [{ translateY }] }]}>
            <Ionicons name={ICONS[toast.type] || ICONS.info} size={18} color={colors.background} style={styles.icon} />
            <Text style={styles.toastText}>{toast.message}</Text>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const makeStyles = (colors) => StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  toastText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
});
