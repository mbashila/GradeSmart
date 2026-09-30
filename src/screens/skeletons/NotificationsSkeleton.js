import React from 'react';
import { View } from 'react-native';
import Card from '../../components/Card';
import {
  SkeletonCircle,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
} from '../../components/skeletons';

// Notification row: type icon, title + timestamp, one-line preview, chevron.
export default function NotificationsSkeleton({ styles, count = 5 }) {
  return (
    <SkeletonGroup label="Loading notifications...">
      <SkeletonList
        count={count}
        renderItem={() => (
          <Card style={styles.notificationCard}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <SkeletonCircle size={24} />
              </View>
              <View style={styles.content}>
                <View style={styles.titleRow}>
                  <SkeletonText type="h4" width="60%" />
                  <SkeletonText type="caption" width={44} />
                </View>
                <SkeletonText type="body" fontSize={13} width="85%" />
              </View>
              <View style={styles.rightCol}>
                <SkeletonCircle size={16} />
              </View>
            </View>
          </Card>
        )}
      />
    </SkeletonGroup>
  );
}
