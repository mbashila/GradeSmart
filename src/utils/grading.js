/**
 * Grading utilities for GradeSmart.
 *
 * MCQ grading: compare student answers (A-D) against the marking key.
 * Essay grading: teacher assigns points per question manually.
 * Mixed grading: MCQ portion auto-graded + essay portion manually scored.
 */

/**
 * Grade MCQ answers against a marking key.
 * @param {string} markingKey - e.g. "ABCDAB"
 * @param {string[]} studentAnswers - e.g. ["A","B","C","D","A","C"]
 * @param {number} pointsPerQuestion - points awarded per correct answer
 * @returns {{ results: Array, score: number, total: number, percentage: string }}
 */
export function gradeMCQ(markingKey, studentAnswers, pointsPerQuestion = 1) {
  const key = (markingKey || '').toUpperCase().split('');
  const results = key.map((correct, i) => {
    const student = (studentAnswers[i] || '').toUpperCase() || '-';
    const isCorrect = student === correct;
    return {
      question: i + 1,
      correct,
      student,
      status: isCorrect ? 'correct' : 'incorrect',
      points: isCorrect ? pointsPerQuestion : 0,
    };
  });
  const score = results.reduce((sum, r) => sum + r.points, 0);
  const total = key.length * pointsPerQuestion;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  return { results, score, total, percentage: `${pct}%` };
}

/**
 * Grade essay answers (teacher-assigned scores).
 * @param {Array<{question: number, points: number, maxPoints: number}>} scores
 * @returns {{ results: Array, score: number, total: number, percentage: string }}
 */
export function gradeEssay(scores) {
  const results = scores.map((s) => ({
    question: s.question,
    points: s.points,
    maxPoints: s.maxPoints,
    status: s.points >= s.maxPoints ? 'correct' : s.points > 0 ? 'partial' : 'incorrect',
  }));
  const score = results.reduce((sum, r) => sum + r.points, 0);
  const total = results.reduce((sum, r) => sum + r.maxPoints, 0);
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  return { results, score, total, percentage: `${pct}%` };
}

/**
 * Grade a mixed test (MCQ + essay).
 * @param {string} markingKey
 * @param {string[]} mcqAnswers
 * @param {number} mcqPointsEach
 * @param {Array<{question: number, points: number, maxPoints: number}>} essayScores
 * @returns {{ mcqResults: Array, essayResults: Array, results: Array, score: number, total: number, percentage: string }}
 */
export function gradeMixed(markingKey, mcqAnswers, mcqPointsEach, essayScores) {
  const mcq = gradeMCQ(markingKey, mcqAnswers, mcqPointsEach);
  const essay = gradeEssay(essayScores);
  const score = mcq.score + essay.score;
  const total = mcq.total + essay.total;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  return {
    mcqResults: mcq.results,
    essayResults: essay.results,
    results: [...mcq.results, ...essay.results.map(r => ({ ...r, correct: `${r.maxPoints}pts`, student: `${r.points}pts` }))],
    score,
    total,
    percentage: `${pct}%`,
  };
}
