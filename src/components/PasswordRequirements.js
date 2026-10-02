import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { getPasswordChecks, getPasswordStrength } from '../utils/security';

const SEGMENTS = 4;

/**
 * Live password checklist + local strength meter. The password never leaves the device.
 */
export default function PasswordRequirements({ password, style }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const checks = getPasswordChecks(password);
  const strength = getPasswordStrength(password);
  const strengthColor = [colors.border, colors.error, colors.warning, colors.info, colors.success][strength.level];

  const renderCheck = (check) => (
    <View
      key={check.id}
      style={styles.row}
      accessible
      accessibilityLabel={`${check.label}: ${check.met ? 'met' : 'not met'}`}
    >
      <Ionicons
        name={check.met ? 'checkmark-circle' : 'close-circle-outline'}
        size={16}
        color={check.met ? colors.success : colors.textLight}
      />
      <Text style={[styles.rowText, check.met && styles.rowTextMet]}>{check.label}</Text>
    </View>
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Password requirements</Text>
        {strength.label ? (
          <Text
            style={[styles.strengthLabel, { color: strengthColor }]}
            accessibilityLabel={`Password strength: ${strength.label}`}
          >
            {strength.label}
          </Text>
        ) : null}
      </View>
      <View style={styles.meter} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <View
            key={i}
            style={[styles.segment, { backgroundColor: i < strength.level ? strengthColor : colors.border }]}
          />
        ))}
      </View>
      {checks.filter((c) => c.required).map(renderCheck)}
      <Text style={styles.subtitle}>Recommended for a stronger password</Text>
      <View style={styles.recommendedGrid}>
        {checks.filter((c) => !c.required).map(renderCheck)}
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  strengthLabel: {
    ...typography.caption,
    fontWeight: '700',
  },
  meter: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: 6,
    marginBottom: 2,
  },
  recommendedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    minWidth: '50%',
  },
  rowText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  rowTextMet: {
    color: colors.text,
  },
});
