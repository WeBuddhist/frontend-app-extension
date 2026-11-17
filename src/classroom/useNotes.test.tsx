/** A student's notes: loaded once, and changed only once the server has accepted it. */

import { act, renderHook, waitFor } from '@testing-library/react';

import * as api from './api';
import { useNotes } from './useNotes';
import type { NewNote, Note } from './types';

jest.mock('./api');
const mocked = api as jest.Mocked<typeof api>;

const note = (id: string, createdAt: string, overrides: Partial<Note> = {}): Note => ({
  id,
  segmentId: 's1',
  layer: 'source',
  startOffset: 0,
  endOffset: 3,
  quote: 'one',
  prefix: '',
  suffix: '',
  color: 'yellow',
  body: null,
  createdAt,
  updatedAt: createdAt,
  ...overrides,
});

const fresh: NewNote = {
  segmentId: 's1', layer: 'source', startOffset: 0, endOffset: 3, quote: 'one', prefix: '', suffix: '', color: 'green', body: null,
};

beforeEach(() => { jest.resetAllMocks(); });

describe('useNotes', () => {
  it('loads this class\'s notes, oldest first, which is the order highlights are drawn in', async () => {
    mocked.listNotes.mockResolvedValue([note('b', '2026-01-02'), note('a', '2026-01-01')]);
    const { result } = renderHook(() => useNotes('ABC234', true));
    await waitFor(() => expect(result.current.notes.map((n) => n.id)).toEqual(['a', 'b']));
    expect(mocked.listNotes).toHaveBeenCalledWith('ABC234');
    expect(result.current.loading).toBe(false);
  });

  it('asks for nothing when notes are not for this person', () => {
    renderHook(() => useNotes('ABC234', false));
    expect(mocked.listNotes).not.toHaveBeenCalled();
  });

  it('says why they could not be loaded', async () => {
    mocked.listNotes.mockRejectedValue(new Error('Notes are for students'));
    const { result } = renderHook(() => useNotes('ABC234', true));
    await waitFor(() => expect(result.current.error).toBe('Notes are for students'));
  });

  it('adds a note only once the server has accepted it', async () => {
    mocked.listNotes.mockResolvedValue([]);
    mocked.createNote.mockResolvedValue(note('new', '2026-01-03'));
    const { result } = renderHook(() => useNotes('ABC234', true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.create(fresh); });
    expect(mocked.createNote).toHaveBeenCalledWith('ABC234', fresh);
    expect(result.current.notes.map((n) => n.id)).toEqual(['new']);
  });

  it('shows nothing, and says why, when the server refuses a new note', async () => {
    mocked.listNotes.mockResolvedValue([]);
    mocked.createNote.mockRejectedValue(new Error('That line is not part of this text'));
    const { result } = renderHook(() => useNotes('ABC234', true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.create(fresh)).rejects.toThrow('That line is not part of this text');
    });
    expect(result.current.notes).toEqual([]);
  });

  it('replaces a note with what the server says it now is', async () => {
    mocked.listNotes.mockResolvedValue([note('a', '2026-01-01')]);
    mocked.updateNote.mockResolvedValue(note('a', '2026-01-01', { color: 'blue', body: 'words' }));
    const { result } = renderHook(() => useNotes('ABC234', true));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    await act(async () => { await result.current.update('a', { color: 'blue', body: 'words' }); });
    expect(mocked.updateNote).toHaveBeenCalledWith('ABC234', 'a', { color: 'blue', body: 'words' });
    expect(result.current.notes[0]).toMatchObject({ color: 'blue', body: 'words' });
  });

  it('keeps a note when the server refuses to change it', async () => {
    mocked.listNotes.mockResolvedValue([note('a', '2026-01-01')]);
    mocked.updateNote.mockRejectedValue(new Error('That class has been archived'));
    const { result } = renderHook(() => useNotes('ABC234', true));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));
    await act(async () => { await expect(result.current.update('a', { color: 'pink' })).rejects.toThrow(); });
    expect(result.current.notes[0].color).toBe('yellow');
  });

  it('removes a note only once the server has deleted it', async () => {
    mocked.listNotes.mockResolvedValue([note('a', '2026-01-01'), note('b', '2026-01-02')]);
    mocked.deleteNote.mockResolvedValue(undefined);
    const { result } = renderHook(() => useNotes('ABC234', true));
    await waitFor(() => expect(result.current.notes).toHaveLength(2));
    await act(async () => { await result.current.remove('a'); });
    expect(mocked.deleteNote).toHaveBeenCalledWith('ABC234', 'a');
    expect(result.current.notes.map((n) => n.id)).toEqual(['b']);
  });

  it('keeps a note when the delete is refused', async () => {
    mocked.listNotes.mockResolvedValue([note('a', '2026-01-01')]);
    mocked.deleteNote.mockRejectedValue(new Error('No such note'));
    const { result } = renderHook(() => useNotes('ABC234', true));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));
    await act(async () => { await expect(result.current.remove('a')).rejects.toThrow(); });
    expect(result.current.notes).toHaveLength(1);
  });
});
