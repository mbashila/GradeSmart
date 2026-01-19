import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import AnimatedScreen from '../components/AnimatedScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useNotifications } from '../context/NotificationsContext';

export default function ProfileScreen({ navigation }) {
  const { unreadCount } = useNotifications();
  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'You have been signed out.',
      [
        {
          text: 'OK',
          onPress: () =>
            navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] }),
        },
      ],
      { cancelable: false }
    );
  };

  return (
    <View style={styles.container}>
      <Header 
        title="Profile" 
        onBack={() => navigation.goBack()} 
        rightIcon="notifications-outline"
        onRightPress={() => navigation.navigate('Notifications')}
        rightBadge={unreadCount}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <AnimatedScreen>
          <View style={styles.headerSection}>
            <Ionicons name="person-circle" size={96} color={colors.secondary} />
            <Text style={styles.name}>Sarah Collins</Text>
            <Text style={styles.role}>Teacher</Text>
          </View>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>sarah.collins@example.com</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>School</Text>
              <Text style={styles.value}>Greenwood High</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Change Password</Text>
              <Text style={styles.value}>••••••••</Text>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Notifications</Text>
              <Text style={styles.value}>Enabled</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Theme</Text>
              <Text style={styles.value}>Light</Text>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <Button title="Open Notifications" variant="outline" onPress={() => navigation.navigate('Notifications')} />
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Support</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Help Center</Text>
              <Text style={styles.value}>Browse FAQs</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>About</Text>
              <Text style={styles.value}>GradeSmart v1.0</Text>
            </View>
          </Card>
        </AnimatedScreen>

        <AnimatedScreen delay={120}>
          <View style={styles.actions}>
            <Button title="Edit Profile" variant="outline" style={styles.actionButton} onPress={() => {}} />
            <Button title="Sign Out" variant="primary" onPress={handleSignOut} />
          </View>
        </AnimatedScreen>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },
  name: {
    ...typography.h2,
    color: colors.text,
    marginTop: 8,
  },
  role: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    marginTop: 16,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
  },
  value: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  actions: {
    marginTop: 24,
  },
  actionButton: {
    marginBottom: 12,
  },
});
