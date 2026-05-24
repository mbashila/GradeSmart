import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import Input from '../components/Input';
import Logo from '../components/Logo';
import AnimatedScreen from '../components/AnimatedScreen';
import { GoogleIcon, AppleIcon, FacebookIcon } from '../components/SocialIcons';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [password, setPassword] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithPhone, signInAsGuest, resetPassword, isConfigured } = useAuth();
  const { showToast } = useToast();

  const isPhone = /^\+?\d[\d\s\-()]{6,}$/.test(identifier.trim());

  const handleLogin = async () => {
    if (!isConfigured) {
      showToast('Supabase not configured. Add your credentials to app.json extra.', 'error');
      return;
    }
    const trimmed = identifier.trim();
    if (!trimmed) {
      showToast('Please enter your email or phone number.', 'error');
      return;
    }

    setLoading(true);

    if (isPhone) {
      // Phone OTP login
      const phone = trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
      const { error } = await signInWithPhone(phone);
      setLoading(false);
      if (error) {
        showToast(error.message || 'Could not send OTP.', 'error');
        return;
      }
      navigation.navigate('VerifyOTP', { phone, type: 'login' });
    } else {
      // Email + password login
      if (!password) {
        setLoading(false);
        showToast('Please enter your password.', 'error');
        return;
      }
      const { data, error } = await signIn({ email: trimmed, password });
      setLoading(false);
      if (error) {
        showToast(error.message || 'Sign-in failed', 'error');
        return;
      }
      showToast('Signed in', 'success');
      navigation.navigate('Dashboard');
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      showToast('Please enter your email address.', 'error');
      return;
    }
    setResetLoading(true);
    const { error } = await resetPassword(resetEmail.trim());
    setResetLoading(false);
    if (error) {
      showToast(error.message || 'Could not send reset email.', 'error');
    } else {
      showToast('Password reset email sent! Check your inbox.', 'success');
      setShowForgotModal(false);
      setResetEmail('');
    }
  };

  const handleGuestLogin = () => {
    signInAsGuest();
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  };

  const handleSocialLogin = async (provider) => {
    if (!isConfigured) {
      showToast('Supabase not configured.', 'error');
      return;
    }
    setSocialLoading(provider);
    try {
      const redirectUrl = makeRedirectUri({ scheme: 'gradesmart', path: 'auth/callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        showToast(error.message || `${provider} sign-in failed`, 'error');
        return;
      }
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success' && result.url) {
          const params = new URL(result.url);
          const accessToken = params.searchParams?.get('access_token') || params.hash?.match(/access_token=([^&]+)/)?.[1];
          const refreshToken = params.searchParams?.get('refresh_token') || params.hash?.match(/refresh_token=([^&]+)/)?.[1];
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            showToast('Signed in!', 'success');
            navigation.navigate('Dashboard');
          }
        }
      }
    } catch (e) {
      showToast(`${provider} sign-in failed`, 'error');
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AnimatedScreen>
            <View style={styles.brandingContainer}>
              <Logo size="welcome" />
            </View>

            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeTitle}>Welcome to GradeSmart</Text>
              <Text style={styles.welcomeSubtitle}>Sign in or create a new account.</Text>
            </View>

            <View style={styles.formCard}>
              <Input
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="Email or Phone Number"
                keyboardType="default"
                autoCapitalize="none"
                iconName={isPhone ? 'call-outline' : 'mail-outline'}
                style={styles.input}
              />

              {!isPhone && (
                <View style={styles.passwordContainer}>
                  <Input
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    secureTextEntry
                    iconName="lock-closed-outline"
                    style={styles.input}
                  />
                  <TouchableOpacity
                    style={styles.forgotPassword}
                    onPress={() => { setResetEmail(identifier); setShowForgotModal(true); }}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>
              )}

              {isPhone && (
                <Text style={styles.phoneHint}>We'll send you a verification code via SMS</Text>
              )}

              <TouchableOpacity
                style={[styles.signInButton, loading && { opacity: 0.7 }]}
                onPress={handleLogin}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.signInButtonText}>{isPhone ? 'Send Code' : 'Sign In'}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Social Auth Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Auth Buttons — Round, icon only */}
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialCircle}
                onPress={() => handleSocialLogin('google')}
                activeOpacity={0.7}
                disabled={!!socialLoading}
              >
                {socialLoading === 'google' ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <GoogleIcon size={24} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.socialCircle}
                onPress={() => handleSocialLogin('apple')}
                activeOpacity={0.7}
                disabled={!!socialLoading}
              >
                {socialLoading === 'apple' ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <AppleIcon size={24} color={colors.text} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.socialCircle}
                onPress={() => handleSocialLogin('facebook')}
                activeOpacity={0.7}
                disabled={!!socialLoading}
              >
                {socialLoading === 'facebook' ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <FacebookIcon size={24} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.newUserContainer}>
              <Text style={styles.newUserText}>New to GradeSmart?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.guestContainer}>
              <TouchableOpacity onPress={handleGuestLogin}>
                <Text style={styles.guestLink}>Continue as Guest</Text>
              </TouchableOpacity>
              <Text style={styles.guestHint}>Limited to 3 tests</Text>
            </View>
          </AnimatedScreen>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal — outside KAV/ScrollView so keyboard works properly */}
      <Modal visible={showForgotModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.modalOverlayDismiss}
            activeOpacity={1}
            onPress={() => { setShowForgotModal(false); setResetEmail(''); }}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalSubtitle}>Enter your email and we'll send you a reset link.</Text>
            <TextInput
              style={styles.modalInput}
              value={resetEmail}
              onChangeText={setResetEmail}
              placeholder="Email address"
              placeholderTextColor={colors.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowForgotModal(false); setResetEmail(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSendBtn} onPress={handleForgotPassword} disabled={resetLoading}>
                {resetLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSendText}>Send Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={styles.modalOverlayDismiss}
            activeOpacity={1}
            onPress={() => { setShowForgotModal(false); setResetEmail(''); }}
          />
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  brandingContainer: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 24,
  },
  welcomeContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  welcomeTitle: {
    ...typography.h1,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    ...typography.body,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  input: {
    marginBottom: 16,
  },
  passwordContainer: {
    marginBottom: 8,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 16,
  },
  forgotPasswordText: {
    ...typography.bodySmall,
    color: colors.secondaryLight,
    fontSize: 14,
  },
  phoneHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  signInButton: {
    backgroundColor: colors.secondaryLight,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signInButtonText: {
    ...typography.button,
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  newUserContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  newUserText: {
    ...typography.body,
    color: colors.textSecondary,
    marginRight: 4,
  },
  signUpLink: {
    ...typography.body,
    color: colors.secondaryLight,
    fontWeight: '600',
  },
  guestContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  guestLink: {
    ...typography.body,
    color: colors.secondaryLight,
    fontWeight: '600',
  },
  guestHint: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textLight,
    marginHorizontal: 12,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 24,
  },
  socialCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalOverlayDismiss: {
    flex: 1,
    width: '100%',
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalCancelText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalSendBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.secondary,
  },
  modalSendText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
});
