import React, { useCallback, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors, useTheme } from '../../context/ThemeContext';
import { useReducedMotion, useShimmerProgress } from './shimmer';

export const SKELETON_RADIUS = {
  rectangular: 0,
  rounded: 8,
  text: 4,
  card: 16,
};

const hiddenFromA11y = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
};

export function useSkeletonPalette() {
  const colors = useColors();
  const { isDark } = useTheme();
  return {
    base: colors.border,
    highlight: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.55)',
    transparent: 'rgba(255,255,255,0)',
  };
}

function resolveRadius(variant, borderRadius, height) {
  if (borderRadius != null) return borderRadius;
  if (variant === 'circle') return typeof height === 'number' ? height / 2 : 9999;
  return SKELETON_RADIUS[variant] ?? SKELETON_RADIUS.rounded;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius,
  radius,
  variant = 'rounded',
  animation = 'shimmer',
  style,
}) {
  const palette = useSkeletonPalette();
  const reduceMotion = useReducedMotion();
  const animated = animation !== 'none' && !reduceMotion;
  const progress = useShimmerProgress(animated);
  const [layoutWidth, setLayoutWidth] = useState(0);

  const onLayout = useCallback((e) => {
    const next = Math.round(e.nativeEvent.layout.width);
    setLayoutWidth((prev) => (prev === next ? prev : next));
  }, []);

  const bandWidth = Math.max(40, Math.min(layoutWidth * 0.6, 160));
  const showBand = animated && layoutWidth > 0;

  return (
    <View
      {...hiddenFromA11y}
      onLayout={animated ? onLayout : undefined}
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius: resolveRadius(variant, borderRadius ?? radius, height),
          backgroundColor: palette.base,
        },
        style,
      ]}
    >
      {showBand && (
        <Animated.View
          style={[
            styles.band,
            {
              width: bandWidth,
              transform: [{
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-bandWidth, layoutWidth],
                }),
              }],
            },
          ]}
        >
          <LinearGradient
            colors={[palette.transparent, palette.highlight, palette.transparent]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
});

export default Skeleton;
