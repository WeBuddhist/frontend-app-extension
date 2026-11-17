/**
 * Matching a translation to its source, against a stubbed library.
 *
 * The shapes are those of the live API (checked against
 * /v2/editions/{a}/alignments/{b}): each item has `source_segment` and
 * `target_segment`, and the content is sliced by `lines` offsets.
 */

import { loadTranslations } from './text';

jest.mock('./api', () => ({ apiBase: () => 'http://sync.test' }));

const SRC = 'ed-src';
const TR = 'ed-tr';

const pair = (source: string, target: string) => ({
  source_segment: { id: source },
  target_segment: { id: target },
});

/** Serve the library from a map of path -> JSON body or string. */
const serve = (routes: Record<string, unknown>) => {
  global.fetch = jest.fn(async (url: string) => {
    const { pathname, searchParams } = new URL(url);
    const path = pathname.replace('/library', '');
    if (!(path in routes)) {
      return { ok: false, status: 404, json: async () => null } as Response;
    }
    const route = routes[path];
    const body = typeof route === 'function'
      ? route(Number(searchParams.get('offset') ?? 0))
      : route;
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as unknown as typeof fetch;
};

const translationEdition = {
  [`/v2/editions/${TR}/segmentation/segments`]: {
    items: [
      { id: 't1', lines: [{ start: 0, end: 5 }], type: 'verse' },
      { id: 't2', lines: [{ start: 5, end: 9 }], type: 'verse' },
    ],
    has_more: false,
  },
  [`/v2/editions/${TR}/content`]: 'HelloWorl',
};

describe('loadTranslations', () => {
  it('reads a direct alignment', async () => {
    serve({
      ...translationEdition,
      [`/v2/editions/${SRC}/alignments/${TR}`]: {
        items: [pair('s1', 't1'), pair('s2', 't2')], has_more: false,
      },
    });
    const found = await loadTranslations(SRC, TR);
    expect(found.get('s1')).toBe('Hello');
    expect(found.get('s2')).toBe('Worl');
  });

  it('falls back to an alignment stored the other way round', async () => {
    serve({
      ...translationEdition,
      [`/v2/editions/${SRC}/alignments/${TR}`]: { items: [], has_more: false },
      // Stored translation-to-source: the translation is the *source* side here.
      [`/v2/editions/${TR}/alignments/${SRC}`]: {
        items: [pair('t1', 's1')], has_more: false,
      },
    });
    const found = await loadTranslations(SRC, TR);
    expect(found.get('s1')).toBe('Hello');
    expect(found.has('t1')).toBe(false);
  });

  it('joins several translation lines under one source line', async () => {
    serve({
      ...translationEdition,
      [`/v2/editions/${SRC}/alignments/${TR}`]: {
        items: [pair('s1', 't1'), pair('s1', 't2')], has_more: false,
      },
    });
    expect((await loadTranslations(SRC, TR)).get('s1')).toBe('Hello\nWorl');
  });

  it('leaves out a source line that has no match', async () => {
    serve({
      ...translationEdition,
      [`/v2/editions/${SRC}/alignments/${TR}`]: {
        items: [pair('s1', 't1')], has_more: false,
      },
    });
    expect((await loadTranslations(SRC, TR)).has('s2')).toBe(false);
  });

  it('follows the library\'s paging until it is done', async () => {
    serve({
      ...translationEdition,
      [`/v2/editions/${SRC}/alignments/${TR}`]: (offset: number) => (offset === 0
        ? { items: [pair('s1', 't1')], has_more: true }
        : { items: [pair('s2', 't2')], has_more: false }),
    });
    const found = await loadTranslations(SRC, TR);
    expect(found.get('s1')).toBe('Hello');
    expect(found.get('s2')).toBe('Worl');
  });
});
