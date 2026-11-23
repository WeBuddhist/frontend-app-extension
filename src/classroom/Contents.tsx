import {
  useEffect, useId, useMemo, useRef, useState,
} from 'react';
import { useIntl } from '@edx/frontend-platform/i18n';

import { ChevronIcon, ContentsIcon } from './icons';
import SidePanel, { PHONE } from './SidePanel';
import messages from './messages';
import {
  ancestorIds, hasChildren, splitNumber, visibleEntries, type OutlineEntry,
} from './outline';

interface Props {
  outline: OutlineEntry[];
  /** Go to a heading. */
  onJump: (segmentId: string) => void;
  /** The line the class is on now, so the heading it falls under can be marked. */
  currentSegmentId?: string | null;
  /** Where each line comes in the text, to tell which heading the current line is under. */
  order?: Map<string, number>;
  /**
   * Whether the drawer is open, when the page decides (it keeps one side panel open at a
   * time). Left out, the drawer keeps track itself.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * The contents, in a drawer down the right-hand side: pick a heading and go to it.
 *
 * A drawer and not a menu, because a table of contents is long (one of these runs to dozens
 * of headings, some of them wrapping) and a floating menu covers the very text it is for.
 * Down the side it can be kept open: a teacher moving through a text can leave it there and
 * use it as a map, with **the heading the class is under marked** so it says where they are.
 *
 * It is a tree, and long ones are mostly deep: a chapter may have forty headings beneath it,
 * most of which nobody wants to scroll past. So sections fold. At first everything is open and sections
 * can be folded; **the way down to where the class is** is always reopened as the class moves, so
 * the marked heading is never hidden inside a fold.
 *
 * For the teacher a jump also moves the class there, since a long text (one of these runs past
 * a thousand lines) cannot be taught by scrolling and pressing. For a student it only moves
 * their own view, so looking ahead never drags anyone else along.
 */
const Contents = ({
  outline, onJump, currentSegmentId = null, order, open: openProp, onOpenChange,
}: Props) => {
  const intl = useIntl();
  const [openOwn, setOpenOwn] = useState(false);
  const open = openProp ?? openOwn;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) { setOpenOwn(next); }
    onOpenChange?.(next);
  };
  // Everything starts open; a different outline (another text) opens afresh.
  const [unfolded, setUnfolded] = useState<Set<string>>(() => new Set(outline.map((entry) => entry.id)));
  useEffect(() => {
    setUnfolded(new Set(outline.map((entry) => entry.id)));
  }, [outline]);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  // The last heading at or before the line the class is on: the one it is under.
  const activeIndex = useMemo(() => {
    const here = currentSegmentId ? order?.get(currentSegmentId) : undefined;
    if (here === undefined || !order) { return -1; }
    let found = -1;
    outline.forEach((entry, index) => {
      const at = entry.segmentId ? order.get(entry.segmentId) : undefined;
      if (at !== undefined && at <= here) { found = index; }
    });
    return found;
  }, [outline, currentSegmentId, order]);
  const activeId = activeIndex >= 0 ? outline[activeIndex].id : null;

  // The way down to the marked heading is always open, as the class moves.
  useEffect(() => {
    if (activeIndex < 0) { return; }
    setUnfolded((previous) => {
      const needed = ancestorIds(outline, activeIndex).filter((id) => !previous.has(id));
      return needed.length === 0 ? previous : new Set([...previous, ...needed]);
    });
  }, [outline, activeIndex]);

  const shown = useMemo(() => visibleEntries(outline, unfolded), [outline, unfolded]);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  // On opening, the heading the class is under is brought into view: with a long list it may
  // otherwise be out of sight. (Focus and Escape are the panel's; see `SidePanel`.)
  useEffect(() => {
    if (open) { activeRef.current?.scrollIntoView?.({ block: 'center' }); }
  }, [open]);

  const pick = (entry: OutlineEntry) => {
    if (!entry.segmentId) { return; }
    onJump(entry.segmentId);
    // A phone's drawer covers the text, so it must go for the jump to be seen. Beside the text
    // on a larger screen it can stay, as a map.
    if (window.innerWidth < PHONE) { close(); }
  };

  const fold = (id: string) => setUnfolded((previous) => {
    const next = new Set(previous);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return next;
  });

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="classroom-contents__toggle"
        aria-label={intl.formatMessage(messages.contents)}
        title={intl.formatMessage(messages.contents)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <ContentsIcon />
      </button>

      {open && (
        <SidePanel
          id={panelId}
          title={intl.formatMessage(messages.contentsHeading)}
          closeLabel={intl.formatMessage(messages.closeContents)}
          onClose={close}
        >
          <ul className="classroom-drawer__list">
            {shown.map((entry) => {
              const index = outline.indexOf(entry);
              const active = entry.id === activeId;
              const parent = hasChildren(outline, index);
              const folded = parent && !unfolded.has(entry.id);
              const { number, rest } = splitNumber(entry.title);
              return (
                <li key={entry.id}>
                  <div
                    className={[
                      'classroom-drawer__row',
                      `classroom-drawer__row--depth-${Math.min(entry.depth, 4)}`,
                      active ? 'classroom-drawer__row--active' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {/* A fold for a section with things in it; a blank of the same width for
                        one without, so every title starts at the same distance from its fold. */}
                    {parent ? (
                      <button
                        type="button"
                        className={`classroom-drawer__fold${folded ? '' : ' classroom-drawer__fold--open'}`}
                        aria-expanded={!folded}
                        aria-label={intl.formatMessage(
                          folded ? messages.expandSection : messages.collapseSection,
                          { title: rest },
                        )}
                        onClick={() => fold(entry.id)}
                      >
                        <ChevronIcon size={16} />
                      </button>
                    ) : (
                      <span className="classroom-drawer__fold classroom-drawer__fold--none" aria-hidden="true" />
                    )}
                    <button
                      ref={active ? activeRef : undefined}
                      type="button"
                      // A heading the library could not place has nowhere to go.
                      disabled={!entry.segmentId}
                      aria-current={active ? 'location' : undefined}
                      className="classroom-drawer__item"
                      onClick={() => pick(entry)}
                    >
                      {/* The number in the interface face and the title in the Tibetan one,
                          each in its own element so they can be set side by side. */}
                      {number && <span className="classroom-drawer__num">{number}</span>}
                      <span className="classroom-drawer__text" lang="bo">{rest}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </SidePanel>
      )}
    </>
  );
};

export default Contents;
