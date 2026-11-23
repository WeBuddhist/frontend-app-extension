/**
 * Pinning a note to words, and finding them again.
 *
 * A note is anchored the way the rest of the classroom is: by the **line** (the segment id)
 * and by where inside that line's own text it sits, never by where it happens to be on a
 * page. Counting from the start of the line's text, not the page, is what makes a highlight
 * land on the same words on a phone, a laptop and a projector, in any font, in any layout.
 *
 * Offsets are in **code points**, the unit the library itself uses, so an emoji or a rare
 * character counts once however JavaScript spells it.
 *
 * Nothing here touches the DOM except the two functions at the bottom, so the hard parts
 * (snapping to syllables, finding words again after an edit, drawing overlapping
 * highlights) are plain functions with plain tests.
 */

import type { Note, NoteColor, NoteLayer } from './types';

/** How many characters either side of a selection are kept to find it again. */
export const CONTEXT = 24;

const cp = (text: string): string[] => Array.from(text);

// ---------------------------------------------------------------------------------------
// Snapping a selection to whole words
// ---------------------------------------------------------------------------------------

const TIBETAN = /[ༀ-࿿]/;

/**
 * Characters that end a Tibetan syllable: the tsek (U+0F0B), the shads and other marks of
 * punctuation (U+0F0D to U+0F11), and ordinary space. A selection is widened out to these,
 * so a highlight never starts or stops in the middle of a syllable, and never cuts a stack
 * of letters in half (the stacks are *within* a syllable).
 */
const isTibetanBreak = (ch: string) => /[\s་།-༑༔]/.test(ch);

/** A letter, digit or mark, or an apostrophe or hyphen inside a word. */
const isWordChar = (ch: string) => /[\p{L}\p{N}\p{M}'’-]/u.test(ch);

const isSpace = (ch: string) => /\s/.test(ch);

export interface Span { start: number; end: number }

/**
 * Widen a selection to whole words, and trim the spaces off its ends.
 *
 * Tibetan is widened to whole syllables, anything else to whole words. The layer is not
 * what decides: a "source" line can be Sanskrit or English, so the *text* is what is
 * looked at.
 *
 * Returns null when nothing but space was selected.
 */
export function snap(text: string, start: number, end: number): Span | null {
  const chars = cp(text);
  let a = Math.max(0, Math.min(start, chars.length));
  let b = Math.max(0, Math.min(end, chars.length));
  if (b < a) { [a, b] = [b, a]; }

  // Trim what the browser picked up by accident: a trailing space, a line break.
  while (a < b && isSpace(chars[a])) { a += 1; }
  while (b > a && isSpace(chars[b - 1])) { b -= 1; }
  if (a >= b) { return null; }

  const tibetan = TIBETAN.test(chars.slice(a, b).join(''));
  if (tibetan) {
    // A highlight should not begin or end on the tsek that joins syllables: it reads as a
    // stray mark. (A shad, which ends a phrase, is kept: it is part of what was read.)
    while (a < b && chars[a] === '\u0F0B') { a += 1; }
    while (b > a && chars[b - 1] === '\u0F0B') { b -= 1; }
    if (a >= b) { return null; }
  }
  const inside = tibetan ? (ch: string) => !isTibetanBreak(ch) : isWordChar;

  // Only widen a side that stops *inside* a word: a selection that already ends at a
  // boundary is left exactly as it is.
  if (a > 0 && inside(chars[a - 1]) && inside(chars[a])) {
    while (a > 0 && inside(chars[a - 1])) { a -= 1; }
  }
  if (b < chars.length && inside(chars[b]) && inside(chars[b - 1])) {
    while (b < chars.length && inside(chars[b])) { b += 1; }
  }
  return { start: a, end: b };
}

// ---------------------------------------------------------------------------------------
// Making an anchor
// ---------------------------------------------------------------------------------------

export interface Anchor {
  start: number;
  end: number;
  quote: string;
  prefix: string;
  suffix: string;
}

/** The selected words and a little around them, for finding them again. */
export function buildAnchor(text: string, start: number, end: number): Anchor {
  const chars = cp(text);
  return {
    start,
    end,
    quote: chars.slice(start, end).join(''),
    prefix: chars.slice(Math.max(0, start - CONTEXT), start).join(''),
    suffix: chars.slice(end, end + CONTEXT).join(''),
  };
}

// ---------------------------------------------------------------------------------------
// Finding the words again
// ---------------------------------------------------------------------------------------

type Located = Pick<Note, 'startOffset' | 'endOffset' | 'quote' | 'prefix' | 'suffix'>;

const commonSuffix = (a: string[], b: string[]) => {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) { n += 1; }
  return n;
};

const commonPrefix = (a: string[], b: string[]) => {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) { n += 1; }
  return n;
};

/**
 * Where a note's words are now.
 *
 * Normally exactly where they were. If the line has been edited and the saved position no
 * longer holds the saved words, they are searched for, and when the words occur more than
 * once the occurrence whose surroundings match the saved ones best is taken. If they are
 * gone, null: the note is then shown as "text changed" rather than pointing at the wrong
 * words, which would be worse than not pointing at all.
 */
