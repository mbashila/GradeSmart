// Shared OpenAI vision call for the CLI scripts (mirrors queryOpenAIVisionPages in the app).
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const toDataUrl = async (file) => {
  const mime = /\.png$/i.test(extname(file)) ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${(await readFile(file)).toString('base64')}`;
};

export function makeCallVision(files, key = process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
  if (!key) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY is not set.');
  return async function callVision(pageIndexes, prompt) {
    try {
      const images = await Promise.all(pageIndexes.map(i => toDataUrl(files[i])));
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          model: 'gpt-4o',
          temperature: 0,
          max_tokens: 8192,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You are an educational technology assistant used by teachers. You transcribe exam papers and handwritten answer booklets into structured JSON. You never invent content that is not on the page.' },
            { role: 'user', content: [{ type: 'text', text: prompt }, ...images.map(url => ({ type: 'image_url', image_url: { url, detail: 'high' } }))] },
          ],
        }),
      });
      if (!res.ok) return { response: '', error: `API error ${res.status}: ${(await res.text()).slice(0, 200)}` };
      const data = await res.json();
      const choice = data.choices?.[0];
      return { response: choice?.message?.content || '', truncated: choice?.finish_reason === 'length' };
    } catch (e) {
      return { response: '', error: e.name === 'TimeoutError' ? 'AI request timed out.' : `AI error: ${e.message}` };
    }
  };
}
