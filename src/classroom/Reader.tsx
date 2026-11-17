import { Fragment, useEffect, useRef } from 'react';

import { pieces, type Mark } from './anchors';
import { splitNumber, type OutlineEntry } from './outline';
import type { Line } from './text';
import type { NoteLayer } from './types';
import { TEXT_SCALE } from './view';
import type { LayoutMode, TextSize, ViewMode } from './view';

/** A line's highlights, by which of its texts they are on. */
export type LineMarks = Partial<Record<NoteLayer, Mark[]>>;

interface Props {
  lines: Line[];
  currentSegmentId: string | null;
  /** Set for the teacher. Clicking a line moves the whole class to it. */
  onPick?: (segmentId: string) => void;
  /** Whether to scroll the current line into view when it changes. */
  follow: boolean;
  /**
   * Hold the scrolling for now, for a reader in the middle of something the screen moving would
   * spoil. Only the teacher's *next* move is held back: when this ends the reader is not carried
   * to where the class has got to. They catch up when they choose (see `jump`).
   */
  paused?: boolean;
  /** Source, translation, or both. Lines with no translation fall back to the source. */
  view?: ViewMode;
  /** Segmented sets each line on its own; prose runs them together. */
  layout?: LayoutMode;
  /** How large to set the text. Defaults to the size the page was designed at. */
  textSize?: TextSize;
  /** Headings to draw above the line they begin at. Omit to draw none. */
  headings?: Map<string, OutlineEntry[]>;
  /** The student's own highlights, by line. Omitted for the teacher, who keeps none. */
  marks?: Map<string, LineMarks>;
  /** A highlight was pressed: open its note. */
  onMarkOpen?: (noteId: string) => void;
  /** Scroll to this line, whoever is teaching. `n` makes a repeat jump count. */
  jump?: { segmentId: string; n: number; exact?: boolean } | null;
}

/**
 * A heading's title with any leading number set apart (see `splitNumber`), each in its own
 * element and the pair centred as a row (see `.classroom-reader__section`).
 */
const numbered = (title: string) => {
  const { number, rest } = splitNumber(title);
  if (number === null) { return title; }
  return (
    <>
      <span className="classroom-reader__section-number">{number}</span>
      <span className="classroom-reader__section-title">{rest}</span>
    </>
  );
};

/**
 * The text, with the line the class is on marked.
 *
 * Scrolling is driven by the **segment id** changing, never by a position or an
 * offset. That is what makes one teacher's click land on the same line on a phone, a
 * tablet and a projector, at any font size.
 *
 * A teacher's line is a real `<button>` and a student's is a `<p>`. Not a lint
 * workaround: a line the teacher can press is a control, and a screen reader should
 * say so. A student's line is prose, and announcing it as a button would be a lie.
 */
