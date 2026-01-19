import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

export default function AnimatedScreen({ children, delay = 0, duration = 650, initialOffset = 24, style }) {
  const translateY = useRef(new Animated.Value(initialOffset)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      translateY.setValue(initialOffset);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(initialOffset);
      opacity.setValue(0);
    }
  }, [isFocused, delay, duration, initialOffset, opacity, translateY]);

  return (
    <Animated.View style={[style, { transform: [{ translateY }], opacity }]}> 
      {children}
    </Animated.View>
  );
}
