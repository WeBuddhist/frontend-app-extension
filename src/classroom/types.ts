/**
 * The socket contract and the HTTP shapes, copied from the sync service's
 * `docs/socket-contract.md`.
 *
 * Nothing imports these from the server — it is Python and lives in another repo — so
 * this file is a hand-kept copy of a written spec. **The field names below are the wire
 * format.** Rename one here and the server will not know; rename one there and this will
 * not. Neither side will fail to build, and thirty screens will do nothing.
 *
 * The server's acceptance test (`tests/smoke.mjs` in that repo) is what catches a
 * mismatch, because it speaks the protocol as a real client does.
 *
 * The one rule: **only a segment id travels between teacher and student.** Never a DOM
 * range, never a character offset, never a scroll position. That is what makes one
 * teacher's click land on the same line on a phone, a tablet and a projector.
 */

export type Role = 'teacher' | 'student';

export interface RoomState {
  code: string;
  /** What the class is called; falls back to the text's title. */
  name: string;
  /**
   * Pins the edition. Segment ids belong to a *segmentation*, which belongs to an
   * *edition* — two editions of one work give different ids for the same line. The
   * server resolves this once when the class is created, so every student reads the
   * same one. Never resolve it here.
   */
  editionId: string;
  /** What the room's segment ids belong to. Verify against it; never parse it. */
  segmentationId: string;
  /**
   * The edition shown beneath the source, pinned by the server for the same reason as
   * `editionId`. Null when the text has no translation lined up with it, in which case
   * the class reads the source alone.
   */
  translationEditionId?: string | null;
  title: string;
  /** Null until the teacher has moved the class somewhere. */
  currentSegmentId: string | null;
  /** People here, not tabs: one person with two tabs open is one person. */
  participantCount: number;
  /** Whether the teacher is connected, so an early student can be told to wait. */
  teacherHere: boolean;
  /** The teacher ended today's session and has not come back. Students stay and may review. */
  sessionEnded?: boolean;
  /** What this account is in this class. Decides what the interface offers. */
  role: Role;
}

export type JoinResult =
  | { ok: true; state: RoomState }
  | { ok: false; error: string };

export type Ack = { ok: true } | { ok: false; error: string };

/** What this client sends. Nobody names themselves: who you are comes from the login. */
export interface ClientToServerEvents {
  'room:join': (payload: { code: string }, ack: (result: JoinResult) => void) => void;
  'teach:goto': (payload: { segmentId: string }, ack: (result: Ack) => void) => void;
  'session:end': (payload: Record<string, never>, ack: (result: Ack) => void) => void;
}

/**
 * What this client listens for.
 *
 * There is no `room:state` event. The authoritative snapshot arrives in the **ack** to
 * `room:join`, and a reconnect re-emits `room:join`, so the same path serves both.
 */
export interface ServerToClientEvents {
  /** Incremental move. */
  'teach:goto': (payload: { segmentId: string }) => void;
  /**
   * The teacher gets the head-count with it; a student gets `teacherHere` alone, and only when it
   * changes (students are not shown a count).
   */
  presence: (payload: { count?: number; teacherHere: boolean }) => void;
  /** Today's session ended. The class stays, and so does everyone's place in it. */
  'session:ended': () => void;
  /** The login this connection was made with has run out. The page refreshes it and reconnects. */
  'auth:expired': () => void;
  /** The teacher came back to a class whose session had ended: it is on again. */
  'session:started': () => void;
  /** The class was archived: it is over, and gone from everyone's list. */
  'room:closed': () => void;
  /** The teacher removed this account from the class. */
  'member:removed': (payload: { code: string }) => void;
  /** This account left the class (on any of its tabs). The class stays in its list. */
  'member:left': (payload: { code: string }) => void;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

/** One entry in a person's list of classes. */
export interface ClassSummary {
  code: string;
  name: string;
  title: string;
  role: Role;
  memberCount: number;
  lastSeenAt: string | null;
  /** The days the class is held, as `YYYY-MM-DD`, when the teacher has said. */
  startsOn?: string | null;
  endsOn?: string | null;
  /** The student left this class; it stays listed, and one press rejoins it (no code). */
  left?: boolean;
}

/** Someone in a class, as the teacher sees them. */
export interface Member {
  id: string;
  username: string;
  name: string;
  role: Role;
  joinedAt: string | null;
  lastSeenAt: string | null;
}

/** A class as the HTTP API returns it when one is created. */
export interface CreatedRoom {
  code: string;
  name: string;
  title: string;
  editionId: string;
  segmentationId: string;
  translationEditionId?: string | null;
  segmentCount: number;
}

export interface JoinedRoom {
  code: string;
  name: string | null;
  title: string;
  role: Role;
}

export interface TextResult {
  id: string;
  title: string;
  language: string;
}

// ---------------------------------------------------------------------------
// Notes: a student's private highlights and notes (students only, for now)
// ---------------------------------------------------------------------------

export const NOTE_COLORS = ['yellow', 'green', 'blue', 'pink'] as const;
export type NoteColor = typeof NOTE_COLORS[number];

/** Which text on a line a note sits on: the source, or its translation. */
export type NoteLayer = 'source' | 'translation';

/**
 * A note, as the server stores it.
 *
 * The anchor is the line (`segmentId`), the text on it (`layer`), and where inside that
 * text the note begins and ends (`startOffset`/`endOffset`, in code points, counted from the
 * start of that text and **not** of the page, so it does not depend on screen, font or
 * layout). `quote`, `prefix` and `suffix` are the selected words and a few either side: if
 * the library ever edits the line, they are how the words are found again.
 */
export interface Note {
  id: string;
  segmentId: string;
  layer: NoteLayer;
  startOffset: number;
  endOffset: number;
  quote: string;
  prefix: string;
  suffix: string;
  color: NoteColor;
  /** Null is a plain highlight, with no words of its own. */
  body: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** What is needed to make a note: everything but what the server decides. */
export type NewNote = Pick<
Note,
'segmentId' | 'layer' | 'startOffset' | 'endOffset' | 'quote' | 'prefix' | 'suffix' | 'color' | 'body'
>;
