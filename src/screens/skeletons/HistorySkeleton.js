import React from 'react';
import { View } from 'react-native';
import Card from '../../components/Card';
import {
  Skeleton,
  SkeletonCircle,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
} from '../../components/skeletons';

// Test history cards: title + subject badge, date, score badge, and the
// class / scans / chevron footer.
export function HistoryTestsSkeleton({ styles, count = 4 }) {
  return (
    <SkeletonGroup label="Loading test history...">
      <SkeletonList
        count={count}
        renderItem={() => (
          <Card style={styles.testCard}>
            <View style={styles.testCardHeader}>
              <View style={styles.testCardInfo}>
                <View style={styles.testCardTitleRow}>
                  <SkeletonText type="h4" width="50%" />
                  <Skeleton width={64} height={24} borderRadius={8} style={{ marginLeft: 8 }} />
                </View>
                <SkeletonText type="bodySmall" width="35%" />
              </View>
              <Skeleton width={56} height={40} borderRadius={12} />
            </View>
            <View style={styles.testCardFooter}>
              <View style={styles.testCardStat}>
                <SkeletonCircle size={16} />
                <SkeletonText type="bodySmall" width={56} style={{ marginLeft: 6 }} />
              </View>
              <View style={styles.testCardStat}>
                <SkeletonCircle size={16} />
                <SkeletonText type="bodySmall" width={56} style={{ marginLeft: 6 }} />
              </View>
              <SkeletonCircle size={20} />
            </View>
          </Card>
        )}
      />
    </SkeletonGroup>
  );
}

export function HistorySummaryValueSkeleton() {
  return <SkeletonText type="h2" width={40} style={{ marginBottom: 4 }} />;
}
