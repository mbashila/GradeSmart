import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import Logo from '../components/Logo';
import AnimatedScreen from '../components/AnimatedScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export default function WelcomeScreen({ navigation }) {
  return (
    <LinearGradient
      colors={[colors.background, colors.surfaceLight]}
      style={styles.container}
    >
      <AnimatedScreen style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Logo size="welcome" />
        </View>
        
        {/* Welcome Text */}
        <Text style={styles.title}>Welcome to GradeSmart</Text>
        <Text style={styles.subtitle}>
          Streamline your grading process with AI-powered paper scanning
        </Text>
        
        {/* Features */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <Ionicons name="camera" size={24} color={colors.secondaryLight} />
            <Text style={styles.featureText}>Quick paper scanning</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="checkmark-done-circle" size={24} color={colors.secondaryLight} />
            <Text style={styles.featureText}>Instant grading</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="analytics" size={24} color={colors.secondaryLight} />
            <Text style={styles.featureText}>Performance insights</Text>
          </View>
        </View>
      </AnimatedScreen>
      
      {/* Action Buttons */}
      <AnimatedScreen style={styles.actions} delay={120}>
        <Button
          title="Get Started"
          onPress={() => navigation.navigate('Login')}
          variant="primary"
        />
      </AnimatedScreen>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  content: {
    flexGrow: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 8,
    marginTop: 16,
  },
  title: {
    ...typography.h1,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  features: {
    width: '100%',
    paddingHorizontal: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingLeft: 8,
  },
  featureText: {
    ...typography.body,
    color: colors.text,
    marginLeft: 16,
  },
  actions: {
    width: '100%',
    marginTop: 12,
  },
  secondaryButton: {
    marginTop: 12,
  },
});
