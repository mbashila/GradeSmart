import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';

export default function NotificationDetailScreen({ route, navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { notification } = route.params || {};

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return { name: 'checkmark-done-circle', color: colors.success, bg: colors.success + '15' };
      case 'warning':
        return { name: 'warning', color: colors.warning, bg: colors.warning + '15' };
      case 'info':
      default:
        return { name: 'information-circle', color: colors.info, bg: colors.info + '15' };
    }
  };

  if (!notification) {
    return (
      <View style={styles.container}>
        <Header title="Notification" onBack={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Notification not found.</Text>
        </View>
      </View>
    );
  }

  const icon = getIcon(notification.type);

  return (
    <View style={styles.container}>
      <Header title="Notification" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AnimatedScreen>
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
              <Ionicons name={icon.name} size={36} color={icon.color} />
            </View>
          </View>

          <Text style={styles.title}>{notification.title}</Text>
          <Text style={styles.time}>{notification.time}</Text>

          <View style={styles.divider} />

          <Text style={styles.message}>{notification.message}</Text>
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
    paddingTop: 24,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  time: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
