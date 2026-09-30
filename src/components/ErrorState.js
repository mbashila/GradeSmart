import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';

export default function ErrorState({
  title = 'Something went wrong',
  message = "We couldn't load this right now. Check your connection and try again.",
  onRetry,
  retrying = false,
  compact = false,
  style,
}) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const retryButton = onRetry ? (
    <TouchableOpacity
      style={[styles.retryBtn, compact && styles.retryBtnCompact, retrying && { opacity: 0.7 }]}
      onPress={onRetry}
      disabled={retrying}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      {retrying ? (
        <ActivityIndicator size="small" color={colors.secondary} />
      ) : (
        <Ionicons name="refresh" size={16} color={colors.secondary} />
      )}
      <Text style={styles.retryText}>{retrying ? 'Retrying...' : 'Try Again'}</Text>
    </TouchableOpacity>
  ) : null;

  if (compact) {
    return (
      <View style={[styles.compact, style]} accessibilityRole="alert">
        <Ionicons name="cloud-offline-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.compactText}>{message}</Text>
        {retryButton}
      </View>
    );
  }

  return (
    <Card style={[styles.card, style]}>
      <View accessibilityRole="alert" style={styles.inner}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.textLight} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {retryButton}
      </View>
    </Card>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  inner: {
    alignItems: 'center',
  },
  title: {
    ...typography.h4,
    color: colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  message: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.secondary,
  },
  retryBtnCompact: {
    marginTop: 0,
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  retryText: {
    ...typography.bodySmall,
    color: colors.secondary,
    fontWeight: '600',
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  compactText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
});
