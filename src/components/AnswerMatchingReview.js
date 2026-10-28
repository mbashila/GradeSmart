import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ActivityIndicator, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import Button from './Button';
import {
  buildQuestionIndex,
  confirmMatch,
  reassignAnswer,
  editAnswerText,
  markUnreadable,
  flagForReview,
  setExcluded,
  chooseAnswerVersion,
  combineAnswerVersions,
  reviewSummary,
} from '../utils/answerMatching';

const MATCH_LABEL = {
  matched: 'Matched by label',
  confirmed: 'Confirmed',
  suggested: 'Suggested',
  needs_review: 'Needs review',
  unmatched: 'Unmatched',
};

function statusColor(colors, status) {
  switch (status) {
    case 'answered': case 'confirmed': case 'matched': return colors.success;
    case 'unreadable': case 'extraction_failed': return colors.error;
    case 'no_answer_detected': return colors.textSecondary;
    default: return colors.warning;
  }
}

function pagesText(pages) {
  if (!pages?.length) return '';
  return pages.length === 1 ? `p.${pages[0]}` : `p.${pages[0]}–${pages[pages.length - 1]}`;
}

/** Page image with the answer's approximate regions highlighted. */
function PageRegion({ uri, regions, colors }) {
  const [ratio, setRatio] = useState(0.7);
  useEffect(() => {
    if (!uri) return;
    Image.getSize(uri, (w, h) => { if (w && h) setRatio(w / h); }, () => {});
  }, [uri]);
  if (!uri) return null;
  return (
    <View style={{ width: '100%', aspectRatio: ratio, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface, marginTop: 6 }}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="stretch" />
      {regions.map((r, i) => (
        <View key={i} pointerEvents="none" style={{
          position: 'absolute', left: 0, right: 0, top: `${r.top * 100}%`, height: `${(r.bottom - r.top) * 100}%`,
          backgroundColor: colors.secondary + '30', borderTopWidth: 2, borderBottomWidth: 2, borderColor: colors.secondary,
        }} />
      ))}
    </View>
  );
}

