/**
 * Notes on the class page: students only, private, drawn in the text.
 *
 * The connection and the text are stand-ins, and so is the server; the selection is a real
 * browser selection (in jsdom), because turning one into a note is the whole feature.
 */

import { IntlProvider } from '@edx/frontend-platform/i18n';
import {
  act, fireEvent, render, screen, waitFor, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ClassroomPage from './ClassroomPage';
import * as api from './api';
import { clearLookupCache } from './dictionary';
import { rememberSession } from './session';
import { useRoom, type Room } from './useRoom';
import { useText } from './useText';
import type { Note, RoomState } from './types';

jest.mock('./api');
jest.mock('./useRoom');
jest.mock('./useText');
jest.mock('./useOutline', () => ({ useOutline: () => [] }));
jest.mock('react-helmet', () => ({ Helmet: () => null }));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedUseRoom = useRoom as jest.MockedFunction<typeof useRoom>;
const mockedUseText = useText as jest.MockedFunction<typeof useText>;

const lines = [
  {
    id: 's1', idx: 0, text: 'one two three', translation: 'uno dos tres', kind: 'verse',
  },
  {
    id: 's2', idx: 1, text: 'four five six', kind: 'paragraph',
  },
];

const state = (overrides: Partial<RoomState> = {}): RoomState => ({
  code: 'ABC234',
  name: 'A class',
  editionId: 'ed',
  segmentationId: 'seg',
  title: 'A class',
  currentSegmentId: null,
  participantCount: 2,
  teacherHere: true,
  role: 'student',
  ...overrides,
});

const room = (overrides: Partial<Room> = {}): Room => ({
  connected: true,
  state: state(),
  error: null,
  ended: null,
  joinRejected: false,
  goto: jest.fn(),
  endSession: jest.fn(),
  ...overrides,
});

const note = (overrides: Partial<Note> = {}): Note => ({
  id: 'n1',
  segmentId: 's1',
  layer: 'source',
  startOffset: 4,
  endOffset: 7,
  quote: 'two',
  prefix: 'one ',
  suffix: ' three',
  color: 'green',
  body: 'my thought',
  createdAt: '2026-01-01T00:00:00',
  updatedAt: '2026-01-01T00:00:00',
  ...overrides,
});

const page = () => (
  <IntlProvider locale="en"><ClassroomPage /></IntlProvider>
);

const open = () => {
  window.history.replaceState(null, '', '/classroom?room=ABC234');
  rememberSession({ code: 'ABC234' });
  return render(page());
};

/** Select words inside a line's text, the way a finger or a mouse would. */
const selectWords = async (segmentId: string, layer: string, from: number, to: number) => {
  const el = document.querySelector(`[data-segment-id="${segmentId}"] [data-layer="${layer}"]`) as Element;
  const text = el.firstChild as Text;
  const range = document.createRange();
  range.setStart(text, from);
  range.setEnd(text, to);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  act(() => { document.dispatchEvent(new Event('selectionchange')); });
};

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
  // jsdom has no layout, so a selection has no box of its own, and no DOMRect either.
  Range.prototype.getBoundingClientRect = () => ({
    x: 10, y: 20, top: 20, left: 10, width: 30, height: 10, bottom: 30, right: 40, toJSON: () => ({}),
  }) as DOMRect;
});

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  (Element.prototype.scrollIntoView as jest.Mock).mockClear?.();
  mockedUseRoom.mockReturnValue(room());
  mockedUseText.mockReturnValue({ lines, loading: false, error: null });
  mockedApi.listNotes.mockResolvedValue([]);
  mockedApi.listMembers.mockResolvedValue([]);
  mockedApi.myClasses.mockResolvedValue([]);
  window.getSelection()?.removeAllRanges();
});

describe('who gets notes', () => {
  it('a student has a notes button, and their notes are fetched for this class', async () => {
    open();
    expect(screen.getByRole('button', { name: /my notes/i })).toBeTruthy();
    await waitFor(() => expect(mockedApi.listNotes).toHaveBeenCalledWith('ABC234'));
  });

  it('a teacher has none: no button, no fetch, and selecting words does nothing', async () => {
    mockedUseRoom.mockReturnValue(room({ state: state({ role: 'teacher' }) }));
    open();
    expect(screen.queryByRole('button', { name: /my notes/i })).toBeNull();
    await selectWords('s1', 'source', 4, 7);
    await new Promise((resolve) => { setTimeout(resolve, 300); });
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(mockedApi.listNotes).not.toHaveBeenCalled();
  });
});

