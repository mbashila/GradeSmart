import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, TouchableOpacity, Modal, ActivityIndicator, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import Input from '../components/Input';
import FormScrollView, { KEYBOARD_AVOIDING_BEHAVIOR } from '../components/FormScrollView';
import FormMessage from '../components/FormMessage';
import Logo from '../components/Logo';
import AnimatedScreen from '../components/AnimatedScreen';
import { GoogleIcon, AppleIcon, FacebookIcon } from '../components/SocialIcons';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { isPhoneNumber, isValidEmail } from '../utils/security';
import { getAuthErrorMessage } from '../utils/authErrors';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetTouched, setResetTouched] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const resetSubmittingRef = useRef(false);
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);
  const { signIn, signInWithPhone, signInAsGuest, resetPassword, isConfigured } = useAuth();
  const { showToast } = useToast();

  const isPhone = isPhoneNumber(identifier);

  const identifierError = (() => {
    const trimmed = identifier.trim();
    if (!trimmed) return 'Enter your email address or phone number.';
    if (!isPhone && !isValidEmail(trimmed)) return 'Enter a valid email address.';
    return '';
  })();
  const passwordError = !isPhone && !password ? 'Enter your password.' : '';
  const showIdentifierError = (touched.identifier || submitted) ? identifierError : '';
  const showPasswordError = (touched.password || submitted) ? passwordError : '';

  const resetEmailError = (() => {
    const trimmed = resetEmail.trim();
    if (!trimmed) return 'Enter your email address.';
    if (!isValidEmail(trimmed)) return 'Enter a valid email address.';
    return '';
  })();

  const markTouched = (field) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }));

  const handleIdentifierChange = (text) => {
    setIdentifier(text);
    if (formError) setFormError('');
  };

  const handlePasswordChange = (text) => {
    setPassword(text);
    if (formError) setFormError('');
  };

  const handleLogin = async () => {
    if (submittingRef.current) return;
    setSubmitted(true);
    setFormError('');
    if (!isConfigured) {
      setFormError('Supabase not configured. Add your credentials to app.json extra.');
      return;
    }
    if (identifierError) {
      identifierRef.current?.focus();
      return;
    }
    if (passwordError) {
      passwordRef.current?.focus();
      return;
    }

    const trimmed = identifier.trim();
    submittingRef.current = true;
    setLoading(true);
    Keyboard.dismiss();
    try {
      if (isPhone) {
        // Phone OTP login
        const phone = trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
        const { error } = await signInWithPhone(phone);
        if (error) {
          setFormError(getAuthErrorMessage(error, 'Could not send the verification code. Please try again.'));
          return;
        }
        navigation.navigate('VerifyOTP', { phone, type: 'login' });
      } else {
        // Email + password login
        const { error } = await signIn({ email: trimmed, password });
        if (error) {
          setFormError(getAuthErrorMessage(error, 'Sign-in failed. Please try again.'));
          return;
        }
        showToast('Signed in', 'success');
        navigation.navigate('Dashboard');
      }
    } catch (e) {
      setFormError(getAuthErrorMessage(e, 'Sign-in failed. Please try again.'));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const openForgotModal = () => {
    setResetEmail(isPhone ? '' : identifier.trim());
    setResetTouched(false);
    setResetError('');
    setShowForgotModal(true);
  };

  const closeForgotModal = () => {
    if (resetSubmittingRef.current) return;
    setShowForgotModal(false);
    setResetEmail('');
    setResetTouched(false);
    setResetError('');
  };

  const handleForgotPassword = async () => {
    if (resetSubmittingRef.current) return;
    setResetTouched(true);
    setResetError('');
    if (resetEmailError) return;
    resetSubmittingRef.current = true;
    setResetLoading(true);
    try {
      const { error } = await resetPassword(resetEmail.trim());
      if (error) {
        setResetError(getAuthErrorMessage(error, 'Could not send the reset email. Please try again.'));
        return;
      }
      resetSubmittingRef.current = false;
      showToast('If an account exists for that email, a reset link is on its way.', 'success', 3500);
      closeForgotModal();
    } catch (e) {
      setResetError(getAuthErrorMessage(e, 'Could not send the reset email. Please try again.'));
    } finally {
      resetSubmittingRef.current = false;
      setResetLoading(false);
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
      <FormScrollView contentContainerStyle={styles.scrollContent}>
          <AnimatedScreen>
            <View style={styles.brandingContainer}>
              <Logo size="welcome" />
            </View>

            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeTitle}>Welcome to GradeSmart</Text>
              <Text style={styles.welcomeSubtitle}>Sign in or create a new account.</Text>
            </View>

            <View style={styles.formCard}>
              <FormMessage message={formError} />

              <Input
                ref={identifierRef}
                label="Email or phone number"
                value={identifier}
                onChangeText={handleIdentifierChange}
                onBlur={() => markTouched('identifier')}
                placeholder="you@example.com or +260 97 123 4567"
                keyboardType="email-address"
                autoComplete="username"
                textContentType="username"
                returnKeyType={isPhone ? 'send' : 'next'}
                submitBehavior={isPhone ? 'blurAndSubmit' : 'submit'}
                onSubmitEditing={() => (isPhone ? handleLogin() : passwordRef.current?.focus())}
                iconName={isPhone ? 'call-outline' : 'mail-outline'}
                error={showIdentifierError}
                editable={!loading}
                style={styles.input}
              />

              {!isPhone && (
                <View style={styles.passwordContainer}>
                  <Input
                    ref={passwordRef}
                    label="Password"
                    value={password}
                    onChangeText={handlePasswordChange}
                    onBlur={() => markTouched('password')}
                    placeholder="Enter your password"
                    secureTextEntry
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    iconName="lock-closed-outline"
                    error={showPasswordError}
                    editable={!loading}
                    style={styles.passwordInput}
                  />
                  <TouchableOpacity
                    style={styles.forgotPassword}
                    onPress={openForgotModal}
                    accessibilityRole="button"
                    hitSlop={8}
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
                accessibilityRole="button"
                accessibilityState={{ disabled: loading, busy: loading }}
              >
                {loading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.signInButtonText}>{isPhone ? 'Sending code...' : 'Signing in...'}</Text>
                  </View>
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
      </FormScrollView>

      {/* Forgot Password Modal — outside KAV/ScrollView so keyboard works properly */}
      <Modal visible={showForgotModal} transparent animationType="fade" onRequestClose={closeForgotModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={KEYBOARD_AVOIDING_BEHAVIOR}
        >
          <TouchableOpacity
            style={styles.modalOverlayDismiss}
            activeOpacity={1}
            onPress={closeForgotModal}
            accessible={false}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle} accessibilityRole="header">Reset Password</Text>
            <Text style={styles.modalSubtitle}>Enter your email and we'll send you a reset link.</Text>
            <FormMessage message={resetError} />
            <Input
              label="Email"
              value={resetEmail}
              onChangeText={(text) => { setResetEmail(text); if (resetError) setResetError(''); }}
              onBlur={() => setResetTouched(true)}
              placeholder="you@example.com"
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={handleForgotPassword}
              iconName="mail-outline"
              error={resetTouched ? resetEmailError : ''}
              editable={!resetLoading}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={closeForgotModal}
                disabled={resetLoading}
                accessibilityRole="button"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSendBtn, resetLoading && { opacity: 0.7 }]}
                onPress={handleForgotPassword}
                disabled={resetLoading}
                accessibilityRole="button"
                accessibilityState={{ disabled: resetLoading, busy: resetLoading }}
              >
                {resetLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.modalSendText}>Sending...</Text>
                  </View>
                ) : (
                  <Text style={styles.modalSendText}>Send Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={styles.modalOverlayDismiss}
            activeOpacity={1}
            onPress={closeForgotModal}
            accessible={false}
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
  passwordInput: {
    marginBottom: 0,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
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
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    minHeight: 44,
    justifyContent: 'center',
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
    minHeight: 44,
    justifyContent: 'center',
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
