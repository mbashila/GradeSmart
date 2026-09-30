import React from 'react';
import { View } from 'react-native';
import Card from '../../components/Card';
import {
  Skeleton,
  SkeletonChart,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
} from '../../components/skeletons';

export function StudentResultsSkeleton({ styles, count = 3 }) {
  return (
    <SkeletonGroup label="Loading student results...">
      <SkeletonList
        count={count}
        renderItem={() => (
          <Card style={styles.studentCard}>
            <View style={styles.studentCardHeader}>
              <View style={styles.studentInfo}>
                <SkeletonText type="body" width="55%" style={{ marginBottom: 4 }} />
                <SkeletonText type="bodySmall" width="40%" />
              </View>
              <View style={styles.studentGrades}>
                <Skeleton width={58} height={36} borderRadius={12} />
                <Skeleton width={40} height={36} borderRadius={12} />
              </View>
            </View>
          </Card>
        )}
      />
    </SkeletonGroup>
  );
}

// Performance distribution (five horizontal grade bars) + class overview.
export function TestAnalyticsSkeleton({ styles }) {
  return (
    <SkeletonGroup label="Loading analytics..." style={styles.analyticsSection}>
      <Card style={styles.analyticsCard}>
        <SkeletonText type="h4" width="60%" style={{ marginBottom: 20 }} />
        <SkeletonChart type="horizontal" bars={5} barHeight={40} />
      </Card>
      <Card style={styles.analyticsCard}>
        <SkeletonText type="h4" width="45%" style={{ marginBottom: 20 }} />
        <View style={styles.overviewStats}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.overviewStat}>
              <SkeletonText type="h2" width={48} style={{ marginBottom: 4 }} />
              <SkeletonText type="bodySmall" width={56} />
            </View>
          ))}
        </View>
      </Card>
    </SkeletonGroup>
  );
}
