import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TextInput, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import PressableScale from '../components/PressableScale';
import { Skeleton } from '../components/Skeleton';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useAdmin } from '../context/AdminContext';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

export default function AdminQueriesScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { queries, fetchQueries, replyToQuery, loading } = useAdmin();
  const [filter, setFilter] = useState('open');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    fetchQueries(filter);
  }, [filter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchQueries(filter);
    setRefreshing(false);
  }, [fetchQueries, filter]);

  const handleReply = async () => {
    if (!replyText.trim() || !selectedQuery) return;
    setReplying(true);
    const { error } = await replyToQuery(selectedQuery.id, replyText.trim(), 'resolved');
    setReplying(false);
    if (error) {
      Alert.alert('Error', error.message || 'Failed to reply.');
    } else {
      Alert.alert('Sent', 'Reply sent successfully.');
      setSelectedQuery(null);
      setReplyText('');
      fetchQueries(filter);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return colors.error;
      case 'high': return colors.warning || '#F59E0B';
      case 'normal': return colors.secondary;
      default: return colors.textLight;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return colors.secondary;
      case 'in_progress': return colors.warning || '#F59E0B';
      case 'resolved': return colors.success;
      case 'closed': return colors.textLight;
      default: return colors.textSecondary;
    }
  };

  const renderQuery = useCallback(({ item: q }) => (
    <PressableScale containerStyle={styles.queryCard} onPress={() => { setSelectedQuery(q); setReplyText(''); }}>
      <View style={styles.queryHeader}>
        <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(q.priority) }]} />
        <Text style={styles.querySubject} numberOfLines={1}>{q.subject}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(q.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(q.status) }]}>
            {q.status === 'in_progress' ? 'In Progress' : q.status.charAt(0).toUpperCase() + q.status.slice(1)}
          </Text>
        </View>
      </View>
      <Text style={styles.queryMessage} numberOfLines={2}>{q.message}</Text>
      <View style={styles.queryFooter}>
        <Text style={styles.queryFrom}>{q.full_name || q.email || 'Unknown'}</Text>
        <Text style={styles.queryDate}>{q.created_at ? new Date(q.created_at).toLocaleDateString() : ''}</Text>
      </View>
      {q.admin_reply && (
        <View style={styles.replyPreview}>
          <Ionicons name="return-down-forward" size={14} color={colors.success} />
          <Text style={styles.replyPreviewText} numberOfLines={1}>{q.admin_reply}</Text>
        </View>
      )}
    </PressableScale>
  ), [colors, styles]);

  return (
    <View style={styles.container}>
      <Header title="Support Queries" onBack={() => navigation.goBack()} />

      {/* Status filter */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map(f => (
          <PressableScale
            key={f.key}
            containerStyle={[styles.filterBtn, filter === f.key && { backgroundColor: colors.secondary }]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && { color: '#fff' }]}>{f.label}</Text>
          </PressableScale>
        ))}
      </View>

      <FlatList
        data={queries}
        keyExtractor={(item) => item.id}
        renderItem={renderQuery}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.secondary} />}
        ListEmptyComponent={
          loading ? (
            [1,2,3].map(i => (
              <View key={i} style={styles.queryCard}>
                <Skeleton width={'70%'} height={16} />
                <Skeleton width={'90%'} height={14} style={{ marginTop: 8 }} />
                <Skeleton width={'50%'} height={12} style={{ marginTop: 8 }} />
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="chatbubble-ellipses-outline" size={36} color={colors.textLight} />
              <Text style={styles.emptyText}>No queries found</Text>
            </View>
          )
        }
      />

      {/* Reply Modal */}
      <Modal visible={!!selectedQuery} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Query Detail</Text>
              <PressableScale onPress={() => setSelectedQuery(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </PressableScale>
            </View>

            {selectedQuery && (
              <>
                <View style={styles.modalQueryInfo}>
                  <Text style={styles.modalSubject}>{selectedQuery.subject}</Text>
                  <Text style={styles.modalFrom}>From: {selectedQuery.full_name || selectedQuery.email}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedQuery.status) + '20', alignSelf: 'flex-start', marginTop: 6 }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(selectedQuery.status) }]}>
                      {selectedQuery.status === 'in_progress' ? 'In Progress' : selectedQuery.status.charAt(0).toUpperCase() + selectedQuery.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalMessage}>
                  <Text style={styles.modalMessageText}>{selectedQuery.message}</Text>
                </View>
                {selectedQuery.admin_reply && (
                  <View style={styles.existingReply}>
                    <Text style={styles.existingReplyLabel}>Your reply:</Text>
                    <Text style={styles.existingReplyText}>{selectedQuery.admin_reply}</Text>
                  </View>
                )}
                <TextInput
                  style={styles.replyInput}
                  placeholder="Type your reply..."
                  placeholderTextColor={colors.textLight}
                  value={replyText}
                  onChangeText={setReplyText}
                  multiline
                  textAlignVertical="top"
                />
                <PressableScale
                  containerStyle={[styles.replyBtn, (!replyText.trim() || replying) && { opacity: 0.5 }]}
                  onPress={handleReply}
                  disabled={!replyText.trim() || replying}
                >
                  <Text style={styles.replyBtnText}>{replying ? 'Sending...' : 'Send Reply & Resolve'}</Text>
                </PressableScale>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  queryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  queryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  querySubject: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  queryMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  queryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  queryFrom: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textLight,
  },
  queryDate: {
    fontSize: 11,
    color: colors.textLight,
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  replyPreviewText: {
    flex: 1,
    fontSize: 12,
    color: colors.success,
    fontStyle: 'italic',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 40,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: 8,
    fontSize: 14,
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
    marginBottom: 16,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  modalQueryInfo: {
    marginBottom: 12,
  },
  modalSubject: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  modalFrom: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  modalMessage: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  modalMessageText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  existingReply: {
    backgroundColor: colors.success + '10',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  existingReplyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
    marginBottom: 4,
  },
  existingReplyText: {
    fontSize: 13,
    color: colors.text,
  },
  replyInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  replyBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  replyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
