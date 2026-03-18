import Anthropic from '@anthropic-ai/sdk';

export interface AIDebugInfo {
  endpoint: string;
  deployment: string;
  keyLength: number;
  status: number;
  requestBody: object;
  rawResponse: string;
}

export interface AIResponse {
  content: string;
  error?: string;
  debugInfo?: AIDebugInfo;
}

interface AzureConfig {
  endpoint: string; // base URL, e.g. https://resource.services.ai.azure.com/anthropic/
  apiKey: string;
  deployment: string; // model deployment name, e.g. claude-sonnet-4-6
}

function makeClient(config: AzureConfig): Anthropic {
  // Strip trailing /v1/messages if user pasted the full URL
  const baseURL = config.endpoint.trim().replace(/\/v1\/messages(\?.*)?$/, '');
  return new Anthropic({
    baseURL,
    apiKey: config.apiKey,
    // Azure AI Foundry uses 'api-key' header instead of Anthropic's 'x-api-key'
    defaultHeaders: { 'api-key': config.apiKey },
    // Azure requires the api-version as a query param
    defaultQuery: { 'api-version': '2023-06-01' },
    dangerouslyAllowBrowser: true,
  });
}

async function callClaude(config: AzureConfig, prompt: string): Promise<AIResponse> {
  const client = makeClient(config);
  const requestBody = {
    model: config.deployment,
    max_tokens: 1500,
    messages: [{ role: 'user' as const, content: prompt }],
  };
  const keyLength = config.apiKey?.length ?? 0;
  console.log('[AI] baseURL:', config.endpoint);
  console.log('[AI] deployment:', config.deployment);
  console.log('[AI] apiKey length:', keyLength);

  try {
    const message = await client.messages.create(requestBody);
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return { content: text };
  } catch (e: any) {
    // Anthropic SDK throws structured errors
    const status = e.status ?? 0;
    const rawResponse = e.message ?? String(e);
    console.log('[AI] error status:', status);
    console.log('[AI] error:', rawResponse);
    return {
      content: '',
      error: `HTTP ${status || 'Network error'}`,
      debugInfo: {
        endpoint: config.endpoint,
        deployment: config.deployment,
        keyLength,
        status,
        requestBody,
        rawResponse: e.error ? JSON.stringify(e.error) : rawResponse,
      },
    };
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
