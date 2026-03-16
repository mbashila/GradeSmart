import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import PressableScale from '../components/PressableScale';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useNotifications } from '../context/NotificationsContext';
import { elevation } from '../theme/elevation';
import { useScans } from '../context/ScansContext';
import { useTests } from '../context/TestsContext';
import { useAuth } from '../context/AuthContext';
import { useLikes } from '../context/LikesContext';

export default function DashboardScreen({ navigation }) {
  const { unreadCount } = useNotifications();
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;
  const { scans } = useScans();
  const { tests } = useTests();
  const { user } = useAuth();
  const { isLiked, toggleLike } = useLikes();
  const displayName = React.useMemo(() => {
    const name = user?.user_metadata?.full_name || '';
    if (name && String(name).trim().length > 0) return name;
    const email = user?.email || '';
    if (email) return email.split('@')[0];
    return 'User';
  }, [user]);
  const scannedCount = scans.length;
  const testsCreated = tests.length;
  const gradedTestsCount = React.useMemo(() => {
    const ids = new Set();
    scans.forEach((s) => {
      if (s?.testId) ids.add(s.testId);
    });
    return ids.size;
  }, [scans]);
  const recentScansList = React.useMemo(() => (
    scans
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3)
  ), [scans]);

  // Tests where scanned students < expected students
  const unfinishedTests = React.useMemo(() => {
    return tests
      .filter((t) => {
        const expected = parseInt(t.numberOfStudents, 10) || 0;
        if (expected <= 0) return false;
        const scannedForTest = scans.filter((s) => s.testId === t.id).length;
        return scannedForTest < expected;
      })
      .map((t) => {
        const expected = parseInt(t.numberOfStudents, 10) || 0;
        const scannedForTest = scans.filter((s) => s.testId === t.id).length;
        return { ...t, expected, scanned: scannedForTest, remaining: expected - scannedForTest };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [tests, scans]);

  
  
  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isTablet ? (
          <View style={styles.tabletRow}>
            <View style={styles.tabletLeft}>
              <AnimatedScreen>
                <View style={styles.heroContainer}>
                  <View style={styles.heroTopRow}>
                    <View>
                      <Text style={styles.welcomeSmall}>Welcome back,</Text>
                      <Text style={styles.welcomeName}>{displayName}</Text>
                    </View>
                    <PressableScale onPress={() => navigation.navigate('Profile')}>
                      <View style={styles.headerIconButton}>
                        <Ionicons name="person-circle-outline" size={28} color={colors.text} />
                        {!!unreadCount && unreadCount > 0 && (
                          <View style={styles.headerBadge}>
                            <Text style={styles.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                          </View>
                        )}
                      </View>
                    </PressableScale>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <View style={styles.statIconWrap}>
                        <Ionicons name="albums-outline" size={20} color={colors.secondary} />
                      </View>
                      <Text style={styles.statValue}>{testsCreated}</Text>
                      <Text style={styles.statLabel}>Tests</Text>
                    </View>
                    <View style={styles.statCard}>
                      <View style={styles.statIconWrap}>
                        <Ionicons name="document-text-outline" size={20} color={colors.secondary} />
                      </View>
                      <Text style={styles.statValue}>{gradedTestsCount}</Text>
                      <Text style={styles.statLabel}>Graded Tests</Text>
                    </View>
                    <View style={styles.statCard}>
                      <View style={styles.statIconWrap}>
                        <Ionicons name="scan-outline" size={20} color={colors.secondary} />
                      </View>
                      <Text style={styles.statValue}>{scannedCount}</Text>
                      <Text style={styles.statLabel}>Scans</Text>
                    </View>
                  </View>
                </View>
              </AnimatedScreen>
            </View>
            <View style={styles.tabletRight}>
              <AnimatedScreen delay={120}>
                <View style={[styles.actionButtons, styles.noPadX]}>
                  <View style={styles.miniActionsRow}>
                    <PressableScale containerStyle={styles.miniAction} onPress={() => navigation.navigate('Scan')} haptic={true}>
                      <View style={styles.miniActionIconCircle}>
                        <Ionicons name="camera" size={20} color={colors.secondary} />
                      </View>
                      <Text style={styles.miniActionText}>Scan Papers</Text>
                    </PressableScale>
                    <PressableScale containerStyle={[styles.miniAction, { marginLeft: 16 }]} onPress={() => navigation.navigate('History')} haptic={true}>
                      <View style={styles.miniActionIconCircle}>
                        <Ionicons name="bar-chart" size={20} color={colors.secondary} />
                      </View>
                      <Text style={styles.miniActionText}>View Results</Text>
                    </PressableScale>
                  </View>

                  <PressableScale onPress={() => navigation.navigate('CreateTest')} haptic={true}>
                    <LinearGradient
                      colors={[colors.secondaryLight, colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryHeroCard}
                    >
                      <View style={styles.primaryHeroLeft}>
                        <View style={styles.heroPlusWrap}>
                          <Ionicons name="add" size={22} color={colors.background} />
                        </View>
                        <View>
                          <Text style={styles.heroTitle}>Create New Test</Text>
                          <Text style={styles.heroSubtitle}>Start grading in minutes</Text>
                        </View>
                      </View>
                      <Ionicons name="scan-outline" size={28} color={'rgba(255,255,255,0.85)'} />
                    </LinearGradient>
                  </PressableScale>
                </View>
              </AnimatedScreen>

              
            </View>
          </View>
        ) : (
          <>
            <AnimatedScreen>
              <View style={styles.heroContainer}>
                <View style={styles.heroTopRow}>
                  <View>
                    <Text style={styles.welcomeSmall}>Welcome back,</Text>
                    <Text style={styles.welcomeName}>{displayName}</Text>
                  </View>
                  <PressableScale onPress={() => navigation.navigate('Profile')}>
                    <View style={styles.headerIconButton}>
                      <Ionicons name="person-circle-outline" size={28} color={colors.text} />
                      {!!unreadCount && unreadCount > 0 && (
                        <View style={styles.headerBadge}>
                          <Text style={styles.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                        </View>
                      )}
                    </View>
                  </PressableScale>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <View style={styles.statIconWrap}>
                      <Ionicons name="albums-outline" size={20} color={colors.secondary} />
                    </View>
                    <Text style={styles.statValue}>{testsCreated}</Text>
                    <Text style={styles.statLabel}>Tests</Text>
                  </View>
                  <View style={styles.statCard}>
                    <View style={styles.statIconWrap}>
                      <Ionicons name="document-text-outline" size={20} color={colors.secondary} />
                    </View>
                    <Text style={styles.statValue}>{gradedTestsCount}</Text>
                    <Text style={styles.statLabel}>Graded Tests</Text>
                  </View>
                  <View style={styles.statCard}>
                    <View style={styles.statIconWrap}>
                      <Ionicons name="scan-outline" size={20} color={colors.secondary} />
                    </View>
                    <Text style={styles.statValue}>{scannedCount}</Text>
                    <Text style={styles.statLabel}>Scans</Text>
                  </View>
                </View>
              </View>
            </AnimatedScreen>
            <AnimatedScreen delay={120}>
              <View style={styles.actionButtons}>
                <View style={styles.miniActionsRow}>
                  <PressableScale containerStyle={styles.miniAction} onPress={() => navigation.navigate('Scan')} haptic={true}>
                    <View style={styles.miniActionIconCircle}>
                      <Ionicons name="camera" size={20} color={colors.secondary} />
                    </View>
                    <Text style={styles.miniActionText}>Scan Papers</Text>
                  </PressableScale>
                  <PressableScale containerStyle={[styles.miniAction, { marginLeft: 16 }]} onPress={() => navigation.navigate('History')} haptic={true}>
                    <View style={styles.miniActionIconCircle}>
                      <Ionicons name="bar-chart" size={20} color={colors.secondary} />
                    </View>
                    <Text style={styles.miniActionText}>View Results</Text>
                  </PressableScale>
                </View>
                <PressableScale onPress={() => navigation.navigate('CreateTest')} haptic={true}>
                  <LinearGradient
                    colors={[colors.secondaryLight, colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryHeroCard}
                  >
                    <View style={styles.primaryHeroLeft}>
                      <View style={styles.heroPlusWrap}>
                        <Ionicons name="add" size={22} color={colors.background} />
                      </View>
                      <View>
                        <Text style={styles.heroTitle}>Create New Test</Text>
                        <Text style={styles.heroSubtitle}>Start grading in minutes</Text>
                      </View>
                    </View>
                    <Ionicons name="scan-outline" size={28} color={'rgba(255,255,255,0.85)'} />
                  </LinearGradient>
                </PressableScale>
              </View>
            </AnimatedScreen>
            
          </>
        )}
        
        {/* Unfinished Scans */}
        {unfinishedTests.length > 0 && (
          <AnimatedScreen delay={240}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Continue Unfinished Scans</Text>
              {unfinishedTests.map((t) => (
                <PressableScale
                  key={t.id}
                  containerStyle={styles.unfinishedCard}
                  onPress={() => navigation.navigate('Scan', { testData: t })}
                  haptic={true}
                >
                  <View style={styles.unfinishedHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.unfinishedName}>{t.testName || t.title || t.name || 'Test'}</Text>
                      <Text style={styles.unfinishedMeta}>{t.subject} • {t.classRoom || t.grade}</Text>
                    </View>
                    <View style={styles.unfinishedBadge}>
                      <Text style={styles.unfinishedBadgeText}>{t.remaining} left</Text>
                    </View>
                  </View>
                  <View style={styles.unfinishedProgress}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${Math.round((t.scanned / t.expected) * 100)}%` }]} />
                    </View>
                    <Text style={styles.unfinishedCount}>{t.scanned}/{t.expected} scanned</Text>
                  </View>
                </PressableScale>
              ))}
            </View>
          </AnimatedScreen>
        )}
        <AnimatedScreen delay={300}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Scans</Text>
            {recentScansList.length === 0 ? (
              <Card style={[styles.testCard, { alignItems: 'center' }] }>
                <Ionicons name="scan-outline" size={40} color={colors.secondary} />
                <Text style={[typography.h4, { color: colors.text, marginTop: 8 }]}>No scans yet</Text>
                <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>Scan a paper to see it here.</Text>
              </Card>
            ) : (
              recentScansList.map((scan) => (
                <Card
                  key={scan.id}
                  style={styles.testCard}
                  onPress={() => navigation.navigate('Results', {
                    studentName: scan.studentName,
                    score: scan.score,
                    percentage: scan.percentage,
                    testData: scan.testData,
                    images: scan.images,
                  })}
                >
                  <View style={styles.testCardHeader}>
                    <View style={styles.testCardInfo}>
                      <Text style={styles.testCardName}>{scan.studentName || 'Student'}</Text>
                      <Text style={styles.testCardDate}>{new Date(scan.createdAt).toLocaleString()}</Text>
                    </View>
                  </View>
                  <View style={styles.testCardFooter}>
                    <View style={styles.testCardStat}>
                      <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.testCardStatText}>{scan.pages || (scan.images ? scan.images.length : 0)} pages</Text>
                    </View>
                    <PressableScale onPress={() => toggleLike(scan.id)}>
                      <Ionicons name={isLiked(scan.id) ? 'heart' : 'heart-outline'} size={20} color={isLiked(scan.id) ? colors.error : colors.textLight} />
                    </PressableScale>
                    <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
                  </View>
                </Card>
              ))
            )}
          </View>
        </AnimatedScreen>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
  },
  tabletRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 16,
  },
  tabletLeft: {
    flex: 1,
    marginRight: 8,
  },
  tabletRight: {
    flex: 1,
    marginLeft: 8,
  },
  heroContainer: {
    backgroundColor: Platform.select({ android: colors.surface, default: colors.secondaryLight + '15' }),
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...elevation.e4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  welcomeSmall: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  welcomeName: {
    ...typography.h2,
    color: colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: Platform.select({ android: colors.background, default: colors.surface }),
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 6,
    alignItems: 'flex-start',
    ...elevation.e4,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Platform.select({ android: colors.secondaryLight + '10', default: colors.secondaryLight + '20' }),
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
    marginTop: 8,
  },
  statLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    padding: 4,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  welcomeSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  welcomeText: {
    ...typography.h2,
    color: colors.text,
  },
  actionButtons: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  noPadX: {
    paddingHorizontal: 0,
  },
  miniActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  miniAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniActionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.secondaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  miniActionText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  primaryHeroCard: {
    backgroundColor: colors.secondary,
    borderRadius: 24,
    padding: 20,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    ...elevation.e6,
  },
  primaryHeroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroPlusWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  heroTitle: {
    ...typography.h4,
    color: colors.background,
  },
  heroSubtitle: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  actionButton: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonPrimary: {
    backgroundColor: colors.secondary,
  },
  actionButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionButtonIconPrimary: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  actionButtonTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: 4,
  },
  actionButtonTitleOnPrimary: {
    color: colors.background,
  },
  actionButtonSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  section: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 16,
  },
  testCard: {
    marginBottom: 12,
    borderRadius: 20,
  },
  testCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  testCardInfo: {
    flex: 1,
  },
  testCardName: {
    ...typography.h4,
    color: colors.text,
    marginBottom: 4,
  },
  testCardDate: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  testCardScore: {
    backgroundColor: colors.secondaryLight + '20',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  testCardScoreText: {
    ...typography.body,
    color: colors.secondaryLight,
    fontWeight: '600',
  },
  testCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  testCardStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testCardStatText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  quickActionText: {
    ...typography.body,
    color: colors.text,
    marginLeft: 12,
    flex: 1,
  },
  unfinishedCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
  },
  unfinishedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  unfinishedName: {
    ...typography.h4,
    color: colors.text,
  },
  unfinishedMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  unfinishedBadge: {
    backgroundColor: colors.secondaryLight + '20',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unfinishedBadgeText: {
    ...typography.bodySmall,
    color: colors.secondary,
    fontWeight: '700',
  },
  unfinishedProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 10,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: colors.secondary,
    borderRadius: 3,
  },
  unfinishedCount: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
    minWidth: 70,
    textAlign: 'right',
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  testCardTablet: {
    width: '48%',
  },
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeText: {
    fontSize: 10,
    color: colors.background,
    fontWeight: '700',
  },
});
