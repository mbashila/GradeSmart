import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useScans } from '../context/ScansContext';
import { useToast } from '../components/Toast';
import { getActionErrorMessage, logError } from '../utils/errors';
import { useAuth } from '../context/AuthContext';
import GradingResultsView from '../components/GradingResultsView';
import { computeTotals, toGradingResultsList, updateSectionAnswers, resultStatus } from '../utils/gradingModel';
import { gradeResultWithAI } from '../utils/openaiService';

export default function ResultsScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { scans, addScan } = useScans();
  const { user } = useAuth();
  const reviewerId = user?.id || 'teacher';
  // Reopening a saved result: load everything from the stored scan, not from route params.
  const savedScan = route.params?.scanId ? scans?.find(s => s.id === route.params.scanId) : null;
  const params = savedScan ? { ...route.params, ...savedScan, percentage: savedScan.percentage } : (route.params || {});
  const { studentName, studentNumber, testData, images, gradingType, isDirectFlow, answerRecords } = params;
  const [currentView, setCurrentView] = useState('individual'); // 'individual' or 'list'
  const { showToast } = useToast();
  const testId = route?.params?.testId || params.testId || testData?.id || null;
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(params.gradingResult || null);
  const [busyIds, setBusyIds] = useState([]);
  const [saveState, setSaveState] = useState(savedScan ? 'saved' : 'unsaved'); // unsaved | saving | saved | local | error
  const [saveError, setSaveError] = useState('');
  useEffect(() => { if (!result && savedScan?.gradingResult) setResult(savedScan.gradingResult); }, [savedScan?.gradingResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = result ? computeTotals(result) : null;
  const score = totals ? String(totals.awarded) : params.score;
  const percentage = totals ? (totals.percentage !== null ? `${totals.percentage}%` : null) : params.percentage;
  const gradingResults = result ? toGradingResultsList(result) : params.gradingResults;
  const hasPct = percentage !== null && percentage !== undefined && percentage !== '';

  const normalizedName = (studentName || 'Student').trim().toLowerCase();
  // A different saved scan for the same student blocks saving; the same record (same id) can be updated.
  const isExisting = scans?.some((s) => (s.testId === testId) && ((s.studentName || '').trim().toLowerCase() === normalizedName) && (!result || s.id !== result.id));
  const isUpdate = !!result && scans?.some(s => s.id === result.id);

  const handleRegrade = useCallback(async (ids, base) => {
    const source = base || result;
    if (!source) return;
    setBusyIds(prev => [...new Set([...prev, ...ids])]);
    try {
      const run = await gradeResultWithAI(source, { ids, subject: testData?.subject || '', gradeLevel: testData?.grade || '', testId: testId || '' });
      setResult(prev => ({ ...(prev || run.result), items: (prev || run.result).items.map(i => (ids.includes(i.id) ? run.result.items.find(x => x.id === i.id) || i : i)), updatedAt: run.result.updatedAt }));
      setSaveState(s => (s === 'saved' ? 'unsaved' : s));
      if (run.failed) showToast('Some items could not be graded. They are marked for retry.', 'warning');
    } finally {
      setBusyIds(prev => prev.filter(id => !ids.includes(id)));
    }
  }, [result, testData, testId, showToast]);

  const handleAnswerChange = useCallback(async (sectionKey, records) => {
    try {
      const { result: next, changedItemIds } = updateSectionAnswers(result, sectionKey, records, reviewerId);
      setResult(next);
      setSaveState('unsaved');
      if (changedItemIds.length) await handleRegrade(changedItemIds, next);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }, [result, reviewerId, handleRegrade, showToast]);

  const handleResultChange = useCallback((next) => {
    setResult(next);
    setSaveState('unsaved');
  }, []);

  // Determine if this is the last student to grade
  const expectedStudents = parseInt(testData?.numberOfStudents, 10) || 0;
  const scannedForTest = scans?.filter((s) => s.testId === testId).length || 0;
  // After saving this one, scannedForTest + 1 will be the new count
  const isLastStudent = expectedStudents > 0 && (scannedForTest + 1) >= expectedStudents;
  
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
      const statusLabel = r.status === 'correct' ? 'Correct' : r.status === 'partial' ? 'Partial' : r.status === 'review' ? 'Needs review' : 'Incorrect';
      const isMCQ = gradingType === 'mcq' || (r.correct && r.student && r.correct.length === 1);
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">Q${r.question}</td>
          ${isMCQ ? `
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${r.correct || '-'}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${r.student || '-'}</td>
          ` : `
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;" colspan="2">${r.points ?? '—'} / ${r.maxPoints ?? '—'}${r.gradingStatus && !['graded', 'manual', 'blank'].includes(r.gradingStatus) ? ' (needs review)' : ''}${r.counted === false ? ' (not counted)' : ''}</td>
          `}
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:${statusColor};font-weight:600;">${statusLabel}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;">${r.points ?? '—'}</td>
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
      logError('EXPORT', e, { operation: 'export pdf' });
      Alert.alert('Export failed', getActionErrorMessage(e, "Couldn't export the results."));
    } finally {
      setExporting(false);
    }
  }, [generateHTML]);

  // Idempotent save: graded scripts use the grading result id, so retries update instead of duplicating.
  const saveScan = async () => {
    setSaveState('saving');
    setSaveError('');
    try {
      const res = await addScan({
        ...(result ? { id: result.id } : null),
        studentName: studentName || 'Student',
        studentNumber: studentNumber || '',
        score: score || null,
        maxScore: totals ? totals.available : null,
        percentage: percentage || null,
        testData: testData || {},
        images: images || [],
        pages: Array.isArray(images) ? images.length : (images ? 1 : 0),
        testId,
        gradingResults: gradingResults || [],
        gradingType: gradingType || null,
        ...(result ? { gradingResult: result, gradingStatus: resultStatus(result) } : null),
        ...(Array.isArray(answerRecords) && answerRecords.length ? { answerRecords } : null),
      });
      if (res?.error) {
        setSaveState('error');
        setSaveError(typeof res.error === 'string' ? res.error : getActionErrorMessage(res.error, "Couldn't save the result."));
        return false;
      }
      if (res?.syncError) {
        setSaveState('local');
        setSaveError(getActionErrorMessage(res.syncError, "Saved on this device only — couldn't sync to your account."));
        return false;
      }
      setSaveState('saved');
      return true;
    } catch (e) {
      logError('SCANS', e, { operation: 'save scan' });
      setSaveState('error');
      setSaveError(getActionErrorMessage(e, "Couldn't save the result."));
      return false;
    }
  };

  const proceed = () => {
    if (savedScan || route.params?.scanId) { navigation.goBack(); return; }
    if (isLastStudent) {
      showToast(`All ${expectedStudents} students graded!`, 'success');
      navigation.navigate('Dashboard');
    } else {
      const remaining = expectedStudents > 0 ? expectedStudents - (scannedForTest + 1) : '?';
      showToast(`Saved! ${remaining} student${remaining === 1 ? '' : 's'} remaining.`, 'success');
      if (isDirectFlow) {
        // Replace with a fresh MCQAnswerInput screen to reset all state
        navigation.replace('MCQAnswerInput', { testData });
      } else {
        // Push a fresh Scan screen for the next student's paper
        navigation.push('Scan', { testData });
      }
    }
  };

  const handleNext = async () => {
    if (isExisting) {
      showToast('A different saved result already exists for this student in this test.', 'error');
      return;
    }
    const ok = await saveScan();
    if (ok) {
      if (result && resultStatus(result) !== 'finalized') showToast('Saved as provisional. Finalize after review.', 'info');
      proceed();
    }
  };
  
  return (
    <View style={styles.container}>
      <Header
        title="Grading Results"
        onBack={() => navigation.navigate('Dashboard')}
        rightIcon="ellipsis-vertical"
        onRightPress={() => {}}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <AnimatedScreen>
          <View style={styles.studentInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.studentAvatar}>
                <Ionicons name="person" size={22} color={colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>{studentName || 'Student Name'}</Text>
                {!!studentNumber && (
                  <Text style={styles.pagesInfo}>No: {studentNumber}</Text>
                )}
              </View>
            </View>
            {!!testData?.testName && (
              <Text style={styles.testNameLabel}>{testData.testName}{testData.subject ? ` — ${testData.subject}` : ''}</Text>
            )}
          </View>
        </AnimatedScreen>
        
        <AnimatedScreen delay={60}>
          <Card style={styles.scoreCard}>
            <View style={styles.scoreMain}>
              <View style={styles.scoreLeft}>
                <Text style={styles.scoreValue}>{score || '0'}{totals?.available !== null && totals?.available !== undefined ? ` / ${totals.available}` : ''}</Text>
                <Text style={styles.scoreLabel}>{result ? (resultStatus(result) === 'finalized' ? 'Final total' : 'Provisional total') : 'Points Total'}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <View style={[styles.statChip, { backgroundColor: colors.success + '15' }]}>
                    <Ionicons name="checkmark" size={12} color={colors.success} />
                    <Text style={[styles.statChipText, { color: colors.success }]}>{correctCount}</Text>
                  </View>
                  {partialCount > 0 && (
                    <View style={[styles.statChip, { backgroundColor: colors.warning + '15' }]}>
                      <Ionicons name="remove" size={12} color={colors.warning} />
                      <Text style={[styles.statChipText, { color: colors.warning }]}>{partialCount}</Text>
                    </View>
                  )}
                  <View style={[styles.statChip, { backgroundColor: colors.error + '15' }]}>
                    <Ionicons name="close" size={12} color={colors.error} />
                    <Text style={[styles.statChipText, { color: colors.error }]}>{incorrectCount}</Text>
                  </View>
                </View>
              </View>
              {hasPct ? (
              <View style={styles.scoreRight}>
                <View style={[styles.percentageCircle, {
                  backgroundColor: (parseInt(percentage) >= 50 ? colors.success : colors.error) + '15',
                  borderWidth: 3,
                  borderColor: (parseInt(percentage) >= 50 ? colors.success : colors.error) + '30',
                }]}>
                  <Text style={[styles.percentageValue, {
                    color: parseInt(percentage) >= 50 ? colors.success : colors.error,
                  }]}>{percentage || '0%'}</Text>
                  <Text style={[styles.percentageStatus, {
                    color: parseInt(percentage) >= 50 ? colors.success : colors.error,
                  }]}>{parseInt(percentage) >= 50 ? 'Pass' : 'Fail'}</Text>
                </View>
              </View>
              ) : (
                <View style={styles.scoreRight}>
                  <Text style={[typography.caption, { color: colors.textSecondary, maxWidth: 120, textAlign: 'center' }]}>Percentage not available — total marks unknown</Text>
                </View>
              )}
            </View>
          </Card>
        </AnimatedScreen>
        
        <AnimatedScreen delay={120}>
          {result ? (
            <View style={styles.resultsSection}>
              <Text style={styles.sectionTitle}>Question Results</Text>
              <GradingResultsView
                result={result}
                onChange={handleResultChange}
                onRegrade={handleRegrade}
                onAnswerChange={handleAnswerChange}
                busyIds={busyIds}
                reviewerId={reviewerId}
              />
            </View>
          ) : (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Question Results</Text>
            
            {individualResults.map((result, index) => {
              const isCorrect = result.status === 'correct';
              const isPartial = result.status === 'partial';
              const statusColor = isCorrect ? colors.success : isPartial ? colors.warning : colors.error;
              const isMCQ = gradingType === 'mcq' || (result.correct && result.student && result.correct.length === 1);
              return (
                <View key={index} style={[styles.resultCard, { borderLeftWidth: 3, borderLeftColor: statusColor }]}>
                  <View style={styles.resultRow}>
                    <View style={styles.resultLeft}>
                      <Text style={styles.questionNumber}>Q{result.question}</Text>
                      {isMCQ ? (
                        <View style={styles.answerRow}>
                          <View style={[styles.answerBadge, { backgroundColor: colors.success + '12' }]}>
                            <Text style={[styles.answerBadgeText, { color: colors.success }]}>{result.correct}</Text>
                          </View>
                          <Ionicons name="arrow-forward" size={14} color={colors.textLight} style={{ marginHorizontal: 6 }} />
                          <View style={[styles.answerBadge, {
                            backgroundColor: isCorrect ? colors.success + '12' : colors.error + '12',
                          }]}>
                            <Text style={[styles.answerBadgeText, {
                              color: isCorrect ? colors.success : colors.error,
                            }]}>{result.student || '—'}</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.answerRow}>
                          <Text style={[typography.bodySmall, { color: statusColor, fontWeight: '600' }]}>
                            {result.points} / {result.maxPoints || result.points} pts
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.statusBubble, { backgroundColor: statusColor + '15' }]}>
                      {isCorrect ? (
                        <Ionicons name="checkmark" size={18} color={statusColor} />
                      ) : isPartial ? (
                        <Text style={[styles.statusBubbleText, { color: statusColor }]}>{result.points}</Text>
                      ) : (
                        <Ionicons name="close" size={18} color={statusColor} />
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
          )}
        </AnimatedScreen>
      </ScrollView>

      {(saveState === 'local' || saveState === 'error') && (
        <View style={[styles.saveBanner, { backgroundColor: (saveState === 'error' ? colors.error : colors.warning) + '18' }]}>
          <Text style={[typography.caption, { color: colors.text, flex: 1 }]}>{saveError}</Text>
          <TouchableOpacity onPress={saveScan} style={{ padding: 8 }} accessibilityRole="button">
            <Text style={[typography.caption, { color: colors.secondary, fontWeight: '700' }]}>Retry</Text>
          </TouchableOpacity>
          {saveState === 'local' && (
            <TouchableOpacity onPress={proceed} style={{ padding: 8 }} accessibilityRole="button">
              <Text style={[typography.caption, { color: colors.secondary, fontWeight: '700' }]}>Continue</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
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
          {isExisting ? (
            <Button
              title="Go Home"
              onPress={() => navigation.navigate('Dashboard')}
              variant="primary"
            />
          ) : isUpdate || savedScan ? (
            <Button
              title={saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save changes'}
              onPress={async () => { if (await saveScan()) showToast('Changes saved.', 'success'); }}
              variant="primary"
              disabled={saveState === 'saved' || saveState === 'saving' || busyIds.length > 0}
            />
          ) : (
            <Button
              title={saveState === 'saving' ? 'Saving…' : isLastStudent ? 'Save & Finish' : `Save & Grade Next${expectedStudents > 0 ? ` (${scannedForTest + 1}/${expectedStudents})` : ''}`}
              onPress={handleNext}
              variant="primary"
              disabled={saveState === 'saving' || busyIds.length > 0}
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
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  saveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  studentInfo: {
    marginBottom: 16,
  },
  studentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentName: {
    ...typography.h3,
    color: colors.text,
  },
  pagesInfo: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  testNameLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 8,
  },
  scoreCard: {
    marginBottom: 20,
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
    fontSize: 44,
  },
  scoreLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statChipText: {
    ...typography.caption,
    fontWeight: '700',
  },
  scoreRight: {
    alignItems: 'center',
  },
  percentageCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageValue: {
    ...typography.h2,
    fontWeight: '800',
    fontSize: 24,
  },
  percentageStatus: {
    ...typography.caption,
    fontWeight: '700',
    marginTop: 1,
  },
  resultsSection: {
    marginTop: 4,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: 12,
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
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
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '700',
    marginBottom: 6,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  answerBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  answerBadgeText: {
    ...typography.body,
    fontWeight: '700',
  },
  statusBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  statusBubbleText: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
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
