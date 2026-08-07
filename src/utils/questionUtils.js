// Shared utilities for question handling across MCQ, Essay, and Mixed flows.

/**
 * Split a combined transcription into per-question segments.
 * Looks for question markers (Q1, 1., Question 1, 1.1, 1a, (a), etc.) in the text.
 * Falls back to even splitting if no markers found.
 */
export function splitTranscriptionByQuestions(fullText, questionCount) {
  if (questionCount <= 1) return [fullText.trim()];

  const lines = fullText.split('\n');
  const boundaries = [];

  // Patterns to detect question boundaries (ordered by specificity)
  const patterns = [
    // "Q1", "Question 1", "#1"
    /^(?:Q|Question|#)\s*(\d+)[\s.):]/i,
    // "1.", "1)", "1:"
    /^(\d+)[.):\s]\s*/,
    // "1.1", "1.2" — sub-numbered
    /^(\d+)\.\d+[.):\s]/,
    // "(a)", "(b)", "(1)", "(2)"
    /^\(([a-z]|\d+)\)/i,
    // "a)", "b)", "a."
    /^([a-z])[.)]\s/i,
  ];

  // First pass: try standard numbering (Q1, 1., etc.)
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim();
    if (!line) continue;
    const match = line.match(/^(?:Q|Question|#)?\s*(\d+)[.):\s]/i);
    if (match) {
      const qNum = parseInt(match[1], 10);
      if (qNum >= 1 && qNum <= questionCount && !boundaries.find(b => b.question === qNum)) {
        boundaries.push({ line: li, question: qNum });
      }
    }
  }

  // If standard numbering found enough boundaries, use them
  if (boundaries.length >= Math.max(2, Math.ceil(questionCount * 0.4))) {
    boundaries.sort((a, b) => a.question - b.question);
    return Array.from({ length: questionCount }, (_, q) => {
      const boundary = boundaries.find(b => b.question === q + 1);
      if (!boundary) return '';
      const startLine = boundary.line;
      const nextBoundary = boundaries.find(b => b.question > q + 1);
      const endLine = nextBoundary ? nextBoundary.line : lines.length;
      return lines
        .slice(startLine, endLine)
        .join('\n')
        .replace(/^(?:Q|Question|#)?\s*\d+[.):\s]\s*/i, '')
        .trim();
    });
  }

  // Second pass: try letter-based numbering (a), b), c) etc.
  const letterBoundaries = [];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim();
    if (!line) continue;
    const match = line.match(/^\(?([a-z])\)?\s*[.:]?\s*/i);
    if (match) {
      const letter = match[1].toLowerCase();
      const qNum = letter.charCodeAt(0) - 96; // a=1, b=2, etc.
      if (qNum >= 1 && qNum <= questionCount && !letterBoundaries.find(b => b.question === qNum)) {
        letterBoundaries.push({ line: li, question: qNum });
      }
    }
  }

  if (letterBoundaries.length >= Math.max(2, Math.ceil(questionCount * 0.4))) {
    letterBoundaries.sort((a, b) => a.question - b.question);
    return Array.from({ length: questionCount }, (_, q) => {
      const boundary = letterBoundaries.find(b => b.question === q + 1);
      if (!boundary) return '';
      const startLine = boundary.line;
      const nextBoundary = letterBoundaries.find(b => b.question > q + 1);
      const endLine = nextBoundary ? nextBoundary.line : lines.length;
      return lines
        .slice(startLine, endLine)
        .join('\n')
        .replace(/^\(?[a-z]\)?\s*[.:]?\s*/i, '')
        .trim();
    });
  }

  // Fallback: split evenly by lines
  const nonEmpty = lines.filter(l => l.trim());
  const linesPerQ = Math.max(1, Math.ceil(nonEmpty.length / questionCount));
  return Array.from({ length: questionCount }, (_, i) => {
    const start = i * linesPerQ;
    const end = i < questionCount - 1 ? start + linesPerQ : nonEmpty.length;
    return nonEmpty.slice(start, end).join('\n').trim();
  });
}

/**
 * Derive question counts and quick stats from structured section data.
 * Returns mcqCount, totalQuestions, and essayCount (non-MCQ).
 */
export function deriveQuestionStats(sectionData) {
  if (!Array.isArray(sectionData) || sectionData.length === 0) {
    return { mcqCount: 0, totalQuestions: 0, essayCount: 0 };
  }
  const allQuestions = sectionData.flatMap(s => Array.isArray(s.questions) ? s.questions : []);
  const totalQuestions = allQuestions.length;
  const mcqCount = sectionData
    .filter(s => s.type === 'mcq')
    .reduce((sum, s) => sum + (Array.isArray(s.questions) ? s.questions.length : 0), 0);
  const essayCount = Math.max(totalQuestions - mcqCount, 0);
  return { mcqCount, totalQuestions, essayCount };
}
