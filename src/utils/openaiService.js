import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OPENAI_KEY_STORAGE = '@gradesmart_openai_key';
const OPENAI_API_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o';

// Read from .env at build time (EXPO_PUBLIC_ prefix makes it available)
const ENV_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

/**
 * Get the OpenAI API key. Checks .env first, then AsyncStorage.
 */
export async function getOpenAIKey() {
  if (ENV_KEY) return ENV_KEY;
  try {
    return (await AsyncStorage.getItem(OPENAI_KEY_STORAGE)) || '';
  } catch {
    return '';
  }
}

/**
 * Save the OpenAI API key.
 */
export async function setOpenAIKey(key) {
  await AsyncStorage.setItem(OPENAI_KEY_STORAGE, key.trim());
}

/**
 * Check if the OpenAI API key is valid by listing models.
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

    const res = await fetch(`${OPENAI_API_URL}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 401) {
      return { ok: false, hasVision: false, error: 'Invalid API key.' };
    }
    if (!res.ok) {
      return { ok: false, hasVision: false, error: `OpenAI returned ${res.status}` };
    }

    return { ok: true, hasVision: true };
  } catch (e) {
    return {
      ok: false,
      hasVision: false,
      error: e.name === 'AbortError'
        ? 'Connection timed out.'
        : `Cannot reach OpenAI: ${e.message}`,
    };
  }
}

/**
 * Convert a local image URI to a base64 data URL for OpenAI vision.
 */
async function imageToBase64DataUrl(uri, maxWidth = 1024) {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: maxWidth });
  const imageRef = await context.renderAsync();
  const result = await imageRef.saveAsync({
    format: SaveFormat.JPEG,
    base64: true,
    compress: 0.8,
  });
  return `data:image/jpeg;base64,${result.base64}`;
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

  try {
    const key = await getOpenAIKey();
    if (!key) return { response: '', error: 'No OpenAI API key configured.' };

    const dataUrl = await imageToBase64DataUrl(imageUri);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an educational assistant used by teachers to help grade student papers. You analyze scanned images of student handwritten work for a school grading application. Always comply with requests to read or transcribe text from these educational documents.',
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
      return { response: '', error: `OpenAI error ${res.status}: ${text}` };
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

  try {
    const key = await getOpenAIKey();
    if (!key) return { response: '', error: 'No OpenAI API key configured.' };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      return { response: '', error: `OpenAI error ${res.status}: ${text}` };
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
 * @returns {Promise<{ answers: string[], confidence: number[], error?: string }>}
 */
export async function detectAnswersWithAI(imageUri, questionCount, markingKey = '') {
  const prompt = `You are analyzing a scanned multiple-choice answer sheet. 
There are exactly ${questionCount} questions, each with options A, B, C, or D.

Look at the image carefully and identify which bubble/option is filled/marked for each question.

Respond with ONLY a JSON object in this exact format, nothing else:
{"answers": ["A", "B", "C", "D", ...]}

The "answers" array must have exactly ${questionCount} elements.
Each element must be one of: "A", "B", "C", "D", or "?" if you cannot determine the answer.
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
      return ['A', 'B', 'C', 'D'].includes(a) ? a : '?';
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

  const prompt = `You are an expert at reading handwritten text from scanned student papers${subjectHint}.

Look at this scanned image carefully and transcribe ALL the handwritten text you can see, exactly as the student wrote it.
${contextHint}
Rules:
- Transcribe everything the student wrote, preserving paragraph breaks
- If there are question numbers visible (like "1.", "Q1", etc.), include them
- If you cannot read a word, write [illegible] in its place
- Do NOT add any commentary, grading, or analysis
- Do NOT make up text that isn't in the image
- Just return the raw transcribed text, nothing else

Transcribe now:`;

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
    const retryPrompt = `This is a photo of a student's handwritten school assignment. Please read and transcribe all the handwritten text visible in the image. Return only the transcribed text.`;
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

  const prompt = `You are a strict but fair teacher grading student essay answers${subjectHint}${gradeHint}.

${questionsBlock}

Grade each question based on:
1. **Correctness** — Is the answer factually correct and relevant?
2. **Completeness** — Does it address all parts of the question?
3. **Quality of expression** — Is it well-written and clear?

IMPORTANT GRADING GUIDELINES:
- An excellent, detailed answer should get 80-100% of max points
- A good but incomplete answer should get 50-79% of max points
- A minimal or partially correct answer should get 20-49% of max points
- An incorrect or barely relevant answer should get 1-19% of max points
- A blank or completely wrong answer gets 0 points
- Differentiate clearly between strong and weak answers

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

