export type IdeaStatus = 'draft' | 'outlined' | 'in-progress' | 'published';

export interface AIContent {
  outline?: string;
  intro?: string;
  improvedTitles?: string[];
  suggestedTags?: string[];
}

export interface ArticleIdea {
  id: string;
  title: string;
  notes: string;
  tags: string[];
  status: IdeaStatus;
  aiContent?: AIContent;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  anthropicApiKey: string;
  wordpressUrl: string;
  wordpressUsername: string;
  wordpressAppPassword: string;
}

export type AIAction = 'outline' | 'titles' | 'tags' | 'intro';
