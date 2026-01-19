import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { elevation } from '../theme/elevation';
import PressableScale from './PressableScale';

export default function Card({ children, style, onPress, ...props }) {
  if (onPress) {
    return (
      <PressableScale onPress={onPress} containerStyle={[styles.card, style]} haptic={true} {...props}>
        {children}
      </PressableScale>
    );
  }

  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    ...elevation.e4,
  },
});