const Reader = ({
  lines, currentSegmentId, onPick, follow, paused = false, view = 'both', layout = 'segmented', textSize = 'medium', headings, jump, marks, onMarkOpen,
}: Props) => {
  const currentRef = useRef<HTMLElement | null>(null);
  // The size is a multiplier the stylesheet applies to the reader's own base size.
  const scaleStyle = { '--classroom-text-scale': TEXT_SCALE[textSize] } as React.CSSProperties;
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Read through a ref, so that a pause ending is not itself a reason to scroll.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Also when the text first arrives: a student who joins mid-class gets the current line from the
  // join, before there is any text to scroll in, so that first scroll found nothing to move to.
  const loaded = lines.length > 0;
  useEffect(() => {
    if (!follow || !currentSegmentId || !loaded || pausedRef.current) { return; }
    currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentSegmentId, follow, loaded]);

  useEffect(() => {
    if (!jump) { return; }
    // The heading, if there is one, so the title is on screen with the line it begins.
    const root = rootRef.current;
    // Matched by comparing, not by a selector built from the id, so an id never has to
    // be escaped.
    const find = (attribute: string) => Array.from(
      root?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? [],
    ).find((node) => node.getAttribute(attribute) === jump.segmentId);
    if (jump.exact) {
      // Stepping line by line: the line itself, in the middle of the screen, so it is clear of
      // the site's top bar. A line taller than the screen goes to the top instead, so its
      // beginning is not cut off.
      const line = find('data-segment-id');
      const tall = line ? line.getBoundingClientRect().height > window.innerHeight * 0.7 : false;
      line?.scrollIntoView({ behavior: 'smooth', block: tall ? 'start' : 'center' });
      return;
    }
    const target = find('data-heading-for') ?? find('data-segment-id');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [jump]);

  /** The headings that begin at this line, as blocks standing above it. */
  const headingsAbove = (line: Line) => (headings?.get(line.id) ?? []).map((entry) => (
    <div
      key={entry.id}
      data-heading-for={line.id}
      className={`classroom-reader__section classroom-reader__section--depth-${Math.min(entry.depth, 3)}`}
      lang="bo"
      role="heading"
      aria-level={Math.min(entry.depth + 2, 6)}
      aria-label={entry.title}
    >
      {numbered(entry.title)}
    </div>
  ));

  /**
   * One text of a line, with the student's highlights drawn in it.
   *
   * The highlights add elements but never characters, so the element's own text is the
   * line's text exactly. That is what lets a selection be turned back into positions
   * inside the line (see `selectionToAnchor`).
   */
  const withMarks = (text: string, lineMarks: Mark[] | undefined) => {
    if (!lineMarks || lineMarks.length === 0) { return text; }
    return pieces(text, lineMarks).map((piece, index) => {
      if (piece.ids.length === 0 || !piece.color) { return piece.text; }
      const noteId = piece.ids[piece.ids.length - 1];
      const open = () => {
        // Letting go of a drag over a highlight is a click. A selection is not a request
        // to open a note.
        if (window.getSelection()?.isCollapsed === false) { return; }
        onMarkOpen?.(noteId);
      };
      return (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className={`classroom-note classroom-note--${piece.color}${piece.hasBody ? ' classroom-note--has-body' : ''}`}
          data-note-id={noteId}
          role="button"
          tabIndex={0}
          onClick={open}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onMarkOpen?.(noteId); }
          }}
        >
          {piece.text}
        </span>
      );
    });
  };

  /** The source and/or translation of one line, according to the chosen view. */
  const bodyOf = (line: Line) => {
    // A line the library has no translation for still shows its source in the
    // translation-only view, rather than leaving a hole in the text.
    const showSource = view !== 'translation' || !line.translation;
    const showTranslation = Boolean(line.translation) && view !== 'source';
    const lineMarks = marks?.get(line.id);
    return (
      <>
        {showSource && (
          <span className="classroom-reader__source" lang="bo" data-layer="source">
            {withMarks(line.text, lineMarks?.source)}
          </span>
        )}
        {showTranslation && (
          <span
            className={[
              'classroom-reader__translation',
              showSource ? '' : 'classroom-reader__translation--alone',
            ].filter(Boolean).join(' ')}
            lang="en"
            data-layer="translation"
          >
            {withMarks(line.translation as string, lineMarks?.translation)}
          </span>
        )}
      </>
    );
  };

  /**
   * A line in the segmented layout: the library's label for it in the margin (`1-1`,
   * `I-2`), then the text. The label is decoration for a person reading along: it is
   * hidden from assistive technology, because a screen reader announcing "one dash
   * one" before every line would be noise, and it is never sent anywhere. Sync carries
   * the segment id alone.
   */
  const segmentedBody = (line: Line) => (
    <>
      {line.reference && (
        <span className="classroom-reader__reference" aria-hidden="true">
          {line.reference}
        </span>
      )}
      <span className="classroom-reader__body">{bodyOf(line)}</span>
    </>
  );

  if (layout === 'prose') {
    // Front and back matter keep their own block: a title and a colophon are not part
    // of the running text. Everything else flows, with a new paragraph wherever the
    // library starts one; consecutive verse lines share a paragraph.
    const blocks: Line[][] = [];
    lines.forEach((line) => {
      const apart = line.kind === 'front_matter' || line.kind === 'back_matter';
      const previous = blocks[blocks.length - 1];
      const startsNew = apart || !previous || line.kind === 'paragraph'
        || headings?.has(line.id)
        || previous[0].kind === 'front_matter' || previous[0].kind === 'back_matter'
        || previous[0].kind === 'paragraph';
      if (startsNew) { blocks.push([line]); } else { previous.push(line); }
    });

    return (
      <div ref={rootRef} className="classroom-reader classroom-reader--prose" style={scaleStyle}>
        {blocks.map((block) => (
          <Fragment key={block[0].id}>
            {headingsAbove(block[0])}
            <p
              className={`classroom-reader__paragraph classroom-reader__paragraph--${block[0].kind ?? 'paragraph'}`}
            >
              {block.map((line) => {
                const current = line.id === currentSegmentId;
                const className = [
                  'classroom-reader__segment',
                  current ? 'classroom-reader__segment--current' : '',
                  onPick ? 'classroom-reader__segment--pickable' : '',
                ].filter(Boolean).join(' ');
                const refer = (node: HTMLElement | null) => {
                  if (current) { currentRef.current = node; }
                };
                // A <span role="button">, not a <button>: a real button is an inline
                // box that will not wrap across lines, and prose has to.
                return onPick ? (
                  <span
                    key={line.id}
                    ref={refer}
                    data-segment-id={line.id}
                    role="button"
                    tabIndex={0}
                    className={className}
                    aria-current={current ? 'true' : undefined}
                    onClick={() => onPick(line.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onPick(line.id);
                      }
                    }}
                  >
                    {bodyOf(line)}{' '}
                  </span>
                ) : (
                  <span
                    key={line.id}
                    ref={refer}
                    data-segment-id={line.id}
                    className={className}
                    aria-current={current ? 'true' : undefined}
                  >
                    {bodyOf(line)}{' '}
                  </span>
                );
              })}
            </p>
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="classroom-reader" style={scaleStyle}>
      {lines.map((line) => {
        const current = line.id === currentSegmentId;
        const className = [
          'classroom-reader__line',
          line.kind ? `classroom-reader__line--${line.kind}` : '',
          current ? 'classroom-reader__line--current' : '',
        ].filter(Boolean).join(' ');

        if (onPick) {
          return (
            <Fragment key={line.id}>
              {headingsAbove(line)}
              <button
                data-segment-id={line.id}
                type="button"
                ref={(node) => { if (current) { currentRef.current = node; } }}
                className={`${className} classroom-reader__line--pickable`}
                onClick={() => onPick(line.id)}
                aria-current={current ? 'true' : undefined}
              >
                {segmentedBody(line)}
              </button>
            </Fragment>
          );
        }

        return (
          <Fragment key={line.id}>
            {headingsAbove(line)}
            <p
              data-segment-id={line.id}
              ref={(node) => { if (current) { currentRef.current = node; } }}
              className={className}
              aria-current={current ? 'true' : undefined}
            >
              {segmentedBody(line)}
            </p>
          </Fragment>
        );
      })}
    </div>
  );
};

export default Reader;
