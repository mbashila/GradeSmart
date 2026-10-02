import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';

const ICONS = {
  error: 'alert-circle',
  warning: 'warning',
  success: 'checkmark-circle',
  info: 'information-circle',
};

/**
 * Inline form-level message (e.g. a failed sign-in) with icon + text, so status
 * is never conveyed by colour alone.
 */
export default function FormMessage({ type = 'error', message, style }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  if (!message) return null;
  const tint = colors[type] || colors.error;
  return (
    <View
      style={[styles.container, { borderColor: tint + '55', backgroundColor: tint + '14' }, style]}
      accessible
      accessibilityRole={type === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
    >
      <Ionicons name={ICONS[type] || ICONS.error} size={18} color={tint} style={styles.icon} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  icon: {
    marginRight: 8,
    marginTop: 1,
  },
  text: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
});
