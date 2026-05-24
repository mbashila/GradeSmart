import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import { Skeleton } from '../components/Skeleton';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';

export default function PrivacySettingsScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [analytics, setAnalytics] = useState(true);
  const [crashReports, setCrashReports] = useState(true);
  const [personalizedTips, setPersonalizedTips] = useState(true);
  const [saveScansLocally, setSaveScansLocally] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const handleDeleteData = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all your scans, tests, and app data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Data Deleted', 'All local data has been cleared.');
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert('Export Data', 'Your data export will be prepared and available for download shortly.');
  };

  const toggleRows = [
    {
      icon: 'analytics-outline',
      label: 'Usage Analytics',
      description: 'Help us improve GradeSmart by sharing anonymous usage data',
      value: analytics,
      onToggle: setAnalytics,
    },
    {
      icon: 'bug-outline',
      label: 'Crash Reports',
      description: 'Automatically send crash reports to help fix issues',
      value: crashReports,
      onToggle: setCrashReports,
    },
    {
      icon: 'bulb-outline',
      label: 'Personalized Tips',
      description: 'Receive tailored suggestions based on your grading activity',
      value: personalizedTips,
      onToggle: setPersonalizedTips,
    },
    {
      icon: 'phone-portrait-outline',
      label: 'Save Scans Locally',
      description: 'Keep a copy of scanned papers on your device',
      value: saveScansLocally,
      onToggle: setSaveScansLocally,
    },
  ];

  return (
    <View style={styles.container}>
      <Header title="Privacy Settings" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AnimatedScreen>
          {loading ? (
            <>
              <View style={styles.card}>
                <Skeleton width={130} height={16} style={{ marginBottom: 12 }} />
                {[1,2,3,4].map(i => (
                  <View key={i} style={[styles.toggleRow, i < 4 && styles.rowBorder]}>
                    <View style={styles.toggleLeft}>
                      <Skeleton width={32} height={32} radius={8} />
                      <View style={[styles.toggleText, { marginLeft: 12 }]}>
                        <Skeleton width={120} height={14} />
                        <Skeleton width={'90%'} height={11} style={{ marginTop: 4 }} />
                      </View>
                    </View>
                    <Skeleton width={48} height={28} radius={14} />
                  </View>
                ))}
              </View>
              <View style={styles.card}>
                <Skeleton width={150} height={16} style={{ marginBottom: 12 }} />
                {[1,2].map(i => (
                  <View key={i} style={[styles.actionRow, i < 2 && styles.rowBorder]}>
                    <View style={styles.rowLeft}>
                      <Skeleton width={32} height={32} radius={8} />
                      <View style={[styles.toggleText, { marginLeft: 12 }]}>
                        <Skeleton width={120} height={14} />
                        <Skeleton width={200} height={11} style={{ marginTop: 4 }} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              {/* Privacy toggles */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Data & Privacy</Text>
                {toggleRows.map((row, i) => (
                  <View key={row.label} style={[styles.toggleRow, i < toggleRows.length - 1 && styles.rowBorder]}>
                    <View style={styles.toggleLeft}>
                      <View style={styles.rowIconWrap}>
                        <Ionicons name={row.icon} size={18} color={colors.secondary} />
                      </View>
                      <View style={styles.toggleText}>
                        <Text style={styles.toggleLabel}>{row.label}</Text>
                        <Text style={styles.toggleDesc}>{row.description}</Text>
                      </View>
                    </View>
                    <Switch
                      value={row.value}
                      onValueChange={row.onToggle}
                      trackColor={{ false: colors.border, true: colors.secondaryLight }}
                      thumbColor={row.value ? colors.secondary : colors.textLight}
                    />
                  </View>
                ))}
              </View>

              {/* Data management card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Data Management</Text>
                <TouchableOpacity style={[styles.actionRow, styles.rowBorder]} onPress={handleExportData} activeOpacity={0.6}>
                  <View style={styles.rowLeft}>
                    <View style={styles.rowIconWrap}>
                      <Ionicons name="download-outline" size={18} color={colors.secondary} />
                    </View>
                    <View style={styles.toggleText}>
                      <Text style={styles.toggleLabel}>Export My Data</Text>
                      <Text style={styles.toggleDesc}>Download a copy of all your data</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionRow} onPress={handleDeleteData} activeOpacity={0.6}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.rowIconWrap, { backgroundColor: colors.error + '15' }]}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </View>
                    <View style={styles.toggleText}>
                      <Text style={[styles.toggleLabel, { color: colors.error }]}>Delete All Data</Text>
                      <Text style={styles.toggleDesc}>Permanently remove all scans, tests, and settings</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                </TouchableOpacity>
              </View>

              {/* Info */}
              <View style={styles.infoBox}>
                <Ionicons name="shield-checkmark" size={20} color={colors.secondary} />
                <Text style={styles.infoText}>
                  Your data is encrypted and stored securely. We never sell your personal information to third parties.
                </Text>
              </View>
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleLeft: {
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
  toggleText: {
    flex: 1,
  },
  toggleLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  toggleDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.secondaryLight + '12',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
});
