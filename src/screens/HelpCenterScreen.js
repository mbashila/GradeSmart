import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import { Skeleton } from '../components/Skeleton';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';

const FAQ_ITEMS = [
  {
    question: 'How do I scan a test paper?',
    answer: 'Navigate to the Dashboard and tap "Scan Papers". Position your camera over the answer sheet, ensure good lighting, and tap the capture button. The app will automatically detect and process the answers.',
  },
  {
    question: 'How does AI grading work?',
    answer: 'AI grading uses machine learning to evaluate student responses. For MCQ tests, it compares scanned answers against your marking key. For essay-type questions, it analyzes content relevance, grammar, and structure. AI grading is available on Pro plans.',
  },
  {
    question: 'Can I edit grades after scanning?',
    answer: 'Yes! After scanning, go to the Results screen where you can review each student\'s answers. Tap on any question to manually adjust the score if needed.',
  },
  {
    question: 'How do I upgrade to Pro?',
    answer: 'Go to your Profile and tap on your current plan under "Subscription", or navigate to the Payment screen. Choose between Monthly or Yearly plans to unlock unlimited tests, AI grading, and more.',
  },
  {
    question: 'What happens to my data if I cancel Pro?',
    answer: 'Your data is safe! If you cancel your Pro subscription, you\'ll retain access to all your existing tests and scans. You\'ll just be limited to Free plan features for new work.',
  },
  {
    question: 'How many tests can I create on the Free plan?',
    answer: 'The Free plan allows you to create 1 test. Upgrade to a Pro plan for unlimited tests, AI-powered grading, and advanced features.',
  },
];

const CONTACT_OPTIONS = [
  {
    icon: 'mail-outline',
    label: 'Email Support',
    description: 'Get help within 24 hours',
    action: () => Linking.openURL('mailto:mbashilakuwunda@gmail.com?subject=GradeSmart%20Support'),
  },
  {
    icon: 'logo-whatsapp',
    label: 'WhatsApp',
    description: '+260 762 883 061',
    action: () => Linking.openURL('https://wa.me/260762883061?text=Hi%2C%20I%20need%20help%20with%20GradeSmart'),
  },
];

export default function HelpCenterScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const toggleFAQ = (index) => {
    setExpandedIndex(prev => prev === index ? null : index);
  };

  return (
    <View style={styles.container}>
      <Header title="Help Center" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AnimatedScreen>
          {loading ? (
            <>
              <View style={styles.banner}>
                <Skeleton width={56} height={56} radius={16} />
                <View style={[styles.bannerText, { marginLeft: 14 }]}>
                  <Skeleton width={160} height={20} />
                  <Skeleton width={240} height={14} style={{ marginTop: 6 }} />
                </View>
              </View>
              <View style={styles.card}>
                <Skeleton width={200} height={16} style={{ marginBottom: 12 }} />
                {[1,2,3,4,5].map(i => (
                  <View key={i} style={[styles.faqItem, i < 5 && styles.rowBorder]}>
                    <View style={styles.faqHeader}>
                      <Skeleton width={'80%'} height={16} />
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.card}>
                <Skeleton width={100} height={16} style={{ marginBottom: 12 }} />
                {[1,2,3].map(i => (
                  <View key={i} style={[styles.contactRow, i < 3 && styles.rowBorder]}>
                    <View style={styles.contactLeft}>
                      <Skeleton width={32} height={32} radius={8} />
                      <View style={[styles.contactText, { marginLeft: 12 }]}>
                        <Skeleton width={100} height={14} />
                        <Skeleton width={150} height={12} style={{ marginTop: 4 }} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              {/* Quick help banner */}
              <View style={styles.banner}>
                <View style={styles.bannerIconWrap}>
                  <Ionicons name="help-buoy" size={28} color={colors.secondary} />
                </View>
                <View style={styles.bannerText}>
                  <Text style={styles.bannerTitle}>How can we help?</Text>
                  <Text style={styles.bannerSubtitle}>Browse FAQs or contact our support team</Text>
                </View>
              </View>

              {/* FAQ section */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Frequently Asked Questions</Text>
                {FAQ_ITEMS.map((item, i) => (
                  <View key={i} style={[styles.faqItem, i < FAQ_ITEMS.length - 1 && styles.rowBorder]}>
                    <TouchableOpacity
                      style={styles.faqHeader}
                      onPress={() => toggleFAQ(i)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.faqQuestion}>{item.question}</Text>
                      <Ionicons
                        name={expandedIndex === i ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.textLight}
                      />
                    </TouchableOpacity>
                    {expandedIndex === i && (
                      <Text style={styles.faqAnswer}>{item.answer}</Text>
                    )}
                  </View>
                ))}
              </View>

              {/* Contact section */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Contact Us</Text>
                {CONTACT_OPTIONS.map((opt, i) => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.contactRow, i < CONTACT_OPTIONS.length - 1 && styles.rowBorder]}
                    onPress={opt.action}
                    activeOpacity={0.6}
                  >
                    <View style={styles.contactLeft}>
                      <View style={styles.rowIconWrap}>
                        <Ionicons name={opt.icon} size={18} color={colors.secondary} />
                      </View>
                      <View style={styles.contactText}>
                        <Text style={styles.contactLabel}>{opt.label}</Text>
                        <Text style={styles.contactDesc}>{opt.description}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Report a bug */}
              <TouchableOpacity
                style={styles.bugBtn}
                onPress={() => Linking.openURL('mailto:bugs@gradesmart.app?subject=Bug%20Report')}
                activeOpacity={0.7}
              >
                <Ionicons name="bug-outline" size={18} color={colors.secondary} />
                <Text style={styles.bugBtnText}>Report a Bug</Text>
              </TouchableOpacity>
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryLight + '12',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  bannerIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.secondaryLight + '25',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    ...typography.h4,
    color: colors.text,
  },
  bannerSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
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
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  faqItem: {
    paddingVertical: 14,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 10,
    lineHeight: 20,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  contactLeft: {
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
  contactText: {
    flex: 1,
  },
  contactLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  contactDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  bugBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    gap: 8,
    marginTop: 8,
  },
  bugBtnText: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
  },
});
