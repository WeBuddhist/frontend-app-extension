/** Where the note bubble goes, relative to the words it points at. */

import { place } from './NoteDialog';

const words = (top: number, left = 400, width = 100) => ({
  top, bottom: top + 20, left, right: left + width,
});

beforeEach(() => {
  Object.assign(window, {
    innerWidth: 1200, innerHeight: 800, scrollX: 0, scrollY: 0,
  });
});

it('goes under the words when it fits there, centred on them, the point at their middle', () => {
  const at = place(words(100), 440, 300);
  expect(at.side).toBe('below');
  expect(at.top).toBe(134);
  expect(at.left).toBe(450 - 220);
  expect(at.pointX).toBe(220);
});

it('goes over the words when there is no room under them', () => {
  const at = place(words(650), 440, 300);
  expect(at.side).toBe('above');
  expect(at.top).toBe(650 - 14 - 300);
});

it('stays on the screen near an edge, and keeps the point over the words', () => {
  const at = place(words(100, 10, 40), 440, 300);
  expect(at.left).toBe(16);
  expect(at.pointX).toBe(22);
});

it('works in the page\'s coordinates when the page is scrolled', () => {
  Object.assign(window, { scrollY: 1000 });
  const at = place(words(1100), 440, 300);
  expect(at.side).toBe('below');
  expect(at.top).toBe(1134);
});
