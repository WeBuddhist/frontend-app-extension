/**
 * The text of a room's edition, loaded once when the class is joined.
 *
 * Once, and the whole thing: a student whose network drops keeps reading, and sync
 * carries only ids, so nothing else is needed to follow along.
 */

import { useEffect, useState } from 'react';

import { loadText, type Line } from './text';

export interface Text {
  lines: Line[];
  loading: boolean;
  error: string | null;
}

export function useText(editionId: string | undefined): Text {
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editionId) { return undefined; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadText(editionId)
      .then((loaded) => { if (!cancelled) { setLines(loaded); } })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load the text.');
        }
      })
      .finally(() => { if (!cancelled) { setLoading(false); } });
    return () => { cancelled = true; };
  }, [editionId]);

  return { lines, loading, error };
}
