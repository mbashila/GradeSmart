import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AnimatedScreen from '../components/AnimatedScreen';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';

const CODE_LENGTH = 6;

export default function VerifyOTPScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { email, phone, type = 'signup' } = route.params || {};
  const identifier = email || phone || '';
  const isPhone = !!phone && !email;
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputs = useRef([]);
  const { showToast } = useToast();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    // Auto-focus the first input
    setTimeout(() => inputs.current[0]?.focus(), 300);
  }, []);

  const handleChange = (text, index) => {
    // Only take last character (handles paste of single digit)
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits filled
    if (digit && index === CODE_LENGTH - 1) {
      const fullCode = newCode.join('');
      if (fullCode.length === CODE_LENGTH) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  };

  const handlePaste = (text) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH).split('');
    if (digits.length > 0) {
      const newCode = Array(CODE_LENGTH).fill('');
      digits.forEach((d, i) => { newCode[i] = d; });
      setCode(newCode);
      const focusIndex = Math.min(digits.length, CODE_LENGTH - 1);
      inputs.current[focusIndex]?.focus();
      if (digits.length === CODE_LENGTH) {
        handleVerify(newCode.join(''));
      }
    }
  };

  const handleVerify = async (otp) => {
    const token = otp || code.join('');
    if (token.length < CODE_LENGTH) {
      showToast('Please enter the full verification code.', 'error');
      return;
    }
    setVerifying(true);
    try {
      const verifyParams = isPhone
        ? { phone, token, type: type === 'signup' ? 'sms' : 'sms' }
        : { email, token, type: type === 'signup' ? 'email' : 'email' };

      const { data, error } = await supabase.auth.verifyOtp(verifyParams);
      if (error) {
        showToast(error.message || 'Verification failed.', 'error');
        setCode(Array(CODE_LENGTH).fill(''));
        inputs.current[0]?.focus();
      } else {
        showToast('Verification successful!', 'success');
        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
      }
    } catch (e) {
      showToast('Verification failed. Please try again.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setResending(true);
    try {
      let error;
      if (isPhone) {
        const res = await supabase.auth.signInWithOtp({ phone });
        error = res.error;
      } else {
        const res = await supabase.auth.resend({
          type: type === 'signup' ? 'signup' : 'email_change',
          email,
        });
        error = res.error;
      }
      if (error) {
        showToast(error.message || 'Could not resend code.', 'error');
      } else {
        showToast('Code resent!', 'success');
        setCountdown(60);
        setCode(Array(CODE_LENGTH).fill(''));
        inputs.current[0]?.focus();
      }
    } catch {
      showToast('Could not resend code.', 'error');
    } finally {
      setResending(false);
    }
  };

  const maskedIdentifier = isPhone
    ? phone.replace(/(\d{3})\d+(\d{2})/, '$1****$2')
    : email.replace(/(.{2}).+(@.+)/, '$1***$2');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <AnimatedScreen>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Verify Code</Text>
          <Text style={styles.subtitle}>
            Please enter the code we just sent to{'\n'}
            <Text style={styles.identifierText}>{maskedIdentifier}</Text>
          </Text>

          <View style={styles.codeRow}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputs.current[index] = ref; }}
                style={[
                  styles.codeInput,
                  digit ? styles.codeInputFilled : null,
                ]}
                value={digit}
                onChangeText={(text) => handleChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                textContentType="oneTimeCode"
              />
            ))}
          </View>

          <View style={styles.resendRow}>
            <Text style={styles.resendHint}>Didn't receive OTP?</Text>
            {countdown > 0 ? (
              <Text style={styles.resendCountdown}>Resend in {countdown}s</Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={resending}>
                {resending ? (
                  <ActivityIndicator size="small" color={colors.secondary} />
                ) : (
                  <Text style={styles.resendLink}>Resend code</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.verifyBtn, verifying && styles.verifyBtnDisabled]}
            onPress={() => handleVerify()}
            disabled={verifying}
            activeOpacity={0.8}
          >
            {verifying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.verifyBtnText}>Verify</Text>
            )}
          </TouchableOpacity>
        </AnimatedScreen>
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
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 40,
  },
  identifierText: {
    color: colors.secondary,
    fontWeight: '600',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  codeInput: {
    width: 50,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  codeInputFilled: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondaryLight + '15',
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: 40,
  },
  resendHint: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  resendCountdown: {
    ...typography.bodySmall,
    color: colors.textLight,
  },
  resendLink: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  verifyBtn: {
    backgroundColor: colors.secondaryLight,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnDisabled: {
    opacity: 0.7,
  },
  verifyBtnText: {
    ...typography.button,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
