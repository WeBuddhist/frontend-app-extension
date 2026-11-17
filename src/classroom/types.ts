/**
 * The socket contract, copied from the sync service's `docs/socket-contract.md`.
 *
 * Nothing imports these from the server — it is Python and lives in another repo — so
 * this file is a hand-kept copy of a written spec. **The field names below are the
 * wire format.** Rename one here and the server will not know; rename one there and
 * this will not. Neither side will fail to build, and thirty screens will do nothing.
 *
 * The server's acceptance test (`tests/smoke.mjs` in that repo) is what catches a
 * mismatch, because it speaks the protocol as a real client does.
 *
 * The one rule: **only a segment id travels between teacher and student.** Never a DOM
 * range, never a character offset, never a scroll position. That is what makes one
 * teacher's click land on the same line on a phone, a tablet and a projector.
 */

export interface RoomState {
  code: string;
  /**
   * Pins the edition. Segment ids belong to a *segmentation*, which belongs to an
   * *edition* — two editions of one work give different ids for the same line. The
   * server resolves this once when the room is created, so every student reads the
   * same one. Never resolve it here.
   */
  editionId: string;
  /** What the room's segment ids belong to. Verify against it; never parse it. */
  segmentationId: string;
  title: string;
  /** Null until the teacher has moved the room somewhere. */
  currentSegmentId: string | null;
  participantCount: number;
}

export type JoinResult =
  | { ok: true; state: RoomState }
  | { ok: false; error: string };

export type Ack = { ok: true } | { ok: false; error: string };

/** What this client sends. */
export interface ClientToServerEvents {
  'room:join': (
    payload: { code: string; displayName: string },
    ack: (result: JoinResult) => void,
  ) => void;
  'teach:goto': (
    payload: { segmentId: string; hostToken: string },
    ack: (result: Ack) => void,
  ) => void;
  'room:close': (
    payload: { hostToken: string },
    ack: (result: Ack) => void,
  ) => void;
}

/**
 * What this client listens for.
 *
 * There is no `room:state` event. The authoritative snapshot arrives in the **ack**
 * to `room:join`, and a reconnect re-emits `room:join`, so the same path serves both.
 * An earlier version of the contract specified such an event; neither side ever sent
 * or handled it, and anyone building a second client from that document would have
 * waited for something that never arrives.
 */
export interface ServerToClientEvents {
  /** Incremental move. */
  'teach:goto': (payload: { segmentId: string }) => void;
  presence: (payload: { count: number }) => void;
  'room:closed': () => void;
}

/** A room as the HTTP API returns it when one is created. */
export interface CreatedRoom {
  code: string;
  /** Shown once. The server keeps only its hash, so it cannot be recovered. */
  hostToken: string;
  title: string;
  editionId: string;
  segmentationId: string;
  segmentCount: number;
}

export interface TextResult {
  id: string;
  title: string;
  language: string;
}
