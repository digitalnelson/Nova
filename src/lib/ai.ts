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

// ─── Image Generation ─────────────────────────────────────────────────────────

interface ImageConfig {
  endpoint: string;   // Azure OpenAI endpoint e.g. https://resource.openai.azure.com/
  apiKey: string;
  deployment: string; // e.g. dall-e-3
}

export interface HeroImageResponse {
  dataUri?: string;   // base64 data URI — persists across sessions
  error?: string;
}

/** Step 1: Ask Claude to craft an optimised DALL-E prompt for the article */
async function buildImagePrompt(
  config: AzureConfig,
  title: string,
  notes: string
): Promise<string> {
  const res = await callClaude(config, `You are creating a DALL-E 3 prompt for a hero image for an article on aipsychmd.com — a professional blog about AI and psychiatry.

Article title: "${title}"
${notes ? `Notes: ${notes}` : ''}

Write a single DALL-E 3 image generation prompt (2–4 sentences) for a wide-format (16:9) editorial hero image that:
- Captures the essence of the article topic visually
- Has a clean, modern, professional aesthetic suitable for a medical/tech publication
- Uses abstract or conceptual imagery — NO text, NO real faces, NO identifiable people
- Fits a dark, sophisticated palette (deep blues, purples, cool grays, with subtle warm accents)
- Could include: abstract neural networks, brain/mind imagery, flowing data visualisations, clinical symbols combined with technology motifs, calm yet intelligent atmosphere

Return ONLY the prompt text, nothing else.`);
  return res.content || `Abstract digital illustration representing ${title}, clinical and technological, deep blue and purple palette, wide format, no text, no people`;
}

/** Step 2: Call Azure OpenAI DALL-E 3 API and download the image as a base64 data URI */
export async function generateHeroImage(
  claudeConfig: AzureConfig,
  imageConfig: ImageConfig,
  title: string,
  notes: string
): Promise<HeroImageResponse> {
  if (!imageConfig.endpoint || !imageConfig.apiKey) {
    return { error: 'Image generation is not configured. Add your Azure OpenAI endpoint and key in Settings.' };
  }

  // Build prompt with Claude first
  const prompt = await buildImagePrompt(claudeConfig, title, notes);
  console.log('[Image] DALL-E prompt:', prompt);

  // Normalise endpoint
  const base = imageConfig.endpoint.trim().replace(/\/$/, '');
  const url = `${base}/openai/deployments/${imageConfig.deployment}/images/generations?api-version=2024-02-01`;

  let imageUrl: string;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': imageConfig.apiKey,
      },
      body: JSON.stringify({
        prompt,
        n: 1,
        size: '1792x1024',
        quality: 'hd',
        style: 'natural',
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.log('[Image] API error:', resp.status, text);
      return { error: `Image API error ${resp.status}: ${text.slice(0, 200)}` };
    }

    const data = await resp.json();
    imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) {
      return { error: 'No image URL in response' };
    }
  } catch (e: any) {
    return { error: `Network error: ${e.message}` };
  }

  // Download and convert to base64 data URI so it persists
  try {
    const imgResp = await fetch(imageUrl);
    const arrayBuffer = await imgResp.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < uint8.length; i += chunk) {
      binary += String.fromCharCode(...(uint8.subarray(i, i + chunk) as unknown as number[]));
    }
    const base64 = btoa(binary);
    return { dataUri: `data:image/png;base64,${base64}` };
  } catch (e: any) {
    // Fallback: return the temporary URL if download fails
    console.log('[Image] download failed, returning URL:', e.message);
    return { dataUri: imageUrl };
  }
}

// ─── AI Collaborator ──────────────────────────────────────────────────────────

export type CollaboratorOperation =
  | 'improve'
  | 'strengthen-intro'
  | 'medical-review'
  | 'seo-optimize'
  | 'add-section'
  | 'custom';

const COLLABORATOR_PROMPTS: Record<CollaboratorOperation, string> = {
  'improve': `You are an expert medical writer and editor for aipsychmd.com, a professional blog about AI and psychiatry for clinicians and healthcare technology professionals.

Improve the writing quality, clarity, flow, and style of the article. Fix grammar issues, strengthen sentence structure, smooth transitions, and make the prose more engaging and authoritative.
Do not change the structure or meaning — only improve how it reads.`,

  'strengthen-intro': `You are an expert medical writer for aipsychmd.com, a professional blog about AI and psychiatry.

Rewrite or significantly strengthen the introductory section (first paragraphs before the first heading). Make it immediately compelling: open with a striking fact, a clinical scenario, or a provocative question. Establish stakes quickly and hook the reader into reading further.
Keep the rest of the article exactly as-is.`,

  'medical-review': `You are a board-certified psychiatrist and medical AI researcher reviewing a blog post for aipsychmd.com.

Review the article and:
- Add clinical accuracy and nuance where needed
- Insert appropriate caveats about AI limitations in mental health contexts
- Add relevant clinical context or real-world applicability
- Ensure responsible framing (no hype, no unsubstantiated claims)
- The audience is informed professionals — no need to over-explain basic concepts`,

  'seo-optimize': `You are an SEO specialist for healthcare content writing for aipsychmd.com.

Optimise this article for search without compromising quality:
- Strengthen H1/H2/H3 headings to be more descriptive and keyword-rich
- Ensure the intro and meta-description area contains the core topic naturally
- Add a FAQ section at the end if it would help (max 3 questions)
- Naturally weave in semantic keywords related to the topic
- Target audience: psychiatrists, mental health professionals, healthcare technology researchers`,

  'add-section': `You are an expert medical writer for aipsychmd.com, a professional blog about AI and psychiatry.

Add a new, well-researched section to the article based on the instruction below. Place it where it fits logically in the flow. Use appropriate H2 or H3 heading.`,

  'custom': `You are an expert medical writer and editor for aipsychmd.com, a professional blog about AI and psychiatry.

Follow the instruction below precisely.`,
};

