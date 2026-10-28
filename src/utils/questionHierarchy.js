// Question-paper hierarchy model.
//
// Pure JavaScript (no React Native / Expo imports) so it can be unit-tested with
// `node --test`. Every extracted paper is represented as a tree of nodes:
//
//   { id, label, rawLabel, text, marks, type, page, confidence, numberUncertain, children: [] }
//
// - Top-level nodes are paper questions ("QUESTION THREE (3)" -> label "3").
// - Children are subquestions ("A.", "(a)", "(i)") and can nest arbitrarily.
// - Leaf nodes are the assessable items that get graded.
// - `marks` on a parent is the stated total; it is never added to its children's marks.

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
};

const ROMAN_RE = /^(?=[ivxlc]+$)c{0,3}(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;
const MARKS_WORD = '(?:marks?|mks?|mrks?|pts?|points?)';
const TRAILING_MARKS_RE = new RegExp(`[\\(\\[]\\s*(?:total\\s*[:\\-]?\\s*)?(\\d+(?:\\.\\d+)?)\\s*${MARKS_WORD}\\s*[\\)\\]]\\s*$`, 'i');
const TOTAL_ONLY_RE = new RegExp(`^[\\(\\[]?\\s*(?:total\\s*[:\\-]?\\s*)?(\\d+(?:\\.\\d+)?)\\s*${MARKS_WORD}\\s*[\\)\\]]?\\.?$`, 'i');
const MARKS_IN_LABEL_RE = new RegExp(`[\\(\\[]?\\s*(?:total\\s*[:\\-]?\\s*)?\\d+(?:\\.\\d+)?\\s*${MARKS_WORD}\\s*[\\)\\]]?`, 'gi');
const NOISE_RE = /^(?:page\s*\d+(?:\s*of\s*\d+)?|\d{1,3}|turn\s*over|p\.?\s*t\.?\s*o\.?|end\s+of\s+(?:paper|exam(?:ination)?|questions?)|-+\s*\d+\s*-+)\.?$/i;

let idCounter = 0;
export function newNodeId() {
  idCounter += 1;
  return `n${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function isRoman(s) {
  return !!s && ROMAN_RE.test(String(s));
}

/** Parse a marks value from a number or a string like "8", "(8 Marks)", "[TOTAL: 20 MARKS]". */
export function parseMarks(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  const m = String(value).match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Strip a trailing "(8 Marks)" style annotation from question text and return the marks it held. */
export function extractTrailingMarks(text) {
  const t = String(text || '').trim();
  const m = t.match(TRAILING_MARKS_RE);
  if (!m) return { text: t, marks: null };
  return { text: t.slice(0, m.index).trim(), marks: parseFloat(m[1]) };
}

/** True if the text is only a marks total such as "[TOTAL: 20 MARKS]". */
export function isTotalMarksOnly(text) {
  return TOTAL_ONLY_RE.test(String(text || '').trim());
}

/** True for page numbers, "Turn over", etc. — content that must never become a question. */
export function isNoiseText(text) {
  return NOISE_RE.test(String(text || '').trim());
}

/**
 * Normalize a top-level question number.
 * "QUESTION THREE (3)" -> "3", "Question 1" -> "1", "Q.4" -> "4", "QUESTION IV" -> "4", "2." -> "2".
 */
export function normalizeTopNumber(raw) {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : '';
  const s = String(raw).replace(MARKS_IN_LABEL_RE, '').trim();
  if (!s) return '';
  const paren = s.match(/\((\d+)\)/);
  if (paren) return String(parseInt(paren[1], 10));
  const digits = s.match(/\d+/);
  if (digits) return String(parseInt(digits[0], 10));
  const lower = s.toLowerCase();
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) return String(n);
  }
  const roman = lower.replace(/^(?:question|q)\.?\s*/, '').replace(/[^a-z]/g, '');
  if (roman && /^(?:question|q)/.test(lower) && isRoman(roman)) return String(romanToInt(roman));
  return s.replace(/^(?:question|q)\.?\s*/i, '').replace(/[.:)\]]+$/, '').trim();
}

function romanToInt(r) {
  const map = { i: 1, v: 5, x: 10, l: 50, c: 100 };
  const s = r.toLowerCase();
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]];
    const next = map[s[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

/**
 * Split a composite label into path segments.
 * "3A" -> ["3","A"], "2(a)(i)" -> ["2","a","i"], "1.2" -> ["1","2"], "Q3 (b)" -> ["3","b"], "(ii)" -> ["ii"].
 */
export function parseLabelPath(raw) {
  if (raw === null || raw === undefined) return [];
  if (typeof raw === 'number') return [String(raw)];
  let s = String(raw).replace(MARKS_IN_LABEL_RE, '').trim().replace(/^(?:question|part|qn|q)\.?\s*/i, '');
  const segs = [];
  const top = s.match(/^(\d+)/);
  if (top) {
    segs.push(String(parseInt(top[1], 10)));
    s = s.slice(top[0].length);
  }
  const tokenRe = /\(\s*([a-z]+|\d+)\s*\)|\.(\d+)|([a-z]+)\s*[.)]?/gi;
  let m;
  while ((m = tokenRe.exec(s)) !== null) {
    const tok = m[1] || m[2] || m[3];
    if (tok) segs.push(tok);
  }
  return segs;
}

/** Normalize a subquestion label relative to its parent path: "3A" under ["3"] -> "A", "(ii)" -> "ii", "b." -> "b". */
export function normalizeSubLabel(raw, parentPath = []) {
  if (raw === null || raw === undefined) return '';
  const segs = parseLabelPath(raw);
  if (segs.length === 0) return String(raw).trim().replace(/[().\]\s]/g, '');
  let i = 0;
  while (i < parentPath.length && i < segs.length - 1 && String(segs[i]).toLowerCase() === String(parentPath[i]).toLowerCase()) i++;
  return segs.slice(i).length === 1 ? segs[segs.length - 1] : segs.slice(i).join('');
}

/** Human-readable label for a node path: ["3","A"] -> "3A", ["2","a","i"] -> "2(a)(i)", ["1","2"] -> "1.2". */
export function displayLabel(path) {
  return path.map((seg, i) => {
    if (i === 0) return seg;
    if (/^\d+$/.test(seg)) return `.${seg}`;
    if (i === 1 && /^[A-Z]$/.test(seg)) return seg;
    return `(${seg})`;
  }).join('');
}

function normText(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '').trim();
}

function textsOverlap(a, b) {
  const x = normText(a);
  const y = normText(b);
  if (!x || !y) return true;
  return x === y || x.includes(y) || y.includes(x);
}

function mergeText(a, b) {
  const x = String(a || '').trim();
  const y = String(b || '').trim();
  if (!x) return y;
  if (!y) return x;
  const nx = normText(x);
  const ny = normText(y);
  if (nx.includes(ny)) return x;
  if (ny.includes(nx)) return y;
  return `${x} ${y}`;
}

// ── Normalization ────────────────────────────────────────────────────────────

function rawChildren(q) {
  const c = q?.subquestions ?? q?.children ?? q?.parts ?? [];
  return Array.isArray(c) ? c : [];
}

function normalizeNode(raw, parentPath, ctx) {
  if (!raw || typeof raw !== 'object') return null;
  const isTop = parentPath.length === 0;
  const rawLabel = String(raw.rawLabel ?? raw.label ?? raw.number ?? '').trim();
  let label = isTop ? normalizeTopNumber(raw.number ?? raw.label ?? raw.rawLabel) : normalizeSubLabel(raw.label ?? raw.number ?? raw.rawLabel, parentPath);
  const rawText = String(raw.text ?? raw.question ?? '').trim();
  if (!label && !rawChildren(raw).length) {
    if (isNoiseText(rawText)) { ctx.ignored.push(rawText); return null; }
    if (isTotalMarksOnly(rawText)) return { __totalOnly: parseMarks(rawText) };
  }

  let { text, marks: textMarks } = extractTrailingMarks(rawText);
  let marks = parseMarks(raw.marks ?? raw.totalMarks ?? raw.maxPoints ?? raw.points);
  if (marks === null) marks = textMarks;
  else if (textMarks !== null && textMarks !== marks) {
    ctx.issues.push({ level: 'warning', code: 'marks_conflict', message: `"${rawLabel || label}": marks field (${marks}) differs from marks printed in text (${textMarks}).` });
  }

  const path = [...parentPath, label || '?'];
  const children = [];
  for (const c of rawChildren(raw)) {
    const n = normalizeNode(c, path, ctx);
    if (!n) continue;
    if (n.__totalOnly !== undefined) { if (marks === null) marks = n.__totalOnly; continue; }
    children.push(n);
  }

  const page = Number.isFinite(Number(raw.page)) && Number(raw.page) > 0 ? Number(raw.page) : null;
  return {
    id: null,
    label,
    rawLabel: rawLabel || label,
    text: String(text || '').trim(),
    marks,
    type: raw.type || ctx.defaultType || 'short_notes',
    page,
    confidence: raw.confidence === 'low' || raw.uncertain === true ? 'low' : 'high',
    numberUncertain: raw.numberUncertain === true || raw.labelUncertain === true,
    continued: raw.continued === true || raw.continuesFromPreviousPage === true,
    options: Array.isArray(raw.options) && raw.options.length ? raw.options : undefined,
    children,
  };
}

/** Merge node `b` into node `a` (same label). Returns the merged node. */
function mergeNodes(a, b, ctx) {
  const merged = { ...a };
  merged.text = mergeText(a.text, b.text);
  if (a.marks === null) merged.marks = b.marks;
  else if (b.marks !== null && b.marks !== a.marks) {
    ctx.issues.push({ level: 'warning', code: 'marks_conflict', message: `Question ${a.rawLabel || a.label} was read twice with different marks (${a.marks} vs ${b.marks}). Kept ${a.marks}.` });
  }
  merged.page = a.page ?? b.page;
  merged.confidence = a.confidence === 'low' || b.confidence === 'low' ? 'low' : 'high';
  merged.numberUncertain = a.numberUncertain && b.numberUncertain;
  merged.children = dedupeSiblings([...a.children, ...b.children], ctx);
  return merged;
}

/**
 * Collapse siblings that share a label. Same label + overlapping text => duplicate (merged).
 * Same label + different text => both kept and flagged later as a duplicate label.
 */
function dedupeSiblings(nodes, ctx) {
  const out = [];
  for (const n of nodes) {
    const idx = n.label ? out.findIndex(o => o.label.toLowerCase() === n.label.toLowerCase() && (n.continued || textsOverlap(o.text, n.text))) : -1;
    if (idx >= 0) out[idx] = mergeNodes(out[idx], n, ctx);
    else out.push({ ...n, children: dedupeSiblings(n.children, ctx) });
  }
  return out;
}

/**
 * Attach top-level items whose label is really a composite path ("3A", "2(a)(i)") under the right
 * parent. This repairs flat output where the model ignored the nested schema.
 */
function nestCompositeTopLevel(items) {
  const tops = [];
  const findTop = (num) => tops.find(t => t.label === num);
  let lastTop = null;
  for (const item of items) {
    // A standalone "[TOTAL: 20 MARKS]" line belongs to the question it follows.
    if (item.__totalOnly !== undefined) {
      if (lastTop && lastTop.marks === null) lastTop.marks = item.__totalOnly;
      continue;
    }
    const segs = parseLabelPath(item.rawLabel);
    if (segs.length <= 1 || !/^\d+$/.test(segs[0])) { tops.push(item); lastTop = item; continue; }
    let parent = findTop(segs[0]);
    if (!parent) {
      parent = { id: null, label: segs[0], rawLabel: segs[0], text: '', marks: null, type: item.type, page: item.page, confidence: 'high', numberUncertain: false, continued: false, children: [] };
      tops.push(parent);
    }
    lastTop = parent;
    for (let d = 1; d < segs.length - 1; d++) {
      let next = parent.children.find(c => c.label.toLowerCase() === segs[d].toLowerCase());
      if (!next) {
        next = { ...parent, label: segs[d], rawLabel: segs[d], text: '', marks: null, children: [] };
        parent.children.push(next);
      }
      parent = next;
    }
    parent.children.push({ ...item, label: segs[segs.length - 1] });
  }
  return tops;
}

function assignIds(nodes, parentPath = [], used = new Set()) {
  return nodes.map((n) => {
    const path = [...parentPath, n.label || '?'];
    let base = `q${path.join('_').toLowerCase().replace(/[^a-z0-9_]/g, '')}`;
    let id = base;
    let k = 2;
    while (used.has(id)) id = `${base}_${k++}`;
    used.add(id);
    return { ...n, id: n.id || id, children: assignIds(n.children, path, used) };
  });
}

/**
 * Convert raw AI question output (hierarchical or flat) into a clean question tree.
 * @returns {{ tree: object[], issues: object[], ignored: string[] }}
 */
export function buildQuestionTree(rawQuestions, options = {}) {
  const ctx = { issues: [], ignored: [], defaultType: options.defaultType };
  const list = Array.isArray(rawQuestions) ? rawQuestions : [];
  const nodes = [];
  for (const raw of list) {
    const n = normalizeNode(raw, [], ctx);
    if (n) nodes.push(n);
  }
  let tree = nestCompositeTopLevel(nodes);
  tree = dedupeSiblings(tree, ctx);
  tree = assignIds(tree);
  return { tree, issues: ctx.issues, ignored: ctx.ignored };
}

/** Merge several partial trees (e.g. separate page batches) in order, joining continued questions. */
export function mergeQuestionTrees(trees) {
  const ctx = { issues: [] };
  const all = trees.flat().map(stripIds);
  const merged = assignIds(dedupeSiblings(all, ctx));
  return { tree: merged, issues: ctx.issues };
}

function stripIds(n) {
  return { ...n, id: null, children: n.children.map(stripIds) };
}

// ── Traversal, counts & validation ───────────────────────────────────────────

export function walk(tree, fn, parentPath = [], parent = null) {
  tree.forEach((n, index) => {
    const path = [...parentPath, n.label || '?'];
    fn(n, { path, parent, depth: parentPath.length, index, siblings: tree });
    walk(n.children || [], fn, path, n);
  });
}

/**
 * Marks represented by a node without double-counting:
 * - leaf: its own marks
 * - parent whose children all resolve to marks: sum of children (parent total is only a cross-check)
 * - otherwise: the parent's stated total (or null if unknown)
 */
export function effectiveMarks(node) {
  if (!node.children || node.children.length === 0) return node.marks ?? null;
  const childMarks = node.children.map(effectiveMarks);
  if (childMarks.every(m => m !== null)) return childMarks.reduce((a, b) => a + b, 0);
  return node.marks ?? null;
}

export function computeCounts(tree) {
  let subquestions = 0;
  let assessable = 0;
  let leavesWithMarks = 0;
  walk(tree, (n, { depth }) => {
    if (depth > 0) subquestions++;
    if (!n.children.length) {
      assessable++;
      if (n.marks !== null && n.marks !== undefined) leavesWithMarks++;
    }
  });
  const perTop = tree.map(effectiveMarks);
  const totalMarks = perTop.reduce((s, m) => s + (m || 0), 0);
  return {
    topLevel: tree.length,
    subquestions,
    assessable,
    totalMarks,
    marksComplete: assessable > 0 && leavesWithMarks === assessable && perTop.every(m => m !== null),
  };
}

function sequenceGaps(allLabels) {
  const labels = allLabels.filter(Boolean);
  const gaps = [];
  for (let i = 1; i < labels.length; i++) {
    const a = labelOrdinal(labels[i - 1]);
    const b = labelOrdinal(labels[i]);
    if (a === null || b === null || a.kind !== b.kind) continue;
    if (b.n < a.n) gaps.push({ type: 'order', from: labels[i - 1], to: labels[i] });
    else if (b.n - a.n > 1) gaps.push({ type: 'gap', from: labels[i - 1], to: labels[i] });
  }
  return gaps;
}

function labelOrdinal(label) {
  const s = String(label || '');
  if (/^\d+$/.test(s)) return { kind: 'num', n: parseInt(s, 10) };
  if (isRoman(s) && s.length > 1) return { kind: 'roman', n: romanToInt(s) };
  if (/^[a-z]$/i.test(s)) return { kind: s === s.toUpperCase() ? 'UP' : 'low', n: s.toLowerCase().charCodeAt(0) - 96 };
  return null;
}

/**
 * Validate a tree and return review issues. Issues never modify the tree.
 * Levels: 'warning' (needs teacher attention) | 'info' (worth knowing, possibly intentional).
 */
export function validateQuestionTree(tree, options = {}) {
  const { paperTotalMarks = null } = options;
  const issues = [];
  const add = (level, code, message, nodeId) => issues.push({ level, code, message, nodeId });

  walk(tree, (n, { path, depth }) => {
    const name = depth === 0 ? `Question ${n.label || '?'}` : displayLabel(path);
    const isLeaf = !n.children.length;
    if (!n.label) add('warning', 'missing_label', `${name}: number/label could not be read.`, n.id);
    if (n.numberUncertain) add('warning', 'number_uncertain', `${name}: the number/label was hard to read — please confirm.`, n.id);
    if (n.confidence === 'low' || /\[(?:illegible|unclear|\?)[^\]]*\]/i.test(n.text)) {
      add('warning', 'low_confidence', `${name}: some text was hard to read — check it against the paper.`, n.id);
    }
    if (isLeaf && !n.text) add('warning', 'empty_text', `${name}: no question text was extracted.`, n.id);
    if (isLeaf && (n.marks === null || n.marks === undefined)) {
      add('warning', 'missing_marks', `${name}: marks not found.`, n.id);
    }
    if (!isLeaf) {
      const childMarks = n.children.map(effectiveMarks);
      const known = childMarks.filter(m => m !== null);
      if (n.marks !== null && known.length === childMarks.length) {
        const sum = known.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - n.marks) > 1e-9) {
          add('warning', 'marks_mismatch', `${name}: stated total is ${n.marks} but its parts add up to ${sum}.`, n.id);
        }
      } else if (n.marks !== null && known.length === 0) {
        add('warning', 'children_marks_missing', `${name} has ${n.marks} marks but its parts have no marks. Check whether these parts are separate questions or part of the question text.`, n.id);
      }
      const dupes = n.children.map(c => c.label.toLowerCase()).filter((l, i, arr) => l && arr.indexOf(l) !== i);
      [...new Set(dupes)].forEach(l => add('warning', 'duplicate_label', `${name}: more than one part is labelled "${l}".`, n.id));
      sequenceGaps(n.children.map(c => c.label)).forEach(g => add('info', g.type === 'gap' ? 'label_gap' : 'label_order',
        g.type === 'gap' ? `${name}: parts jump from ${g.from} to ${g.to}.` : `${name}: part ${g.to} appears after ${g.from}.`, n.id));
    }
  });

  const topDupes = tree.map(t => t.label).filter((l, i, arr) => l && arr.indexOf(l) !== i);
  [...new Set(topDupes)].forEach(l => add('warning', 'duplicate_label', `Question ${l} appears more than once.`));
  sequenceGaps(tree.map(t => t.label)).forEach(g => add('info', g.type === 'gap' ? 'number_gap' : 'number_order',
    g.type === 'gap'
      ? `Question numbers jump from ${g.from} to ${g.to}. This may be intentional.`
      : `Question ${g.to} appears after Question ${g.from} — pages may be out of order.`));

  const counts = computeCounts(tree);
  if (paperTotalMarks !== null && counts.marksComplete && Math.abs(counts.totalMarks - paperTotalMarks) > 1e-9) {
    add('info', 'paper_total_mismatch', `Paper states ${paperTotalMarks} marks but the extracted questions add up to ${counts.totalMarks}. This is expected if students choose a subset of questions.`);
  }
  return issues;
}

// ── Flattening for grading ───────────────────────────────────────────────────

/**
 * Flatten the tree to the list of assessable (leaf) items consumed by the grading flow.
 * `number` is the printed label ("3A", "2(a)(i)") and `text` includes ancestor stems for context.
 */
export function flattenAssessable(tree, options = {}) {
  const { section = '', sectionType = '' } = options;
  const out = [];
  const visit = (nodes, path, stems, topId) => {
    for (const n of nodes) {
      const p = [...path, n.label || '?'];
      const nextStems = n.text ? [...stems, n.text] : stems;
      if (n.children.length) { visit(n.children, p, nextStems, topId || n.id); continue; }
      const contextText = stems.join('\n');
      const type = n.type || sectionType || 'short_notes';
      // Graders recognise the "PASSAGE: ... QUESTION: ..." convention for comprehension items.
      const text = !contextText ? n.text
        : type === 'comprehension' ? `PASSAGE: ${contextText}\n\nQUESTION: ${n.text}`
          : `${contextText}\n\n${n.text}`;
      out.push({
        id: n.id,
        number: displayLabel(p),
        label: n.label,
        rawLabel: n.rawLabel,
        topLevelId: topId || n.id,
        topLevelNumber: p[0],
        text,
        ownText: n.text,
        type,
        section,
        maxPoints: n.marks ?? 0,
        marksMissing: n.marks === null || n.marks === undefined,
        page: n.page,
        options: n.options,
      });
    }
  };
  visit(tree, [], [], null);
  return out;
}

// ── Immutable editing helpers for the review UI ──────────────────────────────

function mapTree(tree, fn) {
  return tree.map(n => fn({ ...n, children: mapTree(n.children, fn) }));
}

export function findNode(tree, id) {
  let found = null;
  walk(tree, (n, info) => { if (!found && n.id === id) found = { node: n, ...info }; });
  return found;
}

export function updateNode(tree, id, patch) {
  return mapTree(tree, n => (n.id === id ? { ...n, ...patch } : n));
}

function removeFrom(nodes, id) {
  let removed = null;
  const next = [];
  for (const n of nodes) {
    if (n.id === id) { removed = n; continue; }
    const r = removeFrom(n.children, id);
    if (r.removed) removed = r.removed;
    next.push(r.removed ? { ...n, children: r.nodes } : n);
  }
  return { nodes: next, removed };
}

export function removeNode(tree, id) {
  return removeFrom(tree, id).nodes;
}

function withSiblings(tree, id, fn) {
  const idx = tree.findIndex(n => n.id === id);
  if (idx >= 0) return fn(tree, idx);
  return tree.map(n => ({ ...n, children: withSiblings(n.children, id, fn) }));
}

/** Move a node up (-1) or down (+1) among its siblings. */
export function moveNode(tree, id, dir) {
  return withSiblings(tree, id, (siblings, idx) => {
    const j = idx + dir;
    if (j < 0 || j >= siblings.length) return siblings;
    const next = [...siblings];
    [next[idx], next[j]] = [next[j], next[idx]];
    return next;
  });
}

/** Make a node the last child of its previous sibling. */
export function indentNode(tree, id) {
  return withSiblings(tree, id, (siblings, idx) => {
    if (idx === 0) return siblings;
    const next = [...siblings];
    const [node] = next.splice(idx, 1);
    next[idx - 1] = { ...next[idx - 1], children: [...next[idx - 1].children, node] };
    return next;
  });
}

/** Move a node out of its parent so it becomes the parent's next sibling. */
export function outdentNode(tree, id) {
  const info = findNode(tree, id);
  if (!info || !info.parent) return tree;
  const parentId = info.parent.id;
  const node = info.node;
  const without = removeNode(tree, id);
  return withSiblings(without, parentId, (siblings, idx) => {
    const next = [...siblings];
    next.splice(idx + 1, 0, node);
    return next;
  });
}

export function createNode(fields = {}) {
  return { id: newNodeId(), label: '', rawLabel: '', text: '', marks: null, type: 'short_notes', page: null, confidence: 'high', numberUncertain: false, continued: false, children: [], ...fields };
}

/** Add a new child under `parentId`, or a new top-level question when parentId is null. */
export function addNode(tree, parentId, fields = {}) {
  const node = createNode(fields);
  if (!parentId) return { tree: [...tree, node], node };
  return { tree: updateTreeChildren(tree, parentId, c => [...c, node]), node };
}

function updateTreeChildren(tree, id, fn) {
  return mapTree(tree, n => (n.id === id ? { ...n, children: fn(n.children) } : n));
}

/** Suggest the next label for a new child, following its siblings' style (A,B / a,b / i,ii / 1,2). */
export function suggestNextLabel(siblings, depth) {
  const last = siblings[siblings.length - 1]?.label;
  const o = labelOrdinal(last);
  if (!o) return depth === 0 ? String(siblings.length + 1) : depth === 1 ? 'a' : 'i';
  if (o.kind === 'num') return String(o.n + 1);
  if (o.kind === 'UP') return String.fromCharCode(65 + o.n);
  if (o.kind === 'low') return last === 'i' && depth >= 2 ? 'ii' : String.fromCharCode(97 + o.n);
  if (o.kind === 'roman') return intToRoman(o.n + 1);
  return '';
}

function intToRoman(n) {
  const table = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let s = '';
  for (const [v, r] of table) while (n >= v) { s += r; n -= v; }
  return s;
}
