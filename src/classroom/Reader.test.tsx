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

// The kinds the library actually returns — checked against
// /v2/editions/{id}/segmentation/segments. See kinds.test.ts.
const lines: Line[] = [
  {
    id: 'a1', idx: 0, text: '༄༅༅། །རྒྱ་གར་སྐད་དུ།', kind: 'front_matter',
  },
  {
    id: 'b2', idx: 1, text: 'བྱང་ཆུབ་སེམས་དཔའི་སྤྱོད་པ་ལ་འཇུག་པ།', kind: 'paragraph',
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
    expect(container.querySelector('.classroom-reader__line--front_matter')).toBeTruthy();
    expect(container.querySelector('.classroom-reader__line--paragraph')).toBeTruthy();
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

describe('Reader — following', () => {
  beforeAll(() => { Element.prototype.scrollIntoView = jest.fn(); });

  it('does not move the view when following is off', () => {
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    const { rerender } = show({ currentSegmentId: 'a1', follow: false });
    rerender(
      <IntlProvider locale="en">
        <Reader lines={lines} currentSegmentId="c3" follow={false} />
      </IntlProvider>,
    );
    // A student who scrolled back to re-read must stay where they are.
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls to the current line once the text arrives, for someone who joined mid-class', () => {
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    const wrap = (shown: typeof lines) => (
      <IntlProvider locale="en">
        <Reader lines={shown} currentSegmentId="b2" follow />
      </IntlProvider>
    );
    const { rerender } = render(wrap([]));
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    rerender(wrap(lines));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('holds still while paused, and does not catch up when the pause ends', () => {
    const wrap = (id: string, paused: boolean) => (
      <IntlProvider locale="en">
        <Reader lines={lines} currentSegmentId={id} follow paused={paused} />
      </IntlProvider>
    );
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    const { rerender } = render(wrap('a1', true));
    rerender(wrap('c3', true));
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    // The student finishes their note: nothing scrolls on its own.
    rerender(wrap('c3', false));
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    // The next move of the class is followed again.
    rerender(wrap('b2', false));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

describe('Reader with a translation', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  const withTranslation: Line[] = [
    {
      id: 'a1', idx: 0, text: 'བཀྲ་ཤིས།', kind: 'verse', translation: 'Be auspicious.',
    },
    {
      id: 'b2', idx: 1, text: 'ཁ་ཅིག', kind: 'paragraph',
    },
  ];

  it('puts the translation after the source, each in its own language', () => {
    const { container } = render(
      <IntlProvider locale="en">
        <Reader lines={withTranslation} currentSegmentId={null} follow={false} />
      </IntlProvider>,
    );
    const [first] = container.querySelectorAll('.classroom-reader__line');
    const [source, translation] = Array.from(
      first.querySelector('.classroom-reader__body')?.children ?? [],
    );
    expect(source.getAttribute('lang')).toBe('bo');
    expect(translation.getAttribute('lang')).toBe('en');
    expect(translation.textContent).toBe('Be auspicious.');
  });

  it('shows no translation element for a line that has none', () => {
    const { container } = render(
      <IntlProvider locale="en">
        <Reader lines={withTranslation} currentSegmentId={null} follow={false} />
      </IntlProvider>,
    );
    expect(container.querySelectorAll('.classroom-reader__translation')).toHaveLength(1);
  });

  it('keeps the translation inside the teacher\'s button, so one press means the source line', async () => {
    const onPick = jest.fn();
    render(
      <IntlProvider locale="en">
        <Reader lines={withTranslation} currentSegmentId={null} follow={false} onPick={onPick} />
      </IntlProvider>,
    );
    await userEvent.click(screen.getByText('Be auspicious.'));
    expect(onPick).toHaveBeenCalledWith('a1');
  });
});

describe('Reader views', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  const mixed: Line[] = [
    {
      id: 'a1', idx: 0, text: 'བཀྲ་ཤིས།', kind: 'verse', translation: 'Be auspicious.',
    },
    {
      id: 'b2', idx: 1, text: 'ཁ་ཅིག', kind: 'paragraph',
    },
  ];

  const view = (mode: 'source' | 'translation' | 'both') => render(
    <IntlProvider locale="en">
      <Reader lines={mixed} currentSegmentId={null} follow={false} view={mode} />
    </IntlProvider>,
  ).container;

  it('source shows no English', () => {
    const container = view('source');
    expect(container.querySelectorAll('.classroom-reader__translation')).toHaveLength(0);
    expect(container.querySelectorAll('.classroom-reader__source')).toHaveLength(2);
  });

  it('translation hides the source where there is English', () => {
    const container = view('translation');
    expect(container.querySelector('.classroom-reader__translation--alone')?.textContent)
      .toBe('Be auspicious.');
    expect(container.textContent).not.toContain('བཀྲ་ཤིས།');
  });

  it('translation still shows the source of a line that has no English', () => {
    expect(view('translation').textContent).toContain('ཁ་ཅིག');
  });

  it('both shows each line\'s source and its English', () => {
    const container = view('both');
    expect(container.querySelectorAll('.classroom-reader__source')).toHaveLength(2);
    expect(container.querySelectorAll('.classroom-reader__translation')).toHaveLength(1);
  });
});

describe('Reader prose layout', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  const text: Line[] = [
    {
      id: 'f', idx: 0, text: 'Title', kind: 'front_matter',
    },
    {
      id: 'v1', idx: 1, text: 'verse one', kind: 'verse',
    },
    {
      id: 'v2', idx: 2, text: 'verse two', kind: 'verse',
    },
    {
      id: 'p1', idx: 3, text: 'a paragraph', kind: 'paragraph',
    },
  ];

  const prose = (props: Partial<React.ComponentProps<typeof Reader>> = {}) => render(
    <IntlProvider locale="en">
      <Reader lines={text} currentSegmentId={null} follow={false} layout="prose" {...props} />
    </IntlProvider>,
  );

  it('runs consecutive verse lines into one paragraph, apart from the title and the next paragraph', () => {
    const { container } = prose();
    const paragraphs = container.querySelectorAll('.classroom-reader__paragraph');
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[1].querySelectorAll('.classroom-reader__segment')).toHaveLength(2);
  });

  it('marks only the current line, wherever it falls', () => {
    const { container } = prose({ currentSegmentId: 'v2' });
    const marked = container.querySelectorAll('[aria-current="true"]');
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent?.trim()).toBe('verse two');
  });

  it('gives the teacher a pressable line that names its segment id, by mouse and keyboard', async () => {
    const onPick = jest.fn();
    prose({ onPick });
    await userEvent.click(screen.getByText('verse one'));
    expect(onPick).toHaveBeenLastCalledWith('v1');
    screen.getByText('verse two').closest('[role="button"]')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(onPick).toHaveBeenLastCalledWith('v2');
  });

  it('gives a student plain text, not controls', () => {
    const { container } = prose();
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
  });
});

describe('Reader section titles', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  const body: Line[] = [
    {
      id: 'a', idx: 0, text: 'one', kind: 'paragraph',
    },
    {
      id: 'b', idx: 1, text: 'two', kind: 'verse',
    },
    {
      id: 'c', idx: 2, text: 'three', kind: 'verse',
    },
  ];
  const headings = new Map([
    ['b', [
      {
        id: 'h1', title: 'Part', depth: 0, segmentId: 'b',
      },
      {
        id: 'h2', title: 'Chapter', depth: 1, segmentId: 'b',
      },
    ]],
  ]);

  const draw = (layout: 'segmented' | 'prose', withHeadings = true) => render(
    <IntlProvider locale="en">
      <Reader
        lines={body}
        currentSegmentId={null}
        follow={false}
        layout={layout}
        headings={withHeadings ? headings : undefined}
      />
    </IntlProvider>,
  ).container;

  ['segmented', 'prose'].forEach((layout) => {
    it(`draws every heading that begins at a line, above it (${layout})`, () => {
      const container = draw(layout as 'segmented' | 'prose');
      const drawn = container.querySelectorAll('.classroom-reader__section');
      expect(Array.from(drawn).map((node) => node.textContent)).toEqual(['Part', 'Chapter']);
      const next = drawn[1].nextElementSibling;
      expect(next?.textContent).toContain('two');
    });

    it(`draws none when titles are hidden (${layout})`, () => {
      const container = draw(layout as 'segmented' | 'prose', false);
      expect(container.querySelectorAll('.classroom-reader__section')).toHaveLength(0);
    });
  });

  it('scrolls to the heading when jumping to the line it begins', () => {
    const scroll = jest.fn();
    Element.prototype.scrollIntoView = scroll;
    render(
      <IntlProvider locale="en">
        <Reader
          lines={body}
          currentSegmentId={null}
          follow={false}
          headings={headings}
          jump={{ segmentId: 'b', n: 1 }}
        />
      </IntlProvider>,
    );
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.instances[0].textContent).toBe('Part');
  });

  it('scrolls to the line itself when it has no heading', () => {
    const scroll = jest.fn();
    Element.prototype.scrollIntoView = scroll;
    render(
      <IntlProvider locale="en">
        <Reader
          lines={body}
          currentSegmentId={null}
          follow={false}
          jump={{ segmentId: 'c', n: 1 }}
        />
      </IntlProvider>,
    );
    expect(scroll.mock.instances[0].textContent).toContain('three');
  });
});

describe('Reader margin labels', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  const labelled: Line[] = [
    {
      id: 'a', idx: 0, text: 'front', kind: 'front_matter', reference: 'I-1',
    },
    {
      id: 'b', idx: 1, text: 'verse', kind: 'verse', reference: '1-1',
    },
    {
      id: 'c', idx: 2, text: 'unlabelled', kind: 'paragraph',
    },
  ];

  const draw = (layout: 'segmented' | 'prose', onPick?: () => void) => render(
    <IntlProvider locale="en">
      <Reader
        lines={labelled}
        currentSegmentId={null}
        follow={false}
        layout={layout}
        onPick={onPick}
      />
    </IntlProvider>,
  ).container;

  it('shows the library\'s label beside each segmented line that has one', () => {
    const container = draw('segmented');
    const labels = container.querySelectorAll('.classroom-reader__reference');
    expect(Array.from(labels).map((node) => node.textContent)).toEqual(['I-1', '1-1']);
  });

  it('shows no labels in prose, which reads as continuous text', () => {
    expect(draw('prose').querySelectorAll('.classroom-reader__reference')).toHaveLength(0);
  });

  it('hides the label from assistive technology', () => {
    const container = draw('segmented');
    expect(container.querySelector('.classroom-reader__reference')?.getAttribute('aria-hidden'))
      .toBe('true');
  });

  it('still names the line by its segment id when the teacher presses it', async () => {
    const onPick = jest.fn();
    draw('segmented', onPick);
    await userEvent.click(screen.getByText('verse'));
    expect(onPick).toHaveBeenCalledWith('b');
  });
});

