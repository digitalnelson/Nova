export interface AIResponse {
  content: string;
  error?: string;
}

interface AzureConfig {
  endpoint: string; // full URL, e.g. https://resource.services.ai.azure.com/anthropic/v1/messages
  apiKey: string;
  deployment: string; // model name, e.g. claude-opus-4-6
}

async function callClaude(config: AzureConfig, prompt: string): Promise<AIResponse> {
  const body = {
    model: config.deployment,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  };
  console.log('[AI] endpoint:', config.endpoint);
  console.log('[AI] deployment:', config.deployment);
  console.log('[AI] apiKey length:', config.apiKey?.length ?? 0);
  try {
    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const rawText = await res.text();
    console.log('[AI] status:', res.status);
    console.log('[AI] response:', rawText);

    if (!res.ok) {
      let errMsg = `API error ${res.status}`;
      try {
        const err = JSON.parse(rawText);
        errMsg = err?.error?.message ?? err?.message ?? rawText;
      } catch {}
      return { content: '', error: errMsg };
    }

    const data = JSON.parse(rawText);
    return { content: data.content[0].text };
  } catch (e: any) {
    return { content: '', error: e.message ?? 'Network error' };
  }
}

export async function generateOutline(
  config: AzureConfig,
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
  return callClaude(config, prompt);
}

export async function improveTitles(
  config: AzureConfig,
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
  return callClaude(config, prompt);
}

export async function suggestTags(
  config: AzureConfig,
  title: string,
  notes: string
): Promise<AIResponse> {
  const prompt = `You are a content strategist helping categorize an article.

Article: "${title}"
${notes ? `Notes: ${notes}` : ''}

Suggest 6-8 relevant tags/categories. Consider topic, audience, content type, and industry.
Return only a comma-separated list of short tags (1-3 words each). No explanations.`;
  return callClaude(config, prompt);
}

export async function writeIntro(
  config: AzureConfig,
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
  return callClaude(config, prompt);
}
