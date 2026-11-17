/**
 * Watching what the student has selected in the text.
 *
 * Reports a selection only when a note could be made on it (see `selectionToAnchor`), and
 * says so while one exists, because the page must hold still then: following the teacher
 * scrolls the screen, and a screen that moves under a half-made selection loses it.
 */

import { useCallback, useEffect, useState } from 'react';

import { selectionToAnchor, type SelectionResult } from './anchors';

export type UsableSelection = Extract<SelectionResult, { ok: true }>;

/** Wait for a selection to settle: on a phone the handles are dragged, and every step of the
 * drag fires an event. */
const SETTLE_MS = 150;

export function useNoteSelection(enabled: boolean) {
  const [selection, setSelection] = useState<UsableSelection | null>(null);

  const read = useCallback(() => {
    const result = selectionToAnchor(window.getSelection(), document.querySelector('.classroom-reader'));
    setSelection(result.ok ? result : null);
  }, []);

  useEffect(() => {
    if (!enabled) { setSelection(null); return undefined; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { clearTimeout(timer); timer = setTimeout(read, SETTLE_MS); };
    document.addEventListener('selectionchange', soon);
    // The popup is placed from the selection's box, so it must follow the page when it
    // scrolls, or it is left hanging where the words used to be.
    window.addEventListener('scroll', soon, true);
    window.addEventListener('resize', soon);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', soon);
      window.removeEventListener('scroll', soon, true);
      window.removeEventListener('resize', soon);
    };
  }, [enabled, read]);

  /** Drop the selection, in the page and in what is remembered of it. */
  const clear = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, []);

  return { selection, clear };
}
