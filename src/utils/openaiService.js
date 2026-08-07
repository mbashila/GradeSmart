import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import secureStorage from './secureStorage';
import { rateLimit } from './security';

const KEY_STORAGE = 'openai_api_key';
const LEGACY_OPENROUTER_STORAGE = 'openrouter_key';
const LEGACY_KEY_STORAGE = '@gradesmart_openrouter_key';

const OPENAI_API_URL = 'https://api.openai.com/v1';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

// Read from .env at build time (EXPO_PUBLIC_ prefix), falling back to app.json's
// `extra` block (Constants.expoConfig.extra) so EAS cloud builds pick up the keys.
const extras = (Constants?.expoConfig?.extra) || (Constants?.manifest?.extra) || {};
const ENV_OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || extras.EXPO_PUBLIC_OPENAI_API_KEY || '';
const ENV_OPENROUTER_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || extras.EXPO_PUBLIC_OPENROUTER_API_KEY || '';

/**
 * Determine which provider to use based on available keys.
 * OpenAI direct is preferred over OpenRouter.
 */
function getProvider(key, { useFullModel = false } = {}) {
  if (key && key.startsWith('sk-')) {
    return { url: OPENAI_API_URL, model: useFullModel ? 'gpt-4o' : 'gpt-4o-mini', isOpenAI: true };
  }
  return { url: OPENROUTER_API_URL, model: useFullModel ? 'openai/gpt-4o' : 'openai/gpt-4o-mini', isOpenAI: false };
}

/**
 * Get the API key. Checks .env first (OpenAI then OpenRouter), then SecureStore.
 * Migrates from legacy storage on first read.
 */
