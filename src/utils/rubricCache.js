// Per-test cache of AI-generated marking criteria, so every student's answer to the same
// question is graded against the same criteria (consistency) and criteria are not regenerated
// for each script (cost). Stores only question criteria — never student answers.
import storage from './storage';

const keyFor = (testId) => `@gradesmart:rubrics:${testId}`;

export async function loadRubricCache(testId) {
  if (!testId) return {};
  try {
    const raw = await storage.getItem(keyFor(testId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveRubricCache(testId, newCriteria) {
  if (!testId || !newCriteria || !Object.keys(newCriteria).length) return;
  try {
    const current = await loadRubricCache(testId);
    await storage.setItem(keyFor(testId), JSON.stringify({ ...current, ...newCriteria }));
  } catch {
    // Cache is an optimisation only.
  }
}
