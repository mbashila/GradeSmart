import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/Header";
import Card from "../components/Card";
import Skeleton, { SkeletonCircle } from "../components/Skeleton";
import AnimatedScreen from "../components/AnimatedScreen";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

export default function HistoryScreen({ navigation }) {
  const [selectedFilter, setSelectedFilter] = useState("all"); // 'all', 'recent', 'by-subject'
  const [loading, setLoading] = useState(true);

  const tests = [
    {
      id: 1,
      name: "Math Quiz - Class 5A",
      date: "April 24, 2024",
      subject: "Math",
      classRoom: "5A",
      papersGraded: 22,
      averageScore: 88,
      status: "completed",
    },
    {
      id: 2,
      name: "History Test - Class 7B",
      date: "April 20, 2024",
      subject: "History",
      classRoom: "7B",
      papersGraded: 28,
      averageScore: 82,
      status: "completed",
    },
    {
      id: 3,
      name: "Science Exam - Class 6C",
      date: "April 18, 2024",
      subject: "Science",
      classRoom: "6C",
      papersGraded: 11,
      averageScore: 80,
      status: "completed",
    },
    {
      id: 4,
      name: "English Quiz - Class 8A",
      date: "April 15, 2024",
      subject: "English",
      classRoom: "8A",
      papersGraded: 25,
      averageScore: 87,
      status: "completed",
    },
  ];

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(t);
  }, []);

  const getScoreColor = (score) => {
    if (score >= 85) return colors.success;
    if (score >= 70) return colors.warning;
    return colors.error;
  };

  return (
    <View style={styles.container}>
      <Header
        title="Test History"
        onBack={() => navigation.goBack()}
        rightIcon="search-outline"
        onRightPress={() => {}}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Summary Statistics */}
        <AnimatedScreen>
          <View style={styles.summarySection}>
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{tests.length}</Text>
                  <Text style={styles.summaryLabel}>Total Tests</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {tests.reduce((sum, t) => sum + t.papersGraded, 0)}
                  </Text>
                  <Text style={styles.summaryLabel}>Papers Graded</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {Math.round(
                      tests.reduce((sum, t) => sum + t.averageScore, 0) /
                        tests.length
                    )}
                    %
                  </Text>
                  <Text style={styles.summaryLabel}>Avg Score</Text>
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

        {/* Tests List */}
        <AnimatedScreen delay={160}>
          <View style={styles.testsSection}>
            <Text style={styles.sectionTitle}>All Tests</Text>

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
            ) : tests.length === 0 ? (
              <Card style={[styles.testCard, { alignItems: 'center' }] }>
                <Ionicons name="document-text-outline" size={40} color={colors.secondary} />
                <Text style={[typography.h4, { color: colors.text, marginTop: 8 }]}>No test history yet</Text>
                <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>Create and grade a test to see it here.</Text>
              </Card>
            ) : (
              tests.map((test) => (
                <Card
                  key={test.id}
                  style={styles.testCard}
                  onPress={() => navigation.navigate("TestDetails", { test })}
                >
                  <View style={styles.testCardHeader}>
                    <View style={styles.testCardInfo}>
                      <View style={styles.testCardTitleRow}>
                        <Text style={styles.testCardName}>{test.name}</Text>
                        <View style={styles.subjectBadge}>
                          <Text style={styles.subjectBadgeText}>
                            {test.subject}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.testCardDate}>{test.date}</Text>
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
                      <Text style={styles.testCardStatText}>
                        {test.papersGraded} papers
                      </Text>
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
