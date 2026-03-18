export type IdeaStatus = 'draft' | 'outlined' | 'in-progress' | 'published';

export interface AIContent {
  outline?: string;
  intro?: string;
  improvedTitles?: string[];
  suggestedTags?: string[];
}

export interface Revision {
  id: string;
  timestamp: string; // ISO string
  source: 'user' | 'ai';
  label: string; // e.g. 'Auto-save', 'Saved', 'Before: Improve Writing'
  content: string; // full HTML snapshot
}

export interface ArticleIdea {
  id: string;
  title: string;
  notes: string;
  content: string;
  heroImageDataUri?: string; // base64 data URI — persists without expiry
  tags: string[];
  status: IdeaStatus;
  aiContent?: AIContent;
  revisions?: Revision[]; // capped at MAX_REVISIONS
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  azureEndpoint: string;
  azureApiKey: string;
  azureDeployment: string;
  // Image generation (Azure OpenAI DALL-E 3)
  imageEndpoint: string;   // e.g. https://resource.openai.azure.com/
  imageApiKey: string;
  imageDeployment: string; // e.g. dall-e-3
  wordpressUrl: string;
  wordpressUsername: string;
  wordpressAppPassword: string;
}

export type AIAction = 'outline' | 'titles' | 'tags' | 'intro';
