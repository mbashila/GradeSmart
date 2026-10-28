import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import Button from './Button';
import {
  computeTotals, validateResult, resultStatus, setItemMarks, confirmItemMark, setItemMaxMarks,
  setFeedbackStatus, setMarkingGuide, acknowledgeIssue, finalizeResult, reopenResult, GRADING_STATUS,
} from '../utils/gradingModel';
import { CRITERIA_SOURCE_LABEL } from '../utils/rubricGrading';
import { buildQuestionIndex, reassignAnswer, editAnswerText } from '../utils/answerMatching';

const STATUS_TEXT = {
  not_started: 'Not graded',
  processing: 'Grading…',
  graded: 'AI graded',
  manual: 'Teacher marked',
  needs_review: 'Needs review',
  failed: 'Grading failed',
  blank: 'No response',
  unresolved: 'Needs attention',
};
const RESULT_TEXT = {
  not_started: 'Not started', processing: 'Processing', graded: 'Graded — ready to finalize',
  needs_review: 'Provisional — needs review', failed: 'Grading failed', finalized: 'Finalized',
};
const EXTRACTION_TEXT = { readable: 'Readable', partial: 'Partly unreadable', unreadable: 'Unreadable', none: 'No answer found', failed: 'Pages could not be read' };
const MATCH_TEXT = { matched: 'Matched by label', confirmed: 'Confirmed by teacher', uncertain: 'Not confirmed', unmatched: 'Unmatched', none: '—' };

function statusColor(colors, s) {
  if (s === 'graded' || s === 'manual' || s === 'finalized') return colors.success;
  if (s === 'failed' || s === 'unresolved') return colors.error;
  if (s === 'blank' || s === 'not_started') return colors.textSecondary;
  return colors.warning;
}
const fmt = (n) => (n === null || n === undefined ? '—' : String(Math.round(n * 10) / 10));

