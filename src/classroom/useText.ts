/**
 * The text of a room's edition, loaded once when the class is joined.
 *
 * Once, and the whole thing: a student whose network drops keeps reading, and sync
 * carries only ids, so nothing else is needed to follow along.
 */

import { useEffect, useState } from 'react';

import { loadText, loadTranslations, type Line } from './text';

export interface Text {
  lines: Line[];
  loading: boolean;
  error: string | null;
}

export function useText(
  editionId: string | undefined,
  translationEditionId?: string | null,
): Text {
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editionId) { return undefined; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    // A translation that fails to load must not take the class down with it: the source
    // is what the teacher is teaching from, and the English is an aid beneath it.
    const translations = translationEditionId
      ? loadTranslations(editionId, translationEditionId).catch(() => new Map<string, string>())
      : Promise.resolve(new Map<string, string>());
    Promise.all([loadText(editionId), translations])
      .then(([loaded, translated]) => {
        if (cancelled) { return; }
        setLines(loaded.map((line) => {
          const translation = translated.get(line.id);
          return translation ? { ...line, translation } : line;
        }));
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load the text.');
        }
      })
      .finally(() => { if (!cancelled) { setLoading(false); } });
    return () => { cancelled = true; };
  }, [editionId, translationEditionId]);

  return { lines, loading, error };
}
