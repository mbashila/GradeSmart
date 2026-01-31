import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/Header";
import Card from "../components/Card";
import Skeleton, { SkeletonCircle } from "../components/Skeleton";
import AnimatedScreen from "../components/AnimatedScreen";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { useTests } from "../context/TestsContext";
import { useScans } from "../context/ScansContext";
import storage from "../utils/storage";

export default function HistoryScreen({ navigation }) {
  const [selectedFilter, setSelectedFilter] = useState("all"); // 'all', 'recent', 'by-subject'
  const [loading, setLoading] = useState(true);
  const { tests } = useTests();
  const { scans } = useScans();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await storage.getItem('@gradesmart:history-filter');
        if (mounted && saved) setSelectedFilter(saved);
      } finally {
        if (mounted) setHydrated(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const parsePercentage = (scan, totalPoints) => {
    const p = scan?.percentage;
    if (typeof p === 'number') return p;
    if (typeof p === 'string') {
      const n = parseFloat(p.replace('%',''));
      if (!isNaN(n)) return n;
    }
    const s = parseFloat(scan?.score);
    const t = parseFloat(totalPoints);
    if (!isNaN(s) && !isNaN(t) && t > 0) return (s / t) * 100;
    return null;
  };

  const enrichedTests = React.useMemo(() => {
    return (tests || []).map((t) => {
      const testId = t.id;
      const related = scans.filter((s) => s.testId === testId);
      const papersGraded = related.length;
      let avg = 0;
      if (papersGraded > 0) {
        const nums = related.map((s) => parsePercentage(s, t.totalPoints)).filter((n) => typeof n === 'number');
        avg = nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
      }
      return {
        ...t,
        papersGraded,
        averageScore: avg,
      };
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [tests, scans]);

  const filteredTests = useMemo(() => {
    if (selectedFilter === 'recent') {
      return enrichedTests.slice(0, 10);
    }
    if (selectedFilter === 'by-subject') {
      return enrichedTests.slice().sort((a, b) => (a.subject || '').localeCompare(b.subject || '') || (new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
    }
    return enrichedTests;
  }, [enrichedTests, selectedFilter]);

  const sectionTitleText = selectedFilter === 'all' ? 'All Tests' : selectedFilter === 'recent' ? 'Recent Tests' : 'Tests by Subject';

  const totalTests = tests.length;
  const totalScans = scans.length;
  const overallAvg = React.useMemo(() => {
    if (totalScans === 0) return 0;
    const nums = scans.map((s) => parsePercentage(s, s?.testData?.totalPoints)).filter((n) => typeof n === 'number');
    if (nums.length === 0) return 0;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  }, [scans]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem('@gradesmart:history-filter', selectedFilter);
  }, [selectedFilter, hydrated]);

  const getScoreColor = (score) => {
    if (score >= 85) return colors.success;
    if (score >= 70) return colors.warning;
    return colors.error;
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <Header
          title="Test History"
          onBack={() => navigation.goBack()}
          rightIcon="search-outline"
          onRightPress={() => {}}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
        {/* Summary Statistics */}
        <AnimatedScreen>
          <View style={styles.summarySection}>
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{totalTests}</Text>
                  <Text style={styles.summaryLabel}>Tests</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{totalScans}</Text>
                  <Text style={styles.summaryLabel}>Scans</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{overallAvg}%</Text>
                  <Text style={styles.summaryLabel}>Average</Text>
                </View>
              </View>
            </Card>
          </View>
        </AnimatedScreen>

        {/* Filter Tabs */}
        <AnimatedScreen delay={80}>
          <View style={styles.filterSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  selectedFilter === "all" && styles.filterTabActive,
                ]}
                onPress={() => setSelectedFilter("all")}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    selectedFilter === "all" && styles.filterTabTextActive,
                  ]}
                >
                  All Tests
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  selectedFilter === "recent" && styles.filterTabActive,
                ]}
                onPress={() => setSelectedFilter("recent")}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    selectedFilter === "recent" && styles.filterTabTextActive,
                  ]}
                >
                  Recent
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  selectedFilter === "by-subject" && styles.filterTabActive,
                ]}
                onPress={() => setSelectedFilter("by-subject")}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    selectedFilter === "by-subject" && styles.filterTabTextActive,
                  ]}
                >
                  By Subject
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </AnimatedScreen>

        {/* Tests List */
        }
        <AnimatedScreen delay={160}>
          <View style={styles.testsSection}>
            <Text style={styles.sectionTitle}>{sectionTitleText}</Text>

            {loading ? (
              [1,2,3,4].map((idx) => (
                <Card key={idx} style={styles.testCard}>
                  <View style={styles.testCardHeader}>
                    <View style={styles.testCardInfo}>
                      <View style={styles.testCardTitleRow}>
                        <Skeleton width={'70%'} height={16} />
                        <Skeleton width={60} height={20} radius={10} style={{ marginLeft: 8 }} />
                      </View>
                      <Skeleton width={'35%'} height={12} />
                    </View>
                    <Skeleton width={52} height={28} radius={12} />
                  </View>
                  <View style={styles.testCardFooter}>
                    <View style={styles.testCardStat}>
                      <SkeletonCircle size={16} />
                      <Skeleton width={40} height={12} style={{ marginLeft: 6 }} />
                    </View>
                    <View style={styles.testCardStat}>
                      <SkeletonCircle size={16} />
                      <Skeleton width={90} height={12} style={{ marginLeft: 6 }} />
                    </View>
                    <Skeleton width={20} height={20} radius={10} />
                  </View>
                </Card>
              ))
            ) : enrichedTests.length === 0 ? (
              <Card style={[styles.testCard, { alignItems: 'center' }] }>
                <Ionicons name="document-text-outline" size={40} color={colors.secondary} />
                <Text style={[typography.h4, { color: colors.text, marginTop: 8 }]}>No test history yet</Text>
                <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>Create and grade a test to see it here.</Text>
              </Card>
            ) : (
              filteredTests.map((test) => (
                <Card
                  key={test.id}
                  style={styles.testCard}
                  onPress={() => navigation.navigate("TestDetails", { test })}
                >
                  <View style={styles.testCardHeader}>
                    <View style={styles.testCardInfo}>
                      <View style={styles.testCardTitleRow}>
                        <Text style={styles.testCardName}>{test.name || test.testName || 'Untitled Test'}</Text>
                        <View style={styles.subjectBadge}>
                          <Text style={styles.subjectBadgeText}>
                            {test.subject}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.testCardDate}>{test.createdAt ? new Date(test.createdAt).toLocaleDateString() : ''}</Text>
                    </View>
                    <View
                      style={[
                        styles.scoreBadge,
                        {
                          backgroundColor: getScoreColor(test.averageScore) + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.scoreBadgeText,
                          { color: getScoreColor(test.averageScore) },
                        ]}
                      >
                        {test.averageScore}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.testCardFooter}>
                    <View style={styles.testCardStat}>
                      <Ionicons
                        name="people"
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.testCardStatText}>{test.classRoom}</Text>
                    </View>
                    <View style={styles.testCardStat}>
                      <Ionicons
                        name="document-text"
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.testCardStatText}>{test.papersGraded} scans</Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={colors.textLight}
                    />
                  </View>
                </Card>
              ))
            )}
          </View>
        </AnimatedScreen>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  summarySection: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  summaryCard: {
    padding: 20,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryValue: {
    ...typography.h2,
    color: colors.secondary,
    marginBottom: 4,
  },
  summaryLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  filterSection: {
    paddingVertical: 16,
    paddingLeft: 24,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surfaceLight,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  filterTabText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.background,
    fontWeight: "600",
  },
  testsSection: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 16,
  },
  testCard: {
    marginBottom: 12,
  },
  testCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  testCardInfo: {
    flex: 1,
  },
  testCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  testCardName: {
    ...typography.h4,
    color: colors.text,
    marginRight: 8,
  },
  subjectBadge: {
    backgroundColor: colors.secondaryLight + "20",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  subjectBadgeText: {
    ...typography.caption,
    color: colors.secondary,
    fontWeight: "600",
  },
  testCardDate: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  scoreBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scoreBadgeText: {
    ...typography.body,
    fontWeight: "700",
  },
  testCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  testCardStat: {
    flexDirection: "row",
    alignItems: "center",
  },
  testCardStatText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: 6,
  },
});
