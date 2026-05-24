import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import { Skeleton, SkeletonCircle } from '../components/Skeleton';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';

const APP_VERSION = '1.0.0';
const BUILD_NUMBER = '1';

export default function AppVersionScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const infoRows = [
    { icon: 'code-slash-outline', label: 'Version', value: `v${APP_VERSION}` },
    { icon: 'hammer-outline', label: 'Build', value: BUILD_NUMBER },
  ];

  const linkRows = [
    { icon: 'document-text-outline', label: 'Terms of Service', onPress: () => navigation.navigate('TermsOfService') },
    { icon: 'shield-outline', label: 'Privacy Policy', onPress: () => navigation.navigate('PrivacyPolicy') },
    { icon: 'logo-github', label: 'Open Source Licenses', onPress: () => Alert.alert('Coming Soon', 'This feature is coming soon. Stay tuned!') },
  ];

  return (
    <View style={styles.container}>
      <Header title="App Version" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AnimatedScreen>
          {loading ? (
            <>
              <View style={styles.heroSection}>
                <SkeletonCircle size={80} />
                <Skeleton width={140} height={24} style={{ marginTop: 14 }} />
              </View>
              <View style={styles.card}>
                <Skeleton width={140} height={16} style={{ marginBottom: 12 }} />
                {[1,2].map(i => (
                  <View key={i} style={[styles.row, i < 2 && styles.rowBorder]}>
                    <View style={styles.rowLeft}>
                      <Skeleton width={32} height={32} radius={8} />
                      <Skeleton width={90} height={14} style={{ marginLeft: 12 }} />
                    </View>
                    <Skeleton width={50} height={14} />
                  </View>
                ))}
              </View>
              <View style={styles.card}>
                <Skeleton width={60} height={16} style={{ marginBottom: 12 }} />
                {[1,2,3].map(i => (
                  <View key={i} style={[styles.row, i < 3 && styles.rowBorder]}>
                    <View style={styles.rowLeft}>
                      <Skeleton width={32} height={32} radius={8} />
                      <Skeleton width={130} height={14} style={{ marginLeft: 12 }} />
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              {/* Logo & App name */}
              <View style={styles.heroSection}>
                <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
                <Text style={styles.appName}>GradeSmart</Text>
              </View>

              {/* Version info card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>App Information</Text>
                {infoRows.map((row, i) => (
                  <View key={row.label} style={[styles.row, i < infoRows.length - 1 && styles.rowBorder]}>
                    <View style={styles.rowLeft}>
                      <View style={styles.rowIconWrap}>
                        <Ionicons name={row.icon} size={18} color={colors.secondary} />
                      </View>
                      <Text style={styles.rowLabel}>{row.label}</Text>
                    </View>
                    <Text style={styles.rowValue}>{row.value}</Text>
                  </View>
                ))}
              </View>

              {/* Links card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Legal</Text>
                {linkRows.map((row, i) => (
                  <TouchableOpacity
                    key={row.label}
                    style={[styles.row, i < linkRows.length - 1 && styles.rowBorder]}
                    onPress={row.onPress}
                    activeOpacity={0.6}
                  >
                    <View style={styles.rowLeft}>
                      <View style={styles.rowIconWrap}>
                        <Ionicons name={row.icon} size={18} color={colors.secondary} />
                      </View>
                      <Text style={styles.rowLabel}>{row.label}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Footer */}
              <Text style={styles.footer}>© {new Date().getFullYear()} GradeSmart. All rights reserved.</Text>
              <Text style={styles.createdBy}>NkUnDeJi & KuWuNdA mbashila</Text>
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
  heroSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 16,
  },
  appName: {
    ...typography.h2,
    color: colors.text,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  rowLabel: {
    ...typography.body,
    color: colors.text,
  },
  rowValue: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  footer: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: 24,
  },
  createdBy: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
