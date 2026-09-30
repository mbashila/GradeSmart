import React from 'react';
import { View } from 'react-native';
import {
  Skeleton,
  SkeletonCircle,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
} from '../../components/skeletons';

export function AdminQuickRowSkeleton({ styles }) {
  return (
    <SkeletonGroup label="Loading admin overview..." style={styles.quickRow}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.quickItem}>
          <Skeleton width={68} height={68} borderRadius={18} />
          <SkeletonText lineHeight={16} fontSize={12} width={48} style={{ marginTop: 8 }} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

export function AdminMetricValueSkeleton() {
  return <SkeletonText lineHeight={30} fontSize={24} width={32} />;
}

// Ranked active-user rows: rank circle, name + activity meta, last-active date.
export function AdminActiveUsersSkeleton({ styles, count = 3 }) {
  return (
    <SkeletonGroup label="Loading active users...">
      <SkeletonList
        count={count}
        renderItem={(i) => (
          <View style={[styles.activeUserRow, i < count - 1 && styles.rowBorder]}>
            <SkeletonCircle size={36} />
            <View style={styles.activeUserInfo}>
              <SkeletonText lineHeight={20} fontSize={15} width="55%" />
              <SkeletonText lineHeight={16} fontSize={12} width="40%" style={{ marginTop: 2 }} />
            </View>
            <SkeletonText lineHeight={16} fontSize={12} width={60} />
          </View>
        )}
      />
    </SkeletonGroup>
  );
}

// Support query summary rows on the admin dashboard.
export function AdminQueryRowsSkeleton({ styles, count = 3 }) {
  return (
    <SkeletonGroup label="Loading support queries...">
      <SkeletonList
        count={count}
        renderItem={(i) => (
          <View style={[styles.queryRow, i < count - 1 && styles.rowBorder]}>
            <Skeleton width={36} height={36} borderRadius={10} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <SkeletonText lineHeight={18} fontSize={14} width="60%" />
              <SkeletonText lineHeight={16} fontSize={12} width="40%" style={{ marginTop: 2 }} />
            </View>
            <SkeletonText lineHeight={16} fontSize={12} width={60} style={{ marginLeft: 8 }} />
          </View>
        )}
      />
    </SkeletonGroup>
  );
}

// Full query cards on the Support Queries screen: priority dot, subject,
// status badge, two-line message, sender + date footer.
export function AdminQueryCardsSkeleton({ styles, count = 4 }) {
  return (
    <SkeletonGroup label="Loading queries...">
      <SkeletonList
        count={count}
        renderItem={() => (
          <View style={styles.queryCard}>
            <View style={styles.queryHeader}>
              <SkeletonCircle size={8} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <SkeletonText lineHeight={20} fontSize={15} width="65%" />
              </View>
              <Skeleton width={52} height={20} borderRadius={6} style={{ marginLeft: 8 }} />
            </View>
            <SkeletonText lines={2} lineHeight={18} fontSize={13} lastLineWidth="70%" />
            <View style={styles.queryFooter}>
              <SkeletonText lineHeight={16} fontSize={12} width={110} />
              <SkeletonText lineHeight={14} fontSize={11} width={64} />
            </View>
          </View>
        )}
      />
    </SkeletonGroup>
  );
}

// Manage Users rows: avatar, name, email, joined date + role badge.
export function AdminUsersSkeleton({ styles, count = 5 }) {
  return (
    <SkeletonGroup label="Loading users..." style={styles.listContent}>
      <SkeletonList
        count={count}
        renderItem={() => (
          <View style={styles.userRow}>
            <SkeletonCircle size={44} />
            <View style={styles.userInfo}>
              <SkeletonText lineHeight={20} fontSize={15} width="50%" />
              <SkeletonText lineHeight={16} fontSize={12} width="70%" style={{ marginTop: 2 }} />
              <SkeletonText lineHeight={14} fontSize={11} width="35%" style={{ marginTop: 2 }} />
            </View>
            <SkeletonCircle size={18} />
          </View>
        )}
      />
    </SkeletonGroup>
  );
}
