// Run Stage 1 (question paper) + Stage 2 (answer booklet) extraction on real photos.
//
//   node --env-file=.env scripts/try-answer-extraction.mjs --paper paper.jpg [--paper paper2.jpg] booklet1.jpg [booklet2.jpg ...]
//
// Uses the same prompts, parsing and matching code as the app. Requires EXPO_PUBLIC_OPENAI_API_KEY.

import { runPaperExtraction } from '../src/utils/paperExtraction.js';
import { runAnswerExtraction } from '../src/utils/answerExtraction.js';
import { makeCallVision } from './openaiVision.mjs';

const args = process.argv.slice(2);
const paper = [];
for (let i = args.indexOf('--paper'); i >= 0; i = args.indexOf('--paper')) paper.push(args.splice(i, 2)[1]);
const booklet = args;
if (!paper.length || !booklet.length) {
  console.error('Usage: node --env-file=.env scripts/try-answer-extraction.mjs --paper paper.jpg booklet1.jpg [booklet2.jpg ...]');
  process.exit(1);
}

const p = await runPaperExtraction({ pageCount: paper.length, callVision: makeCallVision(paper), sectionType: 'essay' });
if (p.status === 'error') { console.error(`Question paper failed: ${p.error}`); process.exit(2); }
console.log(`Questions: ${p.questions.map(q => `${q.number}(${q.maxPoints})`).join(', ')}\n`);

const a = await runAnswerExtraction({ pageCount: booklet.length, questions: p.questions, callVision: makeCallVision(booklet) });
if (a.status === 'error') { console.error(`Answer extraction failed: ${a.error}`); process.exit(3); }

const num = (id) => p.questions.find(q => q.id === id)?.number ?? '—';
for (const r of a.records) {
  console.log(`[${r.id}] written=${JSON.stringify(r.rawLabel)} -> Q${num(r.questionId)} status=${r.matchStatus}${r.duplicateConflict ? ' DUPLICATE' : ''}${r.excluded ? ' (excluded)' : ''} pages=${r.pages.join(',')} readability=${r.readability} label=${r.labelConfidence} handwriting=${r.handwritingConfidence} boundary=${r.boundaryConfidence}`);
  console.log(`    ${r.text.replace(/\s+/g, ' ').slice(0, 160)}`);
  r.matchReasons.forEach(m => console.log(`    · ${m}`));
}
console.log(`\nstatus=${a.status} complete=${a.completeness.complete}${a.completeness.reasons.length ? ` (${a.completeness.reasons.join(' ')})` : ''}`);
for (const [id, s] of Object.entries(a.questionStatuses)) console.log(`  Q${num(id)}: ${s.message}`);
a.issues.forEach(i => console.log(`[${i.level}] ${i.message}`));
