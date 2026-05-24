import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';

export default function TermsOfServiceScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Header title="Terms of Service" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AnimatedScreen>
          <Text style={styles.lastUpdated}>Last updated: May 2026</Text>

          <Text style={styles.heading}>1. Acceptance of Terms</Text>
          <Text style={styles.body}>
            By downloading, installing, or using the GradeSmart application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.
          </Text>

          <Text style={styles.heading}>2. Description of Service</Text>
          <Text style={styles.body}>
            GradeSmart is a mobile application designed to help teachers and educators create tests, scan student answer sheets, and grade papers efficiently. The App may include features such as optical character recognition (OCR), automated grading, and result exporting.
          </Text>

          <Text style={styles.heading}>3. User Accounts</Text>
          <Text style={styles.body}>
            You may be required to create an account to access certain features. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information when creating your account.
          </Text>

          <Text style={styles.heading}>4. Acceptable Use</Text>
          <Text style={styles.body}>
            You agree to use the App only for lawful purposes and in accordance with these Terms. You shall not:{'\n'}
            {'\u2022'} Use the App in any way that violates applicable laws or regulations{'\n'}
            {'\u2022'} Attempt to gain unauthorized access to any part of the App{'\n'}
            {'\u2022'} Upload or transmit harmful content, viruses, or malicious code{'\n'}
            {'\u2022'} Use the App to infringe on the intellectual property rights of others{'\n'}
            {'\u2022'} Reverse engineer, decompile, or disassemble the App
          </Text>

          <Text style={styles.heading}>5. User Content</Text>
          <Text style={styles.body}>
            You retain ownership of all content you create, upload, or input into the App, including test questions, student data, and grading results. By using the App, you grant GradeSmart a limited license to process and store this content solely for the purpose of providing the service.
          </Text>

          <Text style={styles.heading}>6. Privacy & Data</Text>
          <Text style={styles.body}>
            Your use of the App is also governed by our Privacy Policy. Student data and grading results are stored securely and are only accessible to you. We do not sell or share your personal data with third parties for marketing purposes.
          </Text>

          <Text style={styles.heading}>7. Subscription & Payments</Text>
          <Text style={styles.body}>
            Certain features of the App may require a paid subscription. Subscription fees, billing cycles, and cancellation policies will be clearly communicated before purchase. Free plan users are subject to usage limits as described in the App.
          </Text>

          <Text style={styles.heading}>8. Intellectual Property</Text>
          <Text style={styles.body}>
            The App, including its design, code, logos, and content, is the property of GradeSmart and is protected by copyright and other intellectual property laws. You may not copy, modify, distribute, or create derivative works based on the App without prior written consent.
          </Text>

          <Text style={styles.heading}>9. Disclaimers</Text>
          <Text style={styles.body}>
            The App is provided "as is" without warranties of any kind. GradeSmart does not guarantee that grading results will be 100% accurate. Teachers are encouraged to review all grading results before finalizing grades. We are not liable for any errors in grading or data loss.
          </Text>

          <Text style={styles.heading}>10. Limitation of Liability</Text>
          <Text style={styles.body}>
            To the maximum extent permitted by law, GradeSmart shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the App, even if we have been advised of the possibility of such damages.
          </Text>

          <Text style={styles.heading}>11. Termination</Text>
          <Text style={styles.body}>
            We reserve the right to suspend or terminate your account at any time if you violate these Terms. Upon termination, your right to use the App will immediately cease. You may also delete your account at any time through the App settings.
          </Text>

          <Text style={styles.heading}>12. Changes to Terms</Text>
          <Text style={styles.body}>
            We may update these Terms from time to time. We will notify you of any material changes through the App or via email. Your continued use of the App after changes are posted constitutes your acceptance of the revised Terms.
          </Text>

          <Text style={styles.heading}>13. Contact Us</Text>
          <Text style={styles.body}>
            If you have any questions about these Terms, please contact us at:{'\n'}
            Email: mbashilakuwunda@gmail.com{'\n'}
            WhatsApp: +260 762 883 061
          </Text>

          <Text style={styles.footer}>© {new Date().getFullYear()} GradeSmart. All rights reserved.</Text>
          <Text style={styles.createdBy}>NkUnDeJi & KuWuNdA mbashila</Text>
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
  createdBy: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
