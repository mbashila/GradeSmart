import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';

export default function Header({ 
  title, 
  onBack, 
  rightAction,
  rightIcon,
  onRightPress,
  showBack = true,
  rightBadge,
}) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.header}>
      <View style={styles.leftSection}>
        {showBack && onBack && (
          <TouchableOpacity onPress={onBack} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.centerSection}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>
      
      <View style={styles.rightSection}>
        {rightAction && (
          <TouchableOpacity onPress={onRightPress} style={styles.iconButton}>
            <Text style={styles.rightAction}>{rightAction}</Text>
          </TouchableOpacity>
        )}
        {rightIcon && (
          <TouchableOpacity onPress={onRightPress} style={[styles.iconButton, styles.iconButtonWithBadge]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={rightIcon} size={24} color={colors.text} />
            {!!rightBadge && rightBadge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{rightBadge > 99 ? '99+' : rightBadge}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leftSection: {
    width: 40,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  iconButton: {
    padding: 4,
  },
  rightAction: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
  },
  iconButtonWithBadge: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 10,
    color: colors.background,
    fontWeight: '700',
  },
});
