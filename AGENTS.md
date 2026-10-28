# GradeSmart — agent notes

## Verification
- Unit tests (pure JS, no Expo needed): `npm test` (runs `node --test "tests/**/*.test.mjs"`).
- Bundle check: `npx expo export --platform android --output-dir <tmp dir>`.
- Live question-paper extraction against real photos (uses OpenAI, costs money):
  `node --env-file=.env scripts/try-extraction.mjs page1.jpg [page2.jpg ...] --section B --type essay`

## Question extraction architecture
- `src/utils/questionHierarchy.js` — question tree model (labels, marks, counts, validation, flattening, edit ops). Pure JS.
- `src/utils/paperExtraction.js` — prompt, tolerant JSON parsing, page batching, retry, partial results. Vision call is injected.
- `src/utils/openaiService.js#extractQuestionsFromPaperImage` — wires the pipeline to OpenAI.
- `src/components/QuestionReviewEditor.js` — review/correction UI used in `QuestionTypeScreen`.
- Pure modules import siblings with explicit `.js` extensions so Node can load them in tests.
- Grading consumes `section.questions` = flat list of leaf (assessable) items; `number` is a label like "3A", not an index.

## Answer booklet architecture (Stage 2)
- `src/utils/answerExtraction.js` — handwriting transcription prompt (no grading), batching, retry, partial results.
- `src/utils/answerMatching.js` — answer records, label normalization, matching to Stage 1 questions, continuation merge,
  duplicates, per-question statuses, review edit ops, `MATCH_THRESHOLDS`. Pure JS.
- `src/hooks/useEssayGradingPipeline.js` — extract -> review (`AnswerMatchingReview`) -> grade only matched/confirmed answers.
- Live check: `node --env-file=.env scripts/try-answer-extraction.mjs --paper paper.jpg booklet1.jpg [booklet2.jpg]`
