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

import { apiBase, me } from './api';

/** The library pages its segment listing; 500 is what the reader uses. */
const SPAN_PAGE_SIZE = 500;

interface SpanLine { start: number; end: number }

export interface SegmentSpan {
  id: string;
  lines?: SpanLine[];
  type?: string;
  /** The library's label for the segment, such as `1-1` or `I-2`. */
  reference?: string | null;
}

export interface Line {
  /** The segment id. The only thing that travels over the socket. */
  id: string;
  /** Reading order. Display only — never sent anywhere. */
  idx: number;
  /** What this line says. */
  text: string;
  /** The translation lined up with it, when the room has one. Display only. */
  translation?: string;
  /** `verse`, `prose`, `title`… Used for spacing, ignored by sync. */
  kind?: string;
  /** The label shown in the margin of the segmented layout. Display only. */
  reference?: string;
}

/**
 * One GET to the library through the service, with the Academy login.
 *
 * A plain `fetch` rather than the authenticated client, so it renews nothing by itself: when the
 * login cookie has run out (they last about an hour) the service answers 401, and a call to `me()`
 * (an ordinary request, which does renew it) followed by one retry puts it right. Without that a
 * reload late in a long class would fail to load the text at all.
 */
export const library = async <T>(path: string, params?: Record<string, string>): Promise<T> => {
  const query = params ? `?${new URLSearchParams(params)}` : '';
  const attempt = () => fetch(`${apiBase()}/library${path}${query}`, {
    credentials: 'include',
    headers: { 'USE-JWT-COOKIE': 'true' },
  });
  let response = await attempt();
  if (response.status === 401) {
    await me().catch(() => undefined);
    response = await attempt();
  }
  if (!response.ok) {
    throw new Error(`The library could not be reached (${response.status}).`);
  }
  return response.json() as Promise<T>;
};

/** Segment lists already asked for, by edition. See `allSpans`. */
const spansCache = new Map<string, Promise<SegmentSpan[]>>();

/** Forget what was cached. For tests, which reuse one edition id with different answers. */
export const clearTextCache = (): void => spansCache.clear();

const fetchAllSpans = async (editionId: string): Promise<SegmentSpan[]> => {
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
 * Every segment span of an edition, in order. Paged, because texts run long.
 *
 * Asked for once per edition and shared: the text, the table of contents and the translation
 * each need the same list, and a class used to download it four or more times on opening. A
 * failed request is dropped from the cache so the next try asks again.
 */
export const allSpans = (editionId: string): Promise<SegmentSpan[]> => {
  const cached = spansCache.get(editionId);
  if (cached) { return cached; }
  const pending = fetchAllSpans(editionId);
  spansCache.set(editionId, pending);
  pending.catch(() => { spansCache.delete(editionId); });
  return pending;
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
    reference: span.reference || undefined,
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

/** One pair from the library's alignment list: which line of one edition matches which. */
interface AlignmentItem {
  source_segment: { id: string };
  target_segment: { id: string };
}

/** Every alignment pair between two editions, in the direction asked. Paged. */
const alignmentPairs = async (
  fromEditionId: string,
  toEditionId: string,
): Promise<AlignmentItem[]> => {
  const pairs: AlignmentItem[] = [];
  let offset = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const page = await library<{ items?: AlignmentItem[]; has_more?: boolean }>(
      `/v2/editions/${fromEditionId}/alignments/${toEditionId}`,
      { limit: String(SPAN_PAGE_SIZE), offset: String(offset) },
    );
    const items = page.items ?? [];
    pairs.push(...items);
    if (!page.has_more || items.length === 0) { return pairs; }
    offset += items.length;
  }
};

/**
 * What each line of the source says in the translation, keyed by the source's segment id.
 *
 * The library stores an alignment in one direction only, and not always the one we ask
 * for: two translations of one root are each aligned to the root, and the pair may be
 * recorded translation-to-source. So the source-to-translation list is tried first and,
 * when it is empty, the reverse is read with the two sides swapped. This is the same
 * order WeBuddhist's reader uses (`src/services/library/alignments.ts`, commit 80ed57cd).
 *
 * One source line can match several translation lines, and the other way round, so the
 * result joins what it finds. Lines with no match are simply absent from the map.
 *
 * Deliberately not carried over: the walk through a shared ancestor text for editions
 * that are aligned to nothing in common directly. The server only pins a translation
 * that has a direct alignment, so that case cannot arise here.
 */
export const loadTranslations = async (
  sourceEditionId: string,
  translationEditionId: string,
): Promise<Map<string, string>> => {
  const [forward, translation] = await Promise.all([
    alignmentPairs(sourceEditionId, translationEditionId),
    loadText(translationEditionId),
  ]);

  let matches: Array<[string, string]> = forward.map(
    (pair) => [pair.source_segment.id, pair.target_segment.id],
  );
  if (matches.length === 0) {
    const reverse = await alignmentPairs(translationEditionId, sourceEditionId);
    matches = reverse.map((pair) => [pair.target_segment.id, pair.source_segment.id]);
  }

  const said = new Map(translation.map((line) => [line.id, line.text]));
  const bySource = new Map<string, string[]>();
  matches.forEach(([sourceId, translationId]) => {
    const text = said.get(translationId);
    if (!text) { return; }
    const found = bySource.get(sourceId);
    if (found) { found.push(text); } else { bySource.set(sourceId, [text]); }
  });
  return new Map([...bySource].map(([id, texts]) => [id, texts.join('\n')]));
};