describe('highlights in the text', () => {
  it('draws a saved note over exactly its words', async () => {
    mockedApi.listNotes.mockResolvedValue([note()]);
    open();
    const mark = await waitFor(() => {
      const found = document.querySelector('.classroom-note--green');
      expect(found).not.toBeNull();
      return found as Element;
    });
    expect(mark.textContent).toBe('two');
    // The line's own text is unchanged by it.
    expect(document.querySelector('[data-segment-id="s1"] [data-layer="source"]')?.textContent).toBe('one two three');
  });

  it('draws a note on the translation only on the translation', async () => {
    mockedApi.listNotes.mockResolvedValue([note({
      layer: 'translation', startOffset: 4, endOffset: 7, quote: 'dos', prefix: 'uno ', suffix: ' tres', color: 'pink',
    })]);
    open();
    await waitFor(() => expect(document.querySelector('.classroom-note--pink')).not.toBeNull());
    expect(document.querySelector('[data-layer="translation"] .classroom-note--pink')?.textContent).toBe('dos');
    expect(document.querySelector('[data-layer="source"] .classroom-note--pink')).toBeNull();
  });

  it('finds the words again when the line has changed under a note', async () => {
    mockedApi.listNotes.mockResolvedValue([note({ startOffset: 0, endOffset: 3 })]);
    open();
    await waitFor(() => expect(document.querySelector('.classroom-note')).not.toBeNull());
    expect(document.querySelector('.classroom-note')?.textContent).toBe('two');
  });

  it('draws nothing for a note whose words are gone, and says so in the list', async () => {
    mockedApi.listNotes.mockResolvedValue([note({
      quote: 'vanished', prefix: '', suffix: '', startOffset: 0, endOffset: 8,
    })]);
    open();
    await waitFor(() => expect(mockedApi.listNotes).toHaveBeenCalled());
    expect(document.querySelector('.classroom-note')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    expect(await screen.findByText(/can no longer be placed/i)).toBeTruthy();
    expect(screen.getByText('vanished')).toBeTruthy();
  });
});

describe('making a highlight', () => {
  it('shows colours over selected words, and one press saves a plain highlight', async () => {
    mockedApi.createNote.mockImplementation(async (_code, n) => note({ ...n, id: 'new', color: n.color }));
    open();
    await selectWords('s1', 'source', 4, 7);
    await screen.findByRole('toolbar');

    await userEvent.click(screen.getByRole('button', { name: /highlight in blue/i }));

    expect(mockedApi.createNote).toHaveBeenCalledWith('ABC234', {
      segmentId: 's1',
      layer: 'source',
      startOffset: 4,
      endOffset: 7,
      quote: 'two',
      prefix: 'one ',
      suffix: ' three',
      color: 'blue',
      body: null,
    });
    await waitFor(() => expect(document.querySelector('.classroom-note--blue')?.textContent).toBe('two'));
    // And the bar goes away: there is no selection left to act on.
    await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
  });

  it('saves it as the words as they will be drawn: widened to whole words', async () => {
    mockedApi.createNote.mockImplementation(async (_code, n) => note({ ...n, id: 'new' }));
    open();
    await selectWords('s2', 'source', 3, 7); // "r fi", from inside "four" to inside "five"
    await screen.findByRole('toolbar');
    await userEvent.click(screen.getByRole('button', { name: /highlight in yellow/i }));
    expect(mockedApi.createNote.mock.calls[0][1]).toMatchObject({ quote: 'four five', startOffset: 0, endOffset: 9 });
  });

  it('shows why a highlight could not be saved, and keeps nothing', async () => {
    mockedApi.createNote.mockRejectedValue(new Error('You have reached the limit of notes for this class'));
    open();
    await selectWords('s1', 'source', 4, 7);
    await userEvent.click(await screen.findByRole('button', { name: /highlight in green/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/limit of notes/);
    expect(document.querySelector('.classroom-note')).toBeNull();
  });

  it('offers nothing for a selection that crosses two lines', async () => {
    open();
    const a = document.querySelector('[data-segment-id="s1"] [data-layer="source"]')!.firstChild as Text;
    const b = document.querySelector('[data-segment-id="s2"] [data-layer="source"]')!.firstChild as Text;
    const range = document.createRange();
    range.setStart(a, 4);
    range.setEnd(b, 4);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    act(() => { document.dispatchEvent(new Event('selectionchange')); });
    await new Promise((resolve) => { setTimeout(resolve, 300); });
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});

describe('adding a note', () => {
  it('opens a dialog on the selected words and saves the words with the note', async () => {
    mockedApi.createNote.mockImplementation(async (_code, n) => note({ ...n, id: 'new' }));
    open();
    await selectWords('s1', 'source', 4, 7);
    await userEvent.click(await screen.findByRole('button', { name: /add note/i }));

    expect(await screen.findByRole('dialog', { name: /add a note/i })).toBeTruthy();
    expect(screen.getAllByText('two').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('radio', { name: 'pink' }));
    await userEvent.type(screen.getByRole('textbox'), '  remember this  ');
    await userEvent.click(screen.getByRole('button', { name: /^save note$/i }));

    await waitFor(() => expect(mockedApi.createNote).toHaveBeenCalled());
    expect(mockedApi.createNote.mock.calls[0][1]).toMatchObject({ color: 'pink', body: 'remember this', quote: 'two' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /add a note/i })).toBeNull());
  });

  it('shows a refusal in the dialog, and keeps what was typed', async () => {
    mockedApi.createNote.mockRejectedValue(new Error('Your login has expired. Please log in again.'));
    open();
    await selectWords('s1', 'source', 4, 7);
    await userEvent.click(await screen.findByRole('button', { name: /add note/i }));
    await userEvent.type(await screen.findByRole('textbox'), 'precious');
    await userEvent.click(screen.getByRole('button', { name: /^save note$/i }));
    expect(await screen.findByText(/login has expired/i)).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('precious');
  });
});

describe('looking at and changing a note', () => {
  beforeEach(() => { mockedApi.listNotes.mockResolvedValue([note()]); });

  const openIt = async () => {
    open();
    await userEvent.click(await waitFor(() => {
      const found = document.querySelector('.classroom-note');
      expect(found).not.toBeNull();
      return found as Element;
    }));
  };

  it('opens the note when its highlight is pressed', async () => {
    await openIt();
    expect(await screen.findByRole('dialog', { name: /edit note/i })).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('my thought');
  });

  it('changes the colour and the words, sending only what a note may change', async () => {
    mockedApi.updateNote.mockImplementation(async (_c, _id, change) => note({ color: change.color ?? 'green', body: change.body ?? null }));
    await openIt();
    await userEvent.click(await screen.findByRole('radio', { name: 'blue' }));
    const box = screen.getByRole('textbox');
    await userEvent.clear(box);
    await userEvent.type(box, 'a better thought');
    await userEvent.click(screen.getByRole('button', { name: /^save note$/i }));
    await waitFor(() => expect(mockedApi.updateNote).toHaveBeenCalledWith('ABC234', 'n1', { color: 'blue', body: 'a better thought' }));
  });

  it('clearing the words leaves a plain highlight', async () => {
    mockedApi.updateNote.mockImplementation(async () => note({ body: null }));
    await openIt();
    await userEvent.clear(await screen.findByRole('textbox'));
    await userEvent.click(screen.getByRole('button', { name: /^save note$/i }));
    await waitFor(() => expect(mockedApi.updateNote).toHaveBeenCalledWith('ABC234', 'n1', { color: 'green', body: null }));
  });

  it('deletes the note and removes its highlight', async () => {
    mockedApi.deleteNote.mockResolvedValue(undefined);
    await openIt();
    await userEvent.click(await screen.findByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(mockedApi.deleteNote).toHaveBeenCalledWith('ABC234', 'n1'));
    await waitFor(() => expect(document.querySelector('.classroom-note')).toBeNull());
  });

  it('does not open a note when a drag over a highlight lets go', async () => {
    open();
    const mark = await waitFor(() => {
      const found = document.querySelector('.classroom-note');
      expect(found).not.toBeNull();
      return found as Element;
    });
    await selectWords('s2', 'source', 0, 4);
    fireEvent.click(mark);
    expect(screen.queryByRole('dialog', { name: /edit note/i })).toBeNull();
  });
});

describe('my notes', () => {
  const second = () => note({
    id: 'n2', segmentId: 's2', quote: 'five', prefix: 'four ', suffix: ' six', startOffset: 5, endOffset: 9, color: 'yellow', body: 'other',
  });

  it('drops a colour filter once no note has that colour, so every note shows again', async () => {
    mockedApi.listNotes.mockResolvedValue([note(), second()]);
    mockedApi.deleteNote.mockResolvedValue(undefined);
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    await userEvent.click(await screen.findByRole('button', { name: /only green/i }));
    expect(screen.queryByText('other')).toBeNull();
    // The only green note goes.
    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Edit note' })).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('other')).toBeTruthy();
    expect(screen.queryByText(/no notes in this colou?r/i)).toBeNull();
  });

  it('keeps what has been written when another highlight is clicked', async () => {
    mockedApi.listNotes.mockResolvedValue([note(), second()]);
    open();
    await waitFor(() => expect(document.querySelector('[data-note-id="n1"]')).not.toBeNull());
    await userEvent.click(document.querySelector('[data-note-id="n1"]') as HTMLElement);
    const box = await screen.findByRole('textbox', { name: /note/i });
    await userEvent.clear(box);
    await userEvent.type(box, 'half a thought');
    await userEvent.click(document.querySelector('[data-note-id="n2"]') as HTMLElement);
    expect((screen.getByRole('textbox', { name: /note/i }) as HTMLTextAreaElement).value).toBe('half a thought');
  });

  it('opens another note when nothing has been written in the open one', async () => {
    mockedApi.listNotes.mockResolvedValue([note(), second()]);
    open();
    await waitFor(() => expect(document.querySelector('[data-note-id="n1"]')).not.toBeNull());
    await userEvent.click(document.querySelector('[data-note-id="n1"]') as HTMLElement);
    await screen.findByRole('textbox', { name: /note/i });
    await userEvent.click(document.querySelector('[data-note-id="n2"]') as HTMLElement);
    await waitFor(() => expect((screen.getByRole('textbox', { name: /note/i }) as HTMLTextAreaElement).value).toBe('other'));
  });

  it('puts the list away when a note is edited on a screen where it lies over the text', async () => {
    const width = window.innerWidth;
    mockedApi.listNotes.mockResolvedValue([note()]);
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
    try {
      await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
      await screen.findByRole('dialog', { name: 'Edit note' });
      expect(screen.queryByRole('dialog', { name: 'My notes' })).toBeNull();
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    }
  });

  it('keeps the list open beside the text on a wide screen when a note is edited', async () => {
    mockedApi.listNotes.mockResolvedValue([note()]);
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByRole('dialog', { name: 'Edit note' });
    expect(screen.getByRole('dialog', { name: 'My notes' })).toBeTruthy();
  });

  it('lists every note in reading order, with its words', async () => {
    mockedApi.listNotes.mockResolvedValue([
      note({
        id: 'b', segmentId: 's2', quote: 'five', prefix: 'four ', suffix: ' six', startOffset: 5, endOffset: 9, body: 'second',
      }),
      note({ id: 'a', body: 'first' }),
    ]);
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    await screen.findByText('first');
    const bodies = Array.from(document.querySelectorAll('.classroom-notes-panel__body')).map((n) => n.textContent);
    expect(bodies).toEqual(['first', 'second']);
  });

  it('says there are none yet, and that they are private', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    expect(await screen.findByText(/no notes yet/i)).toBeTruthy();
    expect(screen.getAllByText(/only you can see your notes/i).length).toBeGreaterThan(0);
  });

  it('narrows the list to one colour, when more than one is in use', async () => {
    mockedApi.listNotes.mockResolvedValue([
      note({ id: 'a', body: 'green one', color: 'green' }),
      note({
        id: 'b', segmentId: 's2', quote: 'five', prefix: 'four ', suffix: ' six', startOffset: 5, endOffset: 9, body: 'pink one', color: 'pink',
      }),
    ]);
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    expect(await screen.findByText('2 notes')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Only pink' }));
    expect(screen.queryByText('green one')).toBeNull();
    expect(screen.getByText('pink one')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('green one')).toBeTruthy();
  });

  it('opens a note to change it from the pen on its card', async () => {
    mockedApi.listNotes.mockResolvedValue([note()]);
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('dialog', { name: /edit note/i })).toBeTruthy();
  });

  it('goes to the line a note is on', async () => {
    mockedApi.listNotes.mockResolvedValue([note({
      segmentId: 's2', quote: 'five', prefix: 'four ', suffix: ' six', startOffset: 5, endOffset: 9,
    })]);
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    await userEvent.click(await screen.findByRole('button', { name: /go to line/i }));
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  });
});

describe('following the teacher', () => {
  it('waits while a student has words selected, so the screen does not move under them', async () => {
    const { rerender } = open();
    await selectWords('s1', 'source', 4, 7);
    await screen.findByRole('toolbar');
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();

    // The teacher moves on.
    mockedUseRoom.mockReturnValue(room({ state: state({ currentSegmentId: 's2' }) }));
    rerender(page());
    await new Promise((resolve) => { setTimeout(resolve, 100); });
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('follows as usual when nothing is selected', async () => {
    const { rerender } = open();
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    mockedUseRoom.mockReturnValue(room({ state: state({ currentSegmentId: 's2' }) }));
    rerender(page());
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  });
});

describe('looking words up', () => {
  const tibetan = [{
    id: 't1', idx: 0, text: 'བྱང་ཆུབ་སེམས་དཔའ་', translation: 'bodhisattva', kind: 'verse',
  }];

  beforeEach(() => {
    clearLookupCache();
    mockedUseText.mockReturnValue({ lines: tibetan, loading: false, error: null });
  });

  it('offers "Look up" over Tibetan, and shows what the words mean', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tokens: ['བྱང་ཆུབ་སེམས་'], text: [['the mind of awakening']], source: [['ives_waldo']],
      }),
    })) as unknown as typeof fetch;
    open();
    // བྱང་ཆུབ་སེམས
    await selectWords('t1', 'source', 0, 12);
    await screen.findByRole('toolbar');

    await userEvent.click(screen.getByRole('button', { name: /look up/i }));

    expect(await screen.findByText('the mind of awakening')).toBeTruthy();
    expect(document.querySelector('.classroom-dictionary__name')?.textContent).toBe('Ives Waldo');
    expect(new URL((global.fetch as jest.Mock).mock.calls[0][0]).searchParams.get('query')).toBe('བྱང་ཆུབ་སེམས');
    // The words are gone from the selection: the panel has them now.
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('shows each meaning straight away, labelled with its dictionary, and opens a long one', async () => {
    const long = `${'the mind of awakening '.repeat(12)}end`;
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tokens: ['བྱང་ཆུབ་སེམས་'],
        text: [['the mind of awakening', `${long}`]],
        source: [['ives_waldo', 'monlam']],
      }),
    })) as unknown as typeof fetch;
    open();
    await selectWords('t1', 'source', 0, 12);
    await userEvent.click(await screen.findByRole('button', { name: /look up/i }));

    expect(await screen.findByText('Meanings from 2 dictionaries')).toBeTruthy();
    // No card to open first: the short meaning is there, and needs no "Show more".
    expect(screen.getByText('the mind of awakening')).toBeTruthy();
    const cards = document.querySelectorAll('.classroom-dictionary__entry');
    expect(cards).toHaveLength(2);
    expect(within(cards[0] as HTMLElement).queryByRole('button', { name: 'Show more' })).toBeNull();
    // The long one is cut short until asked.
    expect(cards[1].classList.contains('classroom-dictionary__entry--short')).toBe(true);
    await userEvent.click(within(cards[1] as HTMLElement).getByRole('button', { name: 'Show more' }));
    expect(cards[1].classList.contains('classroom-dictionary__entry--short')).toBe(false);
    expect(within(cards[1] as HTMLElement).getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('says plainly when nothing is found, and offers the dictionaries to choose from', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 404, json: async () => ({ detail: 'Not Found' }) })) as unknown as typeof fetch;
    open();
    await selectWords('t1', 'source', 0, 12);
    await userEvent.click(await screen.findByRole('button', { name: /look up/i }));
    expect(await screen.findByText('No match found')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Choose dictionaries' }));
    expect(screen.getByRole('button', { name: /dictionaries · 5 of 20/i }).getAttribute('aria-expanded')).toBe('true');
  });

  it('turns dictionaries on and off as chips, keeps at least one, and can reset', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true, status: 200, json: async () => ({ tokens: ['x'], text: [['m']], source: [['monlam']] }),
    })) as unknown as typeof fetch;
    open();
    await selectWords('t1', 'source', 0, 12);
    await userEvent.click(await screen.findByRole('button', { name: /look up/i }));
    await userEvent.click(await screen.findByRole('button', { name: /dictionaries · 5 of 20/i }));

    await userEvent.click(screen.getByRole('button', { name: 'Sera' }));
    expect(screen.getByRole('button', { name: 'Sera' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /6 of 20/i })).toBeTruthy();
    expect(new URL((global.fetch as jest.Mock).mock.calls.at(-1)[0]).searchParams.get('dictionaries')).toContain('sera');

    await userEvent.click(screen.getByRole('button', { name: 'Reset to default' }));
    expect(screen.getByRole('button', { name: /5 of 20/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sera' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('does not offer it over the English', async () => {
    open();
    await selectWords('t1', 'translation', 0, 11);
    await screen.findByRole('toolbar');
    expect(screen.queryByRole('button', { name: /look up/i })).toBeNull();
  });

  it('says so, and offers to try again, when the dictionary cannot be reached', async () => {
    global.fetch = jest.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    open();
    await selectWords('t1', 'source', 0, 12);
    await userEvent.click(await screen.findByRole('button', { name: /look up/i }));
    expect(await screen.findByText(/could not reach the dictionary/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });
});

describe('the side panels', () => {
  const tibetan = [{
    id: 't1', idx: 0, text: 'བྱང་ཆུབ་སེམས་དཔའ་', translation: 'bodhisattva', kind: 'verse',
  }, {
    id: 't2', idx: 1, text: 'སེམས་ཅན་', kind: 'verse',
  }];
  const answer = (word: string, meaning: string) => ({
    ok: true,
    status: 200,
    json: async () => ({ tokens: [word], text: [[meaning]], source: [['ives_waldo']] }),
  });

  beforeEach(() => {
    clearLookupCache();
    mockedUseText.mockReturnValue({ lines: tibetan, loading: false, error: null });
  });

  it('gives focus back to the button that opened a panel when it is closed', async () => {
    open();
    const button = await screen.findByRole('button', { name: /my notes/i });
    await userEvent.click(button);
    await screen.findByRole('dialog', { name: 'My notes' });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'My notes' })).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('shows one at a time: looking words up puts the notes away', async () => {
    global.fetch = jest.fn(async () => answer('སེམས་', 'mind')) as unknown as typeof fetch;
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    expect(screen.getByRole('dialog', { name: 'My notes' })).toBeTruthy();

    await selectWords('t1', 'source', 8, 12);
    await userEvent.click(await screen.findByRole('button', { name: /look up/i }));

    expect(await screen.findByRole('dialog', { name: 'Dictionary' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'My notes' })).toBeNull();
  });

  it('keeps the dictionary open, and shows the next words looked up in it', async () => {
    const answers = [answer('བྱང་ཆུབ་', 'awakening'), answer('སེམས་ཅན་', 'sentient being')];
    global.fetch = jest.fn(async () => answers.shift()) as unknown as typeof fetch;
    open();
    await selectWords('t1', 'source', 0, 7);
    await userEvent.click(await screen.findByRole('button', { name: /look up/i }));
    expect(await screen.findByText('awakening')).toBeTruthy();

    // Still open: the next words can be selected beside it.
    await selectWords('t2', 'source', 0, 7);
    await userEvent.click(await screen.findByRole('button', { name: /look up/i }));
    expect(await screen.findByText('sentient being')).toBeTruthy();
    expect(screen.getAllByRole('dialog', { name: 'Dictionary' })).toHaveLength(1);
  });

  it('does not stop the student following the teacher while one is open', async () => {
    const { rerender } = open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    mockedUseRoom.mockReturnValue(room({ state: state({ currentSegmentId: 't2' }) }));
    rerender(page());
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    expect(screen.getByRole('dialog', { name: 'My notes' })).toBeTruthy();
  });

  it('moves the text over while one is open, and closes on Escape', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    expect(document.querySelector('.classroom-page--panel')).not.toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'My notes' })).toBeNull();
    expect(document.querySelector('.classroom-page--panel')).toBeNull();
  });

  it('stays open after "Go to line" on a wide screen', async () => {
    mockedApi.listNotes.mockResolvedValue([note({
      segmentId: 't1', startOffset: 0, endOffset: 7, quote: 'བྱང་ཆུབ', prefix: '', suffix: '་སེམས་དཔའ་',
    })]);
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    await userEvent.click(await screen.findByRole('button', { name: /go to line/i }));
    expect(screen.getByRole('dialog', { name: 'My notes' })).toBeTruthy();
  });
});

