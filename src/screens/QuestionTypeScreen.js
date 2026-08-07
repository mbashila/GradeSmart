import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import Stepper from '../components/Stepper';
import { useToast } from '../components/Toast';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import Input from '../components/Input';
import { extractQuestionsFromPaperImage, getOpenAIKey } from '../utils/openaiService';
import { useAuth } from '../context/AuthContext';

const ALL_SECTION_TYPES = [
  { key: 'mcq', label: 'MCQs', icon: 'radio-button-on' },
  { key: 'fill_in_blank', label: 'Fill in Blanks', icon: 'remove-outline' },
  { key: 'matching', label: 'Matching', icon: 'git-compare-outline' },
  { key: 'short_notes', label: 'Short Notes', icon: 'create-outline' },
  { key: 'comprehension', label: 'Comprehension', icon: 'book-outline' },
  { key: 'essay', label: 'Essay', icon: 'document-text-outline' },
];
const ESSAY_SECTION_TYPES = ALL_SECTION_TYPES.filter(t => t.key !== 'mcq');
const SECTION_SUB_TYPES = [
  { key: 'hasDiagrams', label: 'Diagrams', icon: 'image-outline' },
  { key: 'hasCalculations', label: 'Calculations', icon: 'calculator-outline' },
  { key: 'hasGraphs', label: 'Graphs / Charts', icon: 'bar-chart-outline' },
  { key: 'hasTables', label: 'Tables', icon: 'grid-outline' },
  { key: 'hasMaps', label: 'Maps', icon: 'map-outline' },
  { key: 'hasCodeSnippets', label: 'Code Snippets', icon: 'code-slash-outline' },
  { key: 'hasTrueFalse', label: 'True / False', icon: 'checkmark-circle-outline' },
];

