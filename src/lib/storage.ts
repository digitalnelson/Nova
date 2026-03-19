import { db } from './db';
import { ArticleIdea, AppSettings, SavedPaper } from './types';

// ─── Article Ideas ─────────────────────────────────────────────────────────────

export async function getIdeas(): Promise<ArticleIdea[]> {
  const rows = await db.getAllAsync<{ data: string }>(
    'SELECT data FROM ideas ORDER BY created_at DESC'
  );
  return rows.map((r) => JSON.parse(r.data));
}

export async function saveIdea(idea: ArticleIdea): Promise<void> {
  const json = JSON.stringify(idea);
  await db.runAsync(
    'INSERT OR IGNORE INTO ideas (id, data, created_at) VALUES (?, ?, ?)',
    [idea.id, json, idea.createdAt]
  );
  await db.runAsync('UPDATE ideas SET data = ? WHERE id = ?', [json, idea.id]);
}

export async function deleteIdea(id: string): Promise<void> {
  await db.runAsync('DELETE FROM ideas WHERE id = ?', [id]);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
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

export async function getSettings(): Promise<AppSettings> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'settings'"
  );
  return row ? JSON.parse(row.value) : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('settings', ?)",
    [JSON.stringify(settings)]
  );
}

// ─── ArXiv saved papers ────────────────────────────────────────────────────────

export async function getSavedPapers(): Promise<SavedPaper[]> {
  const rows = await db.getAllAsync<{ data: string }>(
    'SELECT data FROM papers ORDER BY saved_at DESC'
  );
  return rows.map((r) => JSON.parse(r.data));
}

export async function getSavedPaper(paperId: string): Promise<SavedPaper | null> {
  const row = await db.getFirstAsync<{ data: string }>(
    'SELECT data FROM papers WHERE id = ?',
    [paperId]
  );
  return row ? JSON.parse(row.data) : null;
}

export async function savePaper(saved: SavedPaper): Promise<void> {
  const json = JSON.stringify(saved);
  await db.runAsync(
    'INSERT OR IGNORE INTO papers (id, data, saved_at) VALUES (?, ?, ?)',
    [saved.paper.id, json, saved.savedAt]
  );
  await db.runAsync('UPDATE papers SET data = ? WHERE id = ?', [json, saved.paper.id]);
}

export async function deleteSavedPaper(paperId: string): Promise<void> {
  await db.runAsync('DELETE FROM papers WHERE id = ?', [paperId]);
}

// ─── Ignored / reviewed papers ────────────────────────────────────────────────

export async function getIgnoredPaperIds(): Promise<string[]> {
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM ignored_papers');
  return rows.map((r) => r.id);
}

export async function ignorePaper(paperId: string): Promise<void> {
  await db.runAsync('INSERT OR IGNORE INTO ignored_papers (id) VALUES (?)', [paperId]);
}

export async function clearIgnoredPapers(): Promise<void> {
  await db.runAsync('DELETE FROM ignored_papers');
}
