import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
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

export default function SignUpScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [socialLoading, setSocialLoading] = useState(null);
  const [loading, setLoading] = useState(false);
  const { signUp, signInWithPhone, signInAsGuest, isConfigured } = useAuth();
  const { showToast } = useToast();

  const isPhone = /^\+?\d[\d\s\-()]{6,}$/.test(identifier.trim());

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
        showToast(error.message || `${provider} sign-up failed`, 'error');
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
    } catch {
      showToast(`${provider} sign-up failed`, 'error');
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSignUp = async () => {
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
      // Phone sign-up: send OTP via SMS
      const phone = trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
      const { error } = await signInWithPhone(phone);
      setLoading(false);
      if (error) {
        showToast(error.message || 'Could not send verification code.', 'error');
        return;
      }
      navigation.navigate('VerifyOTP', { phone, type: 'signup' });
    } else {
      // Email sign-up: create account, then navigate to OTP verification
      if (!password || !confirmPassword) {
        setLoading(false);
        showToast('Fill in all required fields.', 'error');
        return;
      }
      if (password !== confirmPassword) {
        setLoading(false);
        showToast('Passwords do not match.', 'error');
        return;
      }
      if (password.length < 6) {
        setLoading(false);
        showToast('Password must be at least 6 characters.', 'error');
        return;
      }
      const { data, error } = await signUp({ email: trimmed, password, name });
      setLoading(false);
      if (error) {
        showToast(error.message || 'Sign-up failed.', 'error');
        return;
      }
      // Navigate to OTP verification screen
      showToast('Verification code sent to your email.', 'success');
      navigation.navigate('VerifyOTP', { email: trimmed, type: 'signup' });
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
              <Text style={styles.welcomeTitle}>Create Account</Text>
              <Text style={styles.welcomeSubtitle}>Sign up to get started with GradeSmart.</Text>
            </View>

            <View style={styles.formCard}>
              <Input
                value={name}
                onChangeText={setName}
                placeholder="Full Name"
                iconName="person-outline"
                style={styles.input}
              />

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
                <>
                  <Input
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    secureTextEntry
                    iconName="lock-closed-outline"
                    style={styles.input}
                  />

                  <Input
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm Password"
                    secureTextEntry
                    iconName="lock-closed-outline"
                    style={styles.input}
                  />
                </>
              )}

              {isPhone && (
                <Text style={styles.phoneHint}>We'll send you a verification code via SMS</Text>
              )}

              <TouchableOpacity
                style={[styles.signUpButton, loading && styles.signUpButtonDisabled]}
                onPress={handleSignUp}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.signUpButtonText}>{isPhone ? 'Send Code' : 'Sign Up'}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Social Auth Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign up with</Text>
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

            <View style={styles.existingUserContainer}>
              <Text style={styles.existingUserText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.signInLink}>Sign In</Text>
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
  phoneHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  signUpButton: {
    backgroundColor: colors.secondaryLight,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  signUpButtonText: {
    ...typography.button,
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  existingUserContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  existingUserText: {
    ...typography.body,
    color: colors.textSecondary,
    marginRight: 4,
  },
  signInLink: {
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
});
