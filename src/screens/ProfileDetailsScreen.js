import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import { Skeleton, SkeletonCircle } from '../components/Skeleton';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';

export default function ProfileDetailsScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { user } = useAuth();
  const { isPro, planLabel } = useSubscription();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);
  const meta = user?.user_metadata || {};
  const avatarUrl = meta.avatar_url || null;

  const displayName = React.useMemo(() => {
    const name = meta.full_name || '';
    if (name && String(name).trim().length > 0) return name;
    const email = user?.email || '';
    if (email) return email.split('@')[0];
    return 'User';
  }, [user]);

  const detailSections = [
    {
      title: 'Personal Information',
      rows: [
        { icon: 'person-outline', label: 'Full Name', value: meta.full_name || 'Not set' },
        { icon: 'mail-outline', label: 'Email', value: user?.email || 'Not set' },
        { icon: 'call-outline', label: 'Phone', value: meta.phone || 'Not set' },
        { icon: 'location-outline', label: 'Location', value: meta.location || 'Not set' },
      ],
    },
    {
      title: 'Professional Details',
      rows: [
        { icon: 'school-outline', label: 'School / Institution', value: meta.school || 'Not set' },
        { icon: 'document-text-outline', label: 'Bio', value: meta.bio || 'Not set' },
      ],
    },
    {
      title: 'Account',
      rows: [
        { icon: 'diamond-outline', label: 'Plan', value: `${planLabel}${isPro ? ' (Active)' : ''}` },
        { icon: 'calendar-outline', label: 'Member Since', value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown' },
        { icon: 'finger-print-outline', label: 'User ID', value: user?.id ? `${user.id.substring(0, 8)}...` : 'N/A' },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <Header title="Profile Details" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AnimatedScreen>
          {loading ? (
            <>
              {/* Skeleton hero */}
              <View style={styles.heroSection}>
                <SkeletonCircle size={110} />
                <Skeleton width={160} height={22} style={{ marginTop: 14 }} />
                <Skeleton width={200} height={14} style={{ marginTop: 6 }} />
                <Skeleton width={120} height={36} radius={20} style={{ marginTop: 14 }} />
              </View>
              {/* Skeleton cards */}
              {[1,2,3].map(s => (
                <View key={s} style={styles.card}>
                  <Skeleton width={140} height={16} style={{ marginBottom: 12 }} />
                  {[1,2,3].map(r => (
                    <View key={r} style={[styles.row, r < 3 && styles.rowBorder]}>
                      <View style={styles.rowLeft}>
                        <Skeleton width={32} height={32} radius={8} />
                        <Skeleton width={100} height={14} style={{ marginLeft: 12 }} />
                      </View>
                      <Skeleton width={80} height={14} />
                    </View>
                  ))}
                </View>
              ))}
            </>
          ) : (
            <>
              {/* Large avatar + name header */}
              <View style={styles.heroSection}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>
                      {(displayName || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.name}>{displayName}</Text>
                <Text style={styles.email}>{user?.email || ''}</Text>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => navigation.navigate('EditProfile')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={16} color={colors.secondary} />
                  <Text style={styles.editBtnText}>Edit Profile</Text>
                </TouchableOpacity>
              </View>

              {/* Detail sections */}
              {detailSections.map((section) => (
                <View key={section.title} style={styles.card}>
                  <Text style={styles.cardTitle}>{section.title}</Text>
                  {section.rows.map((row, i) => (
                    <View key={row.label} style={[styles.row, i < section.rows.length - 1 && styles.rowBorder]}>
                      <View style={styles.rowLeft}>
                        <View style={styles.rowIconWrap}>
                          <Ionicons name={row.icon} size={18} color={colors.secondary} />
                        </View>
                        <Text style={styles.rowLabel}>{row.label}</Text>
                      </View>
                      <Text style={[styles.rowValue, row.value === 'Not set' && styles.rowValueEmpty]} numberOfLines={2}>
                        {row.value}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.border,
  },
  avatarFallback: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.secondaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.secondaryLight + '40',
  },
  avatarInitial: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.secondary,
  },
  name: {
    ...typography.h2,
    color: colors.text,
    marginTop: 14,
  },
  email: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.secondaryLight + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowLabel: {
    ...typography.body,
    color: colors.text,
  },
  rowValue: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
    maxWidth: '45%',
    textAlign: 'right',
  },
  rowValueEmpty: {
    color: colors.textLight,
    fontStyle: 'italic',
  },
});
