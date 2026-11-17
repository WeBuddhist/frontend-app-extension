/**
 * What the HTTP client sends and how it reports failure.
 *
 * The calls are about a person, so they go through the platform's authenticated client,
 * which carries the Academy login. Mocked here: what is checked is the request each call
 * makes and the way a refusal reaches the screen.
 */

const request = jest.fn();

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ CLASSROOM_API_URL: 'https://classroom.test' }),
}));
jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: () => ({ request }),
}));

// eslint-disable-next-line import/first
import {
  archiveClass, changeCode, createRoom, joinRoom, listMembers, me, myClasses, removeMember,
} from './api';

beforeEach(() => { request.mockReset(); request.mockResolvedValue({ data: {} }); });

const sent = () => request.mock.calls[0][0];

describe('the classroom HTTP client', () => {
  it('sends every call as the logged-in account, never CSRF-protected', async () => {
    await me();
    // The service is not the LMS and has no CSRF token endpoint to ask.
    expect(sent().isCsrfExempt).toBe(true);
    expect(sent().url).toBe('https://classroom.test/api/me');
  });

  it('asks for the account\'s classes', async () => {
    await myClasses();
    expect(sent()).toMatchObject({ method: 'get', url: 'https://classroom.test/api/me/classes' });
  });

  it('joins with the code, once', async () => {
    await joinRoom('ABC234');
    expect(sent()).toMatchObject({ method: 'post', url: 'https://classroom.test/api/rooms/ABC234/join' });
  });

  it('creates a class with the password, the text and an optional name', async () => {
    await createRoom('pw', 'text-1', '  Tuesday study  ');
    expect(sent()).toMatchObject({
      method: 'post',
      url: 'https://classroom.test/api/rooms',
      data: { hostPassword: 'pw', textId: 'text-1', name: 'Tuesday study' },
    });
  });

  it('leaves the name out when none was given, so the text\'s title is used', async () => {
    await createRoom('pw', 'text-1', '   ');
    expect(sent().data).toEqual({ hostPassword: 'pw', textId: 'text-1' });
  });

  it('reaches the teacher\'s tools', async () => {
    await listMembers('ABC234');
    await removeMember('ABC234', 'user 1');
    await changeCode('ABC234');
    await archiveClass('ABC234');
    expect(request.mock.calls.map(([c]) => `${c.method} ${c.url.replace('https://classroom.test', '')}`)).toEqual([
      'get /api/rooms/ABC234/members',
      'delete /api/rooms/ABC234/members/user%201',
      'post /api/rooms/ABC234/change-code',
      'post /api/rooms/ABC234/archive',
    ]);
  });

  it('shows the server\'s own words when it refuses', async () => {
    request.mockRejectedValue({ response: { status: 403, data: { detail: 'Only this class\'s teacher can do that' } } });
    await expect(listMembers('ABC234')).rejects.toThrow("Only this class's teacher can do that");
  });

  it('falls back to the status when the server gave no words', async () => {
    request.mockRejectedValue({ response: { status: 502, data: {} } });
    await expect(myClasses()).rejects.toThrow('Request failed (502).');
  });

  it('says so when the server cannot be reached at all', async () => {
    request.mockRejectedValue({ message: 'Network Error' });
    await expect(myClasses()).rejects.toThrow('Network Error');
  });
});