export async function collaborateOnArticle(
  config: AzureConfig,
  operation: CollaboratorOperation,
  articleHtml: string,
  title: string,
  notes: string,
  instruction?: string
): Promise<AIResponse> {
  const systemContext = COLLABORATOR_PROMPTS[operation];

  const instructionBlock = instruction
    ? `\n\nInstruction: ${instruction}`
    : '';

  const prompt = `${systemContext}${instructionBlock}

Article title: "${title}"
${notes ? `Brief/notes: ${notes}` : ''}

Current article HTML:
${articleHtml}

IMPORTANT RULES:
- Return ONLY the complete, modified HTML for the article body
- Do NOT wrap in markdown code blocks
- Do NOT include explanations, preamble, or notes — just the HTML
- Preserve all existing formatting tags unless the operation requires changing them
- The HTML will be set directly into a TipTap editor`;

  // Use higher token limit for full document rewrites
  const client = makeClient(config);
  const requestBody = {
    model: config.deployment,
    max_tokens: 4000,
    messages: [{ role: 'user' as const, content: prompt }],
  };

  try {
    const message = await client.messages.create(requestBody);
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    // Strip accidental markdown fences if Claude adds them despite instructions
    const clean = text.replace(/^```html\s*/i, '').replace(/\s*```$/i, '').trim();
    return { content: clean };
  } catch (e: any) {
    const status = e.status ?? 0;
    const rawResponse = e.message ?? String(e);
    return {
      content: '',
      error: `HTTP ${status || 'Network error'}`,
      debugInfo: {
        endpoint: config.endpoint,
        deployment: config.deployment,
        keyLength: config.apiKey?.length ?? 0,
        status,
        requestBody,
        rawResponse: e.error ? JSON.stringify(e.error) : rawResponse,
      },
    };
  }
}

// ─── Writing Buddy ────────────────────────────────────────────────────────────

export type BuddyAction = 'insert' | 'replace' | 'info';

export interface BuddyResponse {
  action: BuddyAction;
  label: string;
  content: string;
  error?: string;
  debugInfo?: AIDebugInfo;
}

export async function buddyAssist(
  config: AzureConfig,
  command: string,
  title: string,
  notes: string,
  articleHtml: string
): Promise<BuddyResponse> {
  const prompt = `You are a writing assistant embedded in a rich text article editor for aipsychmd.com, a professional blog about AI and psychiatry for clinicians and healthcare technology professionals.

Article title: "${title}"
${notes ? `Brief/notes: ${notes}` : ''}
Current article HTML:
${articleHtml || '(empty — no content yet)'}

The writer has sent this command: "${command}"

Choose the appropriate action and respond with JSON in EXACTLY this format (no markdown, no code fences):
{"action":"insert"|"replace"|"info","label":"brief label max 5 words","content":"..."}

Rules:
- "insert": writer wants to ADD new content (write intro, generate outline, add a new section, etc). Return an HTML snippet to append to the article.
- "replace": writer wants to MODIFY the existing article (improve writing, SEO optimize, medical review, strengthen intro, fix grammar, etc). Return the complete updated article HTML.
- "info": for title suggestions, tag ideas, word count analysis, or questions. Return plain readable text.
For "insert" and "replace": return clean HTML, no markdown fences.
For "info": return plain text, no HTML.
Return ONLY the JSON object.`;

  const client = makeClient(config);
  const requestBody = {
    model: config.deployment,
    max_tokens: 4000,
    messages: [{ role: 'user' as const, content: prompt }],
  };

  try {
    const message = await client.messages.create(requestBody);
    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as { action: BuddyAction; label: string; content: string };
    return { action: parsed.action, label: parsed.label, content: parsed.content };
  } catch (e: any) {
    const status = e.status ?? 0;
    const rawResponse = e.message ?? String(e);
    return {
      action: 'info',
      label: 'Error',
      content: '',
      error: `HTTP ${status || 'Network error'}`,
      debugInfo: {
        endpoint: config.endpoint,
        deployment: config.deployment,
        keyLength: config.apiKey?.length ?? 0,
        status,
        requestBody,
        rawResponse: e.error ? JSON.stringify(e.error) : rawResponse,
      },
    };
  }
}
