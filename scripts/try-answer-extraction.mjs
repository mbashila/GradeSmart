// Run Stage 1 (question paper) + Stage 2 (answer booklet) extraction on real photos.
//
//   node --env-file=.env scripts/try-answer-extraction.mjs --paper paper.jpg [--paper paper2.jpg] booklet1.jpg [booklet2.jpg ...]
//
// Uses the same prompts, parsing and matching code as the app. Requires EXPO_PUBLIC_OPENAI_API_KEY.

import { runPaperExtraction } from '../src/utils/paperExtraction.js';
import { runAnswerExtraction } from '../src/utils/answerExtraction.js';
import { makeCallVision } from './openaiVision.mjs';
import { createGradingResult, computeTotals, resultStatus, validateResult } from '../src/utils/gradingModel.js';
import { gradeResultItems } from '../src/utils/rubricGrading.js';

const args = process.argv.slice(2);
const gradeFlag = args.indexOf('--grade');
const doGrade = gradeFlag >= 0;
if (doGrade) args.splice(gradeFlag, 1);
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

if (doGrade) {
  // Stage 3: grade matched answers per item with question-specific rubrics (unconfirmed matches are NOT graded).
  const result = createGradingResult({ sections: [{ key: 's0', label: '', type: 'essay', questions: p.questions, questionTree: p.tree, instructions: p.instructions, records: a.records, complete: a.completeness.complete }] });
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  const callText = async (prompt) => {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(90000),
        body: JSON.stringify({ model: 'gpt-4o', temperature: 0, max_tokens: 4096, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) return { response: '', error: `API error ${res.status}` };
      const data = await res.json();
      return { response: data.choices?.[0]?.message?.content || '', truncated: data.choices?.[0]?.finish_reason === 'length' };
    } catch (e) {
      return { response: '', error: `AI error: ${e.message}` };
    }
  };
  const g = await gradeResultItems(result, { callText });
  const t = computeTotals(g.result);
  console.log('\n=== GRADING (live AI output) ===');
  for (const grp of t.groups) {
    console.log(`QUESTION ${grp.number} — ${grp.awarded}/${grp.available}${grp.counted ? '' : ' (not counted)'}`);
    for (const id of grp.itemIds) {
      const it = g.result.items.find(i => i.id === id);
      console.log(`  - ${it.number} — ${it.awarded ?? '—'}/${it.maxMarks} [${it.gradingStatus}${it.confidence ? `, confidence ${it.confidence}` : ''}]`);
      if (it.rationale) console.log(`      ${it.rationale}`);
      it.flags.forEach(f => console.log(`      ! ${f.message}`));
    }
  }
  console.log(`\nTotal ${t.awarded}/${t.available ?? '?'}${t.percentage !== null ? ` (${t.percentage}%)` : ''} — status=${resultStatus(g.result)}`);
  validateResult(g.result).blocking.forEach(b => console.log(`[blocking] ${b.message}`));
}
