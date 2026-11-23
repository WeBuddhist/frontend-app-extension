/**
 * @jest-environment-options {"url": "http://apps.local.openedx.io:2003", "customExportConditions": ["node"]}
 *
 * The dictionary against the real Padma API, asked from our own site's origin, so this
 * also checks Padma still lets our pages call it. Skipped unless PADMA_LIVE is set.
 *
 *   PADMA_LIVE=1 npm test -- dictionary.live
 */

import { clearLookupCache, lookup } from './dictionary';

const describeLive = process.env.PADMA_LIVE ? describe : describe.skip;

/**
 * jsdom has XMLHttpRequest but no `fetch`. This supplies `fetch` over jsdom's XHR, which
 * makes real requests and enforces CORS like a browser does.
 */
beforeAll(() => {
  (global as any).fetch = (url: string) => new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.onload = () => resolve({
      ok: request.status >= 200 && request.status < 300,
      status: request.status,
      json: () => Promise.resolve(JSON.parse(request.responseText)),
    });
    request.onerror = () => reject(new Error(`GET ${url} failed`));
    request.send();
  });
});

beforeEach(() => clearLookupCache());

describeLive('lookup, against Padma', () => {
  it('finds a term whole', async () => {
    const result = await lookup('བྱང་ཆུབ་སེམས');
    expect(result.split).toBe(false);
    expect(result.words).toHaveLength(1);
    expect(result.words[0].entries.length).toBeGreaterThan(0);
    expect(result.words[0].entries.every((e) => e.definitions.length > 0)).toBe(true);
  }, 30000);

  it('splits a phrase no dictionary has whole', async () => {
    const result = await lookup('སེམས་ཅན་ཐམས་ཅད་ཀྱི་དོན་དུ');
    expect(result.split).toBe(true);
    expect(result.words.length).toBeGreaterThan(1);
  }, 30000);

  it('says nothing was found for nonsense', async () => {
    const result = await lookup('ཀཀཀཀ');
    expect(result.words).toEqual([]);
  }, 30000);
});