function ItemDetail({ item, result, section, onChange, onRegrade, onAnswerChange, busy, reviewerId, colors, styles }) {
  const [marks, setMarks] = useState(item.awarded === null ? '' : String(item.awarded));
  const [reason, setReason] = useState('');
  const [maxDraft, setMaxDraft] = useState(item.maxMarks === null ? '' : String(item.maxMarks));
  const [guide, setGuide] = useState(item.markingGuide || '');
  const [editingText, setEditingText] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [moving, setMoving] = useState(null);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const locked = result.finalized;
  const records = (section.answers || []).filter(r => item.answerIds.includes(r.id) || (r.questionId === item.questionId && !r.excluded));
  const qIndex = buildQuestionIndex(section.questions);

  const run = (fn) => {
    setError('');
    try { onChange(fn()); } catch (e) { setError(e.message); }
  };

  return (
    <View style={styles.detail}>
      {item.parentContext ? <Text style={styles.context}>Context: {item.parentContext}</Text> : null}
      <Text style={styles.label}>Question</Text>
      <Text style={styles.body}>{item.questionText}</Text>
      {item.commandVerb ? <Text style={styles.meta}>Task word: {item.commandVerb}{item.requestedPoints ? ` · ${item.requestedPoints} points requested` : ''}</Text> : null}

      <Text style={styles.label}>Student's answer (extracted)</Text>
      <Text style={styles.meta}>Text: {EXTRACTION_TEXT[item.extractionStatus] || item.extractionStatus} · Match: {MATCH_TEXT[item.matchStatus] || item.matchStatus}{item.pages?.length ? ` · page ${item.pages.join(', ')}` : ''}</Text>
      {editingText ? (
        <View>
          <TextInput style={styles.input} multiline value={textDraft} onChangeText={setTextDraft} accessibilityLabel="Edit extracted answer" />
          <View style={styles.row}>
            <Button title="Cancel" size="small" variant="outline" onPress={() => setEditingText(false)} style={{ flex: 1 }} />
            <Button title="Save & regrade" size="small" onPress={() => { setEditingText(false); onAnswerChange(section.key, editAnswerText(section.answers, records[0].id, textDraft)); }} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Text style={[styles.body, styles.answer]} selectable>{item.answerText || '(no answer text)'}</Text>
      )}

      {!locked && records.length > 0 && !editingText && (
        <View style={styles.row}>
          {records.length === 1 && (
            <TouchableOpacity style={styles.link} onPress={() => { setTextDraft(records[0].text); setEditingText(true); }}>
              <Ionicons name="create-outline" size={14} color={colors.secondary} /><Text style={styles.linkText}>Edit text</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.link} onPress={() => setMoving(moving ? null : records[0].id)}>
            <Ionicons name="swap-horizontal" size={14} color={colors.secondary} /><Text style={styles.linkText}>Wrong question?</Text>
          </TouchableOpacity>
        </View>
      )}
      {moving && (
        <View style={styles.picker}>
          <Text style={styles.meta}>Move this answer to:</Text>
          <View style={styles.wrap}>
            {qIndex.filter(q => q.id !== item.questionId).map(q => (
              <TouchableOpacity key={q.id} style={styles.chip} onPress={() => { setMoving(null); onAnswerChange(section.key, reassignAnswer(section.answers, moving, q.id, q.number)); }}>
                <Text style={styles.chipText}>{q.number}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.meta}>Only the two affected questions are regraded.</Text>
        </View>
      )}

      <View style={styles.marksBox}>
        <Text style={styles.marksBig}>{fmt(item.awarded)} / {fmt(item.maxMarks)}</Text>
        <Text style={[styles.meta, { color: statusColor(colors, item.gradingStatus) }]}>{STATUS_TEXT[item.gradingStatus]}{item.confidence ? ` · AI confidence in mark: ${item.confidence}` : ''}</Text>
        {item.proposedAwarded !== null && item.awarded === null ? <Text style={styles.warn}>AI proposed {item.proposedAwarded} (not applied)</Text> : null}
      </View>

      {item.flags.map((f, i) => <Text key={i} style={f.level === 'error' ? styles.err : styles.warn}>• {f.message}</Text>)}
      {item.failureReason ? <Text style={styles.err}>• {item.failureReason}</Text> : null}

      {item.rationale ? (
        <View style={styles.feedback}>
          <Text style={styles.label}>Why this mark{item.feedbackStatus === 'rejected' ? ' (rejected by teacher)' : item.feedbackStatus === 'accepted' ? ' (accepted)' : ''}</Text>
          <Text style={[styles.body, item.feedbackStatus === 'rejected' && { textDecorationLine: 'line-through', color: colors.textLight }]}>{item.rationale}</Text>
          {item.strengths.length > 0 && <Text style={styles.body}><Text style={styles.bold}>Strengths: </Text>{item.strengths.join('; ')}</Text>}
          {item.missing.length > 0 && <Text style={styles.body}><Text style={styles.bold}>Missing or incorrect: </Text>{item.missing.join('; ')}</Text>}
          {item.improvement ? <Text style={styles.body}><Text style={styles.bold}>To improve: </Text>{item.improvement}</Text> : null}
          {item.criteria.length > 0 && (
            <>
              <Text style={styles.label}>{CRITERIA_SOURCE_LABEL[item.criteriaSource] || 'Criteria'}</Text>
              {item.criteria.map((c, i) => <Text key={i} style={styles.meta}>• {c.point} ({c.marks})</Text>)}
            </>
          )}
          {!locked && (
            <View style={styles.row}>
              <Button title="Accept feedback" size="small" variant="outline" onPress={() => run(() => setFeedbackStatus(result, item.id, 'accepted', reviewerId))} style={{ flex: 1 }} />
              <Button title="Reject" size="small" variant="outline" onPress={() => run(() => setFeedbackStatus(result, item.id, 'rejected', reviewerId))} style={{ flex: 1 }} />
            </View>
          )}
        </View>
      ) : null}

      {!locked && (
        <View style={styles.moderate}>
          {(item.maxMarks === null || item.maxAssumed) && (
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.small]} value={maxDraft} onChangeText={setMaxDraft} keyboardType="decimal-pad" placeholder="Max" accessibilityLabel="Maximum marks" />
              <Button title={item.maxAssumed ? 'Confirm max marks' : 'Set max marks'} size="small" onPress={() => run(() => setItemMaxMarks(result, item.id, maxDraft, reason || 'Set by teacher', reviewerId))} style={{ flex: 1 }} />
            </View>
          )}
          {item.maxMarks !== null && (
            <>
              <Text style={styles.label}>Adjust mark</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.small]} value={marks} onChangeText={setMarks} keyboardType="decimal-pad" placeholder={`0–${item.maxMarks}`} accessibilityLabel="Marks awarded" />
                <TextInput style={[styles.input, { flex: 1 }]} value={reason} onChangeText={setReason} placeholder="Reason for change" accessibilityLabel="Reason for change" />
              </View>
              <Button title="Save mark" size="small" onPress={() => run(() => setItemMarks(result, item.id, marks === '' ? NaN : marks, reason, reviewerId))} style={{ marginTop: 6 }} />
            </>
          )}
          {item.gradingStatus === GRADING_STATUS.NEEDS_REVIEW && item.awarded !== null && (
            <Button title={`Accept AI mark (${fmt(item.awarded)})`} size="small" variant="outline" onPress={() => run(() => confirmItemMark(result, item.id, reviewerId))} style={{ marginTop: 6 }} />
          )}
          {item.gradingStatus !== GRADING_STATUS.MANUAL && item.maxMarks !== null && ['answered', 'answered_partial'].includes(item.sourceStatus) && (
            <>
              <Text style={styles.label}>Marking guide (optional)</Text>
              <TextInput style={styles.input} multiline value={guide} onChangeText={setGuide} placeholder="Paste the official marking points for this question" accessibilityLabel="Marking guide" />
              <Button
                title={busy ? 'Grading…' : item.gradingStatus === GRADING_STATUS.FAILED ? 'Retry grading' : 'Regrade this question'}
                size="small"
                variant="outline"
                disabled={busy}
                onPress={() => { const next = setMarkingGuide(result, item.id, guide, reviewerId); onChange(next); onRegrade([item.id], next); }}
                style={{ marginTop: 6 }}
              />
            </>
          )}
          {error ? <Text style={styles.err}>{error}</Text> : null}
        </View>
      )}

      {item.history.length > 0 && (
        <TouchableOpacity onPress={() => setShowHistory(v => !v)} style={styles.link}>
          <Ionicons name={showHistory ? 'chevron-down' : 'time-outline'} size={14} color={colors.secondary} />
          <Text style={styles.linkText}>History ({item.history.length})</Text>
        </TouchableOpacity>
      )}
      {showHistory && item.history.map((h, i) => (
        <Text key={i} style={styles.meta}>{new Date(h.at).toLocaleString()} · {h.by} · {h.action.replace(/_/g, ' ')}{h.from !== undefined || h.to !== undefined ? ` ${fmt(h.from)} → ${fmt(h.to)}` : ''}{h.reason ? ` — ${h.reason}` : ''}</Text>
      ))}
    </View>
  );
}

