import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import AnimatedScreen from '../components/AnimatedScreen';
import { Skeleton, SkeletonCircle } from '../components/Skeleton';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useScans } from '../context/ScansContext';

export default function TestDetailsScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { test } = route.params || {};
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'analytics'
  const { scans } = useScans();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const related = (scans || []).filter((s) => s.testId === (test?.id || test?.testId));

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const normalizePercentage = (scan) => {
    const p = scan?.percentage;
    if (typeof p === 'number') return p;
    if (typeof p === 'string') {
      const n = parseFloat(p.replace('%', ''));
      if (!isNaN(n)) return n;
    }
    const s = parseFloat(scan?.score);
    const t = parseFloat(test?.totalPoints);
    if (!isNaN(s) && !isNaN(t) && t > 0) return (s / t) * 100;
    return null;
  };

  const getLetterGrade = (pct) => {
    if (pct == null) return '-';
    if (pct >= 85) return 'A';
    if (pct >= 75) return 'B';
    if (pct >= 65) return 'C';
    if (pct >= 50) return 'D';
    return 'F';
  };

  const students = related
    .map((s) => {
      const pct = normalizePercentage(s);
      return {
        id: s.id,
        name: s.studentName || 'Student',
        studentNumber: s.studentNumber || '',
        score: s.score ?? null,
        percentage: pct != null ? Math.round(pct) : null,
        grade: getLetterGrade(pct),
        status: 'graded',
      };
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  
  const classAverage = (() => {
    if (Array.isArray(students) && students.length > 0) {
      const nums = students.map((s) => s.percentage).filter((n) => typeof n === 'number');
      if (nums.length === 0) return 0;
      return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
    }
    return test?.averageScore || 0;
  })();
  
  // Compute real analytics from student data
  const analytics = useMemo(() => {
    const validStudents = students.filter(s => s.percentage != null);
    const total = validStudents.length;
    if (total === 0) {
      return {
        gradeDistribution: { A: 0, B: 0, C: 0, D: 0 },
        gradePct: { A: 0, B: 0, C: 0, D: 0 },
        highest: 0,
        lowest: 0,
        median: 0,
        passCount: 0,
        failCount: 0,
        passRate: 0,
        topPerformer: null,
        bottomPerformer: null,
        totalGraded: 0,
        scoreRange: 0,
      };
    }

    const sorted = [...validStudents].sort((a, b) => b.percentage - a.percentage);
    const percentages = sorted.map(s => s.percentage);

    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    validStudents.forEach(s => { gradeDistribution[s.grade] = (gradeDistribution[s.grade] || 0) + 1; });

    const gradePct = {
      A: Math.round((gradeDistribution.A / total) * 100),
      B: Math.round((gradeDistribution.B / total) * 100),
      C: Math.round((gradeDistribution.C / total) * 100),
      D: Math.round((gradeDistribution.D / total) * 100),
      F: Math.round((gradeDistribution.F / total) * 100),
    };

    const highest = percentages[0] || 0;
    const lowest = percentages[percentages.length - 1] || 0;
    const midIdx = Math.floor(percentages.length / 2);
    const median = percentages.length % 2 === 0
      ? Math.round((percentages[midIdx - 1] + percentages[midIdx]) / 2)
      : percentages[midIdx];

    const passCount = validStudents.filter(s => s.percentage >= 50).length;
    const failCount = total - passCount;

    return {
      gradeDistribution,
      gradePct,
      highest,
      lowest,
      median,
      passCount,
      failCount,
      passRate: Math.round((passCount / total) * 100),
      topPerformer: sorted[0] || null,
      bottomPerformer: sorted[sorted.length - 1] || null,
      totalGraded: total,
      scoreRange: highest - lowest,
    };
  }, [students]);

  const getGradeColor = (grade) => {
    switch (grade) {
      case 'A': return colors.success;
      case 'B': return colors.info;
      case 'C': return colors.warning;
      case 'D': return colors.accent;
      default: return colors.error;
    }
  };
  
  const getScoreColor = (percentage) => {
    if (percentage >= 85) return colors.success;
    if (percentage >= 75) return colors.info;
    if (percentage >= 65) return colors.warning;
    if (percentage >= 50) return colors.accent;
    return colors.error;
  };

  const generateClassHTML = useCallback(() => {
    const date = new Date().toLocaleDateString();
    const testTitle = test?.name || test?.title || 'Test';
    const subject = test?.subject || '';
    const grade = test?.grade || '';
    const totalPoints = test?.totalPoints || 100;

    const studentsHTML = students.map((s, i) => {
      const pctColor = s.percentage >= 50 ? '#22c55e' : '#ef4444';
      const gradeColor = s.grade === 'A' ? '#22c55e' : s.grade === 'B' ? '#3b82f6' : s.grade === 'C' ? '#f59e0b' : s.grade === 'D' ? '#f97316' : '#ef4444';
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${i + 1}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${s.name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${s.studentNumber || '-'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${s.score ?? '-'} / ${totalPoints}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:${pctColor};font-weight:600;">${s.percentage != null ? s.percentage + '%' : '-'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:${gradeColor};font-weight:700;">${s.grade}</td>
        </tr>`;
    }).join('');

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
        .info-item { flex: 1; min-width: 120px; background: #f9fafb; border-radius: 8px; padding: 12px 16px; }
        .info-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-value { font-size: 15px; font-weight: 600; color: #111827; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        thead th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
        .summary { display: flex; gap: 12px; margin-top: 28px; }
        .summary-item { flex: 1; text-align: center; background: #f9fafb; border-radius: 8px; padding: 14px; }
        .summary-num { font-size: 22px; font-weight: 700; }
        .summary-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>GradeSmart — Class Report</h1>
        <p>Generated on ${date}</p>
      </div>

      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Test</div>
          <div class="info-value">${testTitle}</div>
        </div>
        ${subject ? `<div class="info-item"><div class="info-label">Subject</div><div class="info-value">${subject}</div></div>` : ''}
        ${grade ? `<div class="info-item"><div class="info-label">Grade</div><div class="info-value">${grade}</div></div>` : ''}
        <div class="info-item">
          <div class="info-label">Total Points</div>
          <div class="info-value">${totalPoints}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Students</div>
          <div class="info-value">${students.length}</div>
        </div>
      </div>

      <h3 style="font-size:16px;margin-bottom:8px;">Student Results</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Student</th>
            <th>Student No.</th>
            <th>Score</th>
            <th>Percentage</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>
          ${studentsHTML || '<tr><td colspan="6" style="padding:20px;text-align:center;color:#9ca3af;">No students graded yet</td></tr>'}
        </tbody>
      </table>

      <div class="summary">
        <div class="summary-item">
          <div class="summary-num" style="color:#6366f1;">${classAverage}%</div>
          <div class="summary-label">Class Average</div>
        </div>
        <div class="summary-item">
          <div class="summary-num" style="color:#22c55e;">${analytics.passCount}</div>
          <div class="summary-label">Passed</div>
        </div>
        <div class="summary-item">
          <div class="summary-num" style="color:#ef4444;">${analytics.failCount}</div>
          <div class="summary-label">Failed</div>
        </div>
        <div class="summary-item">
          <div class="summary-num">${analytics.passRate}%</div>
          <div class="summary-label">Pass Rate</div>
        </div>
      </div>

      <div class="footer">GradeSmart &copy; ${new Date().getFullYear()}</div>
    </body>
    </html>`;
  }, [test, students, classAverage, analytics]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const html = generateClassHTML();
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or Share Class Results',
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
  }, [generateClassHTML]);
  
  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <Header
          title={test?.name || 'Test Details'}
          onBack={() => navigation.goBack()}
          rightIcon="ellipsis-vertical"
          onRightPress={() => {}}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
        {/* Test Info Card */}
        <AnimatedScreen>
          {loading ? (
            <Card style={styles.infoCard}>
              <View style={styles.infoRow}>
                {[1,2,3].map(i => (
                  <View key={i} style={styles.infoItem}>
                    <SkeletonCircle size={20} />
                    <Skeleton width={50} height={12} style={{ marginTop: 6 }} />
                    <Skeleton width={40} height={16} style={{ marginTop: 4 }} />
                  </View>
                ))}
              </View>
              <View style={styles.averageScore}>
                <Skeleton width={100} height={14} />
                <Skeleton width={50} height={24} style={{ marginTop: 4 }} />
              </View>
            </Card>
          ) : (
            <Card style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Ionicons name="calendar" size={20} color={colors.textSecondary} />
                  <Text style={styles.infoLabel}>Date</Text>
                  <Text style={styles.infoValue}>{test?.date || (test?.createdAt ? new Date(test.createdAt).toLocaleDateString() : 'N/A')}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="people" size={20} color={colors.textSecondary} />
                  <Text style={styles.infoLabel}>Class</Text>
                  <Text style={styles.infoValue}>{test?.classRoom || 'N/A'}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="document-text" size={20} color={colors.textSecondary} />
                  <Text style={styles.infoLabel}>Scans</Text>
                  <Text style={styles.infoValue}>{test?.papersGraded || related.length}</Text>
                </View>
              </View>
              
              <View style={styles.averageScore}>
                <Text style={styles.averageScoreLabel}>Class Average</Text>
                <Text style={styles.averageScoreValue}>{classAverage}%</Text>
              </View>
            </Card>
          )}
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
              
              {loading ? [1,2,3].map(i => (
                <Card key={i} style={styles.studentCard}>
                  <View style={styles.studentCardHeader}>
                    <View style={styles.studentInfo}>
                      <Skeleton width={'60%'} height={16} />
                      <Skeleton width={'40%'} height={12} style={{ marginTop: 6 }} />
                    </View>
                    <View style={styles.studentGrades}>
                      <Skeleton width={52} height={28} radius={12} />
                      <Skeleton width={32} height={28} radius={12} style={{ marginLeft: 6 }} />
                    </View>
                  </View>
                </Card>
              )) : students.map((student) => (
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

              {/* Performance Distribution */}
              <Card style={styles.analyticsCard}>
                <Text style={styles.analyticsTitle}>Performance Distribution</Text>
                {analytics.totalGraded === 0 ? (
                  <Text style={styles.noDataText}>No graded students yet.</Text>
                ) : (
                  <View style={styles.distribution}>
                    {[
                      { grade: 'A', label: 'A (85-100%)', color: colors.success },
                      { grade: 'B', label: 'B (75-84%)', color: colors.info },
                      { grade: 'C', label: 'C (65-74%)', color: colors.warning },
                      { grade: 'D', label: 'D (50-64%)', color: colors.accent },
                      { grade: 'F', label: 'F (0-49%)', color: colors.error },
                    ].map(({ grade, label, color }) => {
                      const count = analytics.gradeDistribution[grade] || 0;
                      const pct = analytics.gradePct[grade] || 0;
                      const barWidth = Math.max(pct, count > 0 ? 8 : 0);
                      return (
                        <View key={grade} style={styles.distributionRow}>
                          <View style={styles.distributionBar}>
                            <View style={[styles.distributionFill, { width: `${barWidth}%`, backgroundColor: color }]} />
                            <Text style={styles.distributionLabel}>{label}</Text>
                          </View>
                          <Text style={[styles.distributionCount, { color }]}>
                            {count} ({pct}%)
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Card>

              {/* Class Overview */}
              <Card style={styles.analyticsCard}>
                <Text style={styles.analyticsTitle}>Class Overview</Text>
                <View style={styles.overviewStats}>
                  <View style={styles.overviewStat}>
                    <Text style={styles.overviewValue}>{classAverage}%</Text>
                    <Text style={styles.overviewLabel}>Average</Text>
                  </View>
                  <View style={styles.overviewStat}>
                    <Text style={styles.overviewValue}>{analytics.totalGraded}</Text>
                    <Text style={styles.overviewLabel}>Graded</Text>
                  </View>
                  <View style={styles.overviewStat}>
                    <Text style={[styles.overviewValue, { color: colors.success }]}>{analytics.passRate}%</Text>
                    <Text style={styles.overviewLabel}>Pass Rate</Text>
                  </View>
                </View>
              </Card>

              {/* Score Stats */}
              {analytics.totalGraded > 0 && (
                <Card style={styles.analyticsCard}>
                  <Text style={styles.analyticsTitle}>Score Statistics</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statsRow}>
                      <View style={styles.statBox}>
                        <Ionicons name="arrow-up-circle" size={20} color={colors.success} />
                        <Text style={styles.statBoxValue}>{analytics.highest}%</Text>
                        <Text style={styles.statBoxLabel}>Highest</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Ionicons name="arrow-down-circle" size={20} color={colors.error} />
                        <Text style={styles.statBoxValue}>{analytics.lowest}%</Text>
                        <Text style={styles.statBoxLabel}>Lowest</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Ionicons name="remove-circle" size={20} color={colors.info} />
                        <Text style={styles.statBoxValue}>{analytics.median}%</Text>
                        <Text style={styles.statBoxLabel}>Median</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Ionicons name="swap-vertical" size={20} color={colors.textSecondary} />
                        <Text style={styles.statBoxValue}>{analytics.scoreRange}%</Text>
                        <Text style={styles.statBoxLabel}>Range</Text>
                      </View>
                    </View>
                  </View>
                </Card>
              )}

              {/* Pass / Fail */}
              {analytics.totalGraded > 0 && (
                <Card style={styles.analyticsCard}>
                  <Text style={styles.analyticsTitle}>Pass / Fail</Text>
                  <View style={styles.passFailRow}>
                    <View style={styles.passFailBar}>
                      <View style={[
                        styles.passFailFill,
                        {
                          width: `${analytics.passRate}%`,
                          backgroundColor: colors.success,
                          borderTopLeftRadius: 8,
                          borderBottomLeftRadius: 8,
                          borderTopRightRadius: analytics.failCount === 0 ? 8 : 0,
                          borderBottomRightRadius: analytics.failCount === 0 ? 8 : 0,
                        },
                      ]} />
                      <View style={[
                        styles.passFailFill,
                        {
                          width: `${100 - analytics.passRate}%`,
                          backgroundColor: colors.error,
                          borderTopRightRadius: 8,
                          borderBottomRightRadius: 8,
                          borderTopLeftRadius: analytics.passCount === 0 ? 8 : 0,
                          borderBottomLeftRadius: analytics.passCount === 0 ? 8 : 0,
                        },
                      ]} />
                    </View>
                    <View style={styles.passFailLabels}>
                      <View style={styles.passFailLabelItem}>
                        <View style={[styles.passFailDot, { backgroundColor: colors.success }]} />
                        <Text style={styles.passFailLabelText}>Passed: {analytics.passCount} ({analytics.passRate}%)</Text>
                      </View>
                      <View style={styles.passFailLabelItem}>
                        <View style={[styles.passFailDot, { backgroundColor: colors.error }]} />
                        <Text style={styles.passFailLabelText}>Failed: {analytics.failCount} ({100 - analytics.passRate}%)</Text>
                      </View>
                    </View>
                  </View>
                </Card>
              )}

              {/* Top & Bottom Performers */}
              {analytics.topPerformer && analytics.totalGraded > 1 && (
                <Card style={styles.analyticsCard}>
                  <Text style={styles.analyticsTitle}>Performers</Text>
                  <View style={styles.performerRow}>
                    <View style={[styles.performerBox, { borderColor: colors.success + '40' }]}>
                      <Ionicons name="trophy" size={22} color={colors.success} />
                      <Text style={styles.performerName} numberOfLines={1}>{analytics.topPerformer.name}</Text>
                      <Text style={[styles.performerScore, { color: colors.success }]}>{analytics.topPerformer.percentage}%</Text>
                      <Text style={styles.performerLabel}>Top</Text>
                    </View>
                    {(() => {
                      const bp = analytics.bottomPerformer;
                      const struggling = bp.percentage < 50;
                      const bColor = struggling ? colors.error : colors.warning;
                      const bIcon = struggling ? 'alert-circle' : 'arrow-down-circle';
                      const bLabel = struggling ? 'Needs Help' : 'Lowest';
                      return (
                        <View style={[styles.performerBox, { borderColor: bColor + '40' }]}>
                          <Ionicons name={bIcon} size={22} color={bColor} />
                          <Text style={styles.performerName} numberOfLines={1}>{bp.name}</Text>
                          <Text style={[styles.performerScore, { color: bColor }]}>{bp.percentage}%</Text>
                          <Text style={styles.performerLabel}>{bLabel}</Text>
                        </View>
                      );
                    })()}
                  </View>
                </Card>
              )}

            </View>
          </AnimatedScreen>
        )}
        </ScrollView>

        <AnimatedScreen delay={220}>
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
              <Text style={styles.exportBtnText}>{exporting ? 'Exporting...' : 'Export Results'}</Text>
            </TouchableOpacity>
          </View>
        </AnimatedScreen>
      </KeyboardAvoidingView>
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
  noDataText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  distribution: {
    gap: 12,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  distributionBar: {
    flex: 1,
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
    top: 0,
    bottom: 0,
    textAlignVertical: 'center',
    lineHeight: 40,
  },
  distributionCount: {
    ...typography.bodySmall,
    fontWeight: '700',
    minWidth: 55,
    textAlign: 'right',
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
  statsGrid: {
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  statBoxValue: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '700',
    marginTop: 6,
  },
  statBoxLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  passFailRow: {
    gap: 12,
  },
  passFailBar: {
    flexDirection: 'row',
    height: 24,
    borderRadius: 8,
    overflow: 'hidden',
  },
  passFailFill: {
    height: '100%',
  },
  passFailLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  passFailLabelItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passFailDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  passFailLabelText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  performerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  performerBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  performerName: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  performerScore: {
    ...typography.h3,
    fontWeight: '700',
    marginTop: 4,
  },
  performerLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
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
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    gap: 8,
  },
  exportBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.secondary,
  },
});
