/**
 * Remembering which class this browser is in, so a refresh does not throw anyone out.
 *
 * Without this the class lives only in React state, and a reload — a dropped phone
 * connection, a pull-to-refresh, a laptop that woke from sleep — would send everyone back
 * to the list of classes mid-lesson.
 *
 * Holds the class code only. Who you are, and whether you teach it, come from the Academy
 * login, so there is no name and no host token to keep.
 */

export interface StoredSession {
  code: string;
}

const KEY = 'wbac:session';

/** A forgotten entry cannot trap anyone for longer than a class runs in a day. */
export const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function rememberSession(session: StoredSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...session, at: Date.now() }));
  } catch {
    // Private browsing or blocked storage: a refresh will land on the list of classes.
  }
}

export function forgetSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to forget if storage is unavailable.
  }
}

export function recallSession(now: number = Date.now()): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { return null; }
    const parsed = JSON.parse(raw) as Partial<StoredSession> & { at?: number };
    if (
      typeof parsed.code !== 'string' || !parsed.code
      || typeof parsed.at !== 'number'
      || now - parsed.at > MAX_AGE_MS
    ) {
      return null;
    }
    return { code: parsed.code };
  } catch {
    return null;
  }
}

/**
 * The class to start in, given the page address and what was remembered.
 *
 * A class is resumed only when the **address names it** (`?room=CODE`), which is what the
 * page puts there once someone is inside a class. A refresh keeps that address, so it
 * resumes. A fresh visit to plain `/classroom` (the "Join a live class" button on the
 * schools pages, a bookmark) never resumes: it shows the list of classes, which is where
 * "go back to yours" now lives.
 *
 * `?teach=1` means "start a new class", and a link naming a different class goes there.
 */
export function pickSession(search: string, remembered: StoredSession | null): StoredSession | null {
  if (!remembered) { return null; }
  const params = new URLSearchParams(search);
  if (params.get('teach') === '1') { return null; }
  const asked = params.get('room');
  if (!asked || asked.toUpperCase() !== remembered.code.toUpperCase()) { return null; }
  return remembered;
}
