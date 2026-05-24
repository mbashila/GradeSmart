import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../context/ThemeContext';
import { lightColors } from '../theme/colors';
import { typography } from '../theme/typography';

const getSubjectCategories = (colors) => [
  {
    category: 'Mathematics & Calculations',
    icon: 'calculator',
    color: colors.primary,
    subjects: ['Mathematics', 'Algebra', 'Geometry', 'Trigonometry', 'Calculus', 'Statistics'],
  },
  {
    category: 'Sciences',
    icon: 'flask',
    color: colors.secondary,
    subjects: ['Physics', 'Chemistry', 'Biology', 'Environmental Science'],
  },
  {
    category: 'Medical & Health',
    icon: 'medkit',
    color: colors.error,
    subjects: ['Anatomy', 'Physiology', 'Pharmacology', 'Nursing', 'Biochemistry', 'Microbiology', 'Medicine'],
  },
  {
    category: 'Business & Finance',
    icon: 'cash',
    color: colors.success,
    subjects: ['Accounting', 'Economics', 'Finance', 'Business Studies'],
  },
  {
    category: 'Engineering & Tech',
    icon: 'construct',
    color: colors.accent,
    subjects: ['Engineering', 'Computer Science', 'Information Technology'],
  },
  {
    category: 'Languages & Humanities',
    icon: 'book',
    color: colors.info,
    subjects: ['English', 'Literature', 'History', 'Geography', 'Religious Studies', 'Philosophy', 'Law'],
  },
];

// Build a flat lookup for grading mode
const MATH_KEYWORDS = ['math', 'algebra', 'geometry', 'trigonometry', 'calculus', 'statistics', 'physics', 'chemistry', 'accounting', 'economics', 'finance', 'engineering'];
const SCIENCE_KEYWORDS = ['biology', 'anatomy', 'physiology', 'pharmacology', 'nursing', 'medicine', 'biochemistry', 'microbiology'];

export function getGradingMode(subject, colors = lightColors) {
  if (!subject) return { mode: 'general', label: 'General', icon: 'create', color: colors.info };
  const lower = subject.toLowerCase();
  if (MATH_KEYWORDS.some(k => lower.includes(k))) {
    return { mode: 'calculation', label: 'Calculation Mode', icon: 'calculator', color: colors.primary };
  }
  if (SCIENCE_KEYWORDS.some(k => lower.includes(k))) {
    return { mode: 'science', label: 'Science Mode', icon: 'flask', color: colors.secondary };
  }
  return { mode: 'general', label: 'Essay Mode', icon: 'create', color: colors.info };
}

export default function SubjectPicker({ label, value, onSelect, placeholder }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const SUBJECT_CATEGORIES = useMemo(() => getSubjectCategories(colors), [colors]);
  const gradingMode = useMemo(() => getGradingMode(value, colors), [value, colors]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return SUBJECT_CATEGORIES;
    const q = search.toLowerCase();
    return SUBJECT_CATEGORIES.map(cat => ({
      ...cat,
      subjects: cat.subjects.filter(s => s.toLowerCase().includes(q)),
    })).filter(cat => cat.subjects.length > 0);
  }, [search]);

  const handleSelect = (subj) => {
    onSelect(subj);
    setVisible(false);
    setSearch('');
    setCustomMode(false);
  };

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      handleSelect(customValue.trim());
      setCustomValue('');
    }
  };

  const renderCategory = ({ item: cat }) => (
    <View style={styles.categorySection}>
      <View style={styles.categoryHeader}>
        <Ionicons name={cat.icon} size={18} color={cat.color} />
        <Text style={[styles.categoryTitle, { color: cat.color }]}>{cat.category}</Text>
      </View>
      <View style={styles.subjectChips}>
        {cat.subjects.map((subj) => (
          <TouchableOpacity
            key={subj}
            style={[styles.chip, value === subj && { backgroundColor: cat.color + '20', borderColor: cat.color }]}
            onPress={() => handleSelect(subj)}
          >
            <Text style={[styles.chipText, value === subj && { color: cat.color, fontWeight: '700' }]}>
              {subj}
            </Text>
            {value === subj && <Ionicons name="checkmark" size={14} color={cat.color} style={{ marginLeft: 4 }} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity style={styles.selector} onPress={() => setVisible(true)} activeOpacity={0.7}>
        {value ? (
          <View style={styles.selectedRow}>
            <Ionicons name={gradingMode.icon} size={18} color={gradingMode.color} />
            <Text style={styles.selectedText}>{value}</Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>{placeholder || 'Select a subject'}</Text>
        )}
        <Ionicons name="chevron-down" size={18} color={colors.textLight} />
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { setVisible(false); setSearch(''); setCustomMode(false); }} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Subject</Text>
              <TouchableOpacity onPress={() => { setVisible(false); setSearch(''); setCustomMode(false); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.textLight} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search subjects..."
                placeholderTextColor={colors.textLight}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textLight} />
                </TouchableOpacity>
              ) : null}
            </View>

            {!customMode ? (
              <>
                <FlatList
                  data={filteredCategories}
                  keyExtractor={(item) => item.category}
                  renderItem={renderCategory}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>No subjects match "{search}"</Text>
                    </View>
                  }
                />
                <TouchableOpacity style={styles.customButton} onPress={() => setCustomMode(true)}>
                  <Ionicons name="add-circle" size={20} color={colors.secondary} />
                  <Text style={styles.customButtonText}>Enter custom subject</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.customSection}>
                <Text style={styles.customLabel}>Enter your subject:</Text>
                <TextInput
                  style={styles.customInput}
                  placeholder="e.g., Marine Biology, Civil Law"
                  placeholderTextColor={colors.textLight}
                  value={customValue}
                  onChangeText={setCustomValue}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCustomSubmit}
                />
                <View style={styles.customActions}>
                  <TouchableOpacity style={styles.customCancelBtn} onPress={() => { setCustomMode(false); setCustomValue(''); }}>
                    <Text style={styles.customCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.customConfirmBtn, !customValue.trim() && { opacity: 0.5 }]}
                    onPress={handleCustomSubmit}
                    disabled={!customValue.trim()}
                  >
                    <Text style={styles.customConfirmText}>Use This Subject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    ...typography.bodySmall,
    color: colors.text,
    marginBottom: 8,
    fontWeight: '600',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 56,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  selectedText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  placeholder: {
    ...typography.body,
    color: colors.textLight,
    flex: 1,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    marginLeft: 8,
    color: colors.text,
    paddingVertical: 0,
  },
  // Categories
  categorySection: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subjectChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  // Custom subject
  customButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  customButtonText: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
    marginLeft: 8,
  },
  customSection: {
    paddingTop: 8,
  },
  customLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  customInput: {
    ...typography.body,
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    marginBottom: 12,
  },
  customActions: {
    flexDirection: 'row',
    gap: 12,
  },
  customCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  customCancelText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  customConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    alignItems: 'center',
  },
  customConfirmText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
  },
});
