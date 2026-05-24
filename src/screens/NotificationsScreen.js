import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import Skeleton, { SkeletonCircle } from '../components/Skeleton';
import PressableScale from '../components/PressableScale';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useNotifications } from '../context/NotificationsContext';

export default function NotificationsScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { notifications, unreadCount, markAllRead, toggleRead, loading } = useNotifications();

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return { name: 'checkmark-done-circle', color: colors.success };
      case 'warning':
        return { name: 'warning', color: colors.warning };
      case 'info':
      default:
        return { name: 'information-circle', color: colors.info };
    }
  };

  const openNotification = (n) => {
    if (!n.read) toggleRead(n.id);
    navigation.navigate('NotificationDetail', { notification: n });
  };

  return (
    <View style={styles.container}>
      <Header
        title="Notifications"
        onBack={() => navigation.goBack()}
        rightAction="Mark All"
        onRightPress={markAllRead}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <AnimatedScreen>
          {loading ? (
            [1,2,3,4].map(idx => (
              <Card key={idx} style={styles.notificationCard}>
                <View style={styles.row}>
                  <View style={styles.iconWrap}>
                    <SkeletonCircle size={24} />
                  </View>
                  <View style={styles.content}>
                    <Skeleton width={'65%'} height={16} />
                    <Skeleton width={'90%'} height={14} style={{ marginTop: 8 }} />
                  </View>
                </View>
              </Card>
            ))
          ) : notifications.length === 0 ? (
            <Card style={[styles.notificationCard, { alignItems: 'center' }]}> 
              <Ionicons name="checkmark-circle-outline" size={40} color={colors.secondary} />
              <Text style={[typography.h4, { color: colors.text, marginTop: 8 }]}>All caught up</Text>
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>No notifications right now.</Text>
            </Card>
          ) : (
            notifications.map((n) => {
              const icon = getIcon(n.type);
              return (
                <Card key={n.id} style={[styles.notificationCard, !n.read && styles.unreadCard]}>
                  <PressableScale onPress={() => openNotification(n)} containerStyle={styles.row} haptic={true}>
                    <View style={styles.iconWrap}>
                      <Ionicons name={icon.name} size={24} color={icon.color} />
                    </View>
                    <View style={styles.content}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.title, !n.read && styles.titleUnread]} numberOfLines={1}>{n.title}</Text>
                        <Text style={styles.time}>{n.time}</Text>
                      </View>
                      <Text style={styles.preview} numberOfLines={1}>{n.message}</Text>
                    </View>
                    <View style={styles.rightCol}>
                      {!n.read && <View style={styles.dot} />}
                      <Ionicons name="chevron-forward" size={16} color={colors.textLight} style={styles.chevron} />
                    </View>
                  </PressableScale>
                </Card>
              );
            })
          )}
        </AnimatedScreen>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  notificationCard: {
    marginBottom: 12,
    paddingVertical: 12,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary,
    backgroundColor: colors.secondaryLight + '10',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 40,
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    ...typography.h4,
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  titleUnread: {
    fontWeight: '700',
  },
  time: {
    ...typography.caption,
    color: colors.textLight,
  },
  preview: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
  },
  rightCol: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.secondary,
    marginBottom: 4,
  },
  chevron: {
    opacity: 0.5,
  },
});
