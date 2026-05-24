import React, { useRef } from 'react';
import { Animated, Pressable, Vibration } from 'react-native';
import { useHaptics } from '../context/HapticsContext';

export default function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled = false,
  containerStyle,
  hitSlop = { top: 8, bottom: 8, left: 8, right: 8 },
  scaleTo = 0.98,
  duration = 120,
  haptic = false,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const { enabled: hapticsEnabled } = useHaptics();

  const animateTo = (toValue) => {
    Animated.timing(scale, {
      toValue,
      duration,
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = () => animateTo(scaleTo);
  const handlePressOut = () => animateTo(1);

  const handlePress = (e) => {
    if (haptic && hapticsEnabled) {
      try { Vibration.vibrate(10); } catch (_) {}
    }
    if (onPress) onPress(e);
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop}
    >
      <Animated.View style={[{ transform: [{ scale }] }, containerStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
