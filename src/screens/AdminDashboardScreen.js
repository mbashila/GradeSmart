import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import PressableScale from '../components/PressableScale';
import { Skeleton, SkeletonCircle } from '../components/Skeleton';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useAdmin } from '../context/AdminContext';

const PERIODS = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

export default function AdminDashboardScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { stats, fetchStats, fetchUsers, fetchActiveUsers, fetchQueries, users, activeUsers, queries, loading } = useAdmin();
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('day');

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchActiveUsers(period);
    fetchQueries('all');
  }, []);

  useEffect(() => {
    fetchActiveUsers(period);
  }, [period]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchUsers(), fetchActiveUsers(period), fetchQueries('all')]);
    setRefreshing(false);
  }, [fetchStats, fetchUsers, fetchActiveUsers, fetchQueries, period]);

  const quickButtons = [
    { icon: 'people', label: 'Users', bg: '#EEF0FF', iconColor: '#4A6CF7', count: null, action: () => navigation.navigate('AdminUsers') },
    { icon: 'ban', label: 'Blocked', bg: '#FFEBEE', iconColor: '#E53935', count: stats?.total_banned ?? 0, action: () => navigation.navigate('AdminUsers', { initialFilter: 'banned' }) },
    { icon: 'chatbubbles', label: 'Messages', bg: '#FFF3E0', iconColor: '#FB8C00', count: null, action: () => navigation.navigate('AdminQueries') },
    { icon: 'scan', label: 'Scans', bg: '#E8F5E9', iconColor: '#43A047', count: stats?.total_scans ?? 0, action: null },
    { icon: 'albums', label: 'Tests', bg: '#FFF8E1', iconColor: '#FFB300', count: stats?.total_tests ?? 0, action: null },
  ];

  const periodStats = {
    users: stats ? { day: stats.users_today, week: stats.users_this_week, month: stats.users_this_month, year: stats.users_this_year } : {},
    scans: stats ? { day: stats.scans_today, week: stats.scans_this_week, month: stats.scans_this_month, year: stats.scans_this_year } : {},
    tests: stats ? { day: stats.tests_today, week: stats.tests_this_week, month: stats.tests_this_month, year: stats.tests_this_year } : {},
  };

  const openQueries = queries.filter(q => q.status === 'open' || q.status === 'in_progress').slice(0, 3);

  const formatMins = (mins) => {
    if (!mins || mins === 0) return '0m';
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <View style={styles.container}>
      <Header title="Admin Panel" onBack={() => navigation.goBack()} rightAction="Refresh" onRightPress={onRefresh} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.secondary} />}
      >
        {/* Quick action buttons - horizontal row */}
        <AnimatedScreen>
          {!stats && loading ? (
            <View style={styles.quickRow}>
              {[1,2,3,4,5].map(i => (
                <View key={i} style={styles.quickItem}>
                  <Skeleton width={68} height={68} radius={18} />
                  <Skeleton width={48} height={10} style={{ marginTop: 8 }} />
                </View>
              ))}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
              {quickButtons.map(btn => (
                <PressableScale key={btn.label} onPress={btn.action} disabled={!btn.action} containerStyle={styles.quickItem}>
                  <View style={[styles.quickIconBox, { backgroundColor: btn.bg }]}>
                    <Ionicons name={btn.icon} size={28} color={btn.iconColor} />
                  </View>
                  <Text style={styles.quickLabel}>{btn.label}</Text>
                  {btn.count != null && (
                    <Text style={styles.quickCount}>{btn.count}</Text>
                  )}
                </PressableScale>
              ))}
            </ScrollView>
          )}
        </AnimatedScreen>

        {/* Analytics card */}
        <AnimatedScreen delay={80}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Analytics</Text>
            <View style={styles.periodRow}>
              {PERIODS.map(p => (
                <PressableScale
                  key={p.key}
                  containerStyle={[styles.periodPill, period === p.key && styles.periodPillActive]}
                  onPress={() => setPeriod(p.key)}
                >
                  <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>{p.label}</Text>
                </PressableScale>
              ))}
            </View>
            <View style={styles.analyticsGrid}>
              <View style={styles.analyticsBox}>
                <View style={[styles.analyticsIconWrap, { backgroundColor: '#EEF0FF' }]}>
                  <Ionicons name="people" size={22} color="#4A6CF7" />
                </View>
                <Text style={styles.analyticsValue}>{periodStats.users[period] ?? 0}</Text>
                <Text style={styles.analyticsLabel}>New Users</Text>
              </View>
              <View style={styles.analyticsBox}>
                <View style={[styles.analyticsIconWrap, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="scan" size={22} color="#43A047" />
                </View>
                <Text style={styles.analyticsValue}>{periodStats.scans[period] ?? 0}</Text>
                <Text style={styles.analyticsLabel}>Scans</Text>
              </View>
              <View style={styles.analyticsBox}>
                <View style={[styles.analyticsIconWrap, { backgroundColor: '#FFF8E1' }]}>
                  <Ionicons name="folder" size={22} color="#FFB300" />
                </View>
                <Text style={styles.analyticsValue}>{periodStats.tests[period] ?? 0}</Text>
                <Text style={styles.analyticsLabel}>Tests</Text>
              </View>
            </View>
          </View>
        </AnimatedScreen>

        {/* Most Active Users */}
        <AnimatedScreen delay={160}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Most Active Users</Text>
            {activeUsers.length === 0 ? (
              <View style={styles.emptyInner}>
                <Ionicons name="analytics-outline" size={28} color={colors.textLight} />
                <Text style={styles.emptyText}>No activity data yet</Text>
              </View>
            ) : (
              activeUsers.slice(0, 5).map((u, idx) => (
                <PressableScale
                  key={u.user_id}
                  containerStyle={[styles.activeUserRow, idx < activeUsers.slice(0, 5).length - 1 && styles.rowBorder]}
                  onPress={() => navigation.navigate('AdminUserDetail', { userId: u.user_id })}
                >
                  <View style={[styles.rankCircle, idx === 0 && { backgroundColor: '#FFD700' }, idx === 1 && { backgroundColor: '#C0C0C0' }, idx === 2 && { backgroundColor: '#CD7F32' }]}>
                    <Text style={[styles.rankNum, idx < 3 && { color: '#fff' }]}>{idx + 1}</Text>
                  </View>
                  <View style={styles.activeUserInfo}>
                    <Text style={styles.activeUserName} numberOfLines={1}>{u.full_name || u.email || 'Unknown'}</Text>
                    <Text style={styles.activeUserMeta} numberOfLines={1}>
                      {u.login_count} logins · {formatMins(u.total_minutes)} active
                    </Text>
                  </View>
                  <Text style={styles.activeUserDate}>
                    {u.last_active ? new Date(u.last_active).toLocaleDateString() : '—'}
                  </Text>
                </PressableScale>
              ))
            )}
          </View>
        </AnimatedScreen>

        {/* Support Queries */}
        <AnimatedScreen delay={240}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Support Queries</Text>
              <PressableScale onPress={() => navigation.navigate('AdminQueries')}>
                <Text style={styles.seeAll}>See All</Text>
              </PressableScale>
            </View>
            {openQueries.length === 0 ? (
              <View style={styles.emptyInner}>
                <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.textLight} />
                <Text style={styles.emptyText}>No open queries</Text>
              </View>
            ) : (
              openQueries.map((q, idx) => (
                <PressableScale
                  key={q.id}
                  containerStyle={[styles.queryRow, idx < openQueries.length - 1 && styles.rowBorder]}
                  onPress={() => navigation.navigate('AdminQueries')}
                >
                  <View style={[styles.queryIcon, {
                    backgroundColor: q.priority === 'urgent' ? '#FFEBEE' : q.priority === 'high' ? '#FFF3E0' : '#EEF0FF',
                  }]}>
                    <Ionicons name="chatbubble" size={16} color={q.priority === 'urgent' ? '#E53935' : q.priority === 'high' ? '#FB8C00' : '#4A6CF7'} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.querySubject} numberOfLines={1}>{q.subject}</Text>
                    <Text style={styles.queryFrom} numberOfLines={1}>{q.full_name || q.email}</Text>
                  </View>
                  <Text style={styles.queryDate}>{q.created_at ? new Date(q.created_at).toLocaleDateString() : ''}</Text>
                </PressableScale>
              ))
            )}
          </View>
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
    paddingTop: 8,
    paddingBottom: 40,
  },

  /* ── Quick action buttons (horizontal row) ── */
  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  quickItem: {
    alignItems: 'center',
    width: 72,
  },
  quickIconBox: {
    width: 68,
    height: 68,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  quickCount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    marginTop: 2,
  },

  /* ── Shared card wrapper ── */
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A6CF7',
  },

  /* ── Period pills ── */
  periodRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
  },
  periodPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
  },
  periodPillActive: {
    backgroundColor: '#4A6CF7',
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  periodTextActive: {
    color: '#fff',
  },

  /* ── Analytics boxes (3 columns) ── */
  analyticsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  analyticsBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  analyticsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  analyticsValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  analyticsLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },

  /* ── Active users ── */
  activeUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rankCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  rankNum: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  activeUserInfo: {
    flex: 1,
    marginLeft: 12,
  },
  activeUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  activeUserMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  activeUserDate: {
    fontSize: 12,
    color: colors.textLight,
  },

  /* ── Support queries ── */
  queryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  queryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  querySubject: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  queryFrom: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  queryDate: {
    fontSize: 12,
    color: colors.textLight,
    marginLeft: 8,
  },

  /* ── Empty state ── */
  emptyInner: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: 8,
    fontSize: 13,
  },
});
