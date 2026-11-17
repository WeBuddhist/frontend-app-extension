/** Placing a table of contents among the segments, against a stubbed library. */

import { loadOutline, headingsBySegment } from './outline';

jest.mock('./api', () => ({ apiBase: () => 'http://sync.test' }));

const EDITION = 'ed';

const serve = (routes: Record<string, unknown>) => {
  global.fetch = jest.fn(async (url: string) => {
    const path = new URL(url).pathname.replace('/library', '');
    if (!(path in routes)) {
      return { ok: false, status: 404, json: async () => null } as Response;
    }
    return { ok: true, status: 200, json: async () => routes[path] } as Response;
  }) as unknown as typeof fetch;
};

// Three segments covering offsets 0-10, 10-20, 20-30.
const spans = {
  items: [
    { id: 's1', lines: [{ start: 0, end: 10 }] },
    { id: 's2', lines: [{ start: 10, end: 20 }] },
    { id: 's3', lines: [{ start: 20, end: 30 }] },
  ],
  has_more: false,
};

const tocPath = `/v2/editions/${EDITION}/table-of-contents`;
const spansPath = `/v2/editions/${EDITION}/segmentation/segments`;

describe('loadOutline', () => {
  it('places each heading at the segment its span starts in', async () => {
    serve({
      [tocPath]: [{
        id: 't',
        sections: [
          { id: 'a', title: { bo: 'one' }, span: { start: 0, end: 10 } },
          { id: 'b', title: { bo: 'two' }, span: { start: 10, end: 30 } },
        ],
      }],
      [spansPath]: spans,
    });
    const outline = await loadOutline(EDITION);
    expect(outline.map((e) => [e.title, e.segmentId])).toEqual([['one', 's1'], ['two', 's2']]);
  });

  it('nests subsections one level deeper, and a title-less heading adds no indent', async () => {
    serve({
      [tocPath]: [{
        id: 't',
        sections: [{
          id: 'a',
          title: { bo: 'part' },
          span: { start: 0, end: 30 },
          subsections: [{
            id: 'b',
            title: {},
            span: { start: 0, end: 10 },
            subsections: [{ id: 'c', title: { bo: 'chapter' }, span: { start: 10, end: 20 } }],
          }],
        }],
      }],
      [spansPath]: spans,
    });
    const outline = await loadOutline(EDITION);
    expect(outline.map((e) => [e.title, e.depth])).toEqual([['part', 0], ['chapter', 1]]);
  });

  it('anchors an empty span, a position rather than a range, to the first segment at or after it', async () => {
    serve({
      [tocPath]: [{
        id: 't',
        sections: [{ id: 'a', title: { bo: 'heading' }, span: { start: 10, end: 10 } }],
      }],
      [spansPath]: spans,
    });
    expect((await loadOutline(EDITION))[0].segmentId).toBe('s2');
  });

  it('counts a segment that began before the span but runs into it', async () => {
    serve({
      [tocPath]: [{
        id: 't',
        sections: [{ id: 'a', title: { bo: 'h' }, span: { start: 15, end: 30 } }],
      }],
      [spansPath]: spans,
    });
    expect((await loadOutline(EDITION))[0].segmentId).toBe('s2');
  });

  it('gives an empty list, without scanning segments, when there is no outline', async () => {
    serve({ [tocPath]: [] });
    expect(await loadOutline(EDITION)).toEqual([]);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('gives an empty list rather than failing when the library cannot be read', async () => {
    serve({});
    expect(await loadOutline(EDITION)).toEqual([]);
  });

  it('prefers the Tibetan title, then English, then anything', async () => {
    serve({
      [tocPath]: [{
        id: 't',
        sections: [
          { id: 'a', title: { en: 'E', bo: 'B' }, span: { start: 0, end: 10 } },
          { id: 'b', title: { en: 'E2' }, span: { start: 10, end: 20 } },
          { id: 'c', title: { zh: 'Z' }, span: { start: 20, end: 30 } },
        ],
      }],
      [spansPath]: spans,
    });
    expect((await loadOutline(EDITION)).map((e) => e.title)).toEqual(['B', 'E2', 'Z']);
  });

  it('groups headings that share a segment', () => {
    const grouped = headingsBySegment([
      {
        id: 'a', title: 'x', depth: 0, segmentId: 's1',
      },
      {
        id: 'b', title: 'y', depth: 1, segmentId: 's1',
      },
      {
        id: 'c', title: 'z', depth: 1, segmentId: null,
      },
    ]);
    expect(grouped.get('s1')).toHaveLength(2);
    expect(grouped.size).toBe(1);
  });
});
