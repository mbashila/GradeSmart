import React from 'react';
import { Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import PressableScale from './PressableScale';

export default function Button({ 
  title, 
  onPress, 
  variant = 'primary', 
  size = 'large',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const isLarge = size === 'large';
  
  const buttonStyles = [
    styles.button,
    isLarge && styles.buttonLarge,
    !isLarge && styles.buttonSmall,
    isOutline && styles.buttonOutline,
    disabled && styles.buttonDisabled,
    style,
  ];
  
  const textStyles = [
    styles.text,
    isLarge && styles.textLarge,
    !isLarge && styles.textSmall,
    isOutline && styles.textOutline,
    disabled && styles.textDisabled,
    textStyle,
  ];
  
  const content = (
    <>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      {loading ? (
        <ActivityIndicator 
          color={isOutline ? colors.secondary : colors.background} 
          size="small" 
        />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </>
  );
  
  if (isPrimary && !disabled) {
    return (
      <PressableScale onPress={onPress} disabled={disabled || loading} haptic={true}>
        <LinearGradient
          colors={[colors.secondaryLight, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={buttonStyles}
        >
          {content}
        </LinearGradient>
      </PressableScale>
    );
  }

  return (
    <PressableScale 
      onPress={onPress} 
      disabled={disabled || loading}
      containerStyle={buttonStyles}
      haptic={true}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 56,
  },
  buttonLarge: {
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  buttonSmall: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 44,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  text: {
    ...typography.button,
    color: colors.background,
  },
  textLarge: {
    fontSize: 18,
  },
  textSmall: {
    fontSize: 14,
  },
  textOutline: {
    color: colors.secondary,
  },
  textDisabled: {
    opacity: 0.7,
  },
  icon: {
    marginRight: 8,
    fontSize: 20,
  },
});
