/**
 * Loading a text from the library, through the sync service's proxy.
 *
 * The whole text, once, when the class is joined. That is what makes everything else
 * simple: there is no paging, no fetching as you scroll, and a student whose network
 * drops mid-class keeps reading. Sync carries only ids, so the text in the browser is
 * all a student needs to follow along.
 *
 * The line-building below is adapted from WeBuddhist's reader
 * (`src/services/library/textDetails.ts` at commit 80ed57cd). Two details there are
 * not guesses and must not be simplified away — both are commented where they appear.
 */

import { apiBase } from './api';

/** The library pages its segment listing; 500 is what the reader uses. */
const SPAN_PAGE_SIZE = 500;

interface SpanLine { start: number; end: number }

interface SegmentSpan {
  id: string;
  lines?: SpanLine[];
  type?: string;
}

export interface Line {
  /** The segment id. The only thing that travels over the socket. */
  id: string;
  /** Reading order. Display only — never sent anywhere. */
  idx: number;
  /** What this line says. */
  text: string;
  /** `verse`, `prose`, `title`… Used for spacing, ignored by sync. */
  kind?: string;
}

const library = async <T>(path: string, params?: Record<string, string>): Promise<T> => {
  const query = params ? `?${new URLSearchParams(params)}` : '';
  const response = await fetch(`${apiBase()}/library${path}${query}`);
  if (!response.ok) {
    throw new Error(`The library could not be reached (${response.status}).`);
  }
  return response.json() as Promise<T>;
};

/** Every segment span of an edition, in order. Paged, because texts run long. */
const allSpans = async (editionId: string): Promise<SegmentSpan[]> => {
  const spans: SegmentSpan[] = [];
  let offset = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const page = await library<{ items?: SegmentSpan[]; has_more?: boolean }>(
      `/v2/editions/${editionId}/segmentation/segments`,
      { limit: String(SPAN_PAGE_SIZE), offset: String(offset) },
    );
    const items = page.items ?? [];
    spans.push(...items);
    if (!page.has_more || items.length === 0) { return spans; }
    offset += items.length;
  }
};

/**
 * Turn spans and the edition's content into lines.
 *
 * The content carries no line breaks of its own — the spans in `lines` are the only
 * record of where they fall, and they run edge to edge with no gaps. Joining the
 * slices with '' collapses a four-line verse into one run-on line, so they are joined
 * with a newline and the reader decides how to present it.
 *
 * `codePoints` is the content split once, up front. The library computes offsets in
 * Python, where string indices are **code points**; JavaScript slices UTF-16 units.
 * Those agree only while the text stays inside the BMP, which nothing guarantees. The
 * reader slices per line with `Array.from(...)`, which is right but O(n) each time —
 * fine for a window of sixty lines, quadratic for a thousand, which is what loading a
 * whole text at once asks for.
 */
const buildLines = (spans: SegmentSpan[], content: string): Line[] => {
  const codePoints = Array.from(content);
  return spans.map((span, idx) => ({
    id: span.id,
    idx,
    kind: span.type,
    text: (span.lines ?? [])
      .map((line) => codePoints.slice(line.start, line.end).join(''))
      .join('\n'),
  }));
};

/** The whole text of an edition, as lines keyed by segment id. */
export const loadText = async (editionId: string): Promise<Line[]> => {
  const [spans, content] = await Promise.all([
    allSpans(editionId),
    // No span bounds: the whole edition. That is the point — see the file header.
    library<string>(`/v2/editions/${editionId}/content`),
  ]);
  return buildLines(spans, content);
};
