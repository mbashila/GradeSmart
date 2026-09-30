import React from 'react';
import { View } from 'react-native';
import Card from '../../components/Card';
import {
  SkeletonCircle,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
} from '../../components/skeletons';

// Mirrors the three stat cards (icon, value, label) using the Dashboard's own
// statCard styles so the loaded cards take the exact same footprint.
export function DashboardStatsSkeleton({ styles }) {
  return (
    <SkeletonGroup label="Loading dashboard..." style={styles.statsRow}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.statCard}>
          <SkeletonCircle size={32} />
          <SkeletonText type="h2" width={36} style={{ marginTop: 8 }} />
          <SkeletonText type="bodySmall" width="75%" style={{ marginTop: 4 }} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

// Mirrors a Recent Scans card: student name + date, then the footer with the
// score stat, like button and chevron.
export function DashboardRecentScansSkeleton({ styles, count = 2 }) {
  return (
    <SkeletonGroup label="Loading recent scans...">
      <SkeletonList
        count={count}
        renderItem={() => (
          <Card style={styles.testCard}>
            <View style={styles.testCardHeader}>
              <View style={styles.testCardInfo}>
                <SkeletonText type="h4" width="55%" style={{ marginBottom: 4 }} />
                <SkeletonText type="bodySmall" width="35%" />
              </View>
            </View>
            <View style={styles.testCardFooter}>
              <View style={styles.testCardStat}>
                <SkeletonCircle size={16} />
                <SkeletonText type="bodySmall" width={64} style={{ marginLeft: 8 }} />
              </View>
              <View style={styles.testCardStat}>
                <SkeletonCircle size={20} />
                <SkeletonCircle size={20} style={{ marginLeft: 12 }} />
              </View>
            </View>
          </Card>
        )}
      />
    </SkeletonGroup>
  );
}
