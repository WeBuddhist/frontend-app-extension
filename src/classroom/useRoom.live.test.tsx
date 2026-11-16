/**
 * @jest-environment-options {"url": "http://localhost:2003", "customExportConditions": ["node"]}
 *
 * The origin matters. jsdom defaults to `http://localhost` with no port, which is not
 * in the service's WEB_ORIGIN, so every request fails CORS before reaching the
 * assertions. Pinning it to the MFE's own dev origin exercises the same CORS path a
 * real page does — which is itself worth testing, since in `tutor dev` the page and
 * the service genuinely are on different origins.
 *
 * `useRoom` against a real sync server. **Skipped unless CLASSROOM_API_URL is set.**
 *
 *   CLASSROOM_API_URL=http://localhost:8010 CLASSROOM_HOST_PASSWORD=… \
 *     npm test -- useRoom.live
 *
 * The server's own smoke test already proves the protocol. What this proves is the
 * part that test cannot see: that *this client* listens for the right event names and
 * reads the right payload fields. Those are two hand-kept copies of one contract in
 * two languages, and nothing but a test like this notices when they drift.
 *
 * Not part of the normal suite, because it needs a running server and a password.
 */

import { renderHook, waitFor, act } from '@testing-library/react';

import { useRoom } from './useRoom';
import type { CreatedRoom } from './types';

const API = process.env.CLASSROOM_API_URL;
const PASSWORD = process.env.CLASSROOM_HOST_PASSWORD ?? '';

/**
 * jsdom does not expose Node's `fetch`, so the setup calls use XMLHttpRequest, which
 * it does provide. Only this file's own setup needs it — the code under test talks
 * over a socket, and socket.io-client works in jsdom.
 */
const http = (method: string, url: string, body?: unknown): Promise<any> => (
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url, true);
    request.setRequestHeader('content-type', 'application/json');
    request.onload = () => {
      try {
        resolve(JSON.parse(request.responseText));
      } catch (cause) {
        reject(cause);
      }
    };
    request.onerror = () => reject(new Error(`${method} ${url} failed`));
    request.send(body === undefined ? null : JSON.stringify(body));
  })
);

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ CLASSROOM_API_URL: process.env.CLASSROOM_API_URL }),
}));

const describeLive = API ? describe : describe.skip;

describeLive('useRoom, against a live server', () => {
  let room: CreatedRoom;
  let segmentIds: string[];

  beforeAll(async () => {
    const texts = await http(
      'GET',
      `${API}/api/texts?${new URLSearchParams({ title: 'བྱང་ཆུབ', limit: '1' })}`,
    );
    room = await http('POST', `${API}/api/rooms`, {
      hostPassword: PASSWORD, textId: texts[0].id,
    }) as CreatedRoom;
    const spans = await http(
      'GET',
      `${API}/library/v2/editions/${room.editionId}/segmentation/segments?limit=5`,
    );
    segmentIds = spans.items.map((i: { id: string }) => i.id);
  }, 60000);

  it('joins and receives the room state', async () => {
    const { result, unmount } = renderHook(() => useRoom(room.code, 'Student'));
    await waitFor(() => expect(result.current.connected).toBe(true), { timeout: 15000 });
    await waitFor(() => expect(result.current.state).not.toBeNull(), { timeout: 15000 });

    // The field names the server actually sends. If either side renames one, this is
    // where it surfaces rather than as thirty blank screens.
    expect(result.current.state?.code).toBe(room.code);
    expect(result.current.state?.editionId).toBe(room.editionId);
    expect(result.current.state?.segmentationId).toBe(room.segmentationId);
    expect(result.current.state?.currentSegmentId).toBeNull();
    expect(result.current.state?.participantCount).toBeGreaterThanOrEqual(1);
    unmount();
  }, 40000);

  it('a teacher move reaches a student', async () => {
    const student = renderHook(() => useRoom(room.code, 'Student'));
    const teacher = renderHook(() => useRoom(room.code, 'Teacher', room.hostToken));
    await waitFor(() => expect(student.result.current.state).not.toBeNull(), { timeout: 15000 });
    await waitFor(() => expect(teacher.result.current.state).not.toBeNull(), { timeout: 15000 });

    act(() => { teacher.result.current.goto(segmentIds[1]); });

    await waitFor(
      () => expect(student.result.current.state?.currentSegmentId).toBe(segmentIds[1]),
      { timeout: 15000 },
    );
    // Point 6 of the checklist: the broadcast goes to everyone including the teacher,
    // so the two views cannot silently drift apart.
    expect(teacher.result.current.state?.currentSegmentId).toBe(segmentIds[1]);
    student.unmount();
    teacher.unmount();
  }, 60000);

  it('a student without the host token cannot move the room', async () => {
    const student = renderHook(() => useRoom(room.code, 'Student'));
    await waitFor(() => expect(student.result.current.state).not.toBeNull(), { timeout: 15000 });
    const before = student.result.current.state?.currentSegmentId;

    act(() => { student.result.current.goto(segmentIds[2]); });
    await new Promise((resolve) => { setTimeout(resolve, 1500); });

    expect(student.result.current.state?.currentSegmentId).toBe(before);
    student.unmount();
  }, 40000);

  it('a wrong room code is rejected rather than left hanging', async () => {
    const { result, unmount } = renderHook(() => useRoom('ZZZZZZ', 'Stranger'));
    await waitFor(() => expect(result.current.joinRejected).toBe(true), { timeout: 15000 });
    expect(result.current.error).toBeTruthy();
    unmount();
  }, 40000);
});