describe('the note form', () => {
  const openForm = async () => {
    open();
    await selectWords('s1', 'source', 4, 7);
    await userEvent.click(await screen.findByRole('button', { name: /add note/i }));
    return screen.findByRole('textbox');
  };

  it('is ready to type in, with no title row taking room, and a cross to close it', async () => {
    const box = await openForm();
    expect(document.activeElement).toBe(box);
    expect(screen.getByRole('dialog', { name: 'Add a note' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Add a note' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save note' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a note' })).toBeNull());
  });

  it('shows the words in the colour being chosen', async () => {
    await openForm();
    const mark = document.querySelector('.classroom-note-dialog__mark') as Element;
    expect(mark.textContent).toBe('two');
    expect(mark.classList.contains('classroom-note--yellow')).toBe(true);
    await userEvent.click(screen.getByRole('radio', { name: 'green' }));
    expect(mark.classList.contains('classroom-note--green')).toBe(true);
    expect(screen.getByRole('radio', { name: 'green' }).getAttribute('aria-checked')).toBe('true');
  });

  it('is a bubble pointing at the selected words, not a modal over the page', async () => {
    await openForm();
    const bubble = screen.getByRole('dialog', { name: 'Add a note' });
    expect(bubble.classList.contains('classroom-note-bubble')).toBe(true);
    expect(bubble.getAttribute('aria-modal')).toBeNull();
    // The selection's box is at the top of the screen (see beforeAll), so it goes underneath.
    expect(bubble.classList.contains('classroom-note-bubble--below')).toBe(true);
  });

  it('closes on a click elsewhere, but not once something has been written', async () => {
    const box = await openForm();
    await userEvent.type(box, 'half a thought');
    fireEvent.mouseDown(document.body);
    expect(screen.getByRole('dialog', { name: 'Add a note' })).toBeTruthy();
    await userEvent.clear(box);
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a note' })).toBeNull());
  });

  it('highlights the words in the text while it is open, in the colour being chosen', async () => {
    const line = {
      x: 10, y: 20, top: 20, left: 10, width: 30, height: 10, bottom: 30, right: 40, toJSON: () => ({}),
    } as DOMRect;
    const had = (Range.prototype as any).getClientRects;
    (Range.prototype as any).getClientRects = () => [line, line];
    try {
      await openForm();
      const drawn = document.querySelectorAll('.classroom-note-preview');
      // The same line reported twice is drawn once.
      expect(drawn).toHaveLength(1);
      expect(drawn[0].classList.contains('classroom-note--yellow')).toBe(true);
      await userEvent.click(screen.getByRole('radio', { name: 'pink' }));
      expect(document.querySelector('.classroom-note-preview')?.classList.contains('classroom-note--pink')).toBe(true);
      await userEvent.click(screen.getByRole('button', { name: /^close$/i }));
      await waitFor(() => expect(document.querySelector('.classroom-note-preview')).toBeNull());
    } finally {
      (Range.prototype as any).getClientRects = had;
    }
  });

  it('saves with Ctrl+Enter', async () => {
    mockedApi.createNote.mockImplementation(async (_code, n) => note({ ...n, id: 'new' }));
    const box = await openForm();
    await userEvent.type(box, 'quick one{Control>}{Enter}{/Control}');
    await waitFor(() => expect(mockedApi.createNote).toHaveBeenCalled());
    expect(mockedApi.createNote.mock.calls[0][1]).toMatchObject({ body: 'quick one' });
  });
});

describe('hiding my highlights', () => {
  const hide = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Reading options' }));
    const group = screen.getByRole('group', { name: 'My highlights' });
    await userEvent.click(within(group).getByText('Hide'));
  };

  it('takes them out of the text, remembers it, and keeps the notes in the list', async () => {
    mockedApi.listNotes.mockResolvedValue([note()]);
    open();
    await waitFor(() => expect(document.querySelector('.classroom-note')).not.toBeNull());
    await hide();
    expect(document.querySelector('.classroom-note')).toBeNull();
    expect(localStorage.getItem('classroom.highlights')).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    expect(await screen.findByText('my thought')).toBeTruthy();
  });

  it('starts hidden when that was the choice last time', async () => {
    localStorage.setItem('classroom.highlights', 'hidden');
    mockedApi.listNotes.mockResolvedValue([note()]);
    open();
    await waitFor(() => expect(mockedApi.listNotes).toHaveBeenCalled());
    await screen.findByRole('button', { name: /my notes/i });
    expect(document.querySelector('.classroom-note')).toBeNull();
  });

  it('shows them again when a new highlight is made', async () => {
    localStorage.setItem('classroom.highlights', 'hidden');
    mockedApi.listNotes.mockResolvedValue([note()]);
    mockedApi.createNote.mockImplementation(async (_code, n) => note({ ...n, id: 'new' }));
    open();
    await selectWords('s2', 'source', 0, 4);
    await userEvent.click(await screen.findByRole('button', { name: /highlight in blue/i }));
    await waitFor(() => expect(document.querySelectorAll('.classroom-note').length).toBeGreaterThan(1));
    expect(localStorage.getItem('classroom.highlights')).toBe('shown');
  });

  it('shows a note\'s words for a moment when it is gone to from the list', async () => {
    localStorage.setItem('classroom.highlights', 'hidden');
    mockedApi.listNotes.mockResolvedValue([note()]);
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    await userEvent.click(await screen.findByRole('button', { name: /go to line/i }));
    await waitFor(() => expect(document.querySelector('.classroom-page--flash .classroom-note')?.textContent).toBe('two'));
  });

  it('flashes again on a second press of the same note, after the first has gone', async () => {
    localStorage.setItem('classroom.highlights', 'hidden');
    mockedApi.listNotes.mockResolvedValue([note()]);
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    const card = await screen.findByRole('button', { name: /go to line/i });
    await userEvent.click(card);
    await waitFor(() => expect(document.querySelector('.classroom-page--flash .classroom-note')).not.toBeNull());
    // Held, then faded, then taken out of the text.
    await waitFor(() => expect(document.querySelector('.classroom-page--flash-fade')).not.toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(document.querySelector('.classroom-note')).toBeNull(), { timeout: 3000 });
    await userEvent.click(card);
    await waitFor(() => expect(document.querySelector('.classroom-page--flash .classroom-note')?.textContent).toBe('two'));
    expect(document.querySelector('.classroom-page--flash-fade')).toBeNull();
  }, 10000);

  it('brings the line to the middle of the screen, clear of the top bar', async () => {
    mockedApi.listNotes.mockResolvedValue([note()]);
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    await userEvent.click(await screen.findByRole('button', { name: /go to line/i }));
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' }));
  });

  it('tags a note on the hidden side, and leaves the side hidden when it is gone to', async () => {
    localStorage.setItem('classroom.view', 'source');
    mockedApi.listNotes.mockResolvedValue([note({
      id: 'n2', layer: 'translation', startOffset: 4, endOffset: 7, quote: 'dos', prefix: 'uno ', suffix: ' tres',
    })]);
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    expect(await screen.findByText('Translation is hidden')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /go to line/i }));
    expect(document.querySelector('[data-layer="translation"]')).toBeNull();
    expect(localStorage.getItem('classroom.view')).toBe('source');
  });

  it('draws a note\'s highlight while it is edited, for the bubble to point at', async () => {
    localStorage.setItem('classroom.highlights', 'hidden');
    mockedApi.listNotes.mockResolvedValue([note()]);
    open();
    await userEvent.click(screen.getByRole('button', { name: /my notes/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByRole('dialog', { name: 'Edit note' });
    expect(document.querySelector('.classroom-reader [data-note-id="n1"]')?.textContent).toBe('two');
    await waitFor(() => expect(document.querySelector('.classroom-note-bubble--floating')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(document.querySelector('.classroom-note')).toBeNull());
  });

  it('is not offered to a teacher, who has no highlights', async () => {
    mockedUseRoom.mockReturnValue(room({ state: state({ role: 'teacher' }) }));
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Reading options' }));
    expect(screen.queryByRole('group', { name: 'My highlights' })).toBeNull();
  });
});
