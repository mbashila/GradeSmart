import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import { Skeleton } from '../components/Skeleton';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useScans } from '../context/ScansContext';
import { useToast } from '../components/Toast';

export default function ResultsScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { studentName, studentNumber, score, percentage, testData, images, gradingResults, gradingType } = route.params || {};
  const [currentView, setCurrentView] = useState('individual'); // 'individual' or 'list'
  const { scans, addScan } = useScans();
  const { showToast } = useToast();
  const testId = route?.params?.testId || testData?.id || null;
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);
  const normalizedName = (studentName || 'Student').trim().toLowerCase();
  const isExisting = scans?.some((s) => (s.testId === testId) && ((s.studentName || '').trim().toLowerCase() === normalizedName));
  
  const individualResults = gradingResults || [];
  const correctCount = individualResults.filter(r => r.status === 'correct').length;
  const incorrectCount = individualResults.filter(r => r.status === 'incorrect').length;
  const partialCount = individualResults.filter(r => r.status === 'partial').length;
  
  const generateHTML = useCallback(() => {
    const date = new Date().toLocaleDateString();
    const testTitle = testData?.title || testData?.testName || 'Test';
    const subject = testData?.subject || '';
    const grade = testData?.grade || '';
    const pct = parseInt(percentage) || 0;
    const pctColor = pct >= 50 ? '#22c55e' : '#ef4444';

    const questionsHTML = individualResults.map((r, i) => {
      const statusColor = r.status === 'correct' ? '#22c55e' : r.status === 'partial' ? '#f59e0b' : '#ef4444';
      const statusLabel = r.status === 'correct' ? 'Correct' : r.status === 'partial' ? 'Partial' : 'Incorrect';
      const isMCQ = gradingType === 'mcq' || (r.correct && r.student && r.correct.length === 1);
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">Q${r.question}</td>
          ${isMCQ ? `
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${r.correct || '-'}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${r.student || '-'}</td>
          ` : `
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;" colspan="2">${r.points || 0} / ${r.maxPoints || r.points || 0}</td>
          `}
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:${statusColor};font-weight:600;">${statusLabel}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;">${r.points ?? 0}</td>
        </tr>`;
    }).join('');

    const isMCQTest = gradingType === 'mcq';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; padding: 40px; }
        .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e5e7eb; }
        .header h1 { font-size: 24px; color: #111827; margin-bottom: 4px; }
        .header p { font-size: 13px; color: #6b7280; }
        .info-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 28px; }
        .info-item { flex: 1; min-width: 140px; background: #f9fafb; border-radius: 8px; padding: 12px 16px; }
        .info-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-value { font-size: 15px; font-weight: 600; color: #111827; margin-top: 4px; }
        .score-banner { display: flex; align-items: center; justify-content: space-between; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px; }
        .score-banner.fail { background: #fef2f2; border-color: #fecaca; }
        .score-big { font-size: 36px; font-weight: 800; color: ${pctColor}; }
        .score-label { font-size: 13px; color: #6b7280; margin-top: 2px; }
        .pct { font-size: 28px; font-weight: 800; color: ${pctColor}; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        thead th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
        .summary { display: flex; gap: 12px; margin-top: 24px; }
        .summary-item { flex: 1; text-align: center; background: #f9fafb; border-radius: 8px; padding: 12px; }
        .summary-num { font-size: 20px; font-weight: 700; }
        .summary-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>GradeSmart Report</h1>
        <p>Generated on ${date}</p>
      </div>

      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Student</div>
          <div class="info-value">${studentName || 'Student'}</div>
        </div>
        ${studentNumber ? `<div class="info-item"><div class="info-label">Student No.</div><div class="info-value">${studentNumber}</div></div>` : ''}
        <div class="info-item">
          <div class="info-label">Test</div>
          <div class="info-value">${testTitle}</div>
        </div>
        ${subject ? `<div class="info-item"><div class="info-label">Subject</div><div class="info-value">${subject}</div></div>` : ''}
        ${grade ? `<div class="info-item"><div class="info-label">Grade</div><div class="info-value">${grade}</div></div>` : ''}
      </div>

      <div class="score-banner ${pct < 50 ? 'fail' : ''}">
        <div>
          <div class="score-big">${score || '0'}</div>
          <div class="score-label">Points Total</div>
        </div>
        <div style="text-align:right;">
          <div class="pct">${percentage || '0%'}</div>
          <div class="score-label">${pct >= 50 ? 'Pass' : 'Fail'}</div>
        </div>
      </div>

      <h3 style="font-size:16px;margin-bottom:8px;">Question Results</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            ${isMCQTest ? '<th>Correct</th><th>Student</th>' : '<th colspan="2">Score</th>'}
            <th>Status</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          ${questionsHTML}
        </tbody>
      </table>

      <div class="summary">
        <div class="summary-item">
          <div class="summary-num" style="color:#22c55e;">${correctCount}</div>
          <div class="summary-label">Correct</div>
        </div>
        ${partialCount > 0 ? `<div class="summary-item"><div class="summary-num" style="color:#f59e0b;">${partialCount}</div><div class="summary-label">Partial</div></div>` : ''}
        <div class="summary-item">
          <div class="summary-num" style="color:#ef4444;">${incorrectCount}</div>
          <div class="summary-label">Incorrect</div>
        </div>
        <div class="summary-item">
          <div class="summary-num">${individualResults.length}</div>
          <div class="summary-label">Total</div>
        </div>
      </div>

      <div class="footer">GradeSmart &copy; ${new Date().getFullYear()}</div>
    </body>
    </html>`;
  }, [studentName, score, percentage, testData, individualResults, gradingType, correctCount, incorrectCount, partialCount]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const html = generateHTML();
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or Share Results',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Exported', 'PDF generated successfully.');
      }
    } catch (e) {
      Alert.alert('Export Failed', e.message || 'Could not export results.');
    } finally {
      setExporting(false);
    }
  }, [generateHTML]);

  const handleNext = () => {
    if (isExisting) {
      showToast('A saved result already exists for this student in this test and cannot be edited.', 'error');
      return;
    }
    // Save scanned paper to context, then navigate to next student or back to scan
    try {
      addScan({
        studentName: studentName || 'Student',
        studentNumber: studentNumber || '',
        score: score || null,
        percentage: percentage || null,
        testData: testData || {},
        images: images || [],
        pages: Array.isArray(images) ? images.length : (images ? 1 : 0),
        testId,
        gradingResults: gradingResults || [],
        gradingType: gradingType || null,
      });
    } catch (e) {
      // no-op; saving is best-effort for now
    }
    showToast('Saved to Recent Scans', 'success');
    navigation.navigate('Dashboard');
  };
  
  return (
    <View style={styles.container}>
      <Header
        title="Grading Results"
        onBack={() => navigation.goBack()}
        rightIcon="ellipsis-vertical"
        onRightPress={() => {}}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <AnimatedScreen>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>{studentName || 'Student Name'}</Text>
            {!!studentNumber && (
              <Text style={styles.pagesInfo}>Student No: {studentNumber}</Text>
            )}
            {!!images?.length && (
              <Text style={styles.pagesInfo}>Pages captured: {images.length}</Text>
            )}
          </View>
        </AnimatedScreen>
        
        <AnimatedScreen delay={60}>
          {loading ? (
            <Card style={styles.scoreCard}>
              <View style={styles.scoreMain}>
                <View style={styles.scoreLeft}>
                  <Skeleton width={80} height={40} />
                  <Skeleton width={100} height={14} style={{ marginTop: 8 }} />
                </View>
                <View style={styles.scoreRight}>
                  <Skeleton width={80} height={80} radius={40} />
                </View>
              </View>
            </Card>
          ) : (
          <Card style={styles.scoreCard}>
            <View style={styles.scoreMain}>
              <View style={styles.scoreLeft}>
                <Text style={styles.scoreValue}>{score || '0'}</Text>
                <Text style={styles.scoreLabel}>Points Total</Text>
                {incorrectCount > 0 && (
                  <Text style={styles.incorrectText}>
                    {incorrectCount} Incorrect
                  </Text>
                )}
                {partialCount > 0 && (
                  <Text style={[styles.incorrectText, { color: colors.warning }]}>
                    {partialCount} Partial
                  </Text>
                )}
              </View>
              <View style={styles.scoreRight}>
                <View style={[styles.percentageCircle, {
                  backgroundColor: (parseInt(percentage) >= 50 ? colors.success : colors.error) + '20',
                }]}>
                  <Text style={[styles.percentageValue, {
                    color: parseInt(percentage) >= 50 ? colors.success : colors.error,
                  }]}>{percentage || '0%'}</Text>
                  <Ionicons
                    name={parseInt(percentage) >= 50 ? 'checkmark-circle' : 'close-circle'}
                    size={40}
                    color={parseInt(percentage) >= 50 ? colors.success : colors.error}
                  />
                </View>
              </View>
            </View>
          </Card>
          )}
        </AnimatedScreen>
        
        <AnimatedScreen delay={120}>
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Question Results</Text>
            
            {loading ? [1,2,3,4].map(i => (
              <Card key={i} style={styles.resultCard}>
                <View style={styles.resultRow}>
                  <View style={styles.resultLeft}>
                    <Skeleton width={100} height={16} />
                    <View style={[styles.answerRow, { marginTop: 6 }]}>
                      <Skeleton width={60} height={24} radius={8} />
                      <Skeleton width={60} height={24} radius={8} style={{ marginLeft: 8 }} />
                    </View>
                  </View>
                  <Skeleton width={36} height={36} radius={18} />
                </View>
              </Card>
            )) : individualResults.map((result, index) => (
              <Card key={index} style={styles.resultCard}>
                <View style={styles.resultRow}>
                  <View style={styles.resultLeft}>
                    <Text style={styles.questionNumber}>Question {result.question}</Text>
                    {(gradingType === 'mcq' || (result.correct && result.student && result.correct.length === 1)) ? (
                      <View style={styles.answerRow}>
                        <View style={styles.answerBadge}>
                          <Text style={styles.answerLabel}>Correct</Text>
                          <Text style={styles.answerValue}>{result.correct}</Text>
                        </View>
                        <Text style={styles.answerSeparator}>→</Text>
                        <View style={styles.answerBadge}>
                          <Text style={styles.answerLabel}>Student</Text>
                          <Text style={styles.answerValue}>{result.student}</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.answerRow}>
                        <View style={styles.answerBadge}>
                          <Text style={styles.answerLabel}>Score</Text>
                          <Text style={styles.answerValue}>{result.points} / {result.maxPoints || result.points}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                  <View style={styles.resultRight}>
                    {result.status === 'correct' ? (
                      <View style={styles.statusCorrect}>
                        <Text style={styles.statusText}>{result.points}</Text>
                      </View>
                    ) : result.status === 'partial' ? (
                      <View style={[styles.statusCorrect, { backgroundColor: colors.warning + '20' }]}>
                        <Text style={[styles.statusText, { color: colors.warning }]}>{result.points}</Text>
                      </View>
                    ) : (
                      <View style={styles.statusIncorrect}>
                        <Ionicons name="close" size={20} color={colors.error} />
                      </View>
                    )}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </AnimatedScreen>
      </ScrollView>
      
      {/* Action Buttons */}
      <AnimatedScreen delay={180}>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.7}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.secondary} />
            ) : (
              <Ionicons name="download-outline" size={20} color={colors.secondary} />
            )}
            <Text style={styles.exportBtnText}>{exporting ? 'Exporting...' : 'Export PDF'}</Text>
          </TouchableOpacity>
          {!isExisting && (
            <Button
              title="Save & Next"
              onPress={handleNext}
              variant="primary"
            />
          )}
        </View>
      </AnimatedScreen>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
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
  studentInfo: {
    marginBottom: 16,
  },
  studentName: {
    ...typography.h2,
    color: colors.text,
  },
  scoreCard: {
    marginBottom: 24,
  },
  scoreMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLeft: {
    flex: 1,
  },
  scoreValue: {
    ...typography.h1,
    color: colors.text,
    fontSize: 48,
    marginBottom: 8,
  },
  scoreLabel: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  incorrectText: {
    ...typography.bodySmall,
    color: colors.error,
  },
  scoreRight: {
    alignItems: 'center',
  },
  percentageCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.success + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageValue: {
    ...typography.h2,
    color: colors.success,
    fontWeight: '700',
  },
  resultsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 16,
  },
  resultCard: {
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLeft: {
    flex: 1,
  },
  questionNumber: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  answerBadge: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  answerLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  answerValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginTop: 2,
  },
  answerSeparator: {
    ...typography.body,
    color: colors.textLight,
    marginHorizontal: 12,
  },
  resultRight: {
    marginLeft: 16,
  },
  statusCorrect: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.success + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    ...typography.body,
    color: colors.success,
    fontWeight: '600',
  },
  statusIncorrect: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
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
  reviewButton: {
    marginBottom: 12,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    gap: 8,
    marginBottom: 10,
  },
  exportBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.secondary,
  },
});
