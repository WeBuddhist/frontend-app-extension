import {
  useEffect, useLayoutEffect, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useIntl } from '@edx/frontend-platform/i18n';
import { Button } from '@openedx/paragon';

import { CloseIcon, LockIcon } from './icons';
import messages from './messages';
import { NOTE_COLORS, type NoteColor, type NoteLayer } from './types';

interface Props {
  isOpen: boolean;
  /** True when making a note; false when looking at or changing one that exists. */
  isNew: boolean;
  /** The words the note is on, shown so it is clear what is being annotated. */
  quote: string;
  layer: NoteLayer;
  initialColor: NoteColor;
  initialBody: string;
  /**
   * What the bubble points at: the selected words' box (in the window's coordinates, as the
   * selection gave it), or the highlight already in the text. Null when the words cannot be
   * found in the text; the bubble then sits in the middle of the screen with no point.
   */
  anchor: DOMRect | Element | null;
  /**
   * For words just selected: the box of each of their lines, in the window's coordinates. The
   * browser's own selection goes as soon as the note box is clicked into, so the words are
   * highlighted again here, in the colour being chosen, until the bubble closes.
   */
  marks?: DOMRect[];
  /**
   * For words just selected: the words themselves. When given, the bubble and the temporary
   * highlight are placed from it, and placed again whenever the text moves under them (a side
   * panel opening beside it, a different text size), rather than left where the words were.
   */
  range?: Range;
  /** Told whenever the note goes from untouched to changed, and back. */
  onChangedChange?: (changed: boolean) => void;
  /** Save. Rejects with a message to show; resolves when it has been stored. */
  onSave: (color: NoteColor, body: string) => Promise<void>;
  /** Delete the note. Only offered for one that exists. */
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

const colorNames = {
  yellow: messages.colorYellow,
  green: messages.colorGreen,
  blue: messages.colorBlue,
  pink: messages.colorPink,
} as const;

/** Gap between the words and the bubble (the point fills it), and the bubble's distance from the screen's edge. */
const GAP = 14;
const EDGE = 16;
const WIDTH = 440;
/** Below this the bubble is a sheet along the bottom of the screen (the stylesheet decides). */
const PHONE = 576;

/** A box in the page's own coordinates, so it moves with the page when it scrolls. */
export interface PageBox { top: number; bottom: number; left: number; right: number }

const toPage = (rect: DOMRect): PageBox => ({
  top: rect.top + window.scrollY,
  bottom: rect.bottom + window.scrollY,
  left: rect.left + window.scrollX,
  right: rect.right + window.scrollX,
});

export interface Placement {
  top: number;
  left: number;
  /** Where the point is, from the bubble's left edge. */
  pointX: number;
  /** Below the words (point on top) or above them (point underneath). */
  side: 'below' | 'above';
}

/**
 * Where the bubble goes: under the words if it fits on the screen there, otherwise over them,
 * centred on them as far as the screen's edges allow, with the point always over the words.
 */
export function place(words: PageBox, width: number, height: number): Placement {
  const viewTop = window.scrollY;
  const viewBottom = window.scrollY + window.innerHeight;
  const centre = (words.left + words.right) / 2;
  const minLeft = window.scrollX + EDGE;
  const maxLeft = window.scrollX + window.innerWidth - EDGE - width;
  const left = Math.max(minLeft, Math.min(centre - width / 2, maxLeft));
  const fitsBelow = words.bottom + GAP + height <= viewBottom - EDGE;
  const roomAbove = words.top - viewTop;
  const roomBelow = viewBottom - words.bottom;
  const side = fitsBelow || roomBelow >= roomAbove ? 'below' : 'above';
  return {
    top: side === 'below' ? words.bottom + GAP : words.top - GAP - height,
    left,
    pointX: Math.max(22, Math.min(centre - left, width - 22)),
    side,
  };
}

/**
 * Making or changing one note, in a speech bubble pointing at the words it is about.
 *
 * A bubble and not a modal, so the note is seen beside its words, as it will be read later, and
 * the page is not dimmed away behind it. It goes under the words if there is room on the screen
 * and over them if not, and moves with the page as it scrolls. On a phone it is a sheet along
 * the bottom of the screen instead: there is no room beside the words for both, and the keyboard
 * comes up under it.
 *
 * Inside, the box to write in is the bubble: one slim row above it (the words, highlighted in the
 * colour picked, with the colours and the close cross) and one below (who can see it, and the
 * buttons). The words are optional: a note with none is a highlight.
 *
 * Escape or the cross closes it. A click elsewhere closes it too, unless something has been
 * changed in it, so a stray click never throws away a half-written note. Ctrl+Enter (⌘+Enter)
 * saves from the box.
 */
const NoteDialog = ({
  isOpen, isNew, quote, layer, initialColor, initialBody, anchor, marks, range, onChangedChange,
  onSave, onDelete, onClose,
}: Props) => {
  const intl = useIntl();
  const [color, setColor] = useState<NoteColor>(initialColor);
  const [body, setBody] = useState(initialBody);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState<PageBox | null>(null);
  const [lines, setLines] = useState<PageBox[]>([]);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLTextAreaElement | null>(null);

  // A different note, or the same one opened again, starts from what that note says.
  useEffect(() => {
    if (isOpen) { setColor(initialColor); setBody(initialBody); setError(null); }
  }, [isOpen, initialColor, initialBody, quote]);

  // Where the words are, and the box of each of their lines for the temporary highlight, in the
  // page's coordinates so they stay on the words as the page scrolls. Found again whenever the
  // text changes size (a side panel sliding in beside it, a larger text size), so the bubble
  // moves with its words. A highlight already in the text is brought onto the screen first: it
  // may be far down a long text when its note is opened from the list of notes.
  useLayoutEffect(() => {
    if (!isOpen) { setWords(null); setLines([]); return undefined; }
    const usable = (rect: DOMRect | undefined) => Boolean(rect && (rect.width > 0 || rect.height > 0));
    const find = (first: boolean) => {
      const rangeBox = range?.getBoundingClientRect?.();
      if (anchor instanceof Element) {
        const rect = anchor.getBoundingClientRect();
        if (first && (rect.top < 80 || rect.bottom > window.innerHeight - 80)) {
          anchor.scrollIntoView?.({ block: 'center' });
        }
        setWords(toPage(anchor.getBoundingClientRect()));
      } else if (range && usable(rangeBox)) {
        setWords(toPage(rangeBox!));
      } else {
        setWords(anchor ? toPage(anchor) : null);
      }
      const boxes = range && typeof range.getClientRects === 'function' && usable(rangeBox)
        ? Array.from(range.getClientRects())
        : marks ?? [];
      const seen = new Set<string>();
      setLines(boxes.filter((rect) => rect.width > 0 && rect.height > 0).map(toPage).filter((box) => {
        const key = [box.top, box.bottom, box.left, box.right].map(Math.round).join(',');
        if (seen.has(key)) { return false; }
        seen.add(key);
        return true;
      }));
    };
    find(true);
    const reader = document.querySelector('.classroom-reader');
    if (!reader || typeof ResizeObserver === 'undefined') { return undefined; }
    const observer = new ResizeObserver(() => find(false));
    observer.observe(reader);
    return () => observer.disconnect();
  }, [isOpen, anchor, marks, range]);

  // Placed once its own size is known, and again when the window changes size.
  useLayoutEffect(() => {
    if (!isOpen) { return undefined; }
    const measure = () => {
      const bubble = bubbleRef.current;
      if (!bubble || !words || window.innerWidth < PHONE) { setPlacement(null); return; }
      const width = Math.min(WIDTH, window.innerWidth - 2 * EDGE);
      setPlacement(place(words, width, bubble.offsetHeight));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isOpen, words]);

  // Ready to write in as soon as it opens.
  useEffect(() => {
    if (isOpen) { boxRef.current?.focus({ preventScroll: true }); }
  }, [isOpen]);

  const changed = color !== initialColor || body !== initialBody;
  const changedRef = useRef(changed);
  changedRef.current = changed;
  const onChangedChangeRef = useRef(onChangedChange);
  onChangedChangeRef.current = onChangedChange;
  useEffect(() => { onChangedChangeRef.current?.(isOpen && changed); }, [isOpen, changed]);
  useEffect(() => () => onChangedChangeRef.current?.(false), []);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape closes it from anywhere; a click elsewhere closes it if nothing has been changed.
  useEffect(() => {
    if (!isOpen) { return undefined; }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { onCloseRef.current(); } };
    const onDown = (event: MouseEvent) => {
      if (bubbleRef.current?.contains(event.target as Node)) { return; }
      if (!changedRef.current) { onCloseRef.current(); }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [isOpen]);

  if (!isOpen) { return null; }

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => run(() => onSave(color, body));
  const title = intl.formatMessage(isNew ? messages.noteDialogNew : messages.noteDialogEdit);

  // Until it is placed (and when there is nowhere to point), it sits in the middle of the screen.
  const style = placement
    ? {
      top: placement.top,
      left: placement.left,
      width: Math.min(WIDTH, window.innerWidth - 2 * EDGE),
      '--note-point-x': `${placement.pointX}px`,
    }
    : undefined;
  const sideClass = placement ? ` classroom-note-bubble--${placement.side}` : ' classroom-note-bubble--floating';

  return createPortal(
    <>
      {lines.map((box) => (
        <span
          key={`${box.top},${box.left}`}
          aria-hidden="true"
          className={`classroom-note-preview classroom-note--${color}`}
          style={{
            top: box.top, left: box.left, width: box.right - box.left, height: box.bottom - box.top,
          }}
        />
      ))}
      <div
        ref={bubbleRef}
        className={`classroom-note-bubble${sideClass}`}
        style={style as React.CSSProperties}
        role="dialog"
        aria-label={title}
      >
        <div className="classroom-note-dialog__top">
          {/* The words, highlighted as they will be. */}
          <figure className="classroom-note-dialog__quote" aria-label={intl.formatMessage(messages.noteQuoteLabel)}>
            <blockquote lang={layer === 'source' ? 'bo' : 'en'}>
              <mark className={`classroom-note-dialog__mark classroom-note--${color}`}>{quote}</mark>
            </blockquote>
          </figure>

          <div className="classroom-note-dialog__colors" role="radiogroup" aria-label={intl.formatMessage(messages.noteColorLabel)}>
            {NOTE_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={option === color}
                aria-label={intl.formatMessage(colorNames[option])}
                className={`classroom-note-dialog__swatch classroom-note--${option}`}
                onClick={() => setColor(option)}
              />
            ))}
          </div>

          <span className="classroom-note-dialog__divider" aria-hidden="true" />
          <button
            type="button"
            className="classroom-note-dialog__close"
            aria-label={intl.formatMessage(messages.close)}
            title={intl.formatMessage(messages.close)}
            onClick={onClose}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <textarea
          ref={boxRef}
          aria-label={intl.formatMessage(messages.noteBodyLabel)}
          className="classroom-note-dialog__box"
          rows={6}
          maxLength={4000}
          value={body}
          placeholder={intl.formatMessage(messages.noteBodyPlaceholder)}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !busy) { e.preventDefault(); save(); }
          }}
        />
        {error && <p className="classroom-page__error" role="alert">{error}</p>}

        <div className="classroom-note-dialog__footer">
          <p className="classroom-note-dialog__help">
            <LockIcon size={14} />
            <span>{intl.formatMessage(messages.noteBodyHelp)}</span>
          </p>
          {onDelete && (
          <Button
            variant="tertiary"
            size="sm"
            className="classroom-note-dialog__delete"
            disabled={busy}
            onClick={() => run(async () => { await onDelete(); })}
          >
            {intl.formatMessage(messages.deleteNote)}
          </Button>
          )}
          <Button variant="tertiary" size="sm" disabled={busy} onClick={onClose}>
            {intl.formatMessage(messages.cancel)}
          </Button>
          <Button variant="primary" size="sm" disabled={busy} onClick={save}>
            {intl.formatMessage(busy ? messages.saving : messages.saveNote)}
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
};

export default NoteDialog;
