/** What the notes calls send. Only the owner's own notes are ever asked for or changed. */

const request = jest.fn();

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ CLASSROOM_API_URL: 'https://classroom.test' }),
}));
jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: () => ({ request }),
}));

// eslint-disable-next-line import/first
import {
  createNote, deleteNote, listNotes, updateNote,
} from './api';

beforeEach(() => { request.mockReset(); request.mockResolvedValue({ data: {} }); });
const sent = () => request.mock.calls[0][0];

describe('the notes calls', () => {
  it('lists the notes of this class', async () => {
    await listNotes('ABC234');
    expect(sent()).toMatchObject({ method: 'get', url: 'https://classroom.test/api/rooms/ABC234/notes' });
  });

  it('creates a note with where it is, what it covers and how it looks, and nothing else', async () => {
    const note = {
      segmentId: 's1', layer: 'source', startOffset: 1, endOffset: 4, quote: 'abc', prefix: '', suffix: '', color: 'green', body: null,
    } as const;
    await createNote('ABC234', note);
    expect(sent()).toMatchObject({ method: 'post', url: 'https://classroom.test/api/rooms/ABC234/notes', data: note });
  });

  it('changes only the colour and the words', async () => {
    await updateNote('ABC234', 'n 1', { color: 'pink', body: null });
    expect(sent()).toMatchObject({
      method: 'patch',
      url: 'https://classroom.test/api/rooms/ABC234/notes/n%201',
      data: { color: 'pink', body: null },
    });
  });

  it('deletes a note by id', async () => {
    await deleteNote('ABC234', 'n1');
    expect(sent()).toMatchObject({ method: 'delete', url: 'https://classroom.test/api/rooms/ABC234/notes/n1' });
  });

  it('is never exempt from the login: every call goes through the authenticated client', async () => {
    await listNotes('ABC234');
    expect(sent().isCsrfExempt).toBe(true); // no CSRF token endpoint on this service; the login is the credential
  });
});
