/**
 * @jest-environment-options {"url": "http://localhost:2003", "customExportConditions": ["node"]}
 *
 * The origin matters. jsdom defaults to `http://localhost` with no port, which is not in
 * the service's WEB_ORIGIN, so every request fails CORS before reaching the assertions.
 * Pinning it to the MFE's own dev origin exercises the same CORS path a real page does.
 *
 * `useRoom` against a real sync server. **Skipped unless CLASSROOM_API_URL is set.**
 *
 *   CLASSROOM_API_URL=http://localhost:8010 CLASSROOM_HOST_PASSWORD=… \
 *   CLASSROOM_TOKEN_TEACHER=… CLASSROOM_TOKEN_STUDENT=… npm test -- useRoom.live
 *
 * The server's own smoke test already proves the protocol. What this proves is the part
 * that test cannot see: that *this client* listens for the right event names and reads the
 * right payload fields. Those are two hand-kept copies of one contract in two languages,
 * and nothing but a test like this notices when they drift.
 */

import { renderHook, waitFor, act } from '@testing-library/react';

import {
  API, PASSWORD, as, hasTokens, http, tokenOf,
} from './liveSupport';
import { useRoom } from './useRoom';
import type { CreatedRoom } from './types';

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ CLASSROOM_API_URL: process.env.CLASSROOM_API_URL }),
}));
jest.mock('@edx/frontend-platform/auth', () => ({
  // eslint-disable-next-line global-require
  getAuthenticatedHttpClient: () => require('./liveSupport').fakeAuthenticatedClient(),
}));
jest.mock('socket.io-client', () => {
  const real = jest.requireActual('socket.io-client');
  return {
    ...real,
    // A browser attaches the login as cookies; a test attaches it as `auth`.
    // eslint-disable-next-line global-require
    io: (url: string, options: object) => real.io(url, { ...options, auth: { token: require('./liveSupport').tokenOf() } }),
  };
});

const describeLive = API && hasTokens() ? describe : describe.skip;

describeLive('useRoom, against a live server', () => {
  let room: CreatedRoom;
  let segmentIds: string[];

  beforeAll(async () => {
    as('teacher');
    const texts = await http(
      'GET',
      `${API}/api/texts?${new URLSearchParams({ title: 'བྱང་ཆུབ', limit: '1' })}`,
    );
    room = (await http('POST', `${API}/api/rooms`, {
      hostPassword: PASSWORD, textId: texts.data[0].id, name: 'Live test class',
    })).data as CreatedRoom;
    // The student becomes a member once, with the code, as they would in the browser.
    await http('POST', `${API}/api/rooms/${room.code}/join`, undefined, 'student');
    const spans = await http(
      'GET',
      `${API}/library/v2/editions/${room.editionId}/segmentation/segments?limit=5`,
    );
    segmentIds = spans.data.items.map((i: { id: string }) => i.id);
  }, 60000);

  afterAll(async () => {
    await http('POST', `${API}/api/rooms/${room.code}/archive`, undefined, 'teacher');
  });

  it('a student joins and receives the class state, including their role', async () => {
    as('student');
    const { result, unmount } = renderHook(() => useRoom(room.code));
    await waitFor(() => expect(result.current.state).not.toBeNull(), { timeout: 15000 });

    // The field names the server actually sends. If either side renames one, this is
    // where it surfaces rather than as thirty blank screens.
    expect(result.current.state?.code).toBe(room.code);
    expect(result.current.state?.name).toBe('Live test class');
    expect(result.current.state?.editionId).toBe(room.editionId);
    expect(result.current.state?.segmentationId).toBe(room.segmentationId);
    expect(result.current.state?.currentSegmentId).toBeNull();
    expect(result.current.state?.role).toBe('student');
    expect(result.current.state?.participantCount).toBeGreaterThanOrEqual(1);
    expect(typeof result.current.state?.teacherHere).toBe('boolean');
    unmount();
  }, 40000);

  it('the creator joins as the teacher', async () => {
    as('teacher');
    const { result, unmount } = renderHook(() => useRoom(room.code));
    await waitFor(() => expect(result.current.state).not.toBeNull(), { timeout: 15000 });
    expect(result.current.state?.role).toBe('teacher');
    unmount();
  }, 40000);

  it('a teacher move reaches a student, and the student learns the teacher is here', async () => {
    as('student');
    const student = renderHook(() => useRoom(room.code));
    await waitFor(() => expect(student.result.current.state).not.toBeNull(), { timeout: 15000 });
    expect(student.result.current.state?.teacherHere).toBe(false);

    as('teacher');
    const teacher = renderHook(() => useRoom(room.code));
    await waitFor(() => expect(teacher.result.current.state).not.toBeNull(), { timeout: 15000 });
    await waitFor(
      () => expect(student.result.current.state?.teacherHere).toBe(true),
      { timeout: 15000 },
    );

    act(() => { teacher.result.current.goto(segmentIds[1]); });

    await waitFor(
      () => expect(student.result.current.state?.currentSegmentId).toBe(segmentIds[1]),
      { timeout: 15000 },
    );
    // The broadcast goes to everyone including the teacher, so the two views cannot
    // silently drift apart.
    expect(teacher.result.current.state?.currentSegmentId).toBe(segmentIds[1]);
    student.unmount();
    teacher.unmount();
  }, 60000);

  it('a student cannot move the class', async () => {
    as('student');
    const student = renderHook(() => useRoom(room.code));
    await waitFor(() => expect(student.result.current.state).not.toBeNull(), { timeout: 15000 });
    const before = student.result.current.state?.currentSegmentId;

    act(() => { student.result.current.goto(segmentIds[2]); });
    await waitFor(() => expect(student.result.current.error).toBeTruthy(), { timeout: 5000 });

    expect(student.result.current.state?.currentSegmentId).toBe(before);
    student.unmount();
  }, 40000);

  it('a wrong code is rejected rather than left hanging', async () => {
    as('student');
    const { result, unmount } = renderHook(() => useRoom('ZZZZZZ'));
    await waitFor(() => expect(result.current.joinRejected).toBe(true), { timeout: 15000 });
    expect(result.current.error).toBeTruthy();
    unmount();
  }, 40000);

  it('ending the session tells the student, and the class stays', async () => {
    as('student');
    const student = renderHook(() => useRoom(room.code));
    await waitFor(() => expect(student.result.current.state).not.toBeNull(), { timeout: 15000 });
    as('teacher');
    const teacher = renderHook(() => useRoom(room.code));
    await waitFor(() => expect(teacher.result.current.state).not.toBeNull(), { timeout: 15000 });

    act(() => { teacher.result.current.endSession(); });
    await waitFor(() => expect(student.result.current.state?.sessionEnded).toBe(true), { timeout: 15000 });
    // The student is not sent away.
    expect(student.result.current.ended).toBeNull();

    // Still there for next time.
    const again = await http('POST', `${API}/api/rooms/${room.code}/join`, undefined, 'student');
    expect(again.status).toBe(200);
    expect(tokenOf('student')).toBeTruthy();
    student.unmount();
    teacher.unmount();
  }, 60000);
});