function AnswerCard({ record, questions, images, onChange, records, colors, styles }) {
  const [expanded, setExpanded] = useState(false);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(record.text);
  const [showPage, setShowPage] = useState(false);
  const qIndex = buildQuestionIndex(questions);
  const current = qIndex.find(q => q.id === record.questionId);
  const statusKey = record.duplicateConflict ? 'needs_review' : record.matchStatus;
  const color = record.excluded ? colors.textLight : statusColor(colors, statusKey);
  const firstPageNo = record.pages[0];
  const pageRegions = record.regions.filter(r => r.page === firstPageNo);

  const apply = (next) => onChange(next);

  return (
    <View style={[styles.answer, { borderLeftColor: color }, record.excluded && { opacity: 0.65 }]}>
      <View style={styles.answerHead}>
        <Text style={styles.answerLabel}>{record.rawLabel ? `Written: "${record.rawLabel}"` : 'No label written'}</Text>
        <Text style={styles.pageText}>{pagesText(record.pages)}{record.mergedFrom ? ' · continued' : ''}</Text>
        <View style={{ flex: 1 }} />
        <View style={[styles.chip, { backgroundColor: color + '20' }]}>
          <Text style={[styles.chipText, { color }]}>
            {record.excluded ? (record.crossedOut ? 'Crossed out — not graded' : 'Not graded') : record.duplicateConflict ? 'Duplicate' : MATCH_LABEL[record.matchStatus]}
          </Text>
        </View>
      </View>

      <Text style={styles.assoc}>
        {current ? `→ Question ${current.number}` : '→ No question selected'}
        {record.readability !== 'readable' ? `  ·  ${record.readability === 'partial' ? 'partly unreadable' : 'unreadable'}` : ''}
        {record.flaggedForReview ? '  ·  flagged for manual review' : ''}
      </Text>

      <View style={styles.confRow}>
        {record.handwritingConfidence && <Text style={styles.conf}>Handwriting: {record.handwritingConfidence}</Text>}
        {record.labelConfidence && <Text style={styles.conf}>Label: {record.labelConfidence}</Text>}
        {record.boundaryConfidence && <Text style={styles.conf}>Boundary: {record.boundaryConfidence}</Text>}
        {record.matchConfidence && <Text style={styles.conf}>Match: {record.matchConfidence}</Text>}
      </View>

      {(record.matchReasons || []).filter(r => !/^Labelled ".*" → Question/.test(r) || record.matchStatus !== 'matched').map((m, i) => (
        <Text key={i} style={styles.reason}>• {m}</Text>
      ))}
      {record.duplicateConflict && <Text style={[styles.reason, { color: colors.warning }]}>• This question was answered more than once. Choose a version or combine them.</Text>}

      {editing ? (
        <View>
          <TextInput
            style={styles.textInput}
            value={draft}
            onChangeText={setDraft}
            multiline
            accessibilityLabel="Edit extracted answer text"
          />
          <View style={styles.actions}>
            <Act icon="close" label="Cancel" onPress={() => { setDraft(record.text); setEditing(false); }} styles={styles} colors={colors} />
            <Act icon="checkmark" label="Save text" onPress={() => { apply(editAnswerText(records, record.id, draft)); setEditing(false); }} styles={styles} colors={colors} />
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setExpanded(v => !v)} activeOpacity={0.7}>
          <Text style={styles.answerText} numberOfLines={expanded ? undefined : 6} selectable>
            {record.text || '(no readable text)'}
          </Text>
          {record.hasDiagram ? <Text style={styles.reason}>Diagram: {record.diagramDescription || 'present'}</Text> : null}
          {!expanded && record.text.length > 300 && <Text style={styles.more}>Show all</Text>}
        </TouchableOpacity>
      )}

      {firstPageNo && images[firstPageNo - 1] ? (
        <TouchableOpacity onPress={() => setShowPage(v => !v)} style={styles.pageToggle}>
          <Ionicons name={showPage ? 'chevron-down' : 'image-outline'} size={14} color={colors.secondary} />
          <Text style={styles.pageToggleText}>{showPage ? 'Hide page' : `Show on page ${firstPageNo}`}</Text>
        </TouchableOpacity>
      ) : null}
      {showPage && <PageRegion uri={images[firstPageNo - 1]} regions={pageRegions} colors={colors} />}

      {picking && (
        <View style={styles.picker}>
          <Text style={styles.pickerTitle}>Assign to question</Text>
          <View style={styles.pickerWrap}>
            {qIndex.map(q => (
              <TouchableOpacity
                key={q.id}
                style={[styles.pickChip, q.id === record.questionId && styles.pickChipActive, record.candidateQuestionIds?.includes(q.id) && styles.pickChipCandidate]}
                onPress={() => { apply(reassignAnswer(records, record.id, q.id, q.number)); setPicking(false); }}
                accessibilityLabel={`Assign to question ${q.number}`}
              >
                <Text style={[styles.pickChipText, q.id === record.questionId && { color: '#fff' }]}>{q.number}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.pickChip} onPress={() => { apply(reassignAnswer(records, record.id, null)); setPicking(false); }}>
              <Text style={styles.pickChipText}>None</Text>
            </TouchableOpacity>
          </View>
          {record.candidateQuestionIds?.length > 0 && <Text style={styles.hint}>Outlined: likely candidates.</Text>}
        </View>
      )}

      {!editing && (
        <>
          <View style={styles.actions}>
            <Act icon="checkmark-circle-outline" label="Confirm" disabled={!record.questionId || (record.matchStatus === 'confirmed' && !record.flaggedForReview && !record.duplicateConflict)} onPress={() => apply(confirmMatch(records, record.id))} styles={styles} colors={colors} />
            <Act icon="swap-horizontal" label="Change Q" onPress={() => setPicking(v => !v)} styles={styles} colors={colors} />
            <Act icon="create-outline" label="Edit text" onPress={() => { setDraft(record.text); setEditing(true); }} styles={styles} colors={colors} />
          </View>
          <View style={styles.actions}>
            <Act icon="eye-off-outline" label={record.readability === 'unreadable' ? 'Readable' : 'Unreadable'} onPress={() => apply(markUnreadable(records, record.id, record.readability !== 'unreadable'))} styles={styles} colors={colors} />
            <Act icon="flag-outline" label={record.flaggedForReview ? 'Unflag' : 'Flag'} onPress={() => apply(flagForReview(records, record.id, !record.flaggedForReview))} styles={styles} colors={colors} />
            {record.excluded
              ? <Act icon="add-circle-outline" label="Include" onPress={() => apply(setExcluded(records, record.id, false))} styles={styles} colors={colors} />
              : record.duplicateConflict
                ? <Act icon="ribbon-outline" label="Grade this" onPress={() => apply(chooseAnswerVersion(records, record.id))} styles={styles} colors={colors} />
                : <Act icon="remove-circle-outline" label="Don't grade" onPress={() => apply(setExcluded(records, record.id, true))} styles={styles} colors={colors} />}
          </View>
          {record.duplicateConflict && (
            <TouchableOpacity onPress={() => apply(combineAnswerVersions(records, record.questionId))} style={styles.pageToggle}>
              <Ionicons name="git-merge-outline" size={14} color={colors.secondary} />
              <Text style={styles.pageToggleText}>Combine all versions into one answer</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

function Act({ icon, label, onPress, disabled, styles, colors }) {
  const color = disabled ? colors.textLight : colors.secondary;
  return (
    <TouchableOpacity style={[styles.act, disabled && { opacity: 0.45 }]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.actText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Review proposed answer → question matches before grading.
 * Props: sections (useEssayGradingPipeline().answerReview.sections), onRecordsChange(key, records),
 * onSetComplete(key, bool), onRetrySection(key), onContinue(), onScoreManually(), onRescanAll()
 */
export default function AnswerMatchingReview({ sections, onRecordsChange, onSetComplete, onRetrySection, onContinue, onScoreManually, onRescanAll }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [openQ, setOpenQ] = useState({});

  const totals = sections.reduce((acc, s) => {
    const r = reviewSummary(s.records || []);
    return { total: acc.total + r.total, needsReview: acc.needsReview + r.needsReview };
  }, { total: 0, needsReview: 0 });
  const anyLoading = sections.some(s => s.status === 'loading');

  const handleContinue = () => {
    if (totals.needsReview > 0) {
      Alert.alert(
        'Some answers still need review',
        `${totals.needsReview} answer${totals.needsReview === 1 ? '' : 's'} are unconfirmed. They won't be graded automatically; their questions will be flagged for a manual score.`,
        [{ text: 'Keep reviewing', style: 'cancel' }, { text: 'Grade anyway', onPress: onContinue }],
      );
    } else onContinue();
  };

  return (
    <View>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>{totals.total} answer{totals.total === 1 ? '' : 's'} found</Text>
        <Text style={[styles.summaryText, { color: totals.needsReview ? colors.warning : colors.success }]}>
          {totals.needsReview ? `${totals.needsReview} need review` : 'All matches clear'}
        </Text>
      </View>

      {sections.map((sec) => {
        const qIndex = buildQuestionIndex(sec.questions);
        const records = sec.records || [];
        const complete = sec.completeOverride ?? !!sec.completeness?.complete;
        const orphans = records.filter(r => !r.questionId || !qIndex.some(q => q.id === r.questionId));
        return (
          <View key={sec.key} style={styles.section}>
            {sec.label ? <Text style={styles.sectionTitle}>Section {sec.label}</Text> : null}

            {sec.status === 'loading' && (
              <View style={[styles.box, { backgroundColor: colors.info + '15', flexDirection: 'row', gap: 8 }]}>
                <ActivityIndicator size="small" color={colors.info} />
                <Text style={[styles.boxText, { color: colors.info }]}>Reading answers again...</Text>
              </View>
            )}
            {sec.status === 'error' && (
              <View style={[styles.box, { backgroundColor: colors.error + '12' }]}>
                <Text style={[styles.boxText, { color: colors.error }]}>Couldn't read this section's answers. {sec.error}</Text>
                <Text style={styles.hint}>The photos are kept. Questions here are marked "extraction failed", not zero.</Text>
                <Button title="Retry this section" size="small" onPress={() => onRetrySection(sec.key)} style={{ marginTop: 8 }} />
              </View>
            )}
            {(sec.issues || []).filter(i => i.level !== 'info').map((iss, i) => (
              <View key={i} style={styles.issueRow}>
                <Ionicons name={iss.level === 'error' ? 'close-circle' : 'alert-circle'} size={14} color={iss.level === 'error' ? colors.error : colors.warning} />
                <Text style={styles.issueText}>{iss.message}</Text>
              </View>
            ))}
            {sec.status === 'partial' && (
              <TouchableOpacity onPress={() => onRetrySection(sec.key)} style={styles.pageToggle}>
                <Ionicons name="refresh" size={14} color={colors.secondary} />
                <Text style={styles.pageToggleText}>Retry reading this section (replaces your corrections here)</Text>
              </TouchableOpacity>
            )}

            {sec.status !== 'error' && sec.status !== 'loading' && (
              <View style={[styles.box, { backgroundColor: complete ? colors.success + '10' : colors.warning + '12' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.boxText, { flex: 1 }]}>
                    {complete ? 'All booklet pages appear to be here.' : 'The booklet may be incomplete.'}
                  </Text>
                  <Switch value={complete} onValueChange={(v) => onSetComplete(sec.key, v)} accessibilityLabel="Booklet is complete" />
                </View>
                {!complete && (sec.completeness?.reasons || []).map((r, i) => <Text key={i} style={styles.hint}>• {r}</Text>)}
                <Text style={styles.hint}>
                  {complete ? 'Questions with no answer will show "No response detected".' : 'Questions with no answer will show "not found" instead of "unanswered".'}
                </Text>
              </View>
            )}

            {qIndex.map((q) => {
              const st = sec.questionStatuses?.[q.id] || { status: 'not_found_incomplete', message: '' };
              const mine = records.filter(r => r.questionId === q.id);
              const color = statusColor(colors, st.status);
              const open = openQ[`${sec.key}:${q.id}`];
              return (
                <View key={q.id} style={styles.qCard}>
                  <TouchableOpacity onPress={() => setOpenQ(o => ({ ...o, [`${sec.key}:${q.id}`]: !open }))} activeOpacity={0.7}>
                    <View style={styles.qHead}>
                      <Text style={styles.qTitle}>QUESTION {q.number}{q.maxPoints ? ` — ${q.maxPoints} MARKS` : ''}</Text>
                    </View>
                    <Text style={styles.qText} numberOfLines={open ? undefined : 2}>{q.text}</Text>
                    <View style={[styles.statusRow, { backgroundColor: color + '15' }]}>
                      <Text style={[styles.statusText, { color }]}>{st.message}</Text>
                    </View>
                  </TouchableOpacity>
                  {mine.map(r => (
                    <AnswerCard key={r.id} record={r} records={records} questions={sec.questions} images={sec.images} colors={colors} styles={styles}
                      onChange={(next) => onRecordsChange(sec.key, next)} />
                  ))}
                </View>
              );
            })}

            {orphans.length > 0 && (
              <View style={styles.qCard}>
                <Text style={styles.qTitle}>UNMATCHED ANSWERS ({orphans.length})</Text>
                <Text style={styles.hint}>These answers are kept. Use "Change Q" to assign each to a question.</Text>
                {orphans.map(r => (
                  <AnswerCard key={r.id} record={r} records={records} questions={sec.questions} images={sec.images} colors={colors} styles={styles}
                    onChange={(next) => onRecordsChange(sec.key, next)} />
                ))}
              </View>
            )}
          </View>
        );
      })}

      <View style={{ gap: 10, marginTop: 16 }}>
        <Button title="Continue to Grading" onPress={handleContinue} variant="primary" disabled={anyLoading} />
        <Button title="Score Manually" onPress={onScoreManually} variant="outline" />
        <TouchableOpacity style={styles.pageToggle} onPress={onRescanAll}>
          <Ionicons name="refresh" size={14} color={colors.secondary} />
          <Text style={styles.pageToggleText}>Read all pages again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  summary: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.secondary + '10', borderRadius: 12, padding: 12, marginBottom: 12 },
  summaryText: { ...typography.bodySmall, fontWeight: '700', color: colors.text },
  section: { marginBottom: 16 },
  sectionTitle: { ...typography.h4, color: colors.text, marginBottom: 8 },
  box: { borderRadius: 10, padding: 10, marginBottom: 10 },
  boxText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  issueRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginBottom: 6 },
  issueText: { ...typography.caption, color: colors.text, flex: 1 },
  qCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: colors.surfaceLight },
  qHead: { flexDirection: 'row', alignItems: 'center' },
  qTitle: { ...typography.bodySmall, fontWeight: '800', color: colors.text, letterSpacing: 0.3 },
  qText: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },
  statusRow: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginTop: 8, alignSelf: 'flex-start' },
  statusText: { ...typography.caption, fontWeight: '700' },
  answer: { borderLeftWidth: 3, backgroundColor: colors.background, borderRadius: 8, padding: 10, marginTop: 10 },
  answerHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  answerLabel: { ...typography.caption, fontWeight: '700', color: colors.text },
  pageText: { ...typography.caption, color: colors.textLight },
  chip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { ...typography.caption, fontSize: 11, fontWeight: '700' },
  assoc: { ...typography.caption, color: colors.text, fontWeight: '600', marginTop: 4 },
  confRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  conf: { ...typography.caption, fontSize: 11, color: colors.textSecondary },
  reason: { ...typography.caption, color: colors.textSecondary, marginTop: 3 },
  answerText: { ...typography.bodySmall, color: colors.text, marginTop: 8 },
  more: { ...typography.caption, color: colors.secondary, marginTop: 2 },
  textInput: { ...typography.bodySmall, color: colors.text, borderWidth: 1.5, borderColor: colors.secondary, borderRadius: 8, padding: 10, minHeight: 120, textAlignVertical: 'top', marginTop: 8 },
  pageToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingVertical: 4 },
  pageToggleText: { ...typography.caption, color: colors.secondary, fontWeight: '600' },
  picker: { marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: colors.secondary + '08' },
  pickerTitle: { ...typography.caption, fontWeight: '700', color: colors.text, marginBottom: 6 },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pickChip: { minWidth: 48, minHeight: 40, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  pickChipActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  pickChipCandidate: { borderColor: colors.warning, borderWidth: 2 },
  pickChipText: { ...typography.bodySmall, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  act: { flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  actText: { ...typography.caption, fontSize: 11, fontWeight: '600', marginTop: 2 },
});
