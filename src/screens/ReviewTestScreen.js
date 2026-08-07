import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import Stepper from '../components/Stepper';
import { getGradingMode } from '../components/SubjectPicker';
import { useToast } from '../components/Toast';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useTests } from '../context/TestsContext';

export default function ReviewTestScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const testData = route.params || {};
  const { showToast } = useToast();
  const { addTest } = useTests();
  
  // Detect if all sections are MCQ-only
  const sectionData = testData?.sectionData || [];
  const isMcqOnly = sectionData.length > 0 && sectionData.every(s => s.type === 'mcq');

  const handleStartScanning = () => {
    const testId = testData?.id || route?.params?.testId || Date.now().toString();
    const fullTestData = { ...testData, id: testId };
    try {
      addTest({ id: testId, ...testData });
    } catch {}
    showToast('Review confirmed', 'success');

    if (isMcqOnly) {
      // MCQ-only: go directly to MCQAnswerInput — it handles its own photo capture
      navigation.navigate('MCQAnswerInput', { testData: fullTestData, testId });
    } else {
      navigation.navigate('Scan', { testData: fullTestData, testId });
    }
  };
  
  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case 'multiple-choice':
        return 'Multiple Choice';
      case 'essay':
        return 'Essay-Based';
      case 'mixed':
        return 'Mixed';
      default:
        return 'Not specified';
    }
  };
  
  return (
    <View style={styles.container}>
      <Header
        title="Review Test Details"
        onBack={() => navigation.goBack()}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Stepper steps={['Details', 'Questions', 'Review']} current={2} />
        <AnimatedScreen>
          <View style={styles.content}>
            <Text style={styles.title}>Review Before Scanning</Text>
            <Text style={styles.subtitle}>
              Please verify all details are correct before proceeding
            </Text>
            
            <Card style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="document-text" size={24} color={colors.secondary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Test Name</Text>
                <Text style={styles.detailValue}>{testData.testName || 'Not set'}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="book" size={24} color={colors.secondary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Subject</Text>
                <Text style={styles.detailValue}>{testData.subject || 'Not set'}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="people" size={24} color={colors.secondary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Class</Text>
                <Text style={styles.detailValue}>{testData.classRoom || 'Not set'}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="help-circle" size={24} color={colors.secondary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Number of Questions</Text>
                <Text style={styles.detailValue}>{testData.numberOfQuestions || 'Not set'}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="star" size={24} color={colors.secondary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Total Points</Text>
                <Text style={styles.detailValue}>{testData.totalPoints || 'Not set'}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="list" size={24} color={colors.secondary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Question Type</Text>
                <Text style={styles.detailValue}>
                  {getQuestionTypeLabel(testData.questionType)}
                </Text>
              </View>
            </View>

            {(testData?.questionType === 'essay' || testData?.questionType === 'mixed') && (() => {
              const gm = getGradingMode(testData.subject);
              return (
                <View style={styles.gradingModeCard}>
                  <Ionicons name={gm.icon} size={20} color={gm.color} />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={[typography.bodySmall, { color: gm.color, fontWeight: '700' }]}>
                      AI Grading: {gm.label}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {gm.mode === 'calculation'
                        ? 'AI will check method, working steps, formulas, and final answers'
                        : gm.mode === 'science'
                        ? 'AI will check scientific accuracy, completeness, and clinical relevance'
                        : 'AI will check correctness, completeness, and quality of expression'}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Section-based summary */}
            {testData?.sectionData?.length > 0 && testData.sectionData.map((sec, i) => (
              <View key={i} style={{ marginTop: i === 0 ? 4 : 0, marginBottom: 8 }}>
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons
                      name={sec.type === 'mcq' ? 'radio-button-on' : sec.type === 'essay' ? 'document-text' : sec.type === 'diagram' ? 'image' : 'create'}
                      size={24}
                      color={colors.secondary}
                    />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Section {sec.label}</Text>
                    <Text style={styles.detailValue}>
                      {sec.type === 'mcq' ? 'MCQs' : sec.type === 'fill_in_blank' ? 'Fill in Blanks' : sec.type === 'short_notes' ? 'Short Notes' : sec.type === 'comprehension' ? 'Comprehension' : sec.type === 'essay' ? 'Essay' : sec.type === 'diagram' ? 'Diagrams' : sec.type === 'calculation' ? 'Calculations' : sec.type}
                      {' — '}{sec.questions?.length || 0} question{(sec.questions?.length || 0) !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                {sec.type === 'mcq' && sec.markingKey && (
                  <View style={{ marginLeft: 52, marginBottom: 4 }}>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      Marking Key: <Text style={{ fontWeight: '700', color: colors.text }}>{sec.markingKey}</Text>
                    </Text>
                  </View>
                )}
                {sec.questions?.length > 0 && sec.type !== 'mcq' && (
                  <View style={{ marginLeft: 52 }}>
                    {sec.questions.slice(0, 3).map((q, qi) => (
                      <Text key={qi} style={[typography.caption, { color: colors.textSecondary, marginBottom: 2 }]} numberOfLines={1}>
                        Q{q.number}: {q.text}
                      </Text>
                    ))}
                    {sec.questions.length > 3 && (
                      <Text style={[typography.caption, { color: colors.textLight }]}>+ {sec.questions.length - 3} more</Text>
                    )}
                  </View>
                )}
              </View>
            ))}

            {/* Fallback for old-style data without sectionData */}
            {!testData?.sectionData && (testData?.questionType === 'multiple-choice' || testData?.questionType === 'mixed') && (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="key" size={24} color={colors.secondary} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>MCQ Marking Key</Text>
                  <Text style={styles.detailValue}>{testData?.markingKey || 'Not set'}</Text>
                </View>
              </View>
            )}
            </Card>
            
            <View style={styles.tipsCard}>
            <View style={styles.tipsHeader}>
              <Ionicons name="information-circle" size={24} color={colors.info} />
              <Text style={styles.tipsTitle}>Scanning Tips</Text>
            </View>
            <View style={styles.tip}>
              <Text style={styles.tipText}>• Ensure good lighting</Text>
            </View>
            <View style={styles.tip}>
              <Text style={styles.tipText}>• Place paper flat on a surface</Text>
            </View>
            <View style={styles.tip}>
              <Text style={styles.tipText}>• Align paper within the guide frame</Text>
            </View>
            <View style={styles.tip}>
              <Text style={styles.tipText}>• Keep camera steady while scanning</Text>
            </View>
            </View>
          </View>
        </AnimatedScreen>
        
        <AnimatedScreen delay={120}>
          <View style={styles.actions}>
            <Button
              title="Edit Details"
              onPress={() => navigation.goBack()}
              variant="outline"
              style={styles.editButton}
            />
            <Button
              title={isMcqOnly ? 'Start Grading' : 'Start Scanning'}
              onPress={handleStartScanning}
              variant="primary"
              icon={isMcqOnly ? '✅' : '📷'}
            />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  detailsCard: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailIcon: {
    width: 40,
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  tipsCard: {
    backgroundColor: colors.info + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipsTitle: {
    ...typography.h4,
    color: colors.text,
    marginLeft: 8,
  },
  tip: {
    marginBottom: 8,
  },
  tipText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  actions: {
    marginTop: 20,
  },
  editButton: {
    marginBottom: 12,
  },
  gradingModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
