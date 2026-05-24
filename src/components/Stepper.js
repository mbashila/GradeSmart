import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';

export default function Stepper({ steps = [], current = 0, style }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        {steps.map((label, index) => {
          const isCompleted = index < current;
          const isCurrent = index === current;
          const isLast = index === steps.length - 1;
          return (
            <View key={label + index} style={styles.item}>
              <View style={[styles.circle, isCompleted && styles.circleCompleted, isCurrent && styles.circleCurrent]}>
                {isCompleted ? (
                  <Ionicons name="checkmark" size={14} color={colors.background} />
                ) : (
                  <Text style={[styles.circleText, isCurrent && styles.circleTextCurrent]}>{index + 1}</Text>
                )}
              </View>
              {!isLast && <View style={[styles.line, (isCompleted || isCurrent) && styles.lineActive]} />}
            </View>
          );
        })}
      </View>
      <View style={styles.labelsRow}>
        {steps.map((label, index) => {
          const isCompleted = index < current;
          const isCurrent = index === current;
          return (
            <Text key={label + index} style={[styles.label, isCompleted && styles.labelCompleted, isCurrent && styles.labelCurrent]}>
              {label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const CIRCLE_SIZE = 24;

const makeStyles = (colors) => StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  circleCompleted: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  circleCurrent: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondaryLight + '20',
  },
  circleText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  circleTextCurrent: {
    color: colors.secondary,
  },
  line: {
    height: 2,
    backgroundColor: colors.border,
    flex: 1,
    marginHorizontal: 6,
  },
  lineActive: {
    backgroundColor: colors.secondary,
  },
  labelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
  labelCompleted: {
    color: colors.text,
    fontWeight: '600',
  },
  labelCurrent: {
    color: colors.secondary,
    fontWeight: '700',
  },
});