/**
 * Hierarchical, editable grading results.
 * Props: result, onChange(result), onRegrade(ids, base?), onAnswerChange(sectionKey, records), busyIds, reviewerId
 */
export default function GradingResultsView({ result, onChange, onRegrade, onAnswerChange, busyIds = [], reviewerId = 'teacher' }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(null);
  const [ackKey, setAckKey] = useState(null);
  const [ackReason, setAckReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [error, setError] = useState('');

  const totals = computeTotals(result);
  const validation = validateResult(result);
  const status = resultStatus(result);
  const sColor = statusColor(colors, status === 'graded' ? 'graded' : status);

  const tryChange = (fn) => {
    setError('');
    try { onChange(fn()); } catch (e) { setError(e.message); }
  };

  return (
    <View>
      <View style={styles.summary}>
        <View style={[styles.badge, { backgroundColor: sColor + '20' }]}>
          <Text style={[styles.badgeText, { color: sColor }]}>{RESULT_TEXT[status]}</Text>
        </View>
        <Text style={styles.total}>
          {fmt(totals.awarded)}{totals.available !== null ? ` / ${fmt(totals.available)}` : ''}
          {totals.percentage !== null ? <Text style={styles.pct}>  {totals.percentage}%</Text> : null}
        </Text>
        {totals.available === null && <Text style={styles.warn}>Percentage not shown: some maximum marks are missing.</Text>}
        <Text style={styles.meta}>{totals.scored} of {totals.assessable} item{totals.assessable === 1 ? '' : 's'} graded · {totals.needsReview} need{totals.needsReview === 1 ? 's' : ''} review</Text>
        {totals.provisional && !result.finalized && <Text style={styles.meta}>This result is provisional until finalized.</Text>}
      </View>

      {!result.finalized && validation.blocking.length > 0 && (
        <View style={styles.issues}>
          <Text style={styles.label}>Before finalizing ({validation.blocking.length})</Text>
          {validation.blocking.map((b, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <Text style={styles.body}>• {b.message}</Text>
              {b.fix ? <Text style={styles.meta}>  How to fix: {b.fix}</Text> : null}
              {b.itemId ? (
                <TouchableOpacity onPress={() => setOpen(b.itemId)}><Text style={styles.linkText}>  Open item</Text></TouchableOpacity>
              ) : null}
              {b.key ? (ackKey === b.key ? (
                <View style={styles.row}>
                  <TextInput style={[styles.input, { flex: 1 }]} value={ackReason} onChangeText={setAckReason} placeholder="Reason (recorded)" />
                  <Button title="Acknowledge" size="small" onPress={() => { tryChange(() => acknowledgeIssue(result, b.key, ackReason, reviewerId)); setAckKey(null); setAckReason(''); }} />
                </View>
              ) : (
                <TouchableOpacity onPress={() => setAckKey(b.key)}><Text style={styles.linkText}>  Acknowledge…</Text></TouchableOpacity>
              )) : null}
            </View>
          ))}
        </View>
      )}

      {result.sections.map((sec) => {
        const groups = totals.groups.filter(g => g.sectionKey === sec.key);
        const orphans = (sec.answers || []).filter(r => !r.questionId && !r.excluded);
        const qIndex = buildQuestionIndex(sec.questions);
        return (
          <View key={sec.key}>
            {sec.label ? <Text style={styles.sectionTitle}>Section {sec.label}</Text> : null}
            {groups.map(g => (
              <View key={g.topLevelId} style={[styles.group, !g.counted && { opacity: 0.6 }]}>
                <Text style={styles.groupTitle}>
                  {g.itemIds.length > 1 || g.declared !== null ? `QUESTION ${g.number}` : `Question ${g.number}`} — {fmt(g.awarded)}/{fmt(g.available)}
                  {!g.counted ? '  (not counted)' : ''}
                </Text>
                {g.itemIds.map((id) => {
                  const it = result.items.find(i => i.id === id);
                  const busy = busyIds.includes(id) || it.gradingStatus === GRADING_STATUS.PROCESSING;
                  const c = statusColor(colors, it.gradingStatus);
                  return (
                    <View key={id}>
                      <TouchableOpacity style={styles.itemRow} onPress={() => setOpen(open === id ? null : id)} accessibilityRole="button" accessibilityLabel={`${it.number}, ${fmt(it.awarded)} of ${fmt(it.maxMarks)}, ${STATUS_TEXT[it.gradingStatus]}`}>
                        <Text style={styles.itemNum}>{it.number}</Text>
                        <Text style={styles.itemMarks}>{fmt(it.awarded)}/{fmt(it.maxMarks)}</Text>
                        <View style={{ flex: 1 }} />
                        {busy ? <ActivityIndicator size="small" color={colors.secondary} /> : (
                          <View style={[styles.badge, { backgroundColor: c + '20' }]}><Text style={[styles.badgeText, { color: c }]}>{STATUS_TEXT[it.gradingStatus]}</Text></View>
                        )}
                        <Ionicons name={open === id ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textLight} style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                      {open === id && (
                        <ItemDetail key={`${id}:${it.history.length}:${it.gradingStatus}`} item={it} result={result} section={sec} onChange={onChange} onRegrade={onRegrade} onAnswerChange={onAnswerChange}
                          busy={busy} reviewerId={reviewerId} colors={colors} styles={styles} />
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
            {orphans.length > 0 && (
              <View style={styles.group}>
                <Text style={styles.groupTitle}>Unassigned answers ({orphans.length})</Text>
                {orphans.map(r => (
                  <View key={r.id} style={{ marginTop: 6 }}>
                    <Text style={styles.body} numberOfLines={4}>{r.rawLabel ? `"${r.rawLabel}": ` : ''}{r.text || '(no readable text)'}</Text>
                    {!result.finalized && (
                      <View style={styles.wrap}>
                        {qIndex.map(q => (
                          <TouchableOpacity key={q.id} style={styles.chip} onPress={() => onAnswerChange(sec.key, reassignAnswer(sec.answers, r.id, q.id, q.number))}>
                            <Text style={styles.chipText}>{q.number}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {error ? <Text style={styles.err}>{error}</Text> : null}
      {result.finalized ? (
        <View style={styles.issues}>
          <Text style={styles.body}>Finalized{result.finalizedAt ? ` on ${new Date(result.finalizedAt).toLocaleString()}` : ''}.</Text>
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} value={reopenReason} onChangeText={setReopenReason} placeholder="Reason for reopening" />
            <Button title="Reopen" size="small" variant="outline" onPress={() => { tryChange(() => reopenResult(result, reopenReason, reviewerId)); setReopenReason(''); }} />
          </View>
        </View>
      ) : (
        <Button
          title={validation.ok ? 'Finalize result' : `Finalize (${validation.blocking.length} issue${validation.blocking.length === 1 ? '' : 's'} left)`}
          disabled={!validation.ok || busyIds.length > 0}
          onPress={() => tryChange(() => finalizeResult(result, reviewerId))}
          style={{ marginTop: 12 }}
        />
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  summary: { backgroundColor: colors.surfaceLight, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  badge: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { ...typography.caption, fontSize: 11, fontWeight: '700' },
  total: { ...typography.h2, color: colors.text, marginTop: 6 },
  pct: { ...typography.h4, color: colors.textSecondary },
  issues: { backgroundColor: colors.warning + '12', borderRadius: 10, padding: 10, marginBottom: 12 },
  sectionTitle: { ...typography.h4, color: colors.text, marginVertical: 8 },
  group: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, marginBottom: 10 },
  groupTitle: { ...typography.bodySmall, fontWeight: '800', color: colors.text },
  itemRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 6 },
  itemNum: { ...typography.bodySmall, fontWeight: '700', color: colors.secondary, minWidth: 64 },
  itemMarks: { ...typography.bodySmall, fontWeight: '700', color: colors.text },
  detail: { backgroundColor: colors.secondary + '08', borderRadius: 8, padding: 10, marginTop: 4 },
  context: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 4 },
  label: { ...typography.caption, fontWeight: '700', color: colors.text, marginTop: 8 },
  body: { ...typography.bodySmall, color: colors.text, marginTop: 2 },
  bold: { fontWeight: '700' },
  answer: { backgroundColor: colors.background, borderRadius: 6, padding: 8, marginTop: 4 },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  warn: { ...typography.caption, color: colors.warning, marginTop: 4 },
  err: { ...typography.caption, color: colors.error, marginTop: 4 },
  marksBox: { marginTop: 10 },
  marksBig: { ...typography.h3, color: colors.text },
  feedback: { marginTop: 6 },
  moderate: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 6 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
  input: { ...typography.bodySmall, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minHeight: 44, backgroundColor: colors.background, marginTop: 4 },
  small: { width: 80 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, marginRight: 12 },
  linkText: { ...typography.caption, color: colors.secondary, fontWeight: '600' },
  picker: { marginTop: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { minWidth: 48, minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  chipText: { ...typography.bodySmall, fontWeight: '700', color: colors.text },
});
