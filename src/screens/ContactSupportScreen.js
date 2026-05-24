import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import PressableScale from '../components/PressableScale';
import { Skeleton, SkeletonCircle } from '../components/Skeleton';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const SUPPORT_EMAIL = 'mbashilakuwunda@gmail.com';

export default function ContactSupportScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [querySubject, setQuerySubject] = useState('');
  const [queryMessage, setQueryMessage] = useState('');
  const [queryPriority, setQueryPriority] = useState('normal');
  const [sending, setSending] = useState(false);

  const handleSendQuery = async () => {
    if (!querySubject.trim() || !queryMessage.trim()) {
      Alert.alert('Missing Info', 'Please fill in both subject and message.');
      return;
    }
    if (!isSupabaseConfigured || !user?.id) {
      Alert.alert('Not available', 'Sign in to send a support query.');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from('support_queries').insert({
        user_id: user.id,
        subject: querySubject.trim(),
        message: queryMessage.trim(),
        priority: queryPriority,
      });
      if (error) {
        Alert.alert('Error', error.message || 'Failed to send query.');
      } else {
        Alert.alert('Sent!', 'Your query has been submitted. An admin will respond soon.');
        setShowQueryModal(false);
        setQuerySubject('');
        setQueryMessage('');
        setQueryPriority('normal');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);
  const userEmail = user?.email || '';

  const handleEmail = () => {
    const subject = encodeURIComponent('GradeSmart Support Request');
    const body = encodeURIComponent(`\n\n---\nAccount: ${userEmail}\nApp Version: 1.0.0`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  const handleCall = () => {
    Linking.openURL('tel:+260762883061');
  };

  const handleWhatsApp = () => {
    Linking.openURL('https://wa.me/260762883061?text=Hi%2C%20I%20need%20help%20with%20GradeSmart');
  };

  const contactMethods = [
    {
      icon: 'mail-outline',
      label: 'Email Us',
      description: SUPPORT_EMAIL,
      detail: 'Response within 24 hours',
      onPress: handleEmail,
      accent: colors.secondary,
    },
    {
      icon: 'call-outline',
      label: 'Phone Support',
      description: '+260 762 883 061',
      detail: 'Mon-Fri, 8am - 6pm CAT',
      onPress: handleCall,
      accent: colors.success,
    },
    {
      icon: 'logo-whatsapp',
      label: 'WhatsApp',
      description: 'Chat with us on WhatsApp',
      detail: 'Quick responses',
      onPress: handleWhatsApp,
      accent: '#25D366',
    },
    {
      icon: 'send-outline',
      label: 'Send a Query',
      description: 'Submit a support request in-app',
      detail: 'Admin will respond directly',
      onPress: () => setShowQueryModal(true),
      accent: colors.warning || '#F59E0B',
    },
  ];

  const quickActions = [
    { icon: 'bug-outline', label: 'Report a Bug', onPress: () => Linking.openURL(`mailto:bugs@gradesmart.app?subject=Bug%20Report&body=${encodeURIComponent(`\n\n---\nAccount: ${userEmail}\nApp Version: 1.0.0`)}`) },
    { icon: 'bulb-outline', label: 'Request a Feature', onPress: () => Linking.openURL(`mailto:feedback@gradesmart.app?subject=Feature%20Request&body=${encodeURIComponent(`\n\n---\nAccount: ${userEmail}`)}`) },
    { icon: 'help-circle-outline', label: 'Browse FAQ', onPress: () => navigation.navigate('HelpCenter') },
  ];

  return (
    <View style={styles.container}>
      <Header title="Contact Support" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AnimatedScreen>
          {loading ? (
            <>
              <View style={styles.hero}>
                <SkeletonCircle size={64} />
                <Skeleton width={180} height={22} style={{ marginTop: 14 }} />
                <Skeleton width={220} height={14} style={{ marginTop: 6 }} />
              </View>
              <View style={styles.card}>
                {[1,2,3,4].map(i => (
                  <View key={i} style={[styles.contactRow, i < 4 && styles.rowBorder]}>
                    <Skeleton width={44} height={44} radius={12} />
                    <View style={[styles.contactText, { marginLeft: 14 }]}>
                      <Skeleton width={100} height={16} />
                      <Skeleton width={180} height={12} style={{ marginTop: 4 }} />
                      <Skeleton width={120} height={10} style={{ marginTop: 4 }} />
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.card}>
                <Skeleton width={110} height={16} style={{ marginBottom: 8 }} />
                {[1,2,3].map(i => (
                  <View key={i} style={[styles.quickRow, i < 3 && styles.rowBorder]}>
                    <View style={styles.quickLeft}>
                      <Skeleton width={32} height={32} radius={8} />
                      <Skeleton width={120} height={14} style={{ marginLeft: 12 }} />
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              {/* Hero */}
              <View style={styles.hero}>
                <View style={styles.heroIconWrap}>
                  <Ionicons name="headset" size={32} color={colors.secondary} />
                </View>
                <Text style={styles.heroTitle}>We're here to help</Text>
                <Text style={styles.heroSubtitle}>Choose how you'd like to reach us</Text>
              </View>

              {/* Contact methods */}
              <View style={styles.card}>
                {contactMethods.map((method, i) => (
                  <TouchableOpacity
                    key={method.label}
                    style={[styles.contactRow, i < contactMethods.length - 1 && styles.rowBorder]}
                    onPress={method.onPress}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.contactIconWrap, { backgroundColor: method.accent + '15' }]}>
                      <Ionicons name={method.icon} size={22} color={method.accent} />
                    </View>
                    <View style={styles.contactText}>
                      <Text style={styles.contactLabel}>{method.label}</Text>
                      <Text style={styles.contactDesc}>{method.description}</Text>
                      <Text style={styles.contactDetail}>{method.detail}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quick actions */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Quick Actions</Text>
                {quickActions.map((action, i) => (
                  <TouchableOpacity
                    key={action.label}
                    style={[styles.quickRow, i < quickActions.length - 1 && styles.rowBorder]}
                    onPress={action.onPress}
                    activeOpacity={0.6}
                  >
                    <View style={styles.quickLeft}>
                      <View style={styles.quickIconWrap}>
                        <Ionicons name={action.icon} size={18} color={colors.secondary} />
                      </View>
                      <Text style={styles.quickLabel}>{action.label}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Query submission modal */}
          <Modal visible={showQueryModal} animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Send a Query</Text>
                  <PressableScale onPress={() => setShowQueryModal(false)}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </PressableScale>
                </View>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Subject"
                  placeholderTextColor={colors.textLight}
                  value={querySubject}
                  onChangeText={setQuerySubject}
                />
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea]}
                  placeholder="Describe your issue or question..."
                  placeholderTextColor={colors.textLight}
                  value={queryMessage}
                  onChangeText={setQueryMessage}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.priorityLabel}>Priority</Text>
                <View style={styles.priorityRow}>
                  {['low', 'normal', 'high', 'urgent'].map(p => (
                    <PressableScale
                      key={p}
                      containerStyle={[styles.priorityBtn, queryPriority === p && {
                        backgroundColor: p === 'urgent' ? colors.error : p === 'high' ? (colors.warning || '#F59E0B') : colors.secondary,
                      }]}
                      onPress={() => setQueryPriority(p)}
                    >
                      <Text style={[styles.priorityText, queryPriority === p && { color: '#fff' }]}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
                <PressableScale
                  containerStyle={[styles.sendBtn, (!querySubject.trim() || !queryMessage.trim() || sending) && { opacity: 0.5 }]}
                  onPress={handleSendQuery}
                  disabled={!querySubject.trim() || !queryMessage.trim() || sending}
                >
                  <Text style={styles.sendBtnText}>{sending ? 'Sending...' : 'Submit Query'}</Text>
                </PressableScale>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* Account info footer */}
          {userEmail ? (
            <View style={styles.accountInfo}>
              <Ionicons name="person-circle-outline" size={16} color={colors.textLight} />
              <Text style={styles.accountText}>Logged in as {userEmail}</Text>
            </View>
          ) : null}
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
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    ...typography.h3,
    color: colors.text,
  },
  heroSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  contactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  contactText: {
    flex: 1,
  },
  contactLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  contactDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 1,
  },
  contactDetail: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: 2,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  quickLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  quickIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.secondaryLight + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  accountText: {
    ...typography.caption,
    color: colors.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTextArea: {
    minHeight: 100,
  },
  priorityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sendBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
