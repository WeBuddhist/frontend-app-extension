/**
 * Notes on the class page: students only, private, drawn in the text.
 *
 * The connection and the text are stand-ins, and so is the server; the selection is a real
 * browser selection (in jsdom), because turning one into a note is the whole feature.
 */

import { IntlProvider } from '@edx/frontend-platform/i18n';
import {
  act, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ClassroomPage from './ClassroomPage';
import * as api from './api';
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

    expect(await screen.findByRole('heading', { name: /add a note/i })).toBeTruthy();
    expect(screen.getAllByText('two').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('radio', { name: 'pink' }));
    await userEvent.type(screen.getByRole('textbox'), '  remember this  ');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mockedApi.createNote).toHaveBeenCalled());
    expect(mockedApi.createNote.mock.calls[0][1]).toMatchObject({ color: 'pink', body: 'remember this', quote: 'two' });
    await waitFor(() => expect(screen.queryByRole('heading', { name: /add a note/i })).toBeNull());
  });

  it('shows a refusal in the dialog, and keeps what was typed', async () => {
    mockedApi.createNote.mockRejectedValue(new Error('Your login has expired. Please log in again.'));
    open();
    await selectWords('s1', 'source', 4, 7);
    await userEvent.click(await screen.findByRole('button', { name: /add note/i }));
    await userEvent.type(await screen.findByRole('textbox'), 'precious');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
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
    expect(await screen.findByRole('heading', { name: /your note/i })).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('my thought');
  });

  it('changes the colour and the words, sending only what a note may change', async () => {
    mockedApi.updateNote.mockImplementation(async (_c, _id, change) => note({ color: change.color ?? 'green', body: change.body ?? null }));
    await openIt();
    await userEvent.click(await screen.findByRole('radio', { name: 'blue' }));
    const box = screen.getByRole('textbox');
    await userEvent.clear(box);
    await userEvent.type(box, 'a better thought');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(mockedApi.updateNote).toHaveBeenCalledWith('ABC234', 'n1', { color: 'blue', body: 'a better thought' }));
  });

  it('clearing the words leaves a plain highlight', async () => {
    mockedApi.updateNote.mockImplementation(async () => note({ body: null }));
    await openIt();
    await userEvent.clear(await screen.findByRole('textbox'));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
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
    expect(screen.queryByRole('heading', { name: /your note/i })).toBeNull();
  });
});

describe('my notes', () => {
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
