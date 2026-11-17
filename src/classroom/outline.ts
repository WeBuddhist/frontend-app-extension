/**
 * An edition's table of contents, as one flat list the reader can use.
 *
 * The library describes a section by the **character span** it covers, while a class
 * moves by **segment id**. This bridges the two by finding the segment each heading is
 * recited from. Adapted from WeBuddhist's reader
 * (`src/services/library/tableOfContents.ts` at commit 80ed57cd); the span handling
 * below is not a guess and must not be simplified away.
 */

import { allSpans, library, type SegmentSpan } from './text';

interface Span { start: number; end: number }

interface LibrarySection {
  id: string;
  title?: Record<string, string> | string | null;
  span?: Span | null;
  subsections?: LibrarySection[];
}

interface LibraryToc {
  id: string;
  sections?: LibrarySection[];
}

/** One heading, flattened for a list. */
export interface OutlineEntry {
  id: string;
  title: string;
  /** How deep it nests: 0 for the outermost. */
  depth: number;
  /** The segment it is recited from, or null when none could be placed. */
  segmentId: string | null;
}

/**
 * The title, preferring Tibetan since that is the text being read, then English, then
 * whatever there is. Display only.
 */
export const titleOf = (title: LibrarySection['title']): string => {
  if (typeof title === 'string') { return title.trim(); }
  if (!title || typeof title !== 'object') { return ''; }
  const preferred = title.bo || title.en;
  if (preferred) { return preferred.trim(); }
  const other = Object.values(title).find((value) => typeof value === 'string' && value.trim());
  return other ? other.trim() : '';
};

/**
 * The segment a heading is recited from: the one its span begins inside, however early
 * that segment started (a verse whose segment carries the tail of the line above still
 * starts there), or else the first that begins within the span.
 *
 * An empty span is not a defect. The library uses one to mark a *position* rather than
 * a range — a heading with no text of its own, such as a part title above its
 * subsections — so it takes the first segment at or after that position. Without this
 * those headings resolve to nothing and sit dead in the list.
 */
const segmentStartingSpan = (spans: SegmentSpan[], span: Span | null | undefined) => {
  if (!span) { return null; }
  const match = spans.find((candidate) => {
    const lines = candidate.lines ?? [];
    if (lines.length === 0) { return false; }
    const start = Math.min(...lines.map((line) => line.start));
    const end = Math.max(...lines.map((line) => line.end));
    if (start <= span.start && end > span.start) { return true; }
    return span.start === span.end
      ? start >= span.start
      : start >= span.start && start < span.end;
  });
  return match?.id ?? null;
};

/** A heading's own segment, or the first any heading beneath it found. */
const anchorOf = (section: LibrarySection, spans: SegmentSpan[]): string | null => (
  segmentStartingSpan(spans, section.span)
  ?? (section.subsections ?? []).reduce<string | null>(
    (found, sub) => found ?? anchorOf(sub, spans),
    null,
  )
);

const flatten = (
  sections: LibrarySection[],
  spans: SegmentSpan[],
  depth: number,
  into: OutlineEntry[],
): OutlineEntry[] => {
  sections.forEach((section) => {
    const title = titleOf(section.title);
    if (title) {
      into.push({
        id: section.id, title, depth, segmentId: anchorOf(section, spans),
      });
    }
    // A heading with no title adds no indent for the ones beneath it.
    flatten(section.subsections ?? [], spans, title ? depth + 1 : depth, into);
  });
  return into;
};

/**
 * The outline of an edition, outermost heading first, in the order they are recited.
 *
 * Most of the library has no outline yet. Such an edition returns an empty list and
 * costs no segment scan. A failure to read it returns an empty list too: the contents
 * are an aid, and a class must not be unable to start for want of them.
 */
export const loadOutline = async (editionId: string): Promise<OutlineEntry[]> => {
  let tocs: LibraryToc[];
  try {
    tocs = await library<LibraryToc[]>(`/v2/editions/${editionId}/table-of-contents`);
  } catch {
    return [];
  }
  const sections = (tocs ?? []).flatMap((toc) => toc.sections ?? []);
  if (sections.length === 0) { return []; }
  const spans = await allSpans(editionId);
  return flatten(sections, spans, 0, []);
};

/** Headings grouped by the segment they appear above. Several can share one. */
export const headingsBySegment = (outline: OutlineEntry[]): Map<string, OutlineEntry[]> => {
  const grouped = new Map<string, OutlineEntry[]>();
  outline.forEach((entry) => {
    if (!entry.segmentId) { return; }
    const found = grouped.get(entry.segmentId);
    if (found) { found.push(entry); } else { grouped.set(entry.segmentId, [entry]); }
  });
  return grouped;
};

/**
 * A heading's leading number, set apart from its title: `2.2.3 བདེན…` into `2.2.3` and the
 * rest. The number is Latin and the title Tibetan, and the two scripts sit on different baselines
 * in different faces, so wherever they are shown together each gets its own element. Shared by
 * the section titles in the text and the contents drawer so the two cannot drift.
 */
export const splitNumber = (title: string): { number: string | null; rest: string } => {
  const match = /^(\d+(?:\.\d+)*\.?)\s+(\S[\s\S]*)$/.exec(title);
  return match ? { number: match[1], rest: match[2] } : { number: null, rest: title };
};

/** Whether the heading at `index` has headings nested beneath it. */
export const hasChildren = (outline: OutlineEntry[], index: number): boolean => (
  index + 1 < outline.length && outline[index + 1].depth > outline[index].depth
);

/**
 * The headings above `index` that it sits inside, outermost first, as ids. What has to be open
 * for a heading to be seen.
 */
export const ancestorIds = (outline: OutlineEntry[], index: number): string[] => {
  const found: string[] = [];
  let depth = outline[index]?.depth ?? 0;
  for (let i = index - 1; i >= 0 && depth > 0; i -= 1) {
    if (outline[i].depth < depth) { found.unshift(outline[i].id); depth = outline[i].depth; }
  }
  return found;
};

/**
 * Which headings are showing, given which are open. A heading that has children and is not open
 * hides everything nested beneath it, however deep.
 */
export const visibleEntries = (outline: OutlineEntry[], open: Set<string>): OutlineEntry[] => {
  const shown: OutlineEntry[] = [];
  let hideBelow: number | null = null;
  outline.forEach((entry, index) => {
    if (hideBelow !== null && entry.depth > hideBelow) { return; }
    hideBelow = null;
    shown.push(entry);
    if (hasChildren(outline, index) && !open.has(entry.id)) { hideBelow = entry.depth; }
  });
  return shown;
};
