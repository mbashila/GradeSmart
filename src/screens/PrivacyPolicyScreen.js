 import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';

export default function PrivacyPolicyScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Header title="Privacy Policy" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AnimatedScreen>
          <Text style={styles.lastUpdated}>Last updated: May 2026</Text>

          <Text style={styles.heading}>1. Introduction</Text>
          <Text style={styles.body}>
            GradeSmart ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your information when you use the GradeSmart mobile application ("App").
          </Text>

          <Text style={styles.heading}>2. Information We Collect</Text>
          <Text style={styles.subheading}>Account Information</Text>
          <Text style={styles.body}>
            When you create an account, we collect your email address, display name, and school name. This information is used to identify you and personalize your experience.
          </Text>
          <Text style={styles.subheading}>Student & Test Data</Text>
          <Text style={styles.body}>
            When you use the App to create tests and grade papers, we process student names, student numbers, test questions, answer sheets (scanned images), and grading results. This data is stored securely and is only accessible to you.
          </Text>
          <Text style={styles.subheading}>Device Information</Text>
          <Text style={styles.body}>
            We may collect basic device information such as device type, operating system version, and a unique device identifier for session management and security purposes.
          </Text>

          <Text style={styles.heading}>3. How We Use Your Information</Text>
          <Text style={styles.body}>
            We use your information to:{'\n'}
            {'\u2022'} Provide and maintain the App's grading and scanning services{'\n'}
            {'\u2022'} Process and store your test and grading data{'\n'}
            {'\u2022'} Authenticate your identity and manage your account{'\n'}
            {'\u2022'} Send important notifications about your account or the App{'\n'}
            {'\u2022'} Respond to support queries and provide customer service{'\n'}
            {'\u2022'} Improve the App's features and user experience
          </Text>

          <Text style={styles.heading}>4. Data Storage & Security</Text>
          <Text style={styles.body}>
            Your data is stored securely using industry-standard encryption and security practices. We use Supabase as our backend provider, which employs row-level security policies to ensure your data is only accessible to you. Sensitive credentials are stored using secure device storage.
          </Text>

          <Text style={styles.heading}>5. Data Sharing</Text>
          <Text style={styles.body}>
            We do not sell, trade, or share your personal data with third parties for marketing purposes. We may share data only in the following circumstances:{'\n'}
            {'\u2022'} With your explicit consent{'\n'}
            {'\u2022'} To comply with legal obligations or respond to lawful requests{'\n'}
            {'\u2022'} To protect the rights, safety, or property of GradeSmart or its users
          </Text>

          <Text style={styles.heading}>6. Third-Party Services</Text>
          <Text style={styles.body}>
            The App may use third-party services for features like text recognition and automated grading. When these services are used, only the minimum necessary data is shared (e.g., scanned images for text extraction). No personally identifiable student information is sent to third-party services.
          </Text>

          <Text style={styles.heading}>7. Data Retention</Text>
          <Text style={styles.body}>
            We retain your data for as long as your account is active. You can delete individual test results or your entire account at any time through the App. Upon account deletion, all associated data will be permanently removed from our servers.
          </Text>

          <Text style={styles.heading}>8. Your Rights</Text>
          <Text style={styles.body}>
            You have the right to:{'\n'}
            {'\u2022'} Access and view all data stored in your account{'\n'}
            {'\u2022'} Export your grading results as PDF documents{'\n'}
            {'\u2022'} Correct or update your personal information{'\n'}
            {'\u2022'} Delete your account and all associated data{'\n'}
            {'\u2022'} Opt out of non-essential data collection
          </Text>

          <Text style={styles.heading}>9. Children's Privacy</Text>
          <Text style={styles.body}>
            The App is designed for use by teachers and educators. We do not knowingly collect personal information from children under the age of 13. Student data entered by teachers is the responsibility of the teacher and their institution.
          </Text>

          <Text style={styles.heading}>10. Changes to This Policy</Text>
          <Text style={styles.body}>
            We may update this Privacy Policy from time to time. We will notify you of any significant changes through the App or via email. Your continued use of the App after changes are posted constitutes your acceptance of the updated policy.
          </Text>

          <Text style={styles.heading}>11. Contact Us</Text>
          <Text style={styles.body}>
            If you have any questions or concerns about this Privacy Policy or how we handle your data, please contact us at:{'\n'}
            Email: mbashilakuwunda@gmail.com{'\n'}
            WhatsApp: +260 762 883 061
          </Text>

          <Text style={styles.footer}>© {new Date().getFullYear()} GradeSmart. All rights reserved.</Text>
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
    paddingBottom: 48,
  },
  lastUpdated: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  heading: {
    ...typography.h4,
    color: colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  subheading: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 4,
  },
  footer: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: 32,
  },
});
