import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import PressableScale from '../components/PressableScale';
import Skeleton, { SkeletonCircle } from '../components/Skeleton';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useNotifications } from '../context/NotificationsContext';
import { elevation } from '../theme/elevation';

export default function DashboardScreen({ navigation }) {
  const { unreadCount } = useNotifications();
  const [loadingRecent, setLoadingRecent] = useState(true);
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;
  useEffect(() => {
    const t = setTimeout(() => setLoadingRecent(false), 650);
    return () => clearTimeout(t);
  }, []);

  const recentTests = [
    {
      id: 1,
      name: 'Math Quiz - Class 5A',
      date: 'April 24, 2024',
      papersGraded: 22,
      averageScore: 88,
      subject: 'Math',
    },
    {
      id: 2,
      name: 'History Test - Class 7B',
      date: 'April 20, 2024',
      papersGraded: 28,
      averageScore: 82,
      subject: 'History',
    },
  ];
  
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
                      <Text style={styles.welcomeName}>Sarah!</Text>
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
                        <Ionicons name="document-text-outline" size={20} color={colors.secondary} />
                      </View>
                      <Text style={styles.statValue}>0</Text>
                      <Text style={styles.statLabel}>Tests Graded</Text>
                    </View>
                    <View style={styles.statCard}>
                      <View style={styles.statIconWrap}>
                        <Ionicons name="scan-outline" size={20} color={colors.secondary} />
                      </View>
                      <Text style={styles.statValue}>0</Text>
                      <Text style={styles.statLabel}>Papers Scanned</Text>
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

              <AnimatedScreen delay={180}>
                <View style={[styles.section, styles.noPadX]}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Tests</Text>
                    <PressableScale onPress={() => navigation.navigate('History')} containerStyle={styles.viewAllBtn} haptic={true}>
                      <Ionicons name="refresh-circle" size={18} color={colors.textSecondary} />
                      <Text style={styles.viewAllText}>View all</Text>
                    </PressableScale>
                  </View>
                  <View style={styles.recentGrid}>
                    {loadingRecent ? (
                      [1,2].map((idx) => (
                        <Card key={idx} style={[styles.testCard, styles.testCardTablet]}>
                          <View style={styles.testCardHeader}>
                            <View style={styles.testCardInfo}>
                              <Skeleton width={'70%'} height={16} />
                              <Skeleton width={'40%'} height={12} style={{ marginTop: 8 }} />
                            </View>
                            <Skeleton width={42} height={24} radius={12} />
                          </View>
                          <View style={styles.testCardFooter}>
                            <View style={styles.testCardStat}>
                              <SkeletonCircle size={16} />
                              <Skeleton width={120} height={12} style={{ marginLeft: 8 }} />
                            </View>
                            <Skeleton width={20} height={20} radius={10} />
                          </View>
                        </Card>
                      ))
                    ) : recentTests.length === 0 ? (
                      <Card style={[styles.testCard, styles.testCardTablet, { alignItems: 'center' }] }>
                        <Ionicons name="document-text-outline" size={40} color={colors.secondary} />
                        <Text style={[typography.h4, { color: colors.text, marginTop: 8 }]}>No recent tests</Text>
                        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>Create your first test to see it here.</Text>
                      </Card>
                    ) : (
                      recentTests.map((test) => (
                        <Card
                          key={test.id}
                          style={[styles.testCard, styles.testCardTablet]}
                          onPress={() => navigation.navigate('TestDetails', { test })}
                        >
                          <View style={styles.testCardHeader}>
                            <View style={styles.testCardInfo}>
                              <Text style={styles.testCardName}>{test.name}</Text>
                              <Text style={styles.testCardDate}>{test.date}</Text>
                            </View>
                            <View style={styles.testCardScore}>
                              <Text style={styles.testCardScoreText}>{test.averageScore}%</Text>
                            </View>
                          </View>
                          <View style={styles.testCardFooter}>
                            <View style={styles.testCardStat}>
                              <Ionicons name="document-text" size={16} color={colors.textSecondary} />
                              <Text style={styles.testCardStatText}>{test.papersGraded} papers graded</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
                          </View>
                        </Card>
                      ))
                    )}
                  </View>
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
                    <Text style={styles.welcomeName}>Sarah!</Text>
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
                      <Ionicons name="document-text-outline" size={20} color={colors.secondary} />
                    </View>
                    <Text style={styles.statValue}>0</Text>
                    <Text style={styles.statLabel}>Tests Graded</Text>
                  </View>
                  <View style={styles.statCard}>
                    <View style={styles.statIconWrap}>
                      <Ionicons name="scan-outline" size={20} color={colors.secondary} />
                    </View>
                    <Text style={styles.statValue}>0</Text>
                    <Text style={styles.statLabel}>Papers Scanned</Text>
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
            <AnimatedScreen delay={180}>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent Tests</Text>
                  <PressableScale onPress={() => navigation.navigate('History')} containerStyle={styles.viewAllBtn} haptic={true}>
                    <Ionicons name="refresh-circle" size={18} color={colors.textSecondary} />
                    <Text style={styles.viewAllText}>View all</Text>
                  </PressableScale>
                </View>
                
                <View style={isTablet ? styles.recentGrid : undefined}>
                  {loadingRecent ? (
                    [1,2].map((idx) => (
                      <Card key={idx} style={styles.testCard}>
                        <View style={styles.testCardHeader}>
                          <View style={styles.testCardInfo}>
                            <Skeleton width={'70%'} height={16} />
                            <Skeleton width={'40%'} height={12} style={{ marginTop: 8 }} />
                          </View>
                          <Skeleton width={42} height={24} radius={12} />
                        </View>
                        <View style={styles.testCardFooter}>
                          <View style={styles.testCardStat}>
                            <SkeletonCircle size={16} />
                            <Skeleton width={120} height={12} style={{ marginLeft: 8 }} />
                          </View>
                          <Skeleton width={20} height={20} radius={10} />
                        </View>
                      </Card>
                    ))
                  ) : recentTests.length === 0 ? (
                    <Card style={[styles.testCard, { alignItems: 'center' }] }>
                      <Ionicons name="document-text-outline" size={40} color={colors.secondary} />
                      <Text style={[typography.h4, { color: colors.text, marginTop: 8 }]}>No recent tests</Text>
                      <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>Create your first test to see it here.</Text>
                    </Card>
                  ) : (
                    recentTests.map((test) => (
                      <Card
                        key={test.id}
                        style={styles.testCard}
                        onPress={() => navigation.navigate('TestDetails', { test })}
                      >
                        <View style={styles.testCardHeader}>
                          <View style={styles.testCardInfo}>
                            <Text style={styles.testCardName}>{test.name}</Text>
                            <Text style={styles.testCardDate}>{test.date}</Text>
                          </View>
                          <View style={styles.testCardScore}>
                            <Text style={styles.testCardScoreText}>{test.averageScore}%</Text>
                          </View>
                        </View>
                        
                        <View style={styles.testCardFooter}>
                          <View style={styles.testCardStat}>
                            <Ionicons name="document-text" size={16} color={colors.textSecondary} />
                            <Text style={styles.testCardStatText}>{test.papersGraded} papers graded</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
                        </View>
                      </Card>
                    ))
                  )}
                </View>
              </View>
            </AnimatedScreen>
          </>
        )}
        
        {/* Quick Actions */}
        <AnimatedScreen delay={240}>
          <View style={styles.section}>
            <PressableScale containerStyle={styles.quickAction} onPress={() => navigation.navigate('History')} haptic={true}>
              <Ionicons name="time-outline" size={24} color={colors.secondaryLight} />
              <Text style={styles.quickActionText}>Continue Unfinished Scans</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </PressableScale>
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
