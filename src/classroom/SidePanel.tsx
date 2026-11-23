import {
  useEffect, useRef, useState, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { CloseIcon } from './icons';

export type PanelName = 'contents' | 'notes' | 'dictionary';

/** Below this width a panel is the whole screen: there is no room beside the text. */
export const PHONE = 576;

/** From this width the text moves over beside an open panel; below it, the panel lies over the text. */
export const WIDE = 960;

interface Props {
  id?: string;
  title: string;
  /** The close button's accessible name. */
  closeLabel: string;
  onClose: () => void;
  /** A modifier class, such as `classroom-drawer--notes`. */
  className?: string;
  children: ReactNode;
}

/**
 * A panel down the right-hand side of the page: the contents, the student's notes, or the
 * dictionary. One at a time; the page decides which (see `ClassroomPage`).
 *
 * A panel and not a modal, because each is something to keep open while reading: a map of the
 * text, the list of notes, the meaning of the last words looked up. The page stays usable
 * beside it. On a wide screen the text moves over to make room; on a phone the panel is the
 * whole screen.
 *
 * Rendered into the page body, not where it is used: the buttons that open panels sit in the
 * sticky header, and a `position: fixed` element inside something sticky or transformed is
 * fixed to *that*, not to the window.
 */
const SidePanel = ({
  id, title, closeLabel, onClose, className, children,
}: Props) => {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // On opening, keyboard focus goes into the panel, and the panel's header is made as tall as
  // the site's top bar, so the rule under both is one line. On closing, focus goes back to where
  // it was (the button that opened it, usually), rather than being lost to the page, as long as
  // it has not since moved somewhere else on purpose.
  const panelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    return () => {
      const now = document.activeElement;
      const lost = !now || now === document.body || Boolean(panel?.contains(now));
      if (lost && before?.isConnected) { before.focus({ preventScroll: true }); }
    };
  }, []);
  useEffect(() => {
    const siteHeader = Array.from(document.querySelectorAll('header'))
      .find((el) => !el.closest('.classroom-drawer') && !el.closest('.classroom-page'));
    const bottom = siteHeader ? siteHeader.getBoundingClientRect().bottom : 0;
    setHeaderHeight(bottom >= 48 && bottom <= 240 ? Math.round(bottom) : null);
    closeRef.current?.focus();
  }, []);

  // Escape puts it away, from anywhere on the page, unless a modal or the note bubble is open
  // over it: that Escape is theirs.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') { return; }
      if (document.querySelector('[role="dialog"][aria-modal="true"], .classroom-note-bubble')) { return; }
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return createPortal(
    <aside
      ref={panelRef}
      id={id}
      className={`classroom-drawer${className ? ` ${className}` : ''}`}
      role="dialog"
      aria-label={title}
    >
      <header
        className="classroom-drawer__header"
        style={headerHeight ? { height: headerHeight } : undefined}
      >
        <h2 className="classroom-drawer__title">{title}</h2>
        <button
          ref={closeRef}
          type="button"
          className="classroom-drawer__close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <CloseIcon size={20} />
        </button>
      </header>
      {children}
    </aside>,
    document.body,
  );
};

export default SidePanel;
