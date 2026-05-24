import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import PressableScale from '../components/PressableScale';
import { Skeleton, SkeletonCircle } from '../components/Skeleton';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';

export default function AdminUserDetailScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { userId } = route.params;
  const { users, updateUserRole, toggleBan } = useAdmin();
  const { user: currentUser } = useAuth();
  const [updatingRole, setUpdatingRole] = useState(false);
  const [togglingBan, setTogglingBan] = useState(false);

  const targetUser = useMemo(() => users.find(u => u.id === userId), [users, userId]);
  const isSelf = currentUser?.id === userId;

  if (!targetUser) {
    return (
      <View style={styles.container}>
        <Header title="User Detail" onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <Ionicons name="person-outline" size={48} color={colors.textLight} />
          <Text style={styles.emptyText}>User not found</Text>
        </View>
      </View>
    );
  }

  const handleRoleChange = (newRole) => {
    if (isSelf) {
      Alert.alert('Not allowed', 'You cannot change your own role.');
      return;
    }
    Alert.alert(
      'Change Role',
      `Set ${targetUser.full_name || targetUser.email} as "${newRole}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdatingRole(true);
            const { error } = await updateUserRole(userId, newRole);
            setUpdatingRole(false);
            if (error) {
              Alert.alert('Error', error.message || 'Failed to update role.');
            } else {
              Alert.alert('Done', `Role updated to "${newRole}".`);
            }
          },
        },
      ]
    );
  };

  const handleToggleBan = () => {
    if (isSelf) {
      Alert.alert('Not allowed', 'You cannot ban yourself.');
      return;
    }
    const action = targetUser.is_banned ? 'Unban' : 'Ban';
    Alert.alert(
      `${action} User`,
      `${action} ${targetUser.full_name || targetUser.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: targetUser.is_banned ? 'default' : 'destructive',
          onPress: async () => {
            setTogglingBan(true);
            const { error } = await toggleBan(
              userId,
              !targetUser.is_banned,
              targetUser.is_banned ? null : 'Banned by admin'
            );
            setTogglingBan(false);
            if (error) {
              Alert.alert('Error', error.message || `Failed to ${action.toLowerCase()} user.`);
            }
          },
        },
      ]
    );
  };

  const infoRows = [
    { icon: 'mail-outline', label: 'Email', value: targetUser.email || '—' },
    { icon: 'person-outline', label: 'Full Name', value: targetUser.full_name || 'Not set' },
    { icon: 'shield-outline', label: 'Role', value: (targetUser.role || 'user').charAt(0).toUpperCase() + (targetUser.role || 'user').slice(1) },
    { icon: 'calendar-outline', label: 'Joined', value: targetUser.created_at ? new Date(targetUser.created_at).toLocaleDateString() : '—' },
    { icon: 'time-outline', label: 'Last Sign In', value: targetUser.last_sign_in_at ? new Date(targetUser.last_sign_in_at).toLocaleString() : 'Never' },
  ];

  const roleOptions = [
    { key: 'user', label: 'User', icon: 'person', desc: 'Standard access', color: '#4A6CF7', bg: '#EEF0FF' },
    { key: 'admin', label: 'Admin', icon: 'shield', desc: 'Full access', color: '#FFB300', bg: '#FFF8E1' },
  ];

  const statusLabel = targetUser.is_banned ? 'Banned' : 'Active';
  const statusColor = targetUser.is_banned ? '#E53935' : '#43A047';
  const statusBg = targetUser.is_banned ? '#FFEBEE' : '#E8F5E9';

  return (
    <View style={styles.container}>
      <Header title="User Detail" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User hero card */}
        <AnimatedScreen>
          <View style={styles.heroCard}>
            <View style={[styles.avatar, { backgroundColor: '#EEF0FF' }]}>
              <Text style={styles.avatarText}>
                {(targetUser.full_name || targetUser.email || 'U')[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
            <Text style={styles.heroName}>{targetUser.full_name || 'No name'}</Text>
            <Text style={styles.heroEmail}>{targetUser.email}</Text>
            <View style={styles.heroBadges}>
              <View style={[styles.badge, { backgroundColor: statusBg }]}>
                <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: targetUser.role === 'admin' ? '#FFF8E1' : '#EEF0FF' }]}>
                <Ionicons name={targetUser.role === 'admin' ? 'shield' : 'person'} size={12} color={targetUser.role === 'admin' ? '#FFB300' : '#4A6CF7'} />
                <Text style={[styles.badgeText, { color: targetUser.role === 'admin' ? '#FFB300' : '#4A6CF7' }]}>
                  {(targetUser.role || 'user').charAt(0).toUpperCase() + (targetUser.role || 'user').slice(1)}
                </Text>
              </View>
            </View>
          </View>
        </AnimatedScreen>

        {/* Info card */}
        <AnimatedScreen delay={80}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Information</Text>
            {infoRows.map((row, i) => (
              <View key={row.label} style={[styles.infoRow, i < infoRows.length - 1 && styles.rowBorder]}>
                <View style={styles.infoLeft}>
                  <View style={[styles.infoIconWrap, { backgroundColor: '#EEF0FF' }]}>
                    <Ionicons name={row.icon} size={16} color="#4A6CF7" />
                  </View>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                </View>
                <Text style={styles.infoValue} numberOfLines={2}>{row.value}</Text>
              </View>
            ))}
          </View>
        </AnimatedScreen>

        {/* Role management */}
        <AnimatedScreen delay={160}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Role</Text>
            {updatingRole ? (
              <ActivityIndicator color="#4A6CF7" style={{ paddingVertical: 20 }} />
            ) : (
              <View style={styles.roleGrid}>
                {roleOptions.map(opt => {
                  const isActive = targetUser.role === opt.key;
                  return (
                    <PressableScale
                      key={opt.key}
                      containerStyle={[styles.roleCard, isActive && { borderColor: opt.color, borderWidth: 2 }]}
                      onPress={() => handleRoleChange(opt.key)}
                    >
                      <View style={[styles.roleIconWrap, { backgroundColor: opt.bg }]}>
                        <Ionicons name={opt.icon} size={22} color={opt.color} />
                      </View>
                      <Text style={styles.roleLabel}>{opt.label}</Text>
                      <Text style={styles.roleDesc}>{opt.desc}</Text>
                      {isActive && (
                        <View style={[styles.roleCheck, { backgroundColor: opt.color }]}>
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        </View>
                      )}
                    </PressableScale>
                  );
                })}
              </View>
            )}
          </View>
        </AnimatedScreen>

        {/* Ban / Unban */}
        <AnimatedScreen delay={240}>
          <PressableScale
            containerStyle={[styles.actionBtn, { backgroundColor: targetUser.is_banned ? '#E8F5E9' : '#FFEBEE' }]}
            onPress={handleToggleBan}
          >
            {togglingBan ? (
              <ActivityIndicator color={targetUser.is_banned ? '#43A047' : '#E53935'} />
            ) : (
              <>
                <View style={[styles.actionIconWrap, { backgroundColor: targetUser.is_banned ? '#C8E6C9' : '#FFCDD2' }]}>
                  <Ionicons
                    name={targetUser.is_banned ? 'checkmark-circle' : 'ban'}
                    size={20}
                    color={targetUser.is_banned ? '#43A047' : '#E53935'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionTitle, { color: targetUser.is_banned ? '#43A047' : '#E53935' }]}>
                    {targetUser.is_banned ? 'Unban User' : 'Ban User'}
                  </Text>
                  <Text style={styles.actionDesc}>
                    {targetUser.is_banned ? 'Restore access to this account' : 'Restrict access to this account'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={targetUser.is_banned ? '#43A047' : '#E53935'} />
              </>
            )}
          </PressableScale>
          {isSelf && (
            <Text style={styles.selfNote}>You cannot modify your own account.</Text>
          )}
        </AnimatedScreen>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: 12,
    fontSize: 15,
  },

  /* ── Hero card ── */
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4A6CF7',
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
  },
  heroEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Shared card ── */
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
  },

  /* ── Info rows ── */
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '50%',
    textAlign: 'right',
  },

  /* ── Role cards ── */
  roleGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  roleCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  roleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  roleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  roleDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3,
  },
  roleCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Action button ── */
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  selfNote: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 16,
  },
});