describe('Reader numbered section titles', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  const heading = (title: string) => {
    const { container } = render(
      <IntlProvider locale="en">
        <Reader
          lines={[{
            id: 'a', idx: 0, text: 'one', kind: 'paragraph',
          }]}
          currentSegmentId={null}
          follow={false}
          headings={new Map([['a', [{
            id: 'h', title, depth: 0, segmentId: 'a',
          }]]])}
        />
      </IntlProvider>,
    );
    return container.querySelector('.classroom-reader__section') as HTMLElement;
  };

  it('sets a leading number apart from the title, so the two can be aligned', () => {
    const drawn = heading('1. བདེན་གཉིས།');
    expect(drawn.querySelector('.classroom-reader__section-number')?.textContent).toBe('1.');
    expect(drawn.querySelector('.classroom-reader__section-title')?.textContent).toBe('བདེན་གཉིས།');
  });

  it('keeps the whole title as the accessible name', () => {
    expect(heading('1. བདེན་གཉིས།').getAttribute('aria-label')).toBe('1. བདེན་གཉིས།');
  });

  it('handles a nested number such as 2.3', () => {
    expect(heading('2.3 Title').querySelector('.classroom-reader__section-number')?.textContent)
      .toBe('2.3');
  });

  it('leaves a title with no number whole', () => {
    const drawn = heading('མཛད་བྱང།');
    expect(drawn.querySelector('.classroom-reader__section-number')).toBeNull();
    expect(drawn.textContent).toBe('མཛད་བྱང།');
  });
});
