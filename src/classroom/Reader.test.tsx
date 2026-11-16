/**
 * The reader's rendering. No server needed — the lines are fixtures.
 *
 * Runs in the normal suite, unlike the `.live` tests.
 */

import { IntlProvider } from '@edx/frontend-platform/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Reader from './Reader';
import type { Line } from './text';

const lines: Line[] = [
  {
    id: 'a1', idx: 0, text: '༄༅༅། །རྒྱ་གར་སྐད་དུ།', kind: 'title',
  },
  {
    id: 'b2', idx: 1, text: 'བྱང་ཆུབ་སེམས་དཔའི་སྤྱོད་པ་ལ་འཇུག་པ།', kind: 'prose',
  },
  {
    id: 'c3', idx: 2, text: 'first line\nsecond line', kind: 'verse',
  },
];

const show = (props: Partial<React.ComponentProps<typeof Reader>> = {}) => render(
  <IntlProvider locale="en">
    <Reader lines={lines} currentSegmentId={null} follow={false} {...props} />
  </IntlProvider>,
);

describe('Reader', () => {
  beforeAll(() => {
    // jsdom has no layout, so scrollIntoView is not implemented.
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('renders every line', () => {
    show();
    lines.forEach((line) => {
      expect(screen.getByText(line.text.split('\n')[0], { exact: false })).toBeTruthy();
    });
  });

  it('marks only the current line', () => {
    const { container } = show({ currentSegmentId: 'b2' });
    const marked = container.querySelectorAll('[aria-current="true"]');
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent).toBe(lines[1].text);
  });

  it('marks nothing before the teacher has begun', () => {
    const { container } = show({ currentSegmentId: null });
    expect(container.querySelectorAll('[aria-current="true"]')).toHaveLength(0);
  });

  it('gives a student prose, not controls', () => {
    const { container } = show();
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelectorAll('p')).toHaveLength(lines.length);
  });

  it('gives the teacher a button per line', async () => {
    const onPick = jest.fn();
    const { container } = show({ onPick });
    expect(container.querySelectorAll('button')).toHaveLength(lines.length);
    await userEvent.click(screen.getAllByRole('button')[2]);
    // The segment id, and nothing else — that is the whole protocol.
    expect(onPick).toHaveBeenCalledWith('c3');
  });

  it('keeps the kind as a class, for spacing', () => {
    const { container } = show();
    expect(container.querySelector('.classroom-reader__line--verse')).toBeTruthy();
    expect(container.querySelector('.classroom-reader__line--title')).toBeTruthy();
  });

  it('scrolls to the current line only when following', () => {
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    show({ currentSegmentId: 'b2', follow: false });
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

    show({ currentSegmentId: 'b2', follow: true });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth', block: 'center',
    });
  });
});
