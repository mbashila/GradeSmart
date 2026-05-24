import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import secureStorage from './secureStorage';
import { rateLimit } from './security';

const OPENROUTER_KEY_STORAGE = 'openrouter_key';
const LEGACY_KEY_STORAGE = '@gradesmart_openrouter_key';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

// Read from .env at build time (EXPO_PUBLIC_ prefix makes it available)
const ENV_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || '';

/**
 * Get the OpenRouter API key. Checks .env first, then SecureStore.
 * Migrates from legacy AsyncStorage on first read.
 */
export async function getOpenAIKey() {
  if (ENV_KEY) return ENV_KEY;
  try {
    const secureKey = await secureStorage.getItem(OPENROUTER_KEY_STORAGE);
    if (secureKey) return secureKey;
    // Migrate from legacy AsyncStorage if present
    const legacyKey = await AsyncStorage.getItem(LEGACY_KEY_STORAGE);
    if (legacyKey) {
      await secureStorage.setItem(OPENROUTER_KEY_STORAGE, legacyKey);
      await AsyncStorage.removeItem(LEGACY_KEY_STORAGE);
      return legacyKey;
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Save the OpenRouter API key securely.
 */
export async function setOpenAIKey(key) {
  await secureStorage.setItem(OPENROUTER_KEY_STORAGE, key.trim());
}

/**
 * Check if the OpenRouter API key is valid by testing a simple request.
 * @returns {{ ok: boolean, hasVision: boolean, error?: string }}
 */
export async function checkOpenAIStatus() {
  try {
    const key = await getOpenAIKey();
    if (!key) {
      return { ok: false, hasVision: false, error: 'No API key set.' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // Test with a simple chat completion to verify the key works
    const res = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://gradesmart.app',
        'X-Title': 'GradeSmart',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    });
    clearTimeout(timeout);

    if (res.status === 401) {
      return { ok: false, hasVision: false, error: 'Invalid API key.' };
    }
    if (!res.ok) {
      return { ok: false, hasVision: false, error: `OpenRouter returned ${res.status}` };
    }

    return { ok: true, hasVision: true };
  } catch (e) {
    return {
      ok: false,
      hasVision: false,
      error: e.name === 'AbortError'
        ? 'Connection timed out.'
        : `Cannot reach OpenRouter: ${e.message}`,
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
  const { model = DEFAULT_MODEL, timeoutMs = 60000, maxTokens = 1024 } = options;

  if (!rateLimit('openai_vision', 30)) {
    return { response: '', error: 'Too many requests. Please wait a moment.' };
  }

  try {
    const key = await getOpenAIKey();
    if (!key) return { response: '', error: 'No OpenRouter API key configured.' };

    const dataUrl = await imageToBase64DataUrl(imageUri);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://gradesmart.app',
        'X-Title': 'GradeSmart',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert handwriting OCR system for educational documents. Your task is to accurately transcribe handwritten text from student papers. Always comply with requests to read and transcribe text from these educational materials.',
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
      return { response: '', error: `OpenRouter error ${res.status}: ${text}` };
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
  const { model = DEFAULT_MODEL, timeoutMs = 60000, maxTokens = 1024 } = options;

  if (!rateLimit('openai_text', 30)) {
    return { response: '', error: 'Too many requests. Please wait a moment.' };
  }

  try {
    const key = await getOpenAIKey();
    if (!key) return { response: '', error: 'No OpenRouter API key configured.' };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://gradesmart.app',
        'X-Title': 'GradeSmart',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      return { response: '', error: `OpenRouter error ${res.status}: ${text}` };
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
 * @param {string} imageUri - Local image URI of the scanned sheet
 * @param {number} questionCount - Number of questions expected
 * @param {string} [markingKey] - The correct answers (for context)
 * @param {number} [numOptions=4] - Number of options per question (e.g., 4 = A-D, 5 = A-E)
 * @returns {Promise<{ answers: string[], confidence: number[], error?: string }>}
 */
export async function detectAnswersWithAI(imageUri, questionCount, markingKey = '', numOptions = 4) {
  const validOptions = Array.from({ length: numOptions }, (_, i) => String.fromCharCode(65 + i));
  const optionsStr = validOptions.join(', ');
  const lastLetter = validOptions[validOptions.length - 1];

  const prompt = `You are analyzing a scanned multiple-choice answer sheet. 
There are exactly ${questionCount} questions, each with options ${optionsStr}.

Look at the image carefully and identify which bubble/option is filled/marked for each question.

Respond with ONLY a JSON object in this exact format, nothing else:
{"answers": ["A", "B", "C", ...]}

The "answers" array must have exactly ${questionCount} elements.
Each element must be one of: ${validOptions.map(o => `"${o}"`).join(', ')}, or "?" if you cannot determine the answer.
Do not include any explanation, just the JSON.`;

  const { response, error } = await queryOpenAIVision(imageUri, prompt);

  if (error) {
    return {
      answers: Array.from({ length: questionCount }, () => '?'),
      confidence: Array.from({ length: questionCount }, () => 0),
      error,
    };
  }

  try {
    const jsonMatch = response.match(/\{[\s\S]*"answers"[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        answers: Array.from({ length: questionCount }, () => '?'),
        confidence: Array.from({ length: questionCount }, () => 0),
        error: 'AI response did not contain valid JSON.',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const rawAnswers = parsed.answers || [];

    const answers = Array.from({ length: questionCount }, (_, i) => {
      const a = (rawAnswers[i] || '').toUpperCase().trim();
      return validOptions.includes(a) ? a : '?';
    });

    // GPT-4o is highly reliable — confidence 90 for detected answers
    const confidence = answers.map((a) => (a === '?' ? 0 : 90));

    return { answers, confidence };
  } catch (e) {
    return {
      answers: Array.from({ length: questionCount }, () => '?'),
      confidence: Array.from({ length: questionCount }, () => 0),
      error: `Failed to parse AI response: ${e.message}`,
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
      .map((q, i) => `Q${i + 1}: ${q}`)
      .filter(q => q.length > 4)
      .join('\n');
    if (qList) {
      contextHint = `\nThe student is answering these questions:\n${qList}\n\nUse this context to better interpret the handwriting.\n`;
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

  // Detect subject type for appropriate grading criteria
  const mathSubjects = ['math', 'mathematics', 'physics', 'chemistry', 'accounting', 'economics', 'statistics', 'engineering', 'calculus', 'algebra', 'geometry', 'trigonometry', 'finance'];
  const scienceSubjects = ['biology', 'anatomy', 'physiology', 'pharmacology', 'nursing', 'medicine', 'biochemistry', 'microbiology'];
  const lowerSubject = subject.toLowerCase();
  const isMath = mathSubjects.some(s => lowerSubject.includes(s));
  const isScience = scienceSubjects.some(s => lowerSubject.includes(s));

  let gradingCriteria;
  if (isMath) {
    gradingCriteria = `Grade each question based on:
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
  } else if (isScience) {
    gradingCriteria = `Grade each question based on:
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
  } else {
    gradingCriteria = `Grade each question based on:
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

  const prompt = `You are a strict but fair ${subject || 'subject'} teacher grading student answers${subjectHint}${gradeHint}.

${questionsBlock}

${gradingCriteria}

IMPORTANT:
- Grade each question INDEPENDENTLY based on the student's actual answer
- Differentiate clearly between strong and weak answers
- Give partial credit where deserved

Respond with ONLY a JSON object in this exact format:
{"results": [{"questionNumber": 1, "score": 8, "maxPoints": 10, "feedback": "Brief 1-2 sentence feedback explaining the score"}]}

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
1. The question number
2. The full question text (copy it exactly as written)
3. The question type: one of "mcq", "fill_in_blank", "short_notes", "comprehension", "essay", "diagram", or "calculation"
4. Which section it belongs to (e.g., "Section A", "Section B", etc.)
5. Maximum marks/points if shown

Also identify the sections/parts of the paper.

Respond with ONLY a JSON object in this exact format:
{
  "sections": [
    {"label": "Section A", "type": "mcq", "questionRange": "1-10"},
    {"label": "Section B", "type": "fill_in_blank", "questionRange": "11-15"}
  ],
  "questions": [
    {"number": 1, "text": "What is the capital of France?", "type": "mcq", "section": "Section A", "maxPoints": 2, "options": ["A) Paris", "B) London", "C) Berlin", "D) Madrid"]},
    {"number": 11, "text": "The process of photosynthesis requires ___", "type": "fill_in_blank", "section": "Section B", "maxPoints": 2}
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

