import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import AnimatedScreen from '../components/AnimatedScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export default function TestDetailsScreen({ navigation, route }) {
  const { test } = route.params || {};
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'analytics'
  
  // Mock student data
  const students = [
    { id: 1, name: 'Elizabeth Rivera', score: 95, percentage: 95, grade: 'A', status: 'graded' },
    { id: 2, name: 'James Lee', score: 90, percentage: 90, grade: 'A', status: 'graded' },
    { id: 3, name: 'Mary Johnson', score: 80, percentage: 80, grade: 'B', status: 'graded' },
    { id: 4, name: 'Emily Carter', score: 46, percentage: 75, grade: 'C', status: 'graded' },
    { id: 5, name: 'Alden Harris', score: 70, percentage: 70, grade: 'C', status: 'graded' },
  ];
  
  const getGradeColor = (grade) => {
    switch (grade) {
      case 'A': return colors.success;
      case 'B': return colors.info;
      case 'C': return colors.warning;
      default: return colors.error;
    }
  };
  
  const getScoreColor = (percentage) => {
    if (percentage >= 85) return colors.success;
    if (percentage >= 70) return colors.warning;
    return colors.error;
  };
  
  return (
    <View style={styles.container}>
      <Header
        title={test?.name || 'Test Details'}
        onBack={() => navigation.goBack()}
        rightIcon="ellipsis-vertical"
        onRightPress={() => {}}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Test Info Card */}
        <AnimatedScreen>
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="calendar" size={20} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{test?.date || 'N/A'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="people" size={20} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Class</Text>
                <Text style={styles.infoValue}>{test?.classRoom || 'N/A'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="document-text" size={20} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Papers</Text>
                <Text style={styles.infoValue}>{test?.papersGraded || 0}</Text>
              </View>
            </View>
            
            <View style={styles.averageScore}>
              <Text style={styles.averageScoreLabel}>Class Average</Text>
              <Text style={styles.averageScoreValue}>{test?.averageScore || 0}%</Text>
            </View>
          </Card>
        </AnimatedScreen>
        
        {/* View Mode Toggle */}
        <AnimatedScreen delay={80}>
          <View style={styles.viewModeSection}>
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                viewMode === 'list' && styles.viewModeButtonActive,
              ]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons 
                name="list" 
                size={20} 
                color={viewMode === 'list' ? colors.background : colors.textSecondary} 
              />
              <Text
                style={[
                  styles.viewModeText,
                  viewMode === 'list' && styles.viewModeTextActive,
                ]}
              >
                List View
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                viewMode === 'analytics' && styles.viewModeButtonActive,
              ]}
              onPress={() => setViewMode('analytics')}
            >
              <Ionicons 
                name="bar-chart" 
                size={20} 
                color={viewMode === 'analytics' ? colors.background : colors.textSecondary} 
              />
              <Text
                style={[
                  styles.viewModeText,
                  viewMode === 'analytics' && styles.viewModeTextActive,
                ]}
              >
                Analytics
              </Text>
            </TouchableOpacity>
          </View>
        </AnimatedScreen>
        
        {/* Students List */}
        {viewMode === 'list' && (
          <AnimatedScreen delay={160}>
            <View style={styles.studentsSection}>
              <Text style={styles.sectionTitle}>Student Results</Text>
              
              {students.map((student) => (
                <Card
                  key={student.id}
                  style={styles.studentCard}
                  onPress={() => {
                    navigation.navigate('Results', {
                      studentName: student.name,
                      score: student.score,
                      percentage: student.percentage,
                      testData: test,
                    });
                  }}
                >
                  <View style={styles.studentCardHeader}>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{student.name}</Text>
                      <Text style={styles.studentScore}>
                        Score: {student.score} / {test?.totalPoints || 100}
                      </Text>
                    </View>
                    <View style={styles.studentGrades}>
                      <View style={[
                        styles.percentageBadge,
                        { backgroundColor: getScoreColor(student.percentage) + '20' }
                      ]}>
                        <Text style={[
                          styles.percentageText,
                          { color: getScoreColor(student.percentage) }
                        ]}>
                          {student.percentage}%
                        </Text>
                      </View>
                      <View style={[
                        styles.gradeBadge,
                        { backgroundColor: getGradeColor(student.grade) + '20' }
                      ]}>
                        <Text style={[
                          styles.gradeText,
                          { color: getGradeColor(student.grade) }
                        ]}>
                          {student.grade}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </AnimatedScreen>
        )}
        
        {/* Analytics View */}
        {viewMode === 'analytics' && (
          <AnimatedScreen delay={160}>
            <View style={styles.analyticsSection}>
              <Card style={styles.analyticsCard}>
                <Text style={styles.analyticsTitle}>Performance Distribution</Text>
                <View style={styles.distribution}>
                  <View style={styles.distributionBar}>
                    <View style={[styles.distributionFill, { width: '60%', backgroundColor: colors.success }]} />
                    <Text style={styles.distributionLabel}>A (85-100%)</Text>
                  </View>
                  <View style={styles.distributionBar}>
                    <View style={[styles.distributionFill, { width: '20%', backgroundColor: colors.info }]} />
                    <Text style={styles.distributionLabel}>B (70-84%)</Text>
                  </View>
                  <View style={styles.distributionBar}>
                    <View style={[styles.distributionFill, { width: '20%', backgroundColor: colors.warning }]} />
                    <Text style={styles.distributionLabel}>C (60-69%)</Text>
                  </View>
                </View>
              </Card>
              
              <Card style={styles.analyticsCard}>
                <Text style={styles.analyticsTitle}>Class Overview</Text>
                <View style={styles.overviewStats}>
                  <View style={styles.overviewStat}>
                    <Text style={styles.overviewValue}>{test?.averageScore || 0}%</Text>
                    <Text style={styles.overviewLabel}>Average Score</Text>
                  </View>
                  <View style={styles.overviewStat}>
                    <Text style={styles.overviewValue}>{students.length}</Text>
                    <Text style={styles.overviewLabel}>Students</Text>
                  </View>
                  <View style={styles.overviewStat}>
                    <Text style={styles.overviewValue}>
                      {students.filter(s => s.percentage >= 85).length}
                    </Text>
                    <Text style={styles.overviewLabel}>Passed</Text>
                  </View>
                </View>
              </Card>
            </View>
          </AnimatedScreen>
        )}
      </ScrollView>
      
      {/* Action Buttons */}
      <AnimatedScreen delay={220}>
        <View style={styles.actions}>
          <Button
            title="Export Results"
            onPress={() => {}}
            variant="outline"
            style={styles.exportButton}
          />
          <Button
            title="Continue Grading"
            onPress={() => navigation.navigate('Scan', { testData: test })}
            variant="primary"
          />
        </View>
      </AnimatedScreen>
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 100,
  },
  infoCard: {
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 4,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  averageScore: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  averageScoreLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  averageScoreValue: {
    ...typography.h1,
    color: colors.secondary,
  },
  viewModeSection: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  viewModeButtonActive: {
    backgroundColor: colors.secondary,
  },
  viewModeText: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  viewModeTextActive: {
    color: colors.background,
    fontWeight: '600',
  },
  studentsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 16,
  },
  studentCard: {
    marginBottom: 12,
  },
  studentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  studentScore: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  studentGrades: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentageBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  percentageText: {
    ...typography.body,
    fontWeight: '700',
  },
  gradeBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  gradeText: {
    ...typography.body,
    fontWeight: '700',
  },
  analyticsSection: {
    marginTop: 8,
  },
  analyticsCard: {
    marginBottom: 16,
  },
  analyticsTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: 20,
  },
  distribution: {
    gap: 16,
  },
  distributionBar: {
    height: 40,
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  distributionFill: {
    height: '100%',
    borderRadius: 8,
  },
  distributionLabel: {
    ...typography.bodySmall,
    color: colors.text,
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  overviewStat: {
    alignItems: 'center',
  },
  overviewValue: {
    ...typography.h2,
    color: colors.secondary,
    marginBottom: 4,
  },
  overviewLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exportButton: {
    marginBottom: 12,
  },
});
