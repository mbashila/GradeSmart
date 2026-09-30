import React from 'react';
import { View, StyleSheet } from 'react-native';
import Card from '../Card';
import { typography } from '../../theme/typography';
import { Skeleton } from './Skeleton';

// Each text line reserves the real line height and draws a bar roughly the
// height of the glyphs, so swapping to real text does not shift the layout.
export function SkeletonText({
  type = 'body',
  lines = 1,
  width = '100%',
  lastLineWidth = '60%',
  lineHeight,
  fontSize,
  style,
}) {
  const t = typography[type] || typography.body;
  const lh = lineHeight ?? t.lineHeight;
  const barHeight = Math.round((fontSize ?? t.fontSize) * 0.72);
  return (
    <View style={style}>
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i} style={{ height: lh, justifyContent: 'center' }}>
          <Skeleton
            variant="text"
            height={barHeight}
            width={lines > 1 && i === lines - 1 ? lastLineWidth : width}
          />
        </View>
      ))}
    </View>
  );
}

export function SkeletonCircle({ size = 40, style }) {
  return <Skeleton variant="circle" width={size} height={size} style={style} />;
}

export function SkeletonAvatar({ size = 44, shape = 'circle', style }) {
  if (shape === 'circle') return <SkeletonCircle size={size} style={style} />;
  return <Skeleton width={size} height={size} borderRadius={Math.round(size * 0.27)} style={style} />;
}

export function SkeletonButton({ width = '100%', height = 56, borderRadius = 12, style }) {
  return <Skeleton width={width} height={height} borderRadius={borderRadius} style={style} />;
}

export function SkeletonImage({ width = '100%', height, aspectRatio, borderRadius = 12, style }) {
  return (
    <Skeleton
      width={width}
      height={height ?? (aspectRatio ? null : 160)}
      borderRadius={borderRadius}
      style={[aspectRatio ? { aspectRatio } : null, style]}
    />
  );
}

// Uses the real Card so padding, radius and elevation match loaded cards.
export function SkeletonCard({ children, style }) {
  return <Card style={style}>{children}</Card>;
}

export function SkeletonRow({
  leadingSize = 40,
  leadingShape = 'circle',
  title = { type: 'body', width: '60%' },
  subtitle = { type: 'bodySmall', width: '40%' },
  meta,
  trailing,
  gap = 12,
  style,
}) {
  return (
    <View style={[styles.row, style]}>
      {leadingSize > 0 && <SkeletonAvatar size={leadingSize} shape={leadingShape} />}
      <View style={[styles.rowBody, leadingSize > 0 && { marginLeft: gap }]}>
        {title && <SkeletonText {...title} />}
        {subtitle && <SkeletonText {...subtitle} style={{ marginTop: subtitle.marginTop ?? 2 }} />}
        {meta && <SkeletonText {...meta} style={{ marginTop: meta.marginTop ?? 2 }} />}
      </View>
      {trailing}
    </View>
  );
}

export function SkeletonList({ count = 4, renderItem, style }) {
  return (
    <View style={style}>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>{renderItem(i)}</React.Fragment>
      ))}
    </View>
  );
}

const BAR_PATTERN = [0.45, 0.7, 0.55, 0.9, 0.62, 0.78, 0.5, 0.68];
const HBAR_PATTERN = [0.72, 0.55, 0.4, 0.28, 0.18, 0.5];

export function SkeletonChart({
  type = 'bar',
  height = 160,
  bars = 7,
  barHeight = 40,
  showLabels = true,
  style,
}) {
  if (type === 'horizontal') {
    return (
      <View style={[{ gap: 12 }, style]}>
        {Array.from({ length: bars }).map((_, i) => (
          <View key={i} style={styles.hbarRow}>
            <View style={{ flex: 1 }}>
              <Skeleton
                height={barHeight}
                borderRadius={8}
                width={`${Math.round(HBAR_PATTERN[i % HBAR_PATTERN.length] * 100)}%`}
              />
            </View>
            {showLabels && <SkeletonText type="bodySmall" width={55} />}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={style}>
      <View style={[styles.barArea, { height }]}>
        {Array.from({ length: bars }).map((_, i) => (
          <Skeleton
            key={i}
            borderRadius={6}
            width={`${Math.floor(70 / bars)}%`}
            height={Math.round(height * BAR_PATTERN[i % BAR_PATTERN.length])}
          />
        ))}
      </View>
      {showLabels && (
        <View style={styles.barLabels}>
          {Array.from({ length: bars }).map((_, i) => (
            <SkeletonText key={i} type="caption" width={20} />
          ))}
        </View>
      )}
    </View>
  );
}

// Groups a screen's placeholders into one accessible "Loading ..." element so
// screen readers announce the loading state instead of every placeholder.
export function SkeletonGroup({ label = 'Loading', children, style }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={style}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBody: {
    flex: 1,
  },
  hbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});
