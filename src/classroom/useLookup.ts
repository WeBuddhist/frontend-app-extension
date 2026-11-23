import { useCallback, useEffect, useState } from 'react';

import { lookup, type LookupResult } from './dictionary';

export type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: LookupResult }
  | { status: 'failed'; error: string };

/**
 * The meaning of `query` in the chosen dictionaries, looked up when either changes.
 *
 * A lookup still on its way when the words change is dropped, so a slow answer about the
 * last words never lands over the new ones.
 */
export function useLookup(query: string | null, dictionaries: string[]) {
  const [state, setState] = useState<LookupState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const key = dictionaries.join(',');

  useEffect(() => {
    if (!query) { setState({ status: 'idle' }); return undefined; }
    const controller = new AbortController();
    setState({ status: 'loading' });
    lookup(query, key.split(','), controller.signal)
      .then((result) => { if (!controller.signal.aborted) { setState({ status: 'done', result }); } })
      .catch((cause: Error) => {
        if (controller.signal.aborted) { return; }
        setState({ status: 'failed', error: cause.message || 'Could not look that up.' });
      });
    return () => controller.abort();
  }, [query, key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
