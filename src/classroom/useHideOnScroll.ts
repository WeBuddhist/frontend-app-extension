import { useEffect, useState, type RefObject } from 'react';

/** How far the page must move before the direction counts, so a tremor of the trackpad does not flicker the header. */
const THRESHOLD = 8;

/** Near the top of the page the header is always shown. */
const ALWAYS_SHOWN_ABOVE = 120;

/**
 * Whether a sticky header should be tucked away: yes while the reader scrolls down through the
 * text (it is in the way of what they are reading), no the moment they scroll back up (they are
 * looking for something up there), and always near the top of the page.
 *
 * Never while keyboard focus is inside the header (an open menu, a focused button): hiding it
 * would take focus away silently.
 */
export function useHideOnScroll(header?: RefObject<HTMLElement>): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const now = window.scrollY;
      if (now < ALWAYS_SHOWN_ABOVE) {
        setHidden(false);
      } else if (now - last > THRESHOLD) {
        if (header?.current?.contains(document.activeElement)) { return; }
        setHidden(true);
      } else if (last - now > THRESHOLD) {
        setHidden(false);
      } else {
        return;
      }
      last = now;
    };

    const onScroll = () => {
      if (!frame) { frame = window.requestAnimationFrame(update); }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) { window.cancelAnimationFrame(frame); }
    };
  }, [header]);

  return hidden;
}
