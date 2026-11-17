/**
 * The reader redraws only the lines that changed, and still redraws a line when something about
 * it really did change.
 *
 * Two halves, and both matter: a line that is skipped when it should not be shows stale text
 * (worse than the stutter this exists to fix), and one that is never skipped brings the stutter
 * back without anything failing. So: what a teacher's move redraws, and what a real change redraws.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as anchors from './anchors';
import Reader, { type LineMarks } from './Reader';
import type { OutlineEntry } from './outline';
import type { Line } from './text';

const lines: Line[] = Array.from({ length: 60 }, (_, i) => ({
  id: `s${i}`,
  idx: i,
  kind: i % 5 === 0 ? 'paragraph' : 'verse',
  reference: `1-${i}`,
  text: `source ${i}`,
  translation: `english ${i}`,
}));

/** A highlight on every line, so that drawing a line shows up as a call to `pieces`. */
const everyLineMarked = (): Map<string, LineMarks> => new Map(lines.map((line) => [
  line.id,
  {
    source: [{
      id: `n-${line.id}`, start: 0, end: 3, color: 'yellow' as const, hasBody: false,
    }],
    translation: [{
      id: `m-${line.id}`, start: 0, end: 3, color: 'blue' as const, hasBody: false,
    }],
  },
]));

type Props = React.ComponentProps<typeof Reader>;

const mount = (props: Partial<Props> = {}) => {
  const base: Props = {
    lines, currentSegmentId: 's10', follow: false, ...props,
  };
  const view = render(<Reader {...base} />);
  return {
    ...view,
    update: (next: Partial<Props>) => view.rerender(<Reader {...base} {...next} />),
  };
};

beforeAll(() => { Element.prototype.scrollIntoView = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); });

describe.each(['segmented', 'prose'] as const)('when the teacher moves (%s layout)', (layout) => {
  it('redraws only the lines the move touched', () => {
    const marks = everyLineMarked();
    const pieces = jest.spyOn(anchors, 'pieces');
    const { update } = mount({ layout, marks });
    pieces.mockClear();

    update({ layout, marks, currentSegmentId: 's11' });

    // Two lines, each with two texts drawn once: the one that lost the highlight and the one that
    // gained it. In the prose layout the paragraph holding them is redrawn too, so up to a
    // handful of lines more, never the sixty.
    const drawn = pieces.mock.calls.length;
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThanOrEqual(layout === 'prose' ? 20 : 4);
  });

  it('moves the highlight', () => {
    const { container, update } = mount({ layout });
    update({ layout, currentSegmentId: 's11' });
    const current = container.querySelectorAll('[aria-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute('data-segment-id')).toBe('s11');
  });

  it('is not made to redraw everything by a parent that passes new functions every time', () => {
    const marks = everyLineMarked();
    const pieces = jest.spyOn(anchors, 'pieces');
    const { update } = mount({
      layout, marks, onPick: () => undefined, onMarkOpen: () => undefined,
    });
    pieces.mockClear();
    update({
      layout, marks, currentSegmentId: 's11', onPick: () => undefined, onMarkOpen: () => undefined,
    });
    expect(pieces.mock.calls.length).toBeLessThanOrEqual(layout === 'prose' ? 20 : 4);
  });
});

describe.each(['segmented', 'prose'] as const)('when something about a line really changes (%s layout)', (layout) => {
  it('shows a new highlight on the line it is on, and only that line', () => {
    const { container, update } = mount({ layout });
    expect(container.querySelectorAll('.classroom-note')).toHaveLength(0);
    const marks = new Map<string, LineMarks>([['s30', {
      source: [{
        id: 'n1', start: 0, end: 6, color: 'pink', hasBody: true,
      }],
    }]]);
    update({ layout, marks });
    const notes = container.querySelectorAll('.classroom-note');
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toBe('source');
    expect(notes[0].closest('[data-segment-id]')?.getAttribute('data-segment-id')).toBe('s30');
  });

  it('takes a highlight away again', () => {
    const marks = new Map<string, LineMarks>([['s30', {
      source: [{
        id: 'n1', start: 0, end: 6, color: 'pink', hasBody: false,
      }],
    }]]);
    const { container, update } = mount({ layout, marks });
    expect(container.querySelectorAll('.classroom-note')).toHaveLength(1);
    update({ layout, marks: new Map() });
    expect(container.querySelectorAll('.classroom-note')).toHaveLength(0);
  });

  it('changes every line when the view changes', () => {
    const { container, update } = mount({ layout, view: 'both' });
    expect(container.querySelectorAll('[data-layer="translation"]')).toHaveLength(60);
    update({ layout, view: 'source' });
    expect(container.querySelectorAll('[data-layer="translation"]')).toHaveLength(0);
    update({ layout, view: 'translation' });
    expect(container.querySelectorAll('[data-layer="source"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-layer="translation"]')).toHaveLength(60);
  });

  it('changes every line when the text size changes', () => {
    const { container, update } = mount({ layout, textSize: 'medium' });
    const root = container.querySelector('.classroom-reader') as HTMLElement;
    expect(root.style.getPropertyValue('--classroom-text-scale')).toBe('1');
    update({ layout, textSize: 'large' });
    expect(root.style.getPropertyValue('--classroom-text-scale')).toBe('1.2');
  });

  it('gives lines their headings when they arrive', () => {
    const { container, update } = mount({ layout });
    expect(container.querySelectorAll('[role="heading"]')).toHaveLength(0);
    const headings = new Map<string, OutlineEntry[]>([['s20', [{
      id: 'h1', title: 'A chapter', depth: 0, segmentId: 's20',
    }]]]);
    update({ layout, headings });
    expect(screen.getByRole('heading', { name: 'A chapter' })).toBeTruthy();
  });

  it('makes lines pressable when the teacher is the one reading, and not otherwise', () => {
    const { container, update } = mount({ layout });
    expect(container.querySelector('button, [role="button"]')).toBeNull();
    update({ layout, onPick: () => undefined });
    expect(container.querySelectorAll('button, [role="button"]').length).toBeGreaterThan(0);
    update({ layout });
    expect(container.querySelector('button, [role="button"]')).toBeNull();
  });
});

describe.each(['segmented', 'prose'] as const)('pressing (%s layout)', (layout) => {
  it('calls the newest handler, not the one the line was first drawn with', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { update } = mount({ layout, onPick: first });
    update({ layout, onPick: second });
    await userEvent.click(screen.getByText('source 40'));
    expect(second).toHaveBeenCalledWith('s40');
    expect(first).not.toHaveBeenCalled();
  });

  it('opens a note with the newest handler too', async () => {
    const marks = new Map<string, LineMarks>([['s5', {
      source: [{
        id: 'n1', start: 0, end: 6, color: 'green', hasBody: true,
      }],
    }]]);
    const first = jest.fn();
    const second = jest.fn();
    const { update } = mount({ layout, marks, onMarkOpen: first });
    update({ layout, marks, onMarkOpen: second });
    await userEvent.click(screen.getByText('source'));
    expect(second).toHaveBeenCalledWith('n1');
    expect(first).not.toHaveBeenCalled();
  });
});

describe('scrolling to the line the class is on', () => {
  it('still finds the current line after it has moved', () => {
    const scroll = jest.fn();
    Element.prototype.scrollIntoView = scroll;
    const { update } = mount({ follow: true, currentSegmentId: 's3' });
    scroll.mockClear();
    update({ follow: true, currentSegmentId: 's40' });
    expect(scroll).toHaveBeenCalledTimes(1);
    expect((scroll.mock.instances[0] as HTMLElement).getAttribute('data-segment-id')).toBe('s40');
  });
});
