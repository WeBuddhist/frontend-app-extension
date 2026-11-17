/** The contents drawer: open it, fold it, go to a heading, and see where the class is. */

import { IntlProvider } from '@edx/frontend-platform/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Contents from './Contents';
import {
  ancestorIds, hasChildren, splitNumber, visibleEntries, type OutlineEntry,
} from './outline';

const e = (id: string, title: string, depth: number, segmentId: string | null): OutlineEntry => ({
  id, title, depth, segmentId,
});

// Two chapters, each four levels deep, and a heading the library could not place.
const outline: OutlineEntry[] = [
  e('a', '1. Chapter one', 0, 's1'),
  e('b', '1.1 Section', 1, 's2'),
  e('c', '1.1.1 Topic', 2, 's3'),
  e('d', '1.1.1.1 Detail', 3, 's4'),
  e('x', 'Unplaced', 1, null),
  e('f', '2. Chapter two', 0, 's6'),
  e('g', '2.1 Section', 1, 's7'),
  e('h', '2.1.1 Deep', 2, 's8'),
  e('i', '2.1.1.1 Deeper', 3, 's9'),
];

// Lines s0 to s9, in reading order.
const order = new Map(Array.from({ length: 10 }, (_, i) => [`s${i}`, i]));

const show = (props: Partial<React.ComponentProps<typeof Contents>> = {}) => {
  const onJump = jest.fn();
  render(
    <IntlProvider locale="en">
      <Contents outline={outline} onJump={onJump} order={order} {...props} />
    </IntlProvider>,
  );
  return onJump;
};

const toggle = () => screen.getByRole('button', { name: 'Table of Contents' });
const openIt = () => userEvent.click(toggle());
const titles = () => Array.from(document.querySelectorAll('.classroom-drawer__text')).map((n) => n.textContent);
const marked = () => Array.from(document.querySelectorAll('[aria-current="location"]')).map((n) => n.textContent);

beforeAll(() => { Element.prototype.scrollIntoView = jest.fn(); });
afterEach(() => { Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true }); });

