/**
 * @jest-environment-options {"url": "http://localhost:2003", "customExportConditions": ["node"]}
 *
 * Notes against a live server, as three accounts: a teacher, a student, and a second
 * student. Skipped unless CLASSROOM_API_URL is set.
 *
 *   CLASSROOM_API_URL=http://localhost:8010 CLASSROOM_HOST_PASSWORD=… \
 *   CLASSROOM_TOKEN_TEACHER=… CLASSROOM_TOKEN_STUDENT=… CLASSROOM_TOKEN_OTHER=… \
 *     npm test -- notes.live
 *
 * What this proves that the unit tests cannot: that this client sends the field names the
 * server reads, and that a note really is private to the student who made it.
 */

import { renderHook, waitFor, act } from '@testing-library/react';

import {
  API, PASSWORD, as, hasTokens, http,
} from './liveSupport';
import { useNotes } from './useNotes';
import { buildAnchor } from './anchors';
import type { CreatedRoom } from './types';

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ CLASSROOM_API_URL: process.env.CLASSROOM_API_URL }),
}));
jest.mock('@edx/frontend-platform/auth', () => ({
  // eslint-disable-next-line global-require
  getAuthenticatedHttpClient: () => require('./liveSupport').fakeAuthenticatedClient(),
}));

const describeLive = API && hasTokens() && process.env.CLASSROOM_TOKEN_OTHER ? describe : describe.skip;

describeLive('notes, against a live server', () => {
  let room: CreatedRoom;
  let segmentId: string;
  const text = 'བྱང་ཆུབ་སེམས་དཔའི་སྤྱོད་པ།';

  const anchorFor = () => {
    const a = buildAnchor(text, 5, 9);
    return {
      segmentId,
      layer: 'source' as const,
      startOffset: a.start,
      endOffset: a.end,
      quote: a.quote,
      prefix: a.prefix,
      suffix: a.suffix,
      color: 'green' as const,
      body: 'a note from the live test',
    };
  };

  beforeAll(async () => {
    as('teacher');
    const texts = await http('GET', `${API}/api/texts?${new URLSearchParams({ title: 'བྱང་ཆུབ', limit: '1' })}`);
    room = (await http('POST', `${API}/api/rooms`, { hostPassword: PASSWORD, textId: texts.data[0].id })).data;
    await http('POST', `${API}/api/rooms/${room.code}/join`, undefined, 'student');
    await http('POST', `${API}/api/rooms/${room.code}/join`, undefined, 'other');
    const spans = await http('GET', `${API}/library/v2/editions/${room.editionId}/segmentation/segments?limit=3`);
    segmentId = spans.data.items[0].id;
  }, 60000);

  afterAll(async () => {
    await http('POST', `${API}/api/rooms/${room.code}/archive`, undefined, 'teacher');
  });

  it('a student makes, changes and deletes a note, and what the server stores is what was sent', async () => {
    as('student');
    const { result } = renderHook(() => useNotes(room.code, true));
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 15000 });
    expect(result.current.notes).toEqual([]);

    let made: any;
    await act(async () => { made = await result.current.create(anchorFor()); });
    expect(made).toMatchObject({
      segmentId, layer: 'source', color: 'green', body: 'a note from the live test',
    });
    expect(made.quote).toBe(anchorFor().quote);
    expect(result.current.notes).toHaveLength(1);

    await act(async () => { await result.current.update(made.id, { color: 'pink', body: null }); });
    expect(result.current.notes[0]).toMatchObject({ color: 'pink', body: null });

    // A second visit: the note is still there.
    const again = renderHook(() => useNotes(room.code, true));
    await waitFor(() => expect(again.result.current.notes).toHaveLength(1), { timeout: 15000 });
    expect(again.result.current.notes[0].color).toBe('pink');

    await act(async () => { await result.current.remove(made.id); });
    expect(result.current.notes).toEqual([]);
  }, 60000);

  it('another student never sees it, and cannot touch it by its id', async () => {
    as('student');
    const mine = (await http('POST', `${API}/api/rooms/${room.code}/notes`, anchorFor())).data;

    as('other');
    const { result } = renderHook(() => useNotes(room.code, true));
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 15000 });
    expect(result.current.notes).toEqual([]);

    await act(async () => { await expect(result.current.update(mine.id, { color: 'blue' })).rejects.toThrow(/No such note/); });
    await act(async () => { await expect(result.current.remove(mine.id)).rejects.toThrow(/No such note/); });

    // Still intact for its owner.
    const owner = (await http('GET', `${API}/api/rooms/${room.code}/notes`, undefined, 'student')).data;
    expect(owner.find((n: { id: string }) => n.id === mine.id).color).toBe('green');
  }, 60000);

  it('a teacher is refused, for now', async () => {
    as('teacher');
    const { result } = renderHook(() => useNotes(room.code, true));
    await waitFor(() => expect(result.current.error).toBe('Notes are for students'), { timeout: 15000 });
  }, 40000);
});
