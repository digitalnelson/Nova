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
