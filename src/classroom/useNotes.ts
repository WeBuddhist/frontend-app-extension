/**
 * A student's private notes in one class: loaded once, changed through the server.
 *
 * Every change goes to the server first and is shown only once it has been accepted, so
 * what is on screen is what is stored, and a refusal (a lapsed login, a full quota) is shown
 * rather than quietly lost. Each call rejects with a message the caller can display.
 */

import {
  useCallback, useEffect, useMemo, useState,
} from 'react';

import {
  createNote, deleteNote, listNotes, updateNote,
} from './api';
import type { NewNote, Note, NoteColor } from './types';

export interface Notes {
  notes: Note[];
  loading: boolean;
  /** Why the notes could not be loaded. Changing one reports its own failure. */
  error: string | null;
  create: (note: NewNote) => Promise<Note>;
  update: (id: string, change: { color?: NoteColor; body?: string | null }) => Promise<Note>;
  remove: (id: string) => Promise<void>;
}

/** Oldest first, which is the order overlapping highlights are drawn in. */
const oldestFirst = (a: Note, b: Note) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '');

export function useNotes(code: string, enabled: boolean): Notes {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) { return undefined; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    listNotes(code)
      .then((loaded) => { if (!cancelled) { setNotes([...loaded].sort(oldestFirst)); } })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load your notes.');
        }
      })
      .finally(() => { if (!cancelled) { setLoading(false); } });
    return () => { cancelled = true; };
  }, [code, enabled]);

  const create = useCallback(async (note: NewNote) => {
    const made = await createNote(code, note);
    setNotes((previous) => [...previous, made].sort(oldestFirst));
    return made;
  }, [code]);

  const update = useCallback(async (id: string, change: { color?: NoteColor; body?: string | null }) => {
    const changed = await updateNote(code, id, change);
    setNotes((previous) => previous.map((n) => (n.id === id ? changed : n)));
    return changed;
  }, [code]);

  const remove = useCallback(async (id: string) => {
    await deleteNote(code, id);
    setNotes((previous) => previous.filter((n) => n.id !== id));
  }, [code]);

  return useMemo(
    () => ({
      notes, loading, error, create, update, remove,
    }),
    [notes, loading, error, create, update, remove],
  );
}