export async function getOpenAIKey() {
  if (ENV_OPENAI_KEY) return ENV_OPENAI_KEY;
  if (ENV_OPENROUTER_KEY) return ENV_OPENROUTER_KEY;
  try {
    const secureKey = await secureStorage.getItem(KEY_STORAGE);
    if (secureKey) return secureKey;
    // Check legacy openrouter key
    const legacyRouter = await secureStorage.getItem(LEGACY_OPENROUTER_STORAGE);
    if (legacyRouter) {
      await secureStorage.setItem(KEY_STORAGE, legacyRouter);
      return legacyRouter;
    }
    // Migrate from legacy AsyncStorage if present
    const legacyKey = await AsyncStorage.getItem(LEGACY_KEY_STORAGE);
    if (legacyKey) {
      await secureStorage.setItem(KEY_STORAGE, legacyKey);
      await AsyncStorage.removeItem(LEGACY_KEY_STORAGE);
      return legacyKey;
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Save the API key securely.
 */
export async function setOpenAIKey(key) {
  await secureStorage.setItem(KEY_STORAGE, key.trim());
}

/**
 * Check if the API key is valid by testing a simple request.
 * @returns {{ ok: boolean, hasVision: boolean, error?: string }}
 */
export async function checkOpenAIStatus() {
  try {
    const key = await getOpenAIKey();
    if (!key) {
      return { ok: false, hasVision: false, error: 'No API key set.' };
    }

    const provider = getProvider(key);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    };
    if (!provider.isOpenAI) {
      headers['HTTP-Referer'] = 'https://gradesmart.app';
      headers['X-Title'] = 'GradeSmart';
    }

    const res = await fetch(`${provider.url}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    });
    clearTimeout(timeout);

    if (res.status === 401) {
      return { ok: false, hasVision: false, error: 'Invalid API key.' };
    }
    if (!res.ok) {
      return { ok: false, hasVision: false, error: `API returned ${res.status}` };
    }

    return { ok: true, hasVision: true };
  } catch (e) {
    return {
      ok: false,
      hasVision: false,
      error: e.name === 'AbortError'
        ? 'Connection timed out.'
        : `Cannot reach AI service: ${e.message}`,
    };
  }
}

/**
 * Convert a local image URI to a base64 data URL for OpenAI vision.
 * Tries ImageManipulator for resizing, falls back to direct FileSystem read.
 */
async function imageToBase64DataUrl(uri, maxWidth = 1024) {
  try {
    // Try the new SDK 54 API first
    if (ImageManipulator.manipulate) {
      const context = ImageManipulator.manipulate(uri);
      context.resize({ width: maxWidth });
      const imageRef = await context.renderAsync();
      const result = await imageRef.saveAsync({
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
        compress: 0.8,
      });
      if (result.base64) {
        return `data:image/jpeg;base64,${result.base64}`;
      }
    }
  } catch (e) {
    // Fall through to legacy API or direct read
  }

  try {
    // Try legacy manipulateAsync API (older expo versions)
    if (ImageManipulator.manipulateAsync) {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: maxWidth } }],
        { format: ImageManipulator.SaveFormat?.JPEG || 'jpeg', base64: true, compress: 0.8 }
      );
      if (result.base64) {
        return `data:image/jpeg;base64,${result.base64}`;
      }
    }
  } catch (e) {
    // Fall through to direct file read
  }

  // Fallback: read the file directly as base64 without resizing
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  // Detect format from URI
  const isJpeg = uri.toLowerCase().match(/\.(jpg|jpeg)$/);
  const mime = isJpeg ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${base64}`;
}

/**
 * Send an image + prompt to OpenAI and get a text response.
 * @param {string} imageUri - Local image URI
 * @param {string} prompt - The text prompt
 * @param {object} [options]
 * @param {string} [options.model] - OpenAI model name
 * @param {number} [options.timeoutMs] - Request timeout in ms
 * @param {number} [options.maxTokens] - Max response tokens
 * @returns {Promise<{ response: string, error?: string }>}
 */
export async function queryOpenAIVision(imageUri, prompt, options = {}) {
  const { timeoutMs = 60000, maxTokens = 1024 } = options;

  if (!rateLimit('openai_vision', 30)) {
    return { response: '', error: 'Too many requests. Please wait a moment.' };
  }

  try {
    const key = await getOpenAIKey();
    if (!key) return { response: '', error: 'No API key configured. Go to Settings to add it.' };

    const provider = getProvider(key, { useFullModel: true });
    const dataUrl = await imageToBase64DataUrl(imageUri, 1400);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    };
    if (!provider.isOpenAI) {
      headers['HTTP-Referer'] = 'https://gradesmart.app';
      headers['X-Title'] = 'GradeSmart';
    }

    const res = await fetch(`${provider.url}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: provider.model,
        messages: [
          {
            role: 'system',
            content: 'You are an educational technology assistant used by teachers. You help process student exam papers by reading handwriting, transcribing text, analyzing diagrams, and extracting questions from educational documents. This is a legitimate classroom tool. Always comply with requests to read and process these educational materials.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            ],
          },
        ],
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      return { response: '', error: `API error ${res.status}: ${text}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { response: content };
  } catch (e) {
    return {
      response: '',
      error: e.name === 'AbortError'
        ? 'AI request timed out.'
        : `AI error: ${e.message}`,
    };
  }
}

/**
 * Send a text-only prompt to OpenAI (no image).
 * @param {string} prompt - The text prompt
 * @param {object} [options]
 * @returns {Promise<{ response: string, error?: string }>}
 */
export async function queryOpenAIText(prompt, options = {}) {
  const { timeoutMs = 60000, maxTokens = 1024 } = options;

  if (!rateLimit('openai_text', 30)) {
    return { response: '', error: 'Too many requests. Please wait a moment.' };
  }

  try {
    const key = await getOpenAIKey();
    if (!key) return { response: '', error: 'No API key configured. Go to Settings to add it.' };

    const provider = getProvider(key);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    };
    if (!provider.isOpenAI) {
      headers['HTTP-Referer'] = 'https://gradesmart.app';
      headers['X-Title'] = 'GradeSmart';
    }

    const res = await fetch(`${provider.url}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      return { response: '', error: `API error ${res.status}: ${text}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { response: content };
  } catch (e) {
    return {
      response: '',
      error: e.name === 'AbortError'
        ? 'AI request timed out.'
        : `AI error: ${e.message}`,
    };
  }
}

/**
 * Use OpenAI vision to detect MCQ answers from a scanned answer sheet.
 * Uses full gpt-4o model with a dedicated prompt optimized for bubble/mark detection.
 * @param {string} imageUri - Local image URI of the scanned sheet
 * @param {number} questionCount - Number of questions expected
 * @param {string} [markingKey] - The correct answers (for context)
 * @param {number} [numOptions=4] - Number of options per question (e.g., 4 = A-D, 5 = A-E)
 * @returns {Promise<{ answers: string[], confidence: number[], error?: string }>}
 */
export async function detectAnswersWithAI(imageUri, questionCount, markingKey = '', numOptions = 4) {
  const validOptions = Array.from({ length: numOptions }, (_, i) => String.fromCharCode(65 + i));
  const optionsStr = validOptions.join(', ');

  if (!rateLimit('openai_mcq', 20)) {
    return {
      answers: Array.from({ length: questionCount }, () => '?'),
      confidence: Array.from({ length: questionCount }, () => 0),
      error: 'Too many requests. Please wait a moment.',
    };
  }

  try {
    const key = await getOpenAIKey();
    if (!key) {
      return {
        answers: Array.from({ length: questionCount }, () => '?'),
        confidence: Array.from({ length: questionCount }, () => 0),
        error: 'No API key configured. Go to Settings to add it.',
      };
    }

    const provider = getProvider(key, { useFullModel: true });
    // Use higher resolution for MCQ sheets to preserve bubble clarity
    const dataUrl = await imageToBase64DataUrl(imageUri, 1600);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    };
    if (!provider.isOpenAI) {
      headers['HTTP-Referer'] = 'https://gradesmart.app';
      headers['X-Title'] = 'GradeSmart';
    }

    const systemPrompt = `You are a helpful teaching assistant tool used by educators to digitize student exam results. Your job is to read multiple-choice answer sheets that teachers photograph after exams, and return the selected answers as structured data. This is a legitimate educational workflow used in schools worldwide to save teachers time on manual grading.`;

    const userPrompt = `I am a teacher and I just photographed my student's completed multiple-choice answer sheet after an exam. Please help me digitize the answers by reading which option is selected for each question.

Details about this answer sheet:
- It contains ${questionCount} questions (numbered 1 to ${questionCount})
- Each question has ${numOptions} choices: ${optionsStr}
- Students mark answers by filling bubbles, circling letters, writing letters, or ticking boxes

Please read each question's marked answer and return ONLY a JSON object:
{"answers": ["A", "B", "C", ...]}

The array must have exactly ${questionCount} elements.
Use ${validOptions.map(o => `"${o}"`).join(', ')} for detected answers, or "?" if unclear.
No explanation needed, just the JSON.`;

    // Helper to make the API call
    const makeRequest = async (sysMsg, userMsg) => {
      const reqController = new AbortController();
      const reqTimeout = setTimeout(() => reqController.abort(), 60000);
      const reqRes = await fetch(`${provider.url}/chat/completions`, {
        method: 'POST',
        headers,
        signal: reqController.signal,
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: 'system', content: sysMsg },
            {
              role: 'user',
              content: [
                { type: 'text', text: userMsg },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
              ],
            },
          ],
          max_tokens: 1024,
          temperature: 0,
        }),
      });
      clearTimeout(reqTimeout);
      return reqRes;
    };

    let res = await makeRequest(systemPrompt, userPrompt);

    if (!res.ok) {
      const text = await res.text();
      return {
        answers: Array.from({ length: questionCount }, () => '?'),
        confidence: Array.from({ length: questionCount }, () => 0),
        error: `API error ${res.status}: ${text}`,
      };
    }

    let data = await res.json();
    let response = data.choices?.[0]?.message?.content || '';

    // Detect refusal and retry with minimal prompt
    const refusalPatterns = [
      /i('m| am) sorry/i,
      /i can('t|not) (assist|help)/i,
      /unable to (assist|help|process)/i,
      /cannot (assist|help|process)/i,
      /can't help/i,
      /not able to/i,
    ];
    const isRefusal = refusalPatterns.some(p => p.test(response));

    if (isRefusal) {
      const retryPrompt = `This is a photo of a student's completed multiple-choice exam answer sheet from a school classroom. As a teaching assistant, please read the marked answers. There are ${questionCount} questions with options ${optionsStr}. Return only: {"answers": ["A", "B", ...]} with exactly ${questionCount} elements.`;
      const retrySystem = `You are a classroom teaching tool that helps teachers read student answer sheets. Teachers photograph completed exam papers and you return the marked answers as data. This is standard educational technology used in schools.`;

      res = await makeRequest(retrySystem, retryPrompt);
      if (!res.ok) {
        return {
          answers: Array.from({ length: questionCount }, () => '?'),
          confidence: Array.from({ length: questionCount }, () => 0),
          error: 'AI refused to process the image. Try a clearer photo with just the answer area visible.',
        };
      }
      data = await res.json();
      response = data.choices?.[0]?.message?.content || '';

      const stillRefused = refusalPatterns.some(p => p.test(response));
      if (stillRefused) {
        return {
          answers: Array.from({ length: questionCount }, () => '?'),
          confidence: Array.from({ length: questionCount }, () => 0),
          error: 'AI could not process this image. Try cropping to show only the answer bubbles/marks.',
        };
      }
    }

    // Strip markdown code fences that GPT sometimes wraps around JSON
    response = response.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();

    // Try to extract JSON with "answers" key
    let rawAnswers = null;
    const jsonMatch = response.match(/\{[\s\S]*"answers"\s*:\s*\[[\s\S]*?\]\s*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        rawAnswers = parsed.answers || [];
      } catch (_) {
        // JSON parse failed, try fallback below
      }
    }

    // Fallback: try parsing the entire response as JSON
    if (!rawAnswers) {
      try {
        const parsed = JSON.parse(response);
        rawAnswers = parsed.answers || [];
      } catch (_) {
        // Not valid JSON either
      }
    }

    // Fallback: extract array directly e.g. ["A","B","C",...]
    if (!rawAnswers) {
      const arrayMatch = response.match(/\[\s*"[A-Z?]"[\s\S]*?\]/);
      if (arrayMatch) {
        try {
          rawAnswers = JSON.parse(arrayMatch[0]);
        } catch (_) {}
      }
    }

    // Final fallback: extract comma/space-separated letters
    if (!rawAnswers) {
      const letters = response.match(/[A-Z?]/g);
      if (letters && letters.length >= questionCount) {
        rawAnswers = letters.slice(0, questionCount);
      }
    }

    if (!rawAnswers || rawAnswers.length === 0) {
      return {
        answers: Array.from({ length: questionCount }, () => '?'),
        confidence: Array.from({ length: questionCount }, () => 0),
        error: `AI response did not contain valid answers. Raw: ${response.substring(0, 200)}`,
      };
    }

    const answers = Array.from({ length: questionCount }, (_, i) => {
      const a = (rawAnswers[i] || '').toUpperCase().trim();
      return validOptions.includes(a) ? a : '?';
    });

    const confidence = answers.map((a) => (a === '?' ? 0 : 92));

    return { answers, confidence };
  } catch (e) {
    return {
      answers: Array.from({ length: questionCount }, () => '?'),
      confidence: Array.from({ length: questionCount }, () => 0),
      error: e.name === 'AbortError'
        ? 'AI request timed out. Try again.'
        : `AI error: ${e.message}`,
    };
  }
}

/**
 * Use OpenAI Vision to transcribe handwriting from a scanned page image.
 * This is the OCR replacement — GPT-4o reads the handwriting and returns the text.
 * 
 * @param {string} imageUri - Local image URI of the scanned page
 * @param {object} [options]
 * @param {number} [options.questionCount] - Number of questions (hint for the AI)
 * @param {string[]} [options.questionTexts] - The actual question texts for context
 * @param {string} [options.subject] - Subject hint
 * @returns {Promise<{ text: string, error?: string }>}
 */
export async function transcribeHandwritingWithVision(imageUri, options = {}) {
  const { questionCount = 0, questionTexts = [], subject = '' } = options;

  let contextHint = '';
  if (questionCount > 0 && questionTexts.length > 0) {
    const qList = questionTexts
      .map((q, i) => {
        // For passage-based questions, show just the question part to keep context concise
        const passageMatch = q.match(/QUESTION:\s*(.+)/is);
        const displayText = passageMatch ? passageMatch[1].trim() : q;
        return `Q${i + 1}: ${displayText}`;
      })
      .filter(q => q.length > 4)
      .join('\n');
    if (qList) {
      const hasPassage = questionTexts.some(q => /PASSAGE:/i.test(q));
      contextHint = `\nThe student is answering these questions:\n${qList}\n${hasPassage ? '\nSome questions are based on a comprehension passage/extract. The student may reference or quote parts of the passage in their answers.\n' : ''}\nUse this context to better interpret the handwriting.\n`;
    }
  }

  const subjectHint = subject ? ` (subject: ${subject})` : '';

  // Detect if subject involves calculations/formulas
  const mathSubjects = ['math', 'mathematics', 'physics', 'chemistry', 'accounting', 'economics', 'statistics', 'engineering', 'calculus', 'algebra', 'geometry', 'trigonometry', 'finance'];
  const isMathRelated = mathSubjects.some(s => subject.toLowerCase().includes(s));

  const mathInstructions = isMathRelated
    ? `\nIMPORTANT - This is a ${subject} paper with calculations:
- Preserve all mathematical symbols, equations, and formulas exactly
- Use standard notation: ^2 for squared, sqrt() for square root, / for division
- Keep all working steps, intermediate calculations, and final answers
- Note units of measurement if visible (e.g. m/s, kg, $, %)\n`
    : '';

  const prompt = `Transcribe all handwritten text from this image${subjectHint}.
${contextHint ? `Context: ${contextHint}` : ''}${mathInstructions}
Return only the transcribed text, nothing else.`;

  const { response, error } = await queryOpenAIVision(imageUri, prompt, {
    maxTokens: 2048,
    timeoutMs: 45000,
  });

  if (error) {
    return { text: '', error };
  }

  const text = (response || '').trim();

  // Detect AI refusal responses and retry with a simpler prompt
  const refusalPatterns = [
    /i('m| am) sorry/i,
    /i can('t|not) (assist|help)/i,
    /unable to (assist|help|process)/i,
    /cannot (assist|help|process)/i,
  ];
  const isRefusal = refusalPatterns.some(p => p.test(text));

  if (isRefusal) {
    // Retry with a minimal, clear prompt
    const retryPrompt = `Please transcribe all handwritten text from this student's paper. Return only the transcribed text without any commentary.`;
    const retry = await queryOpenAIVision(imageUri, retryPrompt, {
      maxTokens: 2048,
      timeoutMs: 45000,
    });

    if (retry.error) {
      return { text: '', error: retry.error };
    }

    const retryText = (retry.response || '').trim();
    const isRetryRefusal = refusalPatterns.some(p => p.test(retryText));
    if (isRetryRefusal) {
      return { text: '', error: 'AI could not process the image. Try taking a clearer photo.' };
    }
    return { text: retryText };
  }

  return { text };
}

/**
 * Build subject-appropriate grading criteria text shared across grading functions.
 * @param {string} subject
 * @returns {string}
 */
function buildGradingCriteria(subject = '') {
  const mathSubjects = ['math', 'mathematics', 'physics', 'chemistry', 'accounting', 'economics', 'statistics', 'engineering', 'calculus', 'algebra', 'geometry', 'trigonometry', 'finance'];
  const scienceSubjects = ['biology', 'anatomy', 'physiology', 'pharmacology', 'nursing', 'medicine', 'biochemistry', 'microbiology'];
  const lowerSubject = subject.toLowerCase();
  const isMath = mathSubjects.some(s => lowerSubject.includes(s));
  const isScience = scienceSubjects.some(s => lowerSubject.includes(s));

  if (isMath) {
    return `Grade each question based on:
1. **Correct Method/Approach** — Did the student use the right formula, method, or approach?
2. **Working/Steps** — Are the intermediate steps shown and logically correct?
3. **Final Answer** — Is the final numerical answer or conclusion correct?
4. **Units & Notation** — Are correct units and mathematical notation used?

PARTIAL CREDIT RULES:
- Correct method + correct steps + correct answer = 80-100% of max points
- Correct method + correct steps + wrong final answer (arithmetic error) = 50-79%
- Correct method but missing steps or major errors = 20-49%
- Wrong method but some relevant work shown = 5-19%
- Blank or completely wrong approach = 0 points`;
  }
  if (isScience) {
    return `Grade each question based on:
1. **Scientific Accuracy** — Are facts, terms, and concepts correct?
2. **Completeness** — Does it cover all required points (mechanisms, examples, classifications)?
3. **Clinical/Practical Relevance** — Are practical applications or clinical correlations included where expected?
4. **Structure** — Is the answer well-organized and logically presented?

GRADING GUIDELINES:
- Comprehensive, accurate answer with all key points = 80-100%
- Good answer missing some details or examples = 50-79%
- Partial answer with some correct concepts = 20-49%
- Mostly incorrect or very incomplete = 1-19%
- Blank or completely wrong = 0 points`;
  }
  return `Grade each question based on:
1. **Correctness** — Is the answer factually correct and relevant to the question?
2. **Completeness** — Does it address all parts of the question?
3. **Quality of expression** — Is it well-written and clear?

GRADING GUIDELINES:
- An excellent, detailed answer = 80-100% of max points
- A good but incomplete answer = 50-79% of max points
- A minimal or partially correct answer = 20-49% of max points
- An incorrect or barely relevant answer = 1-19% of max points
- A blank or completely wrong answer = 0 points`;
}

/**
 * Category-specific marking rubrics. The grader first CLASSIFIES each question
 * into one of these categories, then applies the matching rubric. Kept concise
 * to stay within token limits while covering every supported question type.
 * @returns {string}
 */
function buildQuestionTypeRubrics() {
  return `QUESTION-TYPE RUBRICS — classify each question into ONE category, then grade it by that category's rule:
- mcq / true_false: Full marks only if the chosen option/answer exactly matches the correct one; otherwise 0. No partial credit.
- fill_in_blank: Award marks per blank for the correct keyword. Accept correct synonyms and minor spelling slips when the intended term is unambiguous. Score each blank independently.
- matching: Score each pairing independently (e.g. 4 of 5 correct pairs = 80%). Wrong or missing pairs earn nothing.
- short_notes: Reward each distinct correct key point, plus clarity and completeness relative to the max points. Vague or padding text earns nothing.
- comprehension: Judge understanding, relevance and correctness AGAINST the provided passage. The answer must reflect that specific passage, not generic knowledge.
- scenario: Judge how well the student applies the relevant concept(s) to the given scenario — correct identification, sound reasoning and a justified conclusion.
- essay: Judge structure (intro/body/conclusion), depth and accuracy of content, argument quality and logic, use of examples/evidence, and coherence.
- calculation: Validate step-by-step — correct method/formula, correct working, correct final answer and correct units. Give partial credit for a correct method with minor arithmetic slips.
- diagram: Check the required parts are present, correctly drawn/related and correctly labelled; compare to the expected diagram.
- graph_chart: Check axes/labels, plotted values, the trend/relationship shown, and any reading or interpretation requested.
- table: Check the values and relationships in the cells are correct and complete.
- map: Check correct locations, labels and any required annotations.
- code: Check logic correctness and expected output; minor syntax slips lose little if the logic is sound.`;
}

/**
 * Build guidance describing the declared visual features of a section and an
 * instruction to extract/interpret visual elements before marking.
 * @param {object} [features]
 * @returns {string}
 */
function buildFeatureGuidance(features = {}) {
  const map = {
    hasDiagrams: 'diagrams',
    hasCalculations: 'calculations',
    hasGraphs: 'graphs/charts',
    hasTables: 'tables',
    hasMaps: 'maps',
    hasCodeSnippets: 'code snippets',
    hasTrueFalse: 'true/false items',
  };
  const present = Object.keys(map).filter((k) => features[k]).map((k) => map[k]);
  let text = '';
  if (present.length) {
    text += `This section may contain: ${present.join(', ')}.\n`;
  }
  text += `VISUAL & STRUCTURED ELEMENTS: If a question involves a diagram, graph, chart, table, map or other visual/structured element, FIRST extract and interpret what the student produced (labels, values, axes, trends, relationships, structure) from the image, THEN compare it to the expected answer before scoring. Briefly note what you observed in the feedback.`;
  return text;
}

/**
 * Grade transcribed essay text using OpenAI (text-only, no image needed).
 * This is the second AI call — takes the already-transcribed text and grades it.
 *
 * @param {object[]} questions - Array of { questionNumber, questionText, studentAnswer, maxPoints }
 * @param {object} [options]
 * @param {string} [options.subject] - Subject for context
 * @param {string} [options.gradeLevel] - Grade level for context
 * @returns {Promise<{ results: Array<{ score: number, maxPoints: number, feedback: string }>, error?: string }>}
 */
export async function gradeEssayTextWithOpenAI(questions, options = {}) {
  const { subject = '', gradeLevel = '' } = options;

  const subjectHint = subject ? ` for ${subject}` : '';
  const gradeHint = gradeLevel ? ` (${gradeLevel} level)` : '';

  const questionsBlock = questions.map((q, i) => {
    return `--- Question ${q.questionNumber || i + 1} (max ${q.maxPoints} points) ---
Question: "${q.questionText || 'Not provided'}"
Student's Answer: "${q.studentAnswer || '(no answer)'}"`;
  }).join('\n\n');

  const gradingScale = buildGradingCriteria(subject);
  const typeRubrics = buildQuestionTypeRubrics();

  const prompt = `You are a strict but fair ${subject || 'subject'} teacher grading student answers${subjectHint}${gradeHint}.

${questionsBlock}

FOR EACH QUESTION: FIRST classify it into ONE category from the rubric list below (use any declared type as a strong hint, but override it if the question is clearly a different type), THEN grade it using that category's rubric.

${typeRubrics}

GENERAL PARTIAL-CREDIT SCALE (apply within the chosen category):
${gradingScale}

IMPORTANT:
- Grade each question INDEPENDENTLY using the rubric appropriate to ITS classified type — do not grade every question the same way.
- Differentiate clearly between strong and weak answers and give partial credit where deserved.
- For comprehension/passage-based questions: the question text may include "PASSAGE: ..." followed by "QUESTION: ...". Use the passage as the primary reference; the answer should demonstrate understanding of that specific passage.

Respond with ONLY a JSON object in this exact format:
{"results": [{"questionNumber": 1, "questionType": "essay", "score": 8, "maxPoints": 10, "feedback": "Brief 1-2 sentence feedback explaining the score"}]}

The "results" array must have exactly ${questions.length} element(s).
Do not include any explanation outside the JSON.`;

  const { response, error } = await queryOpenAIText(prompt, {
    maxTokens: 1500,
    timeoutMs: 45000,
  });

  if (error) {
    return {
      results: questions.map(q => ({ score: 0, maxPoints: q.maxPoints, feedback: '' })),
      error,
    };
  }

  try {
    const jsonMatch = response.match(/\{[\s\S]*"results"[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        results: questions.map(q => ({ score: 0, maxPoints: q.maxPoints, feedback: '' })),
        error: 'AI response did not contain valid JSON.',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const rawResults = parsed.results || [];

    const results = questions.map((q, i) => {
      const r = rawResults[i] || {};
      const score = Math.min(Math.max(parseInt(r.score, 10) || 0, 0), q.maxPoints);
      return {
        score,
        maxPoints: q.maxPoints,
        questionType: r.questionType || '',
        feedback: r.feedback || '',
      };
    });

    return { results };
  } catch (e) {
    return {
      results: questions.map(q => ({ score: 0, maxPoints: q.maxPoints, feedback: '' })),
      error: `Failed to parse AI response: ${e.message}`,
    };
  }
}

/**
 * Extract questions from a photographed question paper using GPT-4o Vision.
 * Supports multiple page images. Returns structured question data.
 * 
 * @param {string[]} imageUris - Array of local image URIs (one per page)
 * @param {object} [options]
 * @param {string} [options.subject] - Subject hint
 * @param {string[]} [options.sectionTypes] - e.g. ['mcq','fill_in_blank','short_notes','comprehension','essay','diagram']
 * @returns {Promise<{ questions: Array<{ number, text, type, section, maxPoints? }>, sections: Array<{ label, type, questionRange }>, error?: string }>}
 */
export async function extractQuestionsFromPaperImage(imageUris, options = {}) {
  const { subject = '', sectionTypes = [], sectionMapping = [] } = options;

  const subjectHint = subject ? ` for a ${subject} exam` : '';
  let sectionHint = '';
  if (sectionMapping && sectionMapping.length > 0) {
    const mappingDesc = sectionMapping.map(s => `Section ${s.label} = ${s.type}`).join(', ');
    sectionHint = `\nThe teacher specified the paper structure: ${mappingDesc}.`;
  } else if (sectionTypes.length > 0) {
    sectionHint = `\nThe teacher indicated these section types are present: ${sectionTypes.join(', ')}.`;
  }

  const prompt = `You are analyzing a photographed question paper${subjectHint}.
${sectionHint}

Extract ALL questions from this question paper. For each question, identify:
1. The question number (use sub-numbering like 1.1, 1.2 if the paper uses it)
2. The full question text (copy it exactly as written)
3. The question type: one of "mcq", "fill_in_blank", "short_notes", "comprehension", "essay", "diagram", or "calculation"
4. Which section it belongs to (e.g., "Section A", "Section B", etc.)
5. Maximum marks/points if shown

CRITICAL — Comprehension & passage-based questions:
- If a section has a reading passage, extract, poem, story, case study, or any shared text that sub-questions refer to, you MUST include that full passage/text in EVERY sub-question's "text" field as context.
- Format: "PASSAGE: [full passage text here]\\n\\nQUESTION: [the actual sub-question]"
- This applies to comprehension sections, reading exercises, case studies, source-based questions, data interpretation, etc.
- Do NOT extract only the sub-question without its passage — the passage IS part of the question.

Also identify the sections/parts of the paper.

Respond with ONLY a JSON object in this exact format:
{
  "sections": [
    {"label": "Section A", "type": "mcq", "questionRange": "1-10"},
    {"label": "Section B", "type": "comprehension", "questionRange": "11-15"}
  ],
  "questions": [
    {"number": 1, "text": "What is the capital of France?", "type": "mcq", "section": "Section A", "maxPoints": 2, "options": ["A) Paris", "B) London", "C) Berlin", "D) Madrid"]},
    {"number": 11, "text": "PASSAGE: The sun is the largest star in our solar system. It provides light and heat...\\n\\nQUESTION: What role does the sun play according to the passage?", "type": "comprehension", "section": "Section B", "maxPoints": 5}
  ]
}

For MCQ questions, include the "options" array. For other types, omit it.
If marks are not shown, estimate based on question complexity.
Do not include any explanation outside the JSON.`;

  // Process all pages — send them as separate images in one request if possible,
  // otherwise process page by page and merge
  if (imageUris.length === 1) {
    try {
      const { response, error } = await queryOpenAIVision(imageUris[0], prompt, {
        maxTokens: 4096,
        timeoutMs: 60000,
      });

      if (error) return { questions: [], sections: [], error };
      if (!response || response.trim().length === 0) {
        return { questions: [], sections: [], error: 'AI returned an empty response. Try a clearer photo.' };
      }
      return parseQuestionExtractionResponse(response);
    } catch (e) {
      return { questions: [], sections: [], error: `Failed to process image: ${e.message}` };
    }
  }

  // Multiple pages: process each page, then merge
  const allQuestions = [];
  const allSections = [];
  const seenSections = new Set();
  const errors = [];

  for (let i = 0; i < imageUris.length; i++) {
    try {
      const pagePrompt = `${prompt}\n\nThis is page ${i + 1} of ${imageUris.length}. Extract only the questions visible on THIS page.`;
      const { response, error } = await queryOpenAIVision(imageUris[i], pagePrompt, {
        maxTokens: 4096,
        timeoutMs: 60000,
      });

      if (error) {
        errors.push(`Page ${i + 1}: ${error}`);
        continue;
      }

      if (!response || response.trim().length === 0) {
        errors.push(`Page ${i + 1}: Empty AI response`);
        continue;
      }

      const parsed = parseQuestionExtractionResponse(response);
      if (parsed.error) {
        errors.push(`Page ${i + 1}: ${parsed.error}`);
        continue;
      }

      for (const q of parsed.questions) {
        if (!allQuestions.some(existing => existing.number === q.number)) {
          allQuestions.push(q);
        }
      }
      for (const s of parsed.sections) {
        if (!seenSections.has(s.label)) {
          seenSections.add(s.label);
          allSections.push(s);
        }
      }
    } catch (e) {
      errors.push(`Page ${i + 1}: ${e.message}`);
      continue;
    }
  }

  if (allQuestions.length === 0) {
    const detail = errors.length > 0 ? errors[0] : 'Unknown error';
    return { questions: [], sections: [], error: `Could not extract questions. ${detail}` };
  }

  allQuestions.sort((a, b) => a.number - b.number);
  return { questions: allQuestions, sections: allSections };
}

function parseQuestionExtractionResponse(response) {
  try {
    const jsonMatch = response.match(/\{[\s\S]*"questions"[\s\S]*\}/);
    if (!jsonMatch) {
      return { questions: [], sections: [], error: 'AI response did not contain valid JSON.' };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const questions = (parsed.questions || []).map(q => ({
      number: q.number || 0,
      text: q.text || '',
      type: q.type || 'short_notes',
      section: q.section || '',
      maxPoints: q.maxPoints || 0,
      options: q.options || undefined,
    }));
    const sections = (parsed.sections || []).map(s => ({
      label: s.label || '',
      type: s.type || '',
      questionRange: s.questionRange || '',
    }));
    return { questions, sections };
  } catch (e) {
    return { questions: [], sections: [], error: `Failed to parse: ${e.message}` };
  }
}

/**
 * Grade a student's diagram/drawing using GPT-4o Vision.
 * Sends the student's answer image directly to the AI for visual evaluation.
 * 
 * @param {string} imageUri - Local image URI of the student's diagram
 * @param {object} options
 * @param {string} options.questionText - The question that was asked
 * @param {number} options.maxPoints - Maximum points for this question
 * @param {string} [options.subject] - Subject for context
 * @returns {Promise<{ score: number, maxPoints: number, feedback: string, error?: string }>}
 */
export async function gradeDiagramWithVision(imageUri, options = {}) {
  const { questionText = '', maxPoints = 10, subject = '' } = options;

  const subjectHint = subject ? ` (${subject})` : '';

  const prompt = `You are a strict but fair teacher grading a student's diagram/drawing${subjectHint}.

Question: "${questionText}"
Maximum points: ${maxPoints}

Look at the student's diagram/drawing in this image and grade it based on:
1. **Accuracy** — Is the diagram scientifically/factually correct?
2. **Completeness** — Are all required parts, labels, and annotations included?
3. **Clarity** — Is it neat, well-organized, and easy to understand?
4. **Labels & Annotations** — Are key parts properly labeled?

GRADING GUIDELINES:
- Excellent diagram with all labels and correct structure = 80-100% of max points
- Good diagram with minor missing labels or small inaccuracies = 50-79%
- Partial diagram, missing major parts or labels = 20-49%
- Poor/mostly incorrect diagram = 1-19%
- Blank or completely wrong = 0 points

Respond with ONLY a JSON object:
{"score": 8, "maxPoints": ${maxPoints}, "feedback": "Brief 1-2 sentence feedback"}

Do not include any explanation outside the JSON.`;

  const { response, error } = await queryOpenAIVision(imageUri, prompt, {
    maxTokens: 500,
    timeoutMs: 45000,
  });

  if (error) {
    return { score: 0, maxPoints, feedback: '', error };
  }

  try {
    const jsonMatch = response.match(/\{[\s\S]*"score"[\s\S]*\}/);
    if (!jsonMatch) {
      return { score: 0, maxPoints, feedback: '', error: 'AI response did not contain valid JSON.' };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const score = Math.min(Math.max(parseInt(parsed.score, 10) || 0, 0), maxPoints);
    return { score, maxPoints, feedback: parsed.feedback || '' };
  } catch (e) {
    return { score: 0, maxPoints, feedback: '', error: `Failed to parse: ${e.message}` };
  }
}

/**
 * Grade a whole section in ONE vision call: send the section's answer page image(s)
 * together with that section's questions, and let GPT-4o read the handwriting,
 * MATCH each answer to its question, and grade them all at once.
 *
 * This replaces the fragile OCR → regex-split → text-grade pipeline. The vision
 * model visually associates handwritten answers with their question numbers on the
 * page, which is far more reliable than splitting transcribed text by markers.
 *
 * @param {string[]} imageUris - Answer page image URIs for this section
 * @param {Array<{number?: number, text: string, maxPoints?: number, type?: string}>} questions - The section's questions
 * @param {object} [options]
 * @param {string} [options.subject] - Subject for context
 * @param {string} [options.gradeLevel] - Grade level for context
 * @param {string} [options.sectionLabel] - Section label (e.g. "A")
 * @param {string} [options.sectionType] - Section type (e.g. "comprehension")
 * @param {object} [options.features] - Declared visual features (hasDiagrams, hasGraphs, hasCalculations, ...)
 * @returns {Promise<{ results: Array<{ questionNumber: number, questionType: string, transcribedAnswer: string, score: number, maxPoints: number, feedback: string }>, error?: string }>}
 */
export async function gradeSectionAnswersWithVision(imageUris, questions, options = {}) {
  const { subject = '', gradeLevel = '', sectionLabel = '', sectionType = '', features = {} } = options;
  const imgs = Array.isArray(imageUris) ? imageUris.filter(Boolean) : [];
  const qs = Array.isArray(questions) ? questions : [];

  const fallbackResults = () => qs.map((q, i) => ({
    questionNumber: q.number || i + 1,
    transcribedAnswer: '',
    score: 0,
    maxPoints: q.maxPoints || 0,
    feedback: '',
  }));

  if (imgs.length === 0) {
    return { results: fallbackResults(), error: 'No answer images provided for this section.' };
  }
  if (qs.length === 0) {
    return { results: [], error: 'No questions provided for this section.' };
  }

  if (!rateLimit('openai_vision', 30)) {
    return { results: fallbackResults(), error: 'Too many requests. Please wait a moment.' };
  }

  try {
    const key = await getOpenAIKey();
    if (!key) return { results: fallbackResults(), error: 'No API key configured. Go to Settings to add it.' };

    const provider = getProvider(key, { useFullModel: true });

    // Convert all answer pages to base64 data URLs
    const dataUrls = [];
    for (const uri of imgs) {
      try {
        dataUrls.push(await imageToBase64DataUrl(uri, 1500));
      } catch {
        // skip unreadable image
      }
    }
    if (dataUrls.length === 0) {
      return { results: fallbackResults(), error: 'Could not read the answer images.' };
    }

    const subjectHint = subject ? ` for ${subject}` : '';
    const gradeHint = gradeLevel ? ` (${gradeLevel} level)` : '';
    const sectionHint = sectionLabel ? ` Section ${sectionLabel}${sectionType ? ` (${sectionType})` : ''}.` : '';

    const questionsBlock = qs.map((q, i) => {
      const typeHint = q.type ? ` [declared type: ${q.type}]` : '';
      return `--- Question ${q.number || i + 1} (max ${q.maxPoints || 0} points)${typeHint} ---
${q.text || 'Question text not provided'}`;
    }).join('\n\n');

    const gradingScale = buildGradingCriteria(subject);
    const typeRubrics = buildQuestionTypeRubrics();
    const featureGuidance = buildFeatureGuidance(features);

    const prompt = `You are a strict but fair ${subject || 'subject'} teacher${subjectHint}${gradeHint}.${sectionHint}

The attached image(s) are the page(s) on which a student wrote their answers for this section. The questions for this section are listed below.

${questionsBlock}

${featureGuidance}

FOLLOW THESE STEPS FOR EACH QUESTION:
1. READ the handwritten answers in the image(s).
2. MATCH each answer to its question using the numbering the student wrote (e.g. "1", "2.1", "(a)"), the order of answers on the page, and the content.
3. CLASSIFY the question into ONE category from the rubric list below. Use the declared section type${sectionType ? ` ("${sectionType}")` : ''} and any declared per-question type as strong hints, but override them if the question is clearly a different type.
4. If the question involves a diagram, graph, chart, table, map or other visual/structured element, extract and interpret it from the student's work FIRST (see above).
5. TRANSCRIBE the student's answer (exactly what they wrote).
6. GRADE strictly using the rubric for the classified category, then map to points using the scale below.

${typeRubrics}

GENERAL PARTIAL-CREDIT SCALE (apply within the chosen category):
${gradingScale}

IMPORTANT:
- Grade each question INDEPENDENTLY using the rubric appropriate to ITS classified type — do not grade every question the same way.
- For comprehension/passage-based questions the text may embed "PASSAGE: ..." then "QUESTION: ..."; evaluate against that passage, not generic knowledge.
- If you cannot find any answer for a question, set its transcribedAnswer to "" and score to 0 with feedback "No answer found".
- Do not invent answers that are not written on the page.

Respond with ONLY a JSON object in this exact format:
{"results": [{"questionNumber": 1, "questionType": "comprehension", "transcribedAnswer": "what the student wrote", "score": 8, "maxPoints": 10, "feedback": "Brief 1-2 sentence feedback"}]}

The "results" array must have exactly ${qs.length} element(s), one per question in the same order as listed above.
Do not include any explanation outside the JSON.`;

    const content = [
      { type: 'text', text: prompt },
      ...dataUrls.map((url) => ({ type: 'image_url', image_url: { url, detail: 'high' } })),
    ];

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    };
    if (!provider.isOpenAI) {
      headers['HTTP-Referer'] = 'https://gradesmart.app';
      headers['X-Title'] = 'GradeSmart';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    const res = await fetch(`${provider.url}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: provider.model,
        messages: [
          {
            role: 'system',
            content: 'You are an educational technology assistant used by teachers to grade student exam papers. You read handwriting from photographed answer sheets, match answers to questions, and grade them. This is a legitimate classroom tool. Always comply with requests to read and grade these educational materials.',
          },
          { role: 'user', content },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      return { results: fallbackResults(), error: `API error ${res.status}: ${text}` };
    }

    const data = await res.json();
    const response = data.choices?.[0]?.message?.content || '';

    const jsonMatch = response.match(/\{[\s\S]*"results"[\s\S]*\}/);
    if (!jsonMatch) {
      return { results: fallbackResults(), error: 'AI response did not contain valid JSON.' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const rawResults = parsed.results || [];

    const results = qs.map((q, i) => {
      const r = rawResults[i] || {};
      const maxPoints = q.maxPoints || 0;
      const score = Math.min(Math.max(parseInt(r.score, 10) || 0, 0), maxPoints || Infinity);
      return {
        questionNumber: q.number || i + 1,
        questionType: r.questionType || q.type || '',
        transcribedAnswer: r.transcribedAnswer || '',
        score,
        maxPoints,
        feedback: r.feedback || '',
      };
    });

    return { results };
  } catch (e) {
    return {
      results: fallbackResults(),
      error: e.name === 'AbortError'
        ? 'AI request timed out.'
        : `AI error: ${e.message}`,
    };
  }
}