export function relocate(text: string, note: Located): Span | null {
  // Nothing to find, and nowhere it could be: an empty note is not at "the empty place".
  if (note.quote === '') { return null; }
  const chars = cp(text);
  if (chars.slice(note.startOffset, note.endOffset).join('') === note.quote) {
    return { start: note.startOffset, end: note.endOffset };
  }

  const quote = cp(note.quote);
  if (quote.length === 0) { return null; }
  const before = cp(note.prefix);
  const after = cp(note.suffix);

  let best: { span: Span; score: number; distance: number } | null = null;
  let from = 0;
  // The code-point position of each match, worked out from the previous one rather than by
  // re-splitting the whole line before it every time.
  let lastIndex = 0;
  let lastStart = 0;
  for (;;) {
    const found = text.indexOf(note.quote, from);
    if (found === -1) { break; }
    const start = lastStart + cp(text.slice(lastIndex, found)).length;
    lastIndex = found;
    lastStart = start;
    const end = start + quote.length;
    // Only the saved context's length of surroundings is compared, not the whole line.
    const score = commonSuffix(chars.slice(Math.max(0, start - before.length), start), before)
      + commonPrefix(chars.slice(end, end + after.length), after);
    const distance = Math.abs(start - note.startOffset);
    if (!best || score > best.score || (score === best.score && distance < best.distance)) {
      best = { span: { start, end }, score, distance };
    }
    from = found + 1;
  }
  return best ? best.span : null;
}

// ---------------------------------------------------------------------------------------
// Drawing highlights
// ---------------------------------------------------------------------------------------

export interface Mark {
  id: string;
  start: number;
  end: number;
  color: NoteColor;
  /** Whether there are words behind the highlight, so it can say so. */
  hasBody: boolean;
}

export interface Piece {
  text: string;
  /** The notes covering this piece, oldest first. Empty for plain text. */
  ids: string[];
  /** The colour to draw: the newest note's, so a fresh highlight shows over an old one. */
  color: NoteColor | null;
  hasBody: boolean;
}

/**
 * Cut a line's text into pieces, each either plain or covered by one or more notes.
 *
 * Notes may overlap, so the text is cut at every note's start and end and each piece
 * records everything that covers it. `marks` must be in the order they were made.
 */
export function pieces(text: string, marks: Mark[]): Piece[] {
  const chars = cp(text);
  const live = marks
    .map((m) => ({ ...m, start: Math.max(0, m.start), end: Math.min(chars.length, m.end) }))
    .filter((m) => m.end > m.start);
  if (live.length === 0) {
    return [{
      text, ids: [], color: null, hasBody: false,
    }];
  }

  const cuts = [...new Set([0, chars.length, ...live.flatMap((m) => [m.start, m.end])])]
    .sort((x, y) => x - y);
  const out: Piece[] = [];
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const [from, to] = [cuts[i], cuts[i + 1]];
    const covering = live.filter((m) => m.start <= from && m.end >= to);
    const top = covering[covering.length - 1];
    out.push({
      text: chars.slice(from, to).join(''),
      ids: covering.map((m) => m.id),
      color: top ? top.color : null,
      hasBody: covering.some((m) => m.hasBody),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// The DOM: from what the person selected to an anchor
// ---------------------------------------------------------------------------------------

/** What a selection came to, or why it was not usable. */
export type SelectionResult =
  | {
    ok: true;
    segmentId: string;
    layer: NoteLayer;
    anchor: Anchor;
    /** Where to put the popup: the selection's box, in the page's own coordinates. */
    rect: DOMRect;
    /** The box of each line of the selection, to draw it again once the browser's own
     * selection has gone (it goes when the note box is clicked into). */
    rects: DOMRect[];
    /** The selected words themselves, to find their boxes again when the text moves (a side
     * panel opening, a different text size). A copy: the browser's own selection goes. */
    range: Range;
  }
  | { ok: false };

/**
 * The anchor for the current selection, if it is one a note can be made on.
 *
 * Usable means: not empty, inside the reader, and wholly inside **one line's one text**.
 * A selection that crosses two lines, or the Tibetan and its English, is refused for now
 * (a Tibetan line is short, and splitting across lines can come later).
 *
 * Offsets come from the layer element's own text, so highlights drawn inside it (which add
 * elements but no characters) do not move anything.
 */
export function selectionToAnchor(selection: Selection | null, root: Element | null): SelectionResult {
  const none: SelectionResult = { ok: false };
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !root) { return none; }
  const range = selection.getRangeAt(0);

  const layerOf = (node: Node) => (
    (node.nodeType === 1 ? (node as Element) : node.parentElement)?.closest('[data-layer]') ?? null
  );
  const layerEl = layerOf(range.startContainer);
  if (!layerEl || layerEl !== layerOf(range.endContainer) || !root.contains(layerEl)) { return none; }

  const segmentId = layerEl.closest('[data-segment-id]')?.getAttribute('data-segment-id');
  const layer = layerEl.getAttribute('data-layer');
  if (!segmentId || (layer !== 'source' && layer !== 'translation')) { return none; }

  const text = layerEl.textContent ?? '';
  const offsetOf = (node: Node, offset: number) => {
    const before = document.createRange();
    before.selectNodeContents(layerEl);
    before.setEnd(node, offset);
    // UTF-16 length of what precedes, turned into code points.
    return cp(text.slice(0, before.toString().length)).length;
  };

  const snapped = snap(
    text,
    offsetOf(range.startContainer, range.startOffset),
    offsetOf(range.endContainer, range.endOffset),
  );
  if (!snapped) { return none; }
  return {
    ok: true,
    segmentId,
    layer,
    anchor: buildAnchor(text, snapped.start, snapped.end),
    rect: range.getBoundingClientRect(),
    rects: typeof range.getClientRects === 'function' ? Array.from(range.getClientRects()) : [],
    range: range.cloneRange(),
  };
}
