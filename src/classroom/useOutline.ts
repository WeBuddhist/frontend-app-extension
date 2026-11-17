/** The room's table of contents, loaded once alongside the text. */

import { useEffect, useState } from 'react';

import { loadOutline, type OutlineEntry } from './outline';

export function useOutline(editionId: string | undefined): OutlineEntry[] {
  const [outline, setOutline] = useState<OutlineEntry[]>([]);

  useEffect(() => {
    if (!editionId) { return undefined; }
    let cancelled = false;
    // loadOutline never rejects: no contents is an ordinary state, not a failure.
    loadOutline(editionId).then((loaded) => { if (!cancelled) { setOutline(loaded); } });
    return () => { cancelled = true; };
  }, [editionId]);

  return outline;
}
