const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-6';

export interface AIResponse {
  content: string;
  error?: string;
}

async function callClaude(apiKey: string, prompt: string): Promise<AIResponse> {
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-calls': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { content: '', error: (err as any).error?.message ?? `API error ${res.status}` };
    }

    const data = await res.json();
    return { content: data.content[0].text };
  } catch (e: any) {
    return { content: '', error: e.message ?? 'Network error' };
  }
}

export async function generateOutline(
  apiKey: string,
  title: string,
  notes: string
): Promise<AIResponse> {
  const prompt = `You are a skilled content strategist helping a writer plan an article.

Article title: "${title}"
${notes ? `Notes/context: ${notes}` : ''}

Generate a detailed article outline with:
- A compelling hook/intro description (1-2 sentences)
- 4-6 main sections with descriptive headings
- 2-3 bullet points per section describing what to cover
- A conclusion note

Format it cleanly with markdown. Be specific and actionable.`;
  return callClaude(apiKey, prompt);
}

export async function improveTitles(
  apiKey: string,
  title: string,
  notes: string
): Promise<AIResponse> {
  const prompt = `You are a skilled headline writer for a blog/publication.

Original title: "${title}"
${notes ? `Context: ${notes}` : ''}

Suggest 5 improved article titles. Make them:
- Specific and clear about the value to the reader
- Engaging without being clickbait
- SEO-friendly
- Varied in style (list, how-to, question, statement, bold claim)

Return just the 5 titles, numbered. No explanations.`;
  return callClaude(apiKey, prompt);
}

export async function suggestTags(
  apiKey: string,
  title: string,
  notes: string
): Promise<AIResponse> {
  const prompt = `You are a content strategist helping categorize an article.

Article: "${title}"
${notes ? `Notes: ${notes}` : ''}

Suggest 6-8 relevant tags/categories. Consider topic, audience, content type, and industry.
Return only a comma-separated list of short tags (1-3 words each). No explanations.`;
  return callClaude(apiKey, prompt);
}

export async function writeIntro(
  apiKey: string,
  title: string,
  notes: string
): Promise<AIResponse> {
  const prompt = `You are a skilled writer drafting an article introduction.

Article: "${title}"
${notes ? `Notes/context: ${notes}` : ''}

Write a compelling 2-3 paragraph introduction that:
- Opens with a hook (surprising fact, question, or relatable scenario)
- Establishes why this topic matters to the reader
- Previews what they'll learn

Keep it engaging and conversational but professional. About 150-200 words.`;
  return callClaude(apiKey, prompt);
}
