/**
 * The live connection, against a stand-in socket.
 *
 * The real thing is exercised by `useRoom.live.test.tsx`. What is checked here is what
 * only a unit test can pin down: the order things happen in, and how each server message
 * becomes state.
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import * as api from './api';
import { socketAddress, useRoom } from './useRoom';
import type { RoomState } from './types';

jest.mock('./api');
const mocked = api as jest.Mocked<typeof api>;

type Handler = (...args: any[]) => void;

class FakeSocket {
  handlers: Record<string, Handler> = {};

  emitted: Array<{ event: string; payload: unknown }> = [];

  /** What the server answers `room:join` with. */
  joinAnswer: unknown = { ok: true, state: null };

  disconnected = false;

  connects = 0;

  on(event: string, handler: Handler) { this.handlers[event] = handler; return this; }

  emit(event: string, payload: unknown, ack?: Handler) {
    this.emitted.push({ event, payload });
    if (event === 'room:join') { ack?.(this.joinAnswer); } else { ack?.({ ok: true }); }
  }

  removeAllListeners() { this.handlers = {}; }

  disconnect() { this.disconnected = true; }

  connect() { this.connects += 1; return this; }

  /** The server speaking to this client. */
  hear(event: string, payload?: unknown) { this.handlers[event]?.(payload); }
}

let socket: FakeSocket;
const ioCalls: Array<{ url: string; options: any }> = [];

jest.mock('socket.io-client', () => ({
  io: (url: string, options: unknown) => { ioCalls.push({ url, options }); return socket; },
}));

const state = (overrides: Partial<RoomState> = {}): RoomState => ({
  code: 'ABC234',
  name: 'Tuesday study',
  editionId: 'ed',
  segmentationId: 'seg',
  title: 'A Text',
  currentSegmentId: null,
  participantCount: 1,
  teacherHere: false,
  role: 'student',
  ...overrides,
});

beforeEach(() => {
  jest.resetAllMocks();
  ioCalls.length = 0;
  socket = new FakeSocket();
  socket.joinAnswer = { ok: true, state: state() };
  mocked.apiBase.mockReturnValue('https://classroom.test');
  mocked.me.mockResolvedValue({ id: 'u1', username: 'pema', name: 'Pema' });
});

/** Render, let the socket open, and connect it. */
const connected = async (code = 'ABC234') => {
  const hook = renderHook(() => useRoom(code));
  await waitFor(() => expect(ioCalls).toHaveLength(1));
  act(() => socket.hear('connect'));
  return hook;
};

describe('where the socket is opened', () => {
  it('splits a path off the address: it is where the socket is served, not a namespace', () => {
    expect(socketAddress('https://apps.example.com/classroom-api')).toEqual({
      origin: 'https://apps.example.com',
      path: '/classroom-api/socket.io',
    });
    expect(socketAddress('https://apps.example.com/classroom-api/')).toEqual({
      origin: 'https://apps.example.com',
      path: '/classroom-api/socket.io',
    });
  });

  it('uses the ordinary path for an address with none, as in development', () => {
    expect(socketAddress('http://local.openedx.io:8010')).toEqual({
      origin: 'http://local.openedx.io:8010',
      path: '/socket.io',
    });
    expect(socketAddress('http://local.openedx.io:8010/')).toEqual({
      origin: 'http://local.openedx.io:8010',
      path: '/socket.io',
    });
  });

  it('hands the origin and the path to the socket, never the path as part of the address', async () => {
    mocked.apiBase.mockReturnValue('https://apps.example.com/classroom-api');
    await connected();
    expect(ioCalls[0].url).toBe('https://apps.example.com');
    expect(ioCalls[0].options.path).toBe('/classroom-api/socket.io');
  });
});