export default function QuestionTypeScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { showToast } = useToast();
  const { isAdmin } = useAuth();
  const [questionType, setQuestionType] = useState(route?.params?.questionType || '');
  const [mcqOptions, setMcqOptions] = useState(route?.params?.mcqOptions || 4);

  const testData = route.params || {};

  // ── Direct MCQ state (when questionType === 'multiple-choice') ──
  const [directMcq, setDirectMcq] = useState({
    questionCount: '',
    markingKey: '',
    mcqOptions: 4,
  });

  // ── Per-section state ──
  // Each section: { label, type, images:[], extracting, extractionDone, extractionMsg, questions:[], markingKey:'', mcqOptions:4, mcqQuestionCount:'', manualQuestions:[''], expanded:true }
  const [sections, setSections] = useState([]);
  const [expandedSection, setExpandedSection] = useState(0); // index of expanded section

  // ── Section CRUD ──
  const addSection = () => {
    const nextLabel = String.fromCharCode(65 + sections.length);
    setSections(prev => [...prev, {
      label: nextLabel,
      type: '',
      images: [],
      extracting: false,
      extractionDone: false,
      extractionMsg: '',
      questions: [],
      markingKey: '',
      mcqOptions: 4,
      mcqQuestionCount: '',
      manualQuestions: [''],
      expanded: true,
      hasDiagrams: false,
      hasCalculations: false,
      hasGraphs: false,
      hasTables: false,
      hasMaps: false,
      hasCodeSnippets: false,
      hasTrueFalse: false,
    }]);
    setExpandedSection(sections.length);
  };

  const updateSection = (index, updates) => {
    setSections(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const removeSection = (index) => {
    setSections(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Re-label A, B, C...
      return updated.map((s, i) => ({ ...s, label: String.fromCharCode(65 + i) }));
    });
    if (expandedSection >= sections.length - 1) setExpandedSection(Math.max(0, sections.length - 2));
  };

  // ── Per-section photo capture ──
  const handleSectionTakePhoto = useCallback(async (sIdx) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
      if (!result.canceled && result.assets?.[0]) {
        setSections(prev => prev.map((s, i) => i === sIdx
          ? { ...s, images: [...s.images, result.assets[0].uri], extractionDone: false, questions: [], extractionMsg: '' }
          : s
        ));
      }
    } catch { showToast('Failed to take photo', 'error'); }
  }, []);

  const handleSectionPickGallery = useCallback(async (sIdx) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
      if (!result.canceled && result.assets?.length > 0) {
        setSections(prev => prev.map((s, i) => i === sIdx
          ? { ...s, images: [...s.images, ...result.assets.map(a => a.uri)], extractionDone: false, questions: [], extractionMsg: '' }
          : s
        ));
      }
    } catch { showToast('Failed to pick images', 'error'); }
  }, []);

  const removeSectionImage = (sIdx, imgIdx) => {
    setSections(prev => prev.map((s, i) => i === sIdx
      ? { ...s, images: s.images.filter((_, j) => j !== imgIdx), extractionDone: false, questions: [], extractionMsg: '' }
      : s
    ));
  };

  // ── Per-section extraction ──
  const handleSectionExtract = useCallback(async (sIdx) => {
    const section = sections[sIdx];
    if (!section || section.images.length === 0) {
      showToast('Upload at least one photo for this section', 'error');
      return;
    }
    const key = await getOpenAIKey();
    if (!key) { showToast('API key not set. Go to Settings to add it.', 'error'); return; }

    updateSection(sIdx, { extracting: true, extractionMsg: `Reading Section ${section.label} (${section.images.length} page${section.images.length > 1 ? 's' : ''})...` });

    try {
      const result = await extractQuestionsFromPaperImage(section.images, {
        subject: testData?.subject || '',
        sectionTypes: [section.type],
        sectionMapping: [{ label: section.label, type: section.type }],
      });

      if (result.error) {
        updateSection(sIdx, { extracting: false, extractionDone: true, extractionMsg: `Failed: ${result.error}` });
        showToast(`Section ${section.label}: Could not extract questions`, 'error');
      } else {
        updateSection(sIdx, {
          extracting: false,
          extractionDone: true,
          questions: result.questions,
          extractionMsg: `Found ${result.questions.length} questions.`,
        });
        showToast(`Section ${section.label}: Extracted ${result.questions.length} questions`, 'success');
      }
    } catch {
      updateSection(sIdx, { extracting: false, extractionDone: true, extractionMsg: 'Extraction failed. Try again.' });
      showToast('Something went wrong', 'error');
    }
  }, [sections, testData]);

  // ── Direct MCQ key handler ──
  const handleDirectKeyChange = (txt) => {
    const maxLetter = String.fromCharCode(64 + (directMcq.mcqOptions || 4));
    const allowedRegex = new RegExp(`[^A-${maxLetter}]`, 'g');
    let v = (txt || '').toUpperCase().replace(allowedRegex, '');
    const limit = parseInt(directMcq.questionCount, 10) || 0;
    if (limit && v.length > limit) v = v.slice(0, limit);
    setDirectMcq(prev => ({ ...prev, markingKey: v }));
  };

  // ── MCQ key handling per section ──
  const handleSectionKeyChange = (sIdx, txt) => {
    const section = sections[sIdx];
    const maxLetter = String.fromCharCode(64 + (section.mcqOptions || 4));
    const allowedRegex = new RegExp(`[^A-${maxLetter}]`, 'g');
    let v = (txt || '').toUpperCase().replace(allowedRegex, '');
    const limit = parseInt(section.mcqQuestionCount, 10) || section.questions.length || 0;
    if (limit && v.length > limit) v = v.slice(0, limit);
    updateSection(sIdx, { markingKey: v });
  };

  // ── Manual question handling per section ──
  const handleSectionManualChange = (sIdx, qIdx, text) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sIdx) return s;
      const updated = [...s.manualQuestions];
      updated[qIdx] = text;
      return { ...s, manualQuestions: updated };
    }));
  };

  const addSectionManualQuestion = (sIdx) => {
    setSections(prev => prev.map((s, i) => i === sIdx ? { ...s, manualQuestions: [...s.manualQuestions, ''] } : s));
  };

  const removeSectionManualQuestion = (sIdx, qIdx) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sIdx) return s;
      return { ...s, manualQuestions: s.manualQuestions.filter((_, j) => j !== qIdx) };
    }));
  };

  // ── Validation & Continue ──
  const handleContinue = () => {
    if (!questionType) {
      showToast('Please select a question type', 'error');
      return;
    }

    if (questionType === 'multiple-choice') {
      const qCount = parseInt(directMcq.questionCount, 10) || 0;
      if (!qCount) { showToast('Enter the number of questions', 'error'); return; }
      if (!directMcq.markingKey || directMcq.markingKey.length !== qCount) {
        showToast(`Marking key must have exactly ${qCount} answers`, 'error'); return;
      }
    } else if (questionType === 'essay' || questionType === 'mixed') {
      if (sections.length === 0) {
        showToast('Add at least one section and upload the question paper', 'error');
        return;
      }

      // Validate each section
      for (const sec of sections) {
        if (!sec.type) {
          showToast(`Please assign a type for Section ${sec.label}`, 'error');
          return;
        }
        if (sec.type === 'mcq') {
          const expectedCount = parseInt(sec.mcqQuestionCount, 10) || 0;
          if (!expectedCount) {
            showToast(`Section ${sec.label}: Enter the number of MCQ questions`, 'error');
            return;
          }
          if (!sec.markingKey || sec.markingKey.length !== expectedCount) {
            showToast(`Section ${sec.label}: Marking key must have exactly ${expectedCount} answers`, 'error');
            return;
          }
        } else {
          // Non-MCQ sections need extracted or manually typed questions
          const hasExtracted = sec.extractionDone && sec.questions.length > 0;
          const hasManual = sec.manualQuestions.some(q => q && q.trim());
          if (!hasExtracted && !hasManual) {
            showToast(`Section ${sec.label}: Upload & extract questions, or type them manually`, 'error');
            return;
          }
        }
      }
    }

    // Build structured section data for downstream screens
    let sectionData;

    if (questionType === 'multiple-choice') {
      // Direct MCQ mode — build a single pseudo-section
      const qCount = parseInt(directMcq.questionCount, 10) || 0;
      const questions = Array.from({ length: qCount }, (_, i) => ({
        number: i + 1, text: `Question ${i + 1}`, type: 'mcq', section: 'Section A', maxPoints: 1,
      }));
      sectionData = [{
        label: 'A',
        type: 'mcq',
        questions,
        markingKey: directMcq.markingKey,
        mcqOptions: directMcq.mcqOptions,
      }];
    } else {
      sectionData = sections.map(s => {
        let questions;
        if (s.questions.length > 0) {
          questions = s.questions;
        } else if (s.type === 'mcq' && s.markingKey) {
          questions = Array.from({ length: s.markingKey.length }, (_, i) => ({
            number: i + 1, text: `Question ${i + 1}`, type: 'mcq', section: `Section ${s.label}`, maxPoints: 1,
          }));
        } else {
          questions = s.manualQuestions.filter(q => q && q.trim()).map((text, i) => ({
            number: i + 1, text, type: s.type, section: `Section ${s.label}`, maxPoints: 0,
          }));
        }
        return {
          label: s.label,
          type: s.type,
          questions,
          markingKey: s.type === 'mcq' ? s.markingKey : undefined,
          mcqOptions: s.type === 'mcq' ? s.mcqOptions : undefined,
          images: s.images,
          hasDiagrams: s.hasDiagrams || false,
          hasCalculations: s.hasCalculations || false,
          hasGraphs: s.hasGraphs || false,
          hasTables: s.hasTables || false,
          hasMaps: s.hasMaps || false,
          hasCodeSnippets: s.hasCodeSnippets || false,
          hasTrueFalse: s.hasTrueFalse || false,
        };
      });
    }

    // Flatten all questions
    const allQuestions = sectionData.flatMap(s => s.questions);
    const mcqSections = sectionData.filter(s => s.type === 'mcq');
    const nonMcqSections = sectionData.filter(s => s.type !== 'mcq');

    // Build combined marking key from MCQ sections
    const combinedMarkingKey = mcqSections.map(s => s.markingKey || '').join('');
    const totalMcqCount = mcqSections.reduce((sum, s) => sum + s.questions.length, 0);

    showToast('Question type saved', 'success');
    navigation.navigate('ReviewTest', {
      ...testData,
      questionType,
      mcqCount: totalMcqCount || undefined,
      mcqOptions: mcqSections.length > 0 ? mcqSections[0].mcqOptions : mcqOptions,
      markingKey: combinedMarkingKey || undefined,
      extractedQuestions: allQuestions.length > 0 ? allQuestions : undefined,
      sectionData,
      questionTexts: nonMcqSections.flatMap(s => s.questions.map(q => q.text)),
    });
  };

  return (
    <View style={styles.container}>
      <Header
        title="Question Type"
        onBack={() => navigation.goBack()}
      />
      
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Stepper steps={['Details', 'Questions', 'Review']} current={1} />
        <AnimatedScreen>
          <View style={styles.content}>
            <Text style={styles.title}>Choose Question Type</Text>
            <Text style={styles.subtitle}>
              Select the type of questions in your test
            </Text>
            
            <View style={styles.options}>
              <TouchableOpacity
                style={[
                  styles.option,
                  questionType === 'multiple-choice' && styles.optionSelected,
                ]}
                onPress={() => setQuestionType('multiple-choice')}
                activeOpacity={0.7}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="radio-button-on" 
                    size={32} 
                    color={questionType === 'multiple-choice' ? colors.secondary : colors.textLight} 
                  />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionTitle,
                    questionType === 'multiple-choice' && styles.optionTitleSelected,
                  ]}>
                    Multiple Choice
                  </Text>
                  <Text style={styles.optionDescription}>
                    OMR sheets with A, B, C, D options
                  </Text>
                </View>
                {questionType === 'multiple-choice' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.option,
                  questionType === 'essay' && styles.optionSelected,
                ]}
                onPress={() => setQuestionType('essay')}
                activeOpacity={0.7}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="document-text" 
                    size={32} 
                    color={questionType === 'essay' ? colors.secondary : colors.textLight} 
                  />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionTitle,
                    questionType === 'essay' && styles.optionTitleSelected,
                  ]}>
                    Essay-Based
                  </Text>
                  <Text style={styles.optionDescription}>
                    Written answers requiring manual review
                  </Text>
                </View>
                {questionType === 'essay' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.option,
                  questionType === 'mixed' && styles.optionSelected,
                  !isAdmin && styles.optionDisabled,
                ]}
                onPress={() => {
                  if (!isAdmin) {
                    showToast('Mixed questions coming soon!', 'info');
                    return;
                  }
                  setQuestionType('mixed');
                }}
                activeOpacity={isAdmin ? 0.7 : 0.5}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="layers" 
                    size={32} 
                    color={questionType === 'mixed' ? colors.secondary : colors.textLight} 
                  />
                </View>
                <View style={[styles.optionContent, { flex: 1 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[
                      styles.optionTitle,
                      questionType === 'mixed' && styles.optionTitleSelected,
                      !isAdmin && { color: colors.textLight },
                    ]}>
                      Mixed
                    </Text>
                    {!isAdmin && (
                      <View style={{ marginLeft: 8, backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>COMING SOON</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.optionDescription, !isAdmin && { color: colors.textLight }]}>
                    Combination of multiple choice and essay questions
                  </Text>
                </View>
                {questionType === 'mixed' && isAdmin && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
                )}
              </TouchableOpacity>
            </View>

            {/* ── Direct MCQ Setup (no sections needed) ── */}
            {questionType === 'multiple-choice' && (
              <View style={{ marginTop: 20 }}>
                <Text style={[typography.h4, { color: colors.text, marginBottom: 4 }]}>
                  MCQ Setup
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 12 }]}>
                  Set up the marking key. Students will be scanned one at a time during grading.
                </Text>

                <Card style={styles.extractedCard}>
                  <Input
                    label="Number of Questions"
                    value={directMcq.questionCount}
                    onChangeText={(txt) => setDirectMcq(prev => ({ ...prev, questionCount: txt.replace(/[^0-9]/g, '') }))}
                    placeholder="e.g., 20"
                    keyboardType="number-pad"
                  />

                  <Text style={[typography.caption, { color: colors.text, fontWeight: '600', marginBottom: 6 }]}>
                    Options per question
                  </Text>
                  <View style={styles.mcqOptionsRow}>
                    {[3, 4, 5, 6].map((n) => {
                      const letter = String.fromCharCode(64 + n);
                      const active = (directMcq.mcqOptions || 4) === n;
                      return (
                        <TouchableOpacity
                          key={n}
                          style={[styles.mcqOptionChip, active && styles.mcqOptionChipActive]}
                          onPress={() => {
                            const newRegex = new RegExp(`[^A-${letter}]`, 'g');
                            setDirectMcq(prev => ({ ...prev, mcqOptions: n, markingKey: (prev.markingKey || '').replace(newRegex, '') }));
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.mcqOptionChipText, active && styles.mcqOptionChipTextActive]}>A-{letter}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Input
                    label={`Marking Key${directMcq.questionCount ? ` (${directMcq.questionCount} answers)` : ''}`}
                    value={directMcq.markingKey}
                    onChangeText={handleDirectKeyChange}
                    placeholder={`e.g., ${'ABCD'.slice(0, directMcq.mcqOptions || 4).repeat(3).slice(0, 8)}...`}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {directMcq.questionCount ? (
                    <Text style={{ ...typography.caption, color: directMcq.markingKey?.length === parseInt(directMcq.questionCount, 10) ? colors.success : colors.textSecondary, marginTop: -10, marginBottom: 8 }}>
                      {directMcq.markingKey?.length || 0} / {directMcq.questionCount} answers entered
                    </Text>
                  ) : (
                    <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: -10, marginBottom: 8 }}>
                      Enter number of questions first.
                    </Text>
                  )}

                  {directMcq.markingKey?.length === parseInt(directMcq.questionCount, 10) && parseInt(directMcq.questionCount, 10) > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text style={[typography.caption, { color: colors.success }]}>Marking key complete. Ready to grade students.</Text>
                    </View>
                  )}
                </Card>
              </View>
            )}

            {/* ── Per-Section Setup (essay/mixed only) ── */}
            {(questionType === 'essay' || questionType === 'mixed') && (
              <View style={{ marginTop: 20 }}>
                <Text style={[typography.h4, { color: colors.text, marginBottom: 4 }]}>
                  Define Sections
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 12 }]}>
                  Add each section of your paper, upload its photos, and extract the questions.
                </Text>

                {sections.map((section, sIdx) => {
                  const isExpanded = expandedSection === sIdx;
                  const sectionDone = section.extractionDone && section.questions.length > 0;
                  const sectionHasManual = section.manualQuestions.some(q => q && q.trim());
                  const mcqExpected = parseInt(section.mcqQuestionCount, 10) || 0;
                  const mcqReady = section.type === 'mcq' && mcqExpected > 0 && section.markingKey?.length === mcqExpected;
                  const sectionReady = mcqReady || sectionDone || sectionHasManual;
                  const typeLabel = ALL_SECTION_TYPES.find(t => t.key === section.type)?.label || 'Not set';
                  const secMaxLetter = String.fromCharCode(64 + (section.mcqOptions || 4));

                  return (
                    <Card key={sIdx} style={[styles.extractedCard, sectionReady && { borderColor: colors.success, borderWidth: 1 }]}>
                      {/* Section header — tap to expand/collapse */}
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                        onPress={() => setExpandedSection(isExpanded ? -1 : sIdx)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                          <View style={styles.sectionMapLabel}>
                            <Text style={styles.sectionMapLabelText}>Section {section.label}</Text>
                          </View>
                          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{typeLabel}</Text>
                          {sectionReady && <Ionicons name="checkmark-circle" size={18} color={colors.success} />}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity onPress={() => removeSection(sIdx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="trash-outline" size={18} color={colors.error} />
                          </TouchableOpacity>
                          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textLight} />
                        </View>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={{ marginTop: 14 }}>
                          {/* Section type picker */}
                          <Text style={[typography.caption, { color: colors.text, fontWeight: '600', marginBottom: 6 }]}>Question Type</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 14 }}>
                            {(questionType === 'essay' ? ESSAY_SECTION_TYPES : ALL_SECTION_TYPES).map((st) => {
                              const active = section.type === st.key;
                              return (
                                <TouchableOpacity
                                  key={st.key}
                                  style={[styles.sectionTypeChip, active && styles.sectionTypeChipActive]}
                                  onPress={() => updateSection(sIdx, { type: st.key })}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name={st.icon} size={14} color={active ? '#fff' : colors.textSecondary} />
                                  <Text style={[styles.sectionTypeChipText, active && styles.sectionTypeChipTextActive]}>{st.label}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>

                          {/* Section body — different layout for MCQ vs non-MCQ */}
                          {section.type === 'mcq' ? (
                            <>
                              {/* ── MCQ Section: count → options → key → answer sheet ── */}
                              <Input
                                label="Number of Questions"
                                value={section.mcqQuestionCount}
                                onChangeText={(txt) => {
                                  const num = txt.replace(/[^0-9]/g, '');
                                  updateSection(sIdx, { mcqQuestionCount: num });
                                }}
                                placeholder="e.g., 20"
                                keyboardType="number-pad"
                              />

                              <Text style={[typography.caption, { color: colors.text, fontWeight: '600', marginBottom: 6 }]}>
                                Options per question
                              </Text>
                              <View style={styles.mcqOptionsRow}>
                                {[3, 4, 5, 6].map((n) => {
                                  const letter = String.fromCharCode(64 + n);
                                  const active = (section.mcqOptions || 4) === n;
                                  return (
                                    <TouchableOpacity
                                      key={n}
                                      style={[styles.mcqOptionChip, active && styles.mcqOptionChipActive]}
                                      onPress={() => {
                                        const newRegex = new RegExp(`[^A-${letter}]`, 'g');
                                        updateSection(sIdx, { mcqOptions: n, markingKey: (section.markingKey || '').replace(newRegex, '') });
                                      }}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={[styles.mcqOptionChipText, active && styles.mcqOptionChipTextActive]}>A-{letter}</Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>

                              <Input
                                label={`Marking Key${section.mcqQuestionCount ? ` (${section.mcqQuestionCount} answers)` : ''}`}
                                value={section.markingKey}
                                onChangeText={(txt) => handleSectionKeyChange(sIdx, txt)}
                                placeholder={`e.g., ${'ABCD'.slice(0, section.mcqOptions || 4).repeat(3).slice(0, 8)}...`}
                                autoCapitalize="characters"
                                autoCorrect={false}
                              />
                              {section.mcqQuestionCount ? (
                                <Text style={{ ...typography.caption, color: section.markingKey?.length === parseInt(section.mcqQuestionCount, 10) ? colors.success : colors.textSecondary, marginTop: -10 }}>
                                  {section.markingKey?.length || 0} / {section.mcqQuestionCount} answers entered
                                </Text>
                              ) : (
                                <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: -10 }}>
                                  Enter number of questions first, then type one letter (A-{secMaxLetter}) per question.
                                </Text>
                              )}

                              {section.markingKey?.length === parseInt(section.mcqQuestionCount, 10) && parseInt(section.mcqQuestionCount, 10) > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                                  <Text style={[typography.caption, { color: colors.success }]}>Marking key complete. Students will be scanned during grading.</Text>
                                </View>
                              )}
                            </>
                          ) : section.type ? (
                            <>
                              {/* ── Sub-types: optional extras in this section ── */}
                              <Text style={[typography.caption, { color: colors.text, fontWeight: '600', marginBottom: 8 }]}>
                                This section also includes: <Text style={{ color: colors.textSecondary, fontWeight: '400' }}>(optional)</Text>
                              </Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                                {SECTION_SUB_TYPES.map((sub) => {
                                  const active = !!section[sub.key];
                                  return (
                                    <TouchableOpacity
                                      key={sub.key}
                                      style={[styles.sectionTypeChip, active && styles.sectionTypeChipActive, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}
                                      onPress={() => updateSection(sIdx, { [sub.key]: !active })}
                                      activeOpacity={0.7}
                                    >
                                      <Ionicons name={active ? 'checkbox' : 'square-outline'} size={14} color={active ? '#fff' : colors.textSecondary} />
                                      <Ionicons name={sub.icon} size={13} color={active ? '#fff' : colors.textSecondary} />
                                      <Text style={[styles.sectionTypeChipText, active && styles.sectionTypeChipTextActive]}>{sub.label}</Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </ScrollView>

                              {/* ── Non-MCQ Section: Upload question paper + extract ── */}
                              <Text style={[typography.caption, { color: colors.text, fontWeight: '600', marginBottom: 6 }]}>
                                Upload Section {section.label} Question Paper
                              </Text>

                              {section.images.length > 0 && (
                                <View style={styles.thumbRow}>
                                  {section.images.map((uri, imgI) => (
                                    <View key={imgI} style={styles.thumbWrap}>
                                      <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                                      <TouchableOpacity style={styles.thumbRemove} onPress={() => removeSectionImage(sIdx, imgI)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                        <Ionicons name="close-circle" size={20} color={colors.error} />
                                      </TouchableOpacity>
                                      <Text style={styles.thumbLabel}>Page {imgI + 1}</Text>
                                    </View>
                                  ))}
                                </View>
                              )}

                              <View style={styles.uploadRow}>
                                <TouchableOpacity style={styles.uploadBtn} onPress={() => handleSectionTakePhoto(sIdx)} activeOpacity={0.7}>
                                  <Ionicons name="camera-outline" size={20} color={colors.secondary} />
                                  <Text style={[styles.uploadBtnText, { fontSize: 13 }]}>Camera</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.uploadBtn} onPress={() => handleSectionPickGallery(sIdx)} activeOpacity={0.7}>
                                  <Ionicons name="images-outline" size={20} color={colors.secondary} />
                                  <Text style={[styles.uploadBtnText, { fontSize: 13 }]}>Gallery</Text>
                                </TouchableOpacity>
                              </View>

                              {/* Extract button */}
                              {section.images.length > 0 && !section.extractionDone && (
                                <TouchableOpacity
                                  style={[styles.extractBtn, section.extracting && { opacity: 0.6 }]}
                                  onPress={() => handleSectionExtract(sIdx)}
                                  disabled={section.extracting}
                                  activeOpacity={0.7}
                                >
                                  {section.extracting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
                                  <Text style={styles.extractBtnText}>{section.extracting ? 'Reading...' : 'Extract Questions'}</Text>
                                </TouchableOpacity>
                              )}

                              {/* Extraction status */}
                              {section.extractionMsg ? (
                                <View style={[styles.extractStatus, {
                                  backgroundColor: sectionDone ? colors.success + '15' : section.extracting ? colors.info + '15' : colors.warning + '15',
                                }]}>
                                  <Ionicons
                                    name={sectionDone ? 'checkmark-circle' : section.extracting ? 'hourglass-outline' : 'alert-circle'}
                                    size={16}
                                    color={sectionDone ? colors.success : section.extracting ? colors.info : colors.warning}
                                  />
                                  <Text style={[styles.extractStatusText, {
                                    color: sectionDone ? colors.success : section.extracting ? colors.info : colors.warning,
                                  }]}>{section.extractionMsg}</Text>
                                </View>
                              ) : null}

                              {/* Extracted questions preview */}
                              {section.questions.length > 0 && (
                                <View style={{ marginBottom: 8 }}>
                                  {section.questions.slice(0, 8).map((q, qi) => (
                                    <View key={qi} style={styles.extractedQRow}>
                                      <View style={[styles.qTypeBadge, { backgroundColor: colors.secondary + '20' }]}>
                                        <Text style={[styles.qTypeBadgeText, { color: colors.secondary }]}>Q{q.number}</Text>
                                      </View>
                                      <Text style={styles.extractedQText} numberOfLines={1}>{q.text}</Text>
                                      {q.maxPoints > 0 && <Text style={styles.extractedQPts}>{q.maxPoints}pts</Text>}
                                    </View>
                                  ))}
                                  {section.questions.length > 8 && (
                                    <Text style={[typography.caption, { color: colors.textLight }]}>+ {section.questions.length - 8} more</Text>
                                  )}
                                </View>
                              )}

                              {/* Retry */}
                              {section.extractionDone && (
                                <TouchableOpacity style={styles.retryLink} onPress={() => updateSection(sIdx, { extractionDone: false, questions: [], extractionMsg: '' })}>
                                  <Ionicons name="refresh" size={14} color={colors.secondary} />
                                  <Text style={[typography.caption, { color: colors.secondary, marginLeft: 4 }]}>Re-extract</Text>
                                </TouchableOpacity>
                              )}

                              {/* Manual question entry — when no images uploaded */}
                              {section.images.length === 0 && !section.extractionDone && (
                                <View style={{ marginTop: 8 }}>
                                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 6 }]}>
                                    Or type questions manually:
                                  </Text>
                                  {section.manualQuestions.map((txt, qIdx) => (
                                    <View key={qIdx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                                      <View style={{ flex: 1 }}>
                                        <Input
                                          label={`Q${qIdx + 1}`}
                                          value={txt}
                                          onChangeText={(v) => handleSectionManualChange(sIdx, qIdx, v)}
                                          placeholder="Type the question..."
                                          multiline
                                        />
                                      </View>
                                      {section.manualQuestions.length > 1 && (
                                        <TouchableOpacity style={{ marginLeft: 4, marginTop: 24, padding: 4 }} onPress={() => removeSectionManualQuestion(sIdx, qIdx)}>
                                          <Ionicons name="trash-outline" size={16} color={colors.error} />
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  ))}
                                  <TouchableOpacity style={styles.addSectionBtn} onPress={() => addSectionManualQuestion(sIdx)} activeOpacity={0.7}>
                                    <Ionicons name="add-circle-outline" size={18} color={colors.secondary} />
                                    <Text style={[typography.caption, { color: colors.secondary, fontWeight: '600', marginLeft: 4 }]}>Add Question</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </>
                          ) : (
                            <Text style={[typography.caption, { color: colors.warning, fontStyle: 'italic' }]}>
                              Select a question type above first
                            </Text>
                          )}
                        </View>
                      )}
                    </Card>
                  );
                })}

                {/* Add section button */}
                {sections.length < 10 && (
                  <TouchableOpacity style={styles.addSectionBtn} onPress={addSection} activeOpacity={0.7}>
                    <Ionicons name="add-circle-outline" size={22} color={colors.secondary} />
                    <Text style={[typography.bodySmall, { color: colors.secondary, fontWeight: '600', marginLeft: 6 }]}>
                      Add Section {String.fromCharCode(65 + sections.length)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </AnimatedScreen>
        
        <AnimatedScreen delay={120}>
          <View style={styles.actions}>
            <Button
              title={questionType === 'multiple-choice'
                ? 'Continue'
                : sections.length > 0 ? `Continue (${sections.length} section${sections.length > 1 ? 's' : ''})` : 'Continue'}
              onPress={handleContinue}
              variant="primary"
              disabled={!questionType || (questionType === 'multiple-choice'
                ? (!directMcq.questionCount || !directMcq.markingKey || directMcq.markingKey.length !== parseInt(directMcq.questionCount, 10))
                : sections.length === 0)}
            />
          </View>
        </AnimatedScreen>
      </ScrollView>
      </KeyboardAvoidingView>
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
  content: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  options: {
    marginTop: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondaryLight + '10',
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionIcon: {
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: colors.secondary,
  },
  optionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actions: {
    marginTop: 20,
  },
  // ── Paper image thumbnails ──
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  thumbWrap: {
    position: 'relative',
    alignItems: 'center',
  },
  thumb: {
    width: 80,
    height: 110,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  thumbLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: 2,
    fontSize: 10,
  },
  // ── Upload buttons ──
  uploadRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.secondaryLight + '15',
    borderWidth: 1,
    borderColor: colors.secondary + '30',
  },
  uploadBtnText: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
  },
  // ── Extract button ──
  extractBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    marginBottom: 12,
  },
  extractBtnText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
  // ── Extraction status ──
  extractStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  extractStatusText: {
    ...typography.bodySmall,
    flex: 1,
    fontWeight: '600',
  },
  // ── Extracted results ──
  extractedCard: {
    marginBottom: 12,
    padding: 16,
  },
  extractedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  extractedRowText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  extractedQRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  qTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  qTypeBadgeText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 9,
  },
  extractedQText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  extractedQPts: {
    ...typography.caption,
    color: colors.textLight,
    fontWeight: '600',
  },
  retryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  // ── Section mapping ──
  sectionMapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionMapLabel: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
  },
  sectionMapLabelText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionMapPicker: {
    flex: 1,
  },
  sectionTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  sectionTypeChipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  sectionTypeChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 11,
  },
  sectionTypeChipTextActive: {
    color: '#fff',
  },
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 16,
  },
  qSectionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  // ── MCQ Options selector ──
  mcqOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  mcqOptionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  mcqOptionChipActive: {
    backgroundColor: colors.secondary + '15',
    borderColor: colors.secondary,
  },
  mcqOptionChipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  mcqOptionChipTextActive: {
    color: colors.secondary,
    fontWeight: '700',
  },
});
