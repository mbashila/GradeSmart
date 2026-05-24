import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useColors } from '../context/ThemeContext';

export function Skeleton({ width = '100%', height = 16, radius = 8, style }) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { backgroundColor: colors.border },
        { width, height, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCircle({ size = 40, style }) {
  return <Skeleton width={size} height={size} radius={size / 2} style={style} />;
}

export function SkeletonRow({ items = [], spacing = 12, style }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      {items.map((item, idx) => (
        <Skeleton key={idx} width={item.width} height={item.height} radius={item.radius ?? 8} style={{ marginRight: idx < items.length - 1 ? spacing : 0 }} />
      ))}
    </View>
  );
}


export default Skeleton;
