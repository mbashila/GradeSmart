// Run the app's question-paper extraction pipeline against real photos from the command line.
//
//   node --env-file=.env scripts/try-extraction.mjs page1.jpg [page2.jpg ...] [--section B --type essay]
//
// Uses the same prompt, parsing, hierarchy and validation code as the app
// (src/utils/paperExtraction.js). Requires EXPO_PUBLIC_OPENAI_API_KEY in the environment.

import { runPaperExtraction } from '../src/utils/paperExtraction.js';
import { makeCallVision } from './openaiVision.mjs';
import { displayLabel, effectiveMarks } from '../src/utils/questionHierarchy.js';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : ''; };
const sectionLabel = flag('section');
const sectionType = flag('type') || 'essay';
const files = args;

if (!files.length) { console.error('Usage: node --env-file=.env scripts/try-extraction.mjs <image...> [--section B] [--type essay]'); process.exit(1); }

const result = await runPaperExtraction({ pageCount: files.length, callVision: makeCallVision(files), sectionLabel, sectionType });

if (result.status === 'error') { console.error(`ERROR: ${result.error}`); process.exit(2); }
const print = (nodes, path = [], depth = 0) => nodes.forEach((n) => {
  const p = [...path, n.label || '?'];
  const m = effectiveMarks(n);
  const head = depth === 0 ? `QUESTION ${n.label || '?'} — ${m ?? '?'} MARKS` : `${'  '.repeat(depth)}- ${displayLabel(p)} — ${n.marks ?? '?'} marks`;
  console.log(`${head}${n.text ? `  | ${n.text.replace(/\s+/g, ' ').slice(0, 90)}` : ''}`);
  print(n.children, p, depth + 1);
});
print(result.tree);
console.log(`\nstatus=${result.status} top-level=${result.counts.topLevel} subquestions=${result.counts.subquestions} assessable=${result.counts.assessable} marks=${result.counts.totalMarks} marksComplete=${result.counts.marksComplete}`);
result.issues.forEach(i => console.log(`[${i.level}] ${i.message}`));
