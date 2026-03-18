/**
 * Nova Debug Logger
 *
 * A lightweight persistent logger that stores timestamped entries in
 * AsyncStorage so they can be viewed from the Settings screen even
 * after the originating component has unmounted.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGS_KEY = '@nova/debug_logs';
const MAX_ENTRIES = 500;

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  ts: string;       // ISO timestamp
  level: LogLevel;
  tag: string;      // e.g. '[IdeaScreen]', '[Storage]'
  message: string;
}

// In-memory buffer (fast access, no await needed for writes)
let _buffer: LogEntry[] = [];
let _listeners: Array<() => void> = [];
let _hydrated = false;

/** Subscribe to log changes (for live UI updates). Returns unsubscribe fn. */
export function subscribeToLogs(listener: () => void): () => void {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}

function notify() {
  _listeners.forEach((l) => l());
}

/** Hydrate from AsyncStorage once on first call. */
async function hydrate() {
  if (_hydrated) return;
  _hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(LOGS_KEY);
    if (raw) {
      const parsed: LogEntry[] = JSON.parse(raw);
      // Prepend persisted entries (newer in-memory entries take precedence)
      _buffer = [...parsed, ..._buffer].slice(-MAX_ENTRIES);
      notify();
    }
  } catch {
    // ignore hydration errors
  }
}

async function persist() {
  try {
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(_buffer.slice(-MAX_ENTRIES)));
  } catch {
    // ignore persistence errors
  }
}

function addEntry(level: LogLevel, tag: string, parts: unknown[]) {
  const message = parts
    .map((p) => {
      if (p === null) return 'null';
      if (p === undefined) return 'undefined';
      if (typeof p === 'object') {
        try { return JSON.stringify(p); } catch { return String(p); }
      }
      return String(p);
    })
    .join(' ');

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    tag,
    message,
  };

  _buffer.push(entry);
  if (_buffer.length > MAX_ENTRIES) {
    _buffer = _buffer.slice(-MAX_ENTRIES);
  }

  // Mirror to console
  const line = `${entry.ts} ${tag} ${message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);

  notify();
  persist(); // fire-and-forget
}

/** Initialise logger (call once at app startup or lazily). */
export function initLogger() {
  hydrate();
}

/** Create a tagged logger instance. */
export function createLogger(tag: string) {
  return {
    info: (...parts: unknown[]) => addEntry('info', tag, parts),
    warn: (...parts: unknown[]) => addEntry('warn', tag, parts),
    error: (...parts: unknown[]) => addEntry('error', tag, parts),
    debug: (...parts: unknown[]) => addEntry('debug', tag, parts),
  };
}

/** Get a snapshot of current log entries (newest first). */
export function getLogs(): LogEntry[] {
  return [..._buffer].reverse();
}

/** Clear all logs. */
export async function clearLogs(): Promise<void> {
  _buffer = [];
  notify();
  try {
    await AsyncStorage.removeItem(LOGS_KEY);
  } catch {
    // ignore
  }
}