describe('opening the connection', () => {
  it('makes an ordinary request first, so the login cookie is fresh before a socket needs it', async () => {
    await connected();
    expect(mocked.me).toHaveBeenCalledTimes(1);
  });

  it('sends the login with the socket, and names no one: not a name, not a token', async () => {
    await connected();
    expect(ioCalls[0].options.withCredentials).toBe(true);
    expect(ioCalls[0].options.auth).toBeUndefined();
    const join = socket.emitted.find((e) => e.event === 'room:join');
    expect(join?.payload).toEqual({ code: 'ABC234' });
  });

  it('opens no socket at all when the login has gone, and says why', async () => {
    mocked.me.mockRejectedValue(new Error('Your login has expired. Please log in again.'));
    const { result } = renderHook(() => useRoom('ABC234'));
    await waitFor(() => expect(result.current.error).toBe('Your login has expired. Please log in again.'));
    expect(ioCalls).toHaveLength(0);
  });

  it('shows a missing configuration instead of throwing out of the effect', async () => {
    mocked.apiBase.mockImplementation(() => { throw new Error('The classroom is not configured'); });
    const { result } = renderHook(() => useRoom('ABC234'));
    await waitFor(() => expect(result.current.error).toMatch(/not configured/));
  });

  it('closes the socket when the page leaves, and does not open one after it has gone', async () => {
    const { unmount } = await connected();
    unmount();
    expect(socket.disconnected).toBe(true);

    // And a hook unmounted before its login check returned never opens a socket.
    ioCalls.length = 0;
    let finish: (value: any) => void = () => undefined;
    mocked.me.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const early = renderHook(() => useRoom('ABC234'));
    early.unmount();
    await act(async () => { finish({ id: 'u', username: 'u', name: '' }); });
    expect(ioCalls).toHaveLength(0);
  });
});

