import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import Input from './Input';
import Button from './Button';
import {
  displayLabel,
  effectiveMarks,
  updateNode,
  removeNode,
  moveNode,
  indentNode,
  outdentNode,
  addNode,
  findNode,
  suggestNextLabel,
  parseMarks,
} from '../utils/questionHierarchy';

const MAX_INDENT_DEPTH = 4;

function formatMarks(m) {
  return m === null || m === undefined ? '?' : String(m);
}

/**
 * Review and correct an extracted question hierarchy before it is used for grading.
 *
 * Props:
 *  - tree, counts, issues: from summarizeQuestionTree()
 *  - onChange(tree): called with the edited tree
 *  - onConfirm(): teacher confirms the hierarchy
 *  - confirmed: whether the current tree has been confirmed
 */
export default function QuestionReviewEditor({ tree, counts, issues = [], onChange, onConfirm, confirmed = false, instructions = [] }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [editingId, setEditingId] = useState(null);
  const [showInfo, setShowInfo] = useState(false);

  // Keep the editing panel valid if the node was removed (e.g. its parent was deleted).
  useEffect(() => {
    if (editingId && !findNode(tree, editingId)) setEditingId(null);
  }, [tree, editingId]);

  const warnings = issues.filter(i => i.level === 'error' || i.level === 'warning');
  const infos = issues.filter(i => i.level === 'info');
  const issuesFor = (id) => warnings.filter(i => i.nodeId === id);

  const apply = (next) => onChange(next);

  const handleDelete = (node) => {
    const doDelete = () => {
      if (editingId === node.id) setEditingId(null);
      apply(removeNode(tree, node.id));
    };
    if (node.children.length) {
      Alert.alert('Delete question?', `This also deletes its ${node.children.length} part(s).`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    } else doDelete();
  };

  const handleAddChild = (node, depth) => {
    const { tree: next, node: created } = addNode(tree, node.id, { label: suggestNextLabel(node.children, depth + 1), type: node.type });
    apply(next);
    setEditingId(created.id);
  };

  const handleAddTop = () => {
    const { tree: next, node: created } = addNode(tree, null, { label: suggestNextLabel(tree, 0), type: tree[0]?.type });
    apply(next);
    setEditingId(created.id);
  };

  const renderNode = (node, path, depth, index, siblings) => {
    const p = [...path, node.label || '?'];
    const isTop = depth === 0;
    const isLeaf = node.children.length === 0;
    const nodeIssues = issuesFor(node.id);
    const editing = editingId === node.id;
    const eff = effectiveMarks(node);
    const marksText = isLeaf
      ? `${formatMarks(node.marks)} mk${node.marks === 1 ? '' : 's'}`
      : node.marks !== null && eff !== null && eff !== node.marks
        ? `${node.marks} (parts ${eff})`
        : `${formatMarks(eff ?? node.marks)} marks`;
    const canIndent = index > 0 && depth < MAX_INDENT_DEPTH;
    const canOutdent = depth > 0;

    return (
      <View key={node.id} style={{ marginLeft: Math.min(depth, MAX_INDENT_DEPTH) * 14 }}>
        <TouchableOpacity
          style={[styles.row, isTop && styles.rowTop, editing && styles.rowEditing, nodeIssues.length > 0 && styles.rowWarn]}
          onPress={() => setEditingId(editing ? null : node.id)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${isTop ? 'Question' : 'Part'} ${displayLabel(p)}, ${marksText}. Tap to edit.`}
        >
          <View style={styles.rowHeader}>
            <Text style={[styles.label, isTop && styles.labelTop]}>
              {isTop ? `QUESTION ${node.label || '?'}` : displayLabel(p)}
            </Text>
            {node.page ? <Text style={styles.page}>p.{node.page}</Text> : null}
            <View style={{ flex: 1 }} />
            {nodeIssues.length > 0 && <Ionicons name="alert-circle" size={16} color={colors.warning} style={{ marginRight: 6 }} />}
            <Text style={[styles.marks, (isLeaf ? node.marks === null : eff === null) && { color: colors.warning }]}>{marksText}</Text>
            <Ionicons name={editing ? 'chevron-up' : 'create-outline'} size={16} color={colors.textLight} style={{ marginLeft: 8 }} />
          </View>
          {node.text ? (
            <Text style={styles.text} numberOfLines={editing ? undefined : 3}>{node.text}</Text>
          ) : isLeaf ? (
            <Text style={[styles.text, { color: colors.warning, fontStyle: 'italic' }]}>No text extracted</Text>
          ) : null}
          {nodeIssues.map((iss, k) => (
            <Text key={k} style={styles.nodeIssue}>• {iss.message}</Text>
          ))}
        </TouchableOpacity>

        {editing && (
          <View style={styles.editPanel}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Input
                style={{ flex: 1, marginBottom: 12 }}
                label={isTop ? 'Question number' : 'Part label'}
                value={node.label}
                onChangeText={(v) => apply(updateNode(tree, node.id, { label: v.trim(), numberUncertain: false }))}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={isTop ? 'e.g. 3' : 'e.g. A, a, i'}
              />
              <Input
                style={{ flex: 1, marginBottom: 12 }}
                label={isLeaf ? 'Marks' : 'Total marks'}
                value={node.marks === null || node.marks === undefined ? '' : String(node.marks)}
                onChangeText={(v) => apply(updateNode(tree, node.id, { marks: parseMarks(v.replace(/[^0-9]/g, '')) }))}
                keyboardType="number-pad"
                placeholder="?"
              />
            </View>
            <Input
              style={{ marginBottom: 12 }}
              label={isLeaf ? 'Question text' : 'Introductory text (optional)'}
              value={node.text}
              onChangeText={(v) => apply(updateNode(tree, node.id, { text: v, confidence: 'high' }))}
              multiline
              placeholder="Type the question exactly as printed"
            />
            <View style={styles.actionsRow}>
              <Action icon="arrow-up" label="Up" disabled={index === 0} onPress={() => apply(moveNode(tree, node.id, -1))} styles={styles} colors={colors} />
              <Action icon="arrow-down" label="Down" disabled={index === siblings.length - 1} onPress={() => apply(moveNode(tree, node.id, 1))} styles={styles} colors={colors} />
              <Action icon="return-up-back" label="Outdent" disabled={!canOutdent} onPress={() => apply(outdentNode(tree, node.id))} styles={styles} colors={colors} />
              <Action icon="return-down-forward" label="Indent" disabled={!canIndent} onPress={() => apply(indentNode(tree, node.id))} styles={styles} colors={colors} />
            </View>
            <View style={styles.actionsRow}>
              <Action icon="add-circle-outline" label="Add part" onPress={() => handleAddChild(node, depth)} styles={styles} colors={colors} />
              <Action icon="trash-outline" label="Delete" danger onPress={() => handleDelete(node)} styles={styles} colors={colors} />
              <Action icon="checkmark" label="Done" onPress={() => setEditingId(null)} styles={styles} colors={colors} />
            </View>
            <Text style={styles.hint}>Indent makes this a part of the item above it. Outdent moves it up one level.</Text>
          </View>
        )}

        {node.children.map((c, i) => renderNode(c, p, depth + 1, i, node.children))}
      </View>
    );
  };

  return (
    <View>
      <View style={styles.summary}>
        <Stat value={counts.topLevel} label={counts.topLevel === 1 ? 'question' : 'questions'} styles={styles} />
        <Stat value={counts.subquestions} label={counts.subquestions === 1 ? 'sub-part' : 'sub-parts'} styles={styles} />
        <Stat value={counts.assessable} label="gradable" styles={styles} />
        <Stat value={counts.totalMarks} label="marks" styles={styles} warn={!counts.marksComplete} />
      </View>
      {!counts.marksComplete && (
        <Text style={styles.summaryNote}>Some marks are missing, so the total may be incomplete.</Text>
      )}

      {instructions.length > 0 && (
        <View style={styles.instructions}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.instructionsText} numberOfLines={3}>{instructions.join(' · ')}</Text>
        </View>
      )}

      {warnings.filter(i => !i.nodeId).length > 0 && (
        <View style={styles.issueBox}>
          {warnings.filter(i => !i.nodeId).map((iss, k) => (
            <View key={k} style={styles.issueRow}>
              <Ionicons name={iss.level === 'error' ? 'close-circle' : 'alert-circle'} size={14} color={iss.level === 'error' ? colors.error : colors.warning} />
              <Text style={styles.issueText}>{iss.message}</Text>
            </View>
          ))}
        </View>
      )}
      {infos.length > 0 && (
        <TouchableOpacity onPress={() => setShowInfo(v => !v)} style={styles.infoToggle}>
          <Ionicons name={showInfo ? 'chevron-down' : 'chevron-forward'} size={14} color={colors.textSecondary} />
          <Text style={styles.infoToggleText}>{infos.length} note{infos.length > 1 ? 's' : ''}</Text>
        </TouchableOpacity>
      )}
      {showInfo && infos.map((iss, k) => (
        <Text key={k} style={styles.infoText}>• {iss.message}</Text>
      ))}

      <Text style={styles.tapHint}>Tap any question or part to correct it.</Text>
      {tree.map((n, i) => renderNode(n, [], 0, i, tree))}

      <TouchableOpacity style={styles.addTop} onPress={handleAddTop} activeOpacity={0.7}>
        <Ionicons name="add-circle-outline" size={18} color={colors.secondary} />
        <Text style={styles.addTopText}>Add question</Text>
      </TouchableOpacity>

      {confirmed ? (
        <View style={styles.confirmed}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={[typography.bodySmall, { color: colors.success, fontWeight: '600', marginLeft: 6 }]}>Questions confirmed for grading</Text>
        </View>
      ) : (
        <Button
          title={`Confirm ${counts.assessable} gradable item${counts.assessable === 1 ? '' : 's'}`}
          onPress={onConfirm}
          size="small"
          disabled={counts.assessable === 0}
          style={{ marginTop: 8 }}
        />
      )}
    </View>
  );
}

function Stat({ value, label, styles, warn }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, warn && styles.statWarn]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Action({ icon, label, onPress, disabled, danger, styles, colors }) {
  const color = disabled ? colors.textLight : danger ? colors.error : colors.secondary;
  return (
    <TouchableOpacity
      style={[styles.action, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  summary: {
    flexDirection: 'row',
    backgroundColor: colors.secondary + '10',
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.h4, color: colors.text },
  statWarn: { color: colors.warning },
  statLabel: { ...typography.caption, color: colors.textSecondary, fontSize: 11 },
  summaryNote: { ...typography.caption, color: colors.warning, marginBottom: 6 },
  instructions: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginBottom: 8 },
  instructionsText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  issueBox: {
    backgroundColor: colors.warning + '15',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 6,
  },
  issueRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  issueText: { ...typography.caption, color: colors.text, flex: 1 },
  infoToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  infoToggleText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  infoText: { ...typography.caption, color: colors.textSecondary, marginBottom: 4, marginLeft: 18 },
  tapHint: { ...typography.caption, color: colors.textLight, marginVertical: 6 },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    backgroundColor: colors.background,
  },
  rowTop: { backgroundColor: colors.surfaceLight, borderColor: colors.secondary + '40' },
  rowEditing: { borderColor: colors.secondary, borderWidth: 1.5 },
  rowWarn: { borderLeftWidth: 3, borderLeftColor: colors.warning },
  rowHeader: { flexDirection: 'row', alignItems: 'center' },
  label: { ...typography.bodySmall, fontWeight: '700', color: colors.secondary },
  labelTop: { color: colors.text, letterSpacing: 0.3 },
  page: { ...typography.caption, color: colors.textLight, marginLeft: 6, fontSize: 10 },
  marks: { ...typography.caption, fontWeight: '700', color: colors.textSecondary },
  text: { ...typography.bodySmall, color: colors.text, marginTop: 4 },
  nodeIssue: { ...typography.caption, color: colors.warning, marginTop: 4 },
  editPanel: {
    borderWidth: 1,
    borderColor: colors.secondary + '40',
    borderRadius: 10,
    padding: 10,
    marginTop: -2,
    marginBottom: 8,
    backgroundColor: colors.secondary + '08',
  },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  action: { flex: 1, alignItems: 'center', paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  actionText: { ...typography.caption, fontSize: 11, marginTop: 2, fontWeight: '600' },
  hint: { ...typography.caption, color: colors.textLight, fontSize: 11 },
  addTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  addTopText: { ...typography.bodySmall, color: colors.secondary, fontWeight: '600' },
  confirmed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
});
