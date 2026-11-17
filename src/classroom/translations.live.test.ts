/**
 * @jest-environment-options {"url": "http://localhost:2003", "customExportConditions": ["node"]}
 *
 * Translations against the real library, through the sync service's proxy.
 * Skipped unless CLASSROOM_API_URL is set.
 *
 *   CLASSROOM_API_URL=http://localhost:8010 npm test -- translations.live
 */

import { loadOutline } from './outline';
import { tokenOf } from './liveSupport';
import { loadText, loadTranslations } from './text';

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
    request.setRequestHeader('authorization', `JWT ${tokenOf('teacher')}`);
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

// The Bodhicaryavatara (Tibetan) and its first translation, as a room pins them.
const SOURCE_EDITION = '3rCvwAoWrzKGlIQdtLjCu';
const TRANSLATION_EDITION = 'YJRbRrAWPXC8TDr8doccI';

describeLive('loadTranslations (live)', () => {
  it('lines up English with the Tibetan, through the proxy', async () => {
    const [lines, translations] = await Promise.all([
      loadText(SOURCE_EDITION),
      loadTranslations(SOURCE_EDITION, TRANSLATION_EDITION),
    ]);
    expect(translations.size).toBeGreaterThan(0);
    // Every key is a real source segment id, so it can be looked up by what the
    // teacher sends over the socket.
    const ids = new Set(lines.map((line) => line.id));
    translations.forEach((text, id) => {
      expect(ids.has(id)).toBe(true);
      expect(text.trim().length).toBeGreaterThan(0);
    });
  }, 60000);
});

describeLive('loadOutline (live)', () => {
  it('places the Bodhicaryavatara\'s chapters at real segments, in reading order', async () => {
    const [lines, outline] = await Promise.all([
      loadText(SOURCE_EDITION),
      loadOutline(SOURCE_EDITION),
    ]);
    expect(outline.length).toBeGreaterThan(10);
    const index = new Map(lines.map((line) => [line.id, line.idx]));
    const placed = outline.filter((entry) => entry.segmentId);
    expect(placed.length).toBe(outline.length);
    // Every anchor is a real segment id of the text.
    placed.forEach((entry) => expect(index.has(entry.segmentId as string)).toBe(true));
    // Recited in order, so anchors never run backwards.
    const positions = placed.map((entry) => index.get(entry.segmentId as string) as number);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  }, 60000);
});