describe('what the server says', () => {
  it('takes the class state from the answer to joining, role included', async () => {
    socket.joinAnswer = { ok: true, state: state({ role: 'teacher', teacherHere: true }) };
    const { result } = await connected();
    expect(result.current.connected).toBe(true);
    expect(result.current.state?.role).toBe('teacher');
    expect(result.current.joinRejected).toBe(false);
  });

  it('is told, not left hanging, when the join is refused', async () => {
    socket.joinAnswer = { ok: false, error: 'You are not in this class. Join it with its code first.' };
    const { result } = await connected();
    expect(result.current.joinRejected).toBe(true);
    expect(result.current.error).toMatch(/not in this class/);
    expect(result.current.state).toBeNull();
  });

  it('follows the teacher: the move updates the current line', async () => {
    const { result } = await connected();
    act(() => socket.hear('teach:goto', { segmentId: 's7' }));
    expect(result.current.state?.currentSegmentId).toBe('s7');
  });

  it('updates the head count and whether the teacher is here from presence', async () => {
    const { result } = await connected();
    expect(result.current.state?.teacherHere).toBe(false);
    act(() => socket.hear('presence', { count: 4, teacherHere: true }));
    expect(result.current.state).toMatchObject({ participantCount: 4, teacherHere: true });
    act(() => socket.hear('presence', { count: 3, teacherHere: false }));
    expect(result.current.state).toMatchObject({ participantCount: 3, teacherHere: false });
    // A student is told only whether the teacher is here, with no count: the count is kept.
    act(() => socket.hear('presence', { teacherHere: true }));
    expect(result.current.state).toMatchObject({ participantCount: 3, teacherHere: true });
  });

  it.each([
    ['room:closed', 'archived'],
    ['member:removed', 'removed'],
    ['member:left', 'left'],
  ])('%s ends the class for this person, as %s', async (event, ended) => {
    const { result } = await connected();
    expect(result.current.ended).toBeNull();
    act(() => socket.hear(event, { code: 'ABC234' }));
    expect(result.current.ended).toBe(ended);
  });

  it('does not send a student away when the session ends, and clears when it starts again', async () => {
    const { result } = await connected();
    act(() => socket.hear('session:ended'));
    expect(result.current.ended).toBeNull();
    expect(result.current.state?.sessionEnded).toBe(true);
    act(() => socket.hear('session:started'));
    expect(result.current.state?.sessionEnded).toBe(false);
  });

  it('leaves the class for good when the teacher ends the session, so a reconnect cannot restart it', async () => {
    socket.joinAnswer = { ok: true, state: state({ role: 'teacher' }) };
    await connected();
    act(() => socket.hear('session:ended'));
    expect(socket.disconnected).toBe(true);
  });

  it('keeps a student connected when the session ends', async () => {
    await connected();
    act(() => socket.hear('session:ended'));
    expect(socket.disconnected).toBe(false);
  });

  it('refreshes the login and reconnects when the server says it has run out', async () => {
    await connected();
    mocked.me.mockClear();
    act(() => socket.hear('auth:expired'));
    await waitFor(() => expect(socket.connects).toBe(1));
    expect(mocked.me).toHaveBeenCalledTimes(1);
  });

  it('puts the line back when the server refuses a move', async () => {
    socket.joinAnswer = { ok: true, state: state({ role: 'teacher', currentSegmentId: 'a' }) };
    socket.emit = function emit(event: string, payload: unknown, ack?: any) {
      this.emitted.push({ event, payload });
      if (event === 'room:join') { ack?.(this.joinAnswer); } else { ack?.({ ok: false, error: 'Nope' }); }
    };
    const { result } = await connected();
    act(() => result.current.goto('b'));
    expect(result.current.error).toBe('Nope');
    expect(result.current.state?.currentSegmentId).toBe('a');
  });

  it('does not reconnect when only the code changes, and joins with the new one if it has to', async () => {
    const { rerender } = renderHook(({ code }) => useRoom(code), { initialProps: { code: 'ABC234' } });
    await waitFor(() => expect(ioCalls).toHaveLength(1));
    act(() => socket.hear('connect'));
    rerender({ code: 'NEW234' });
    expect(ioCalls).toHaveLength(1);
    expect(socket.disconnected).toBe(false);
    act(() => socket.hear('connect'));
    const joins = socket.emitted.filter((e) => e.event === 'room:join');
    expect(joins.map((j) => j.payload)).toEqual([{ code: 'ABC234' }, { code: 'NEW234' }]);
  });

  it('says goodbye when the tab is closed', async () => {
    await connected();
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(socket.disconnected).toBe(true);
  });

  it('marks the connection down and up again', async () => {
    const { result } = await connected();
    act(() => socket.hear('disconnect'));
    expect(result.current.connected).toBe(false);
    act(() => socket.hear('connect'));
    expect(result.current.connected).toBe(true);
    // Reconnecting re-joins, which is all the resume logic there is.
    expect(socket.emitted.filter((e) => e.event === 'room:join')).toHaveLength(2);
  });

  it('shows the server\'s reason when it refuses the connection', async () => {
    const { result } = await connected();
    act(() => socket.hear('connect_error', new Error('Your login has expired. Please log in again.')));
    expect(result.current.error).toBe('Your login has expired. Please log in again.');
  });
});

describe('what this client asks of the server', () => {
  it('asks to move the class with a segment id and nothing else', async () => {
    const { result } = await connected();
    act(() => result.current.goto('s3'));
    expect(socket.emitted.find((e) => e.event === 'teach:goto')?.payload).toEqual({ segmentId: 's3' });
  });

  it('shows the refusal when the server says this account may not move the class', async () => {
    const { result } = await connected();
    socket.emit = ((event: string, _payload: unknown, ack?: Handler) => {
      ack?.(event === 'teach:goto' ? { ok: false, error: 'Only this class\'s teacher can do that.' } : { ok: true, state: state() });
    }) as FakeSocket['emit'];
    act(() => result.current.goto('s3'));
    expect(result.current.error).toBe('Only this class\'s teacher can do that.');
  });

  it('asks to end the session', async () => {
    const { result } = await connected();
    act(() => result.current.endSession());
    expect(socket.emitted.some((e) => e.event === 'session:end')).toBe(true);
  });
});
