import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArticleIdea, AppSettings, SavedPaper } from './types';

const IDEAS_KEY = '@nova/ideas';
const SETTINGS_KEY = '@nova/settings';

export async function getIdeas(): Promise<ArticleIdea[]> {
  const raw = await AsyncStorage.getItem(IDEAS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveIdea(idea: ArticleIdea): Promise<void> {
  const ideas = await getIdeas();
  const idx = ideas.findIndex((i) => i.id === idea.id);
  if (idx >= 0) {
    ideas[idx] = idea;
  } else {
    ideas.unshift(idea);
  }
  await AsyncStorage.setItem(IDEAS_KEY, JSON.stringify(ideas));
}

export async function deleteIdea(id: string): Promise<void> {
  const ideas = await getIdeas();
  const filtered = ideas.filter((i) => i.id !== id);
  await AsyncStorage.setItem(IDEAS_KEY, JSON.stringify(filtered));
}

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  return raw
    ? JSON.parse(raw)
    : {
        azureEndpoint: '',
        azureApiKey: '',
        azureDeployment: 'claude-opus-4-6',
        imageEndpoint: '',
        imageApiKey: '',
        imageDeployment: 'dall-e-3',
        wordpressUrl: '',
        wordpressUsername: '',
        wordpressAppPassword: '',
      };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ─── ArXiv saved papers ───────────────────────────────────────────────────────

const PAPERS_KEY = '@nova/papers';

export async function getSavedPapers(): Promise<SavedPaper[]> {
  const raw = await AsyncStorage.getItem(PAPERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getSavedPaper(paperId: string): Promise<SavedPaper | null> {
  const papers = await getSavedPapers();
  return papers.find((p) => p.paper.id === paperId) ?? null;
}

export async function savePaper(saved: SavedPaper): Promise<void> {
  const papers = await getSavedPapers();
  const idx = papers.findIndex((p) => p.paper.id === saved.paper.id);
  if (idx >= 0) {
    papers[idx] = saved;
  } else {
    papers.unshift(saved);
  }
  await AsyncStorage.setItem(PAPERS_KEY, JSON.stringify(papers));
}

export async function deleteSavedPaper(paperId: string): Promise<void> {
  const papers = await getSavedPapers();
  const filtered = papers.filter((p) => p.paper.id !== paperId);
  await AsyncStorage.setItem(PAPERS_KEY, JSON.stringify(filtered));
}
