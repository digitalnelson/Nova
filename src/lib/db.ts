import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseSync } from 'expo-sqlite';

export const db = openDatabaseSync('nova.db');

db.execSync(`
  CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    saved_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ignored_papers (
    id TEXT PRIMARY KEY
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ─── AsyncStorage → SQLite one-time migration ─────────────────────────────────

const MIGRATION_KEY = '__migration_v1_done__';

export async function runMigrationIfNeeded(): Promise<void> {
  const already = db.getFirstSync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [MIGRATION_KEY]
  );
  if (already) return;

  // Ideas
  try {
    const raw = await AsyncStorage.getItem('@nova/ideas');
    if (raw) {
      const ideas: any[] = JSON.parse(raw);
      for (const idea of ideas) {
        db.runSync(
          'INSERT OR IGNORE INTO ideas (id, data, created_at) VALUES (?, ?, ?)',
          [idea.id, JSON.stringify(idea), idea.createdAt ?? new Date().toISOString()]
        );
      }
    }
  } catch (e) { console.log('[Migration] ideas:', e); }

  // Settings
  try {
    const raw = await AsyncStorage.getItem('@nova/settings');
    if (raw) {
      db.runSync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('settings', ?)",
        [raw]
      );
    }
  } catch (e) { console.log('[Migration] settings:', e); }

  // Saved papers
  try {
    const raw = await AsyncStorage.getItem('@nova/papers');
    if (raw) {
      const papers: any[] = JSON.parse(raw);
      for (const saved of papers) {
        db.runSync(
          'INSERT OR IGNORE INTO papers (id, data, saved_at) VALUES (?, ?, ?)',
          [saved.paper.id, JSON.stringify(saved), saved.savedAt ?? new Date().toISOString()]
        );
      }
    }
  } catch (e) { console.log('[Migration] papers:', e); }

  // Ignored paper IDs
  try {
    const raw = await AsyncStorage.getItem('@nova/ignored-papers');
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      for (const id of ids) {
        db.runSync('INSERT OR IGNORE INTO ignored_papers (id) VALUES (?)', [id]);
      }
    }
  } catch (e) { console.log('[Migration] ignored-papers:', e); }

  // Mark done
  db.runSync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, 'true')",
    [MIGRATION_KEY]
  );

  console.log('[Migration] AsyncStorage → SQLite complete');
}