describe('opening and closing', () => {
  it('is shut until asked for, and says so to assistive technology', () => {
    show();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens down the side', async () => {
    show();
    await openIt();
    expect(screen.getByRole('dialog', { name: 'Table of Contents' })).toBeTruthy();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('closes from its own button, and hands focus back to where it was opened from', async () => {
    show();
    await openIt();
    await userEvent.click(screen.getByRole('button', { name: /close contents/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(toggle());
  });

  it('closes on Escape', async () => {
    show();
    await openIt();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('puts keyboard focus inside the drawer when it opens', async () => {
    show();
    await openIt();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /close contents/i }));
  });

  it('is closed again by the same button that opened it', async () => {
    show();
    await openIt();
    await openIt();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('the numbers', () => {
  it('sets a heading\'s number apart from its title, in its own element', async () => {
    show();
    await openIt();
    const row = screen.getByText('Chapter one').closest('button') as HTMLElement;
    expect(within(row).getByText('1.').className).toContain('classroom-drawer__num');
    expect(titles()[0]).toBe('Chapter one');
  });

  it('leaves a heading with no number as it is', async () => {
    show();
    await openIt();
    const row = screen.getByText('Unplaced').closest('button') as HTMLElement;
    expect(row.querySelector('.classroom-drawer__num')).toBeNull();
  });
});

describe('folding', () => {
  it('starts with every heading showing', async () => {
    show();
    await openIt();
    expect(titles()).toContain('Detail');
    expect(titles()).toContain('Deep');
  });

  it('folds a section, hiding everything beneath it however deep, without going anywhere', async () => {
    const onJump = show();
    await openIt();
    await userEvent.click(screen.getByRole('button', { name: 'Hide what is under Chapter one' }));
    expect(titles()).toEqual(['Chapter one', 'Chapter two', 'Section', 'Deep', 'Deeper']);
    expect(onJump).not.toHaveBeenCalled();
  });

  it('opens a folded section again', async () => {
    show();
    await openIt();
    await userEvent.click(screen.getByRole('button', { name: 'Hide what is under Topic' }));
    expect(titles()).not.toContain('Detail');
    await userEvent.click(screen.getByRole('button', { name: 'Show what is under Topic' }));
    expect(titles()).toContain('Detail');
  });

  it('says whether a fold is open or shut', async () => {
    show();
    await openIt();
    expect(screen.getByRole('button', { name: 'Hide what is under Chapter one' }).getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'Hide what is under Chapter one' }));
    expect(screen.getByRole('button', { name: 'Show what is under Chapter one' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('gives a heading with nothing under it no fold', async () => {
    show();
    await openIt();
    const row = screen.getByText('Unplaced').closest('.classroom-drawer__row') as HTMLElement;
    expect(within(row).queryByRole('button', { name: /what is under/i })).toBeNull();
  });

  it('never hides the marked heading inside a fold, even if the class moves somewhere folded', async () => {
    const { rerender } = render(
      <IntlProvider locale="en">
        <Contents outline={outline} onJump={jest.fn()} order={order} currentSegmentId="s1" />
      </IntlProvider>,
    );
    await openIt();
    await userEvent.click(screen.getByRole('button', { name: 'Hide what is under Chapter one' }));
    expect(titles()).not.toContain('Detail');
    rerender(
      <IntlProvider locale="en">
        <Contents outline={outline} onJump={jest.fn()} order={order} currentSegmentId="s4" />
      </IntlProvider>,
    );
    expect(titles()).toContain('Detail');
    expect(marked()).toEqual(['1.1.1.1Detail']);
  });
});

describe('going to a heading', () => {
  it('jumps to the line a heading begins at', async () => {
    const onJump = show();
    await openIt();
    await userEvent.click(screen.getAllByText('Section')[0]);
    expect(onJump).toHaveBeenCalledWith('s2');
  });

  it('stays open beside the text on a wide screen, to be used as a map', async () => {
    show();
    await openIt();
    await userEvent.click(screen.getAllByText('Section')[0]);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('puts itself away on a phone, where it covers the text, so the jump can be seen', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    show();
    await openIt();
    await userEvent.click(screen.getAllByText('Section')[0]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does nothing for a heading that could not be placed', async () => {
    const onJump = show();
    await openIt();
    const unplaced = screen.getByText('Unplaced').closest('button') as HTMLButtonElement;
    expect(unplaced.disabled).toBe(true);
    await userEvent.click(unplaced);
    expect(onJump).not.toHaveBeenCalled();
  });

  it('steps nested headings in, and no further than four levels', async () => {
    show();
    await openIt();
    const depthOf = (text: string) => (screen.getByText(text).closest('.classroom-drawer__row') as HTMLElement).className;
    expect(depthOf('Chapter one')).toContain('--depth-0');
    expect(depthOf('Topic')).toContain('--depth-2');
  });
});

describe('where the class is', () => {
  it('marks the heading the current line falls under', async () => {
    show({ currentSegmentId: 's7' });
    await openIt();
    expect(marked()).toEqual(['2.1Section']);
  });

  it('marks the earlier heading until the class reaches the next', async () => {
    show({ currentSegmentId: 's5' });
    await openIt();
    expect(marked()).toEqual(['1.1.1.1Detail']);
  });

  it('marks nothing before the class has begun, or for a line it knows nothing about', async () => {
    show({ currentSegmentId: null });
    await openIt();
    expect(marked()).toEqual([]);
  });

  it('brings the marked heading into view when it opens, since the list may be long', async () => {
    show({ currentSegmentId: 's7' });
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    await openIt();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});

describe('the tree helpers', () => {
  it('splitNumber takes a leading number, nested or not, and nothing else', () => {
    expect(splitNumber('2.2.3 བདེན')).toEqual({ number: '2.2.3', rest: 'བདེན' });
    expect(splitNumber('1. བདེན')).toEqual({ number: '1.', rest: 'བདེན' });
    expect(splitNumber('བདེན')).toEqual({ number: null, rest: 'བདེན' });
    expect(splitNumber('2024')).toEqual({ number: null, rest: '2024' });
  });

  it('hasChildren is true only when the next heading is deeper', () => {
    expect(hasChildren(outline, 0)).toBe(true);
    expect(hasChildren(outline, 3)).toBe(false);
    expect(hasChildren(outline, outline.length - 1)).toBe(false);
  });

  it('ancestorIds gives the way down to a heading, outermost first', () => {
    expect(ancestorIds(outline, 3)).toEqual(['a', 'b', 'c']);
    expect(ancestorIds(outline, 8)).toEqual(['f', 'g', 'h']);
    expect(ancestorIds(outline, 0)).toEqual([]);
  });

  it('visibleEntries hides everything beneath a closed section', () => {
    const open = new Set(['a', 'b']);
    expect(visibleEntries(outline, open).map((x) => x.id)).toEqual(['a', 'b', 'c', 'x', 'f']);
  });
});
