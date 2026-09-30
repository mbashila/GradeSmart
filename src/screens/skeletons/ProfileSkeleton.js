import React from 'react';
import { View } from 'react-native';
import {
  Skeleton,
  SkeletonCircle,
  SkeletonGroup,
  SkeletonText,
} from '../../components/skeletons';

// Avatar, name, email and the outlined "Edit profile" pill.
export function ProfileHeaderSkeleton({ styles }) {
  return (
    <SkeletonGroup label="Loading profile...">
      <View style={[styles.avatarWrapper, { alignItems: 'center' }]}>
        <SkeletonCircle size={96} />
      </View>
      <View style={{ alignItems: 'center' }}>
        <SkeletonText lineHeight={28} fontSize={22} width={150} style={{ marginTop: 10 }} />
        <SkeletonText lineHeight={20} fontSize={14} width={190} style={{ marginTop: 2 }} />
        <Skeleton width={128} height={39} borderRadius={20} style={{ marginTop: 14 }} />
      </View>
    </SkeletonGroup>
  );
}

// The Account section card: title and three icon + label + value rows.
export function ProfileAccountSkeleton({ styles }) {
  return (
    <View style={styles.sectionCard} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SkeletonText lineHeight={22} fontSize={16} width="30%" style={{ marginBottom: 8 }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.settingRow, i < 2 && styles.settingRowBorder]}>
          <View style={styles.settingLeft}>
            <SkeletonCircle size={20} />
            <SkeletonText lineHeight={20} fontSize={15} width={90} style={{ marginLeft: 12 }} />
          </View>
          <SkeletonText lineHeight={20} fontSize={14} width={i === 2 ? 20 : 110} />
        </View>
      ))}
    </View>
  );
}
