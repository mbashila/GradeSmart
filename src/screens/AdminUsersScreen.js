import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import PressableScale from '../components/PressableScale';
import { Skeleton } from '../components/Skeleton';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useAdmin } from '../context/AdminContext';

export default function AdminUsersScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { users, fetchUsers, updateUserRole, loading } = useAdmin();
  const promoteMode = route.params?.promoteMode ?? false;
  const initialFilter = route.params?.initialFilter ?? null;
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState(initialFilter ? initialFilter : promoteMode ? 'user' : 'all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (users.length === 0) fetchUsers();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [fetchUsers]);

  const filtered = useMemo(() => {
    let list = users;
    if (filterRole !== 'all') {
      if (filterRole === 'banned') {
        list = list.filter(u => u.is_banned);
      } else {
        list = list.filter(u => u.role === filterRole);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(u =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, search, filterRole]);

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'admin', label: 'Admins' },
    { key: 'moderator', label: 'Mods' },
    { key: 'banned', label: 'Banned' },
  ];

  const handlePromote = useCallback((u) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    const action = newRole === 'admin' ? 'Promote to Admin' : 'Remove Admin';
    Alert.alert(
      action,
      `${action}: ${u.full_name || u.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const { error } = await updateUserRole(u.id, newRole);
            if (error) Alert.alert('Error', error.message || 'Failed to update role.');
            else Alert.alert('Done', `${u.full_name || u.email} is now "${newRole}".`);
          },
        },
      ]
    );
  }, [updateUserRole]);

  const renderUser = useCallback(({ item: u }) => (
    <PressableScale
      containerStyle={styles.userRow}
      onPress={() => promoteMode ? handlePromote(u) : navigation.navigate('AdminUserDetail', { userId: u.id })}
    >
      <View style={[styles.userAvatar, { backgroundColor: colors.secondaryLight + '30' }]}>
        <Text style={styles.userAvatarText}>
          {(u.full_name || u.email || 'U')[0]?.toUpperCase() || 'U'}
        </Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>{u.full_name || 'No name'}</Text>
        <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
        <Text style={styles.userDate}>
          Joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
        </Text>
      </View>
      <View style={styles.userMeta}>
        {u.role === 'admin' && (
          <View style={[styles.badge, { backgroundColor: colors.accent + '20' }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>Admin</Text>
          </View>
        )}
        {u.role === 'moderator' && (
          <View style={[styles.badge, { backgroundColor: colors.secondary + '20' }]}>
            <Text style={[styles.badgeText, { color: colors.secondary }]}>Mod</Text>
          </View>
        )}
        {u.is_banned && (
          <View style={[styles.badge, { backgroundColor: colors.error + '20' }]}>
            <Text style={[styles.badgeText, { color: colors.error }]}>Banned</Text>
          </View>
        )}
        {promoteMode ? (
          <View style={[styles.badge, { backgroundColor: u.role === 'admin' ? colors.error + '20' : colors.accent + '20' }]}>
            <Text style={[styles.badgeText, { color: u.role === 'admin' ? colors.error : colors.accent }]}>
              {u.role === 'admin' ? 'Demote' : 'Promote'}
            </Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
        )}
      </View>
    </PressableScale>
  ), [colors, styles, navigation, promoteMode, handlePromote]);

  return (
    <View style={styles.container}>
      <Header title={promoteMode ? "Add / Remove Admin" : "Manage Users"} onBack={() => navigation.goBack()} />

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textLight} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <PressableScale onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textLight} />
          </PressableScale>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filtersRow}>
        {filters.map(f => (
          <PressableScale
            key={f.key}
            containerStyle={[
              styles.filterChip,
              filterRole === f.key && { backgroundColor: colors.secondary },
            ]}
            onPress={() => setFilterRole(f.key)}
          >
            <Text style={[
              styles.filterChipText,
              filterRole === f.key && { color: '#fff' },
            ]}>{f.label}</Text>
          </PressableScale>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={styles.countText}>{filtered.length} users</Text>
      </View>

      {/* User list */}
      {loading && users.length === 0 ? (
        <View style={styles.listContent}>
          {[1,2,3,4,5].map(i => (
            <View key={i} style={styles.userRow}>
              <Skeleton width={44} height={44} radius={22} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Skeleton width={140} height={14} />
                <Skeleton width={180} height={12} style={{ marginTop: 4 }} />
                <Skeleton width={100} height={10} style={{ marginTop: 4 }} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderUser}
          keyExtractor={u => u.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.secondary} />}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="search-outline" size={32} color={colors.textLight} />
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 24,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  countText: {
    fontSize: 12,
    color: colors.textLight,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 4,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.secondary,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  userEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userDate: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: 8,
    fontSize: 14,
  },
});
