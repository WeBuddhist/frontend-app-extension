/**
 * @jest-environment-options {"url": "http://localhost:2003", "customExportConditions": ["node"]}
 *
 * The text loader against the real library, through the sync service's proxy.
 * Skipped unless CLASSROOM_API_URL is set.
 *
 *   CLASSROOM_API_URL=http://localhost:8010 npm test -- text.live
 */

import { loadText } from './text';

const API = process.env.CLASSROOM_API_URL;

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ CLASSROOM_API_URL: process.env.CLASSROOM_API_URL }),
}));

const describeLive = API ? describe : describe.skip;

/**
 * jsdom provides XMLHttpRequest but not `fetch`, which every real browser has. Rather
 * than contort the code under test, the test supplies the missing browser API over
 * jsdom's own XHR — which does make real requests, so this still exercises the live
 * library and the proxy's CORS headers.
 */
beforeAll(() => {
  (global as any).fetch = (url: string) => new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.onload = () => resolve({
      ok: request.status >= 200 && request.status < 300,
      status: request.status,
      json: () => Promise.resolve(JSON.parse(request.responseText)),
      text: () => Promise.resolve(request.responseText),
    });
    request.onerror = () => reject(new Error(`GET ${url} failed`));
    request.send();
  });
});

const get = (url: string): Promise<any> => new Promise((resolve, reject) => {
  const request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.onload = () => resolve(JSON.parse(request.responseText));
  request.onerror = () => reject(new Error(`GET ${url} failed`));
  request.send();
});

describeLive('loadText, against the real library', () => {
  let editionId: string;
  let expectedIds: string[];

  beforeAll(async () => {
    const texts = await get(
      `${API}/api/texts?${new URLSearchParams({ title: 'བྱང་ཆུབ', limit: '1' })}`,
    );
    const editions = await get(
      `${API}/library/v2/texts/${texts[0].id}/editions?edition_type=critical`,
    );
    editionId = editions[0].id;
    const spans = await get(
      `${API}/library/v2/editions/${editionId}/segmentation/segments?limit=500&offset=0`,
    );
    expectedIds = spans.items.map((i: { id: string }) => i.id);
  }, 60000);

  it('loads every line of the text', async () => {
    const lines = await loadText(editionId);
    expect(lines).toHaveLength(expectedIds.length);
    expect(lines.map((l) => l.id)).toEqual(expectedIds);
  }, 60000);

  it('each line carries its own text, in reading order', async () => {
    const lines = await loadText(editionId);
    expect(lines.every((l) => l.text.length > 0)).toBe(true);
    expect(lines.map((l) => l.idx)).toEqual(lines.map((_, i) => i));
    // Tibetan, not mojibake or someone else's text.
    expect(lines[0].text).toMatch(/[ༀ-࿿]/);
  }, 60000);

  it('lines are distinct rather than all the same slice', async () => {
    const lines = await loadText(editionId);
    const distinct = new Set(lines.map((l) => l.text));
    // An off-by-one in the offsets, or slicing the wrong string, tends to produce
    // identical or empty lines rather than an obvious error.
    expect(distinct.size).toBeGreaterThan(lines.length / 2);
  }, 60000);

  it('a multi-line segment keeps its line breaks', async () => {
    const lines = await loadText(editionId);
    // Joining with '' instead of '\n' collapses a four-line verse into one run-on
    // line, which looks plausible and is wrong.
    const multiline = lines.filter((l) => l.text.includes('\n'));
    expect(multiline.length).toBeGreaterThan(0);
  }, 60000);
});
