/**
 * HTTP calls to the classroom sync service.
 *
 * Every call that is about a person goes through `getAuthenticatedHttpClient()`: it
 * keeps the Academy login cookie fresh, sends it with the request, and adds the
 * `USE-JWT-COOKIE` header the service requires before it will treat a cookie as a
 * credential. The service checks the login itself, against the platform's public key; the
 * user's token is not given to anything that cannot verify it.
 *
 * Field names are camelCase on the wire. `camelCaseObject` is not used here — the
 * server already speaks camelCase, and converting would hide a mismatch rather than
 * surface it.
 */

import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';

import type {
  ClassSummary, CreatedRoom, JoinedRoom, Member, NewNote, Note, NoteColor, TextResult,
} from './types';

/**
 * Where the classroom service answers in development, with no Caddy and no config.
 *
 * **`local.openedx.io`, not `localhost`.** The Academy login lives in cookies scoped to
 * `local.openedx.io`, and a browser sends them only to that host and its subdomains. A
 * service on `localhost` would never see them, and every call would be "not logged in".
 */
const DEV_FALLBACK = 'http://local.openedx.io:8010';

/**
 * Set by the Tutor plugin's MFE runtime config. In production it is a path on this
 * MFE's own origin (Caddy proxies it), which is under the same parent domain as the LMS
 * and so shares its cookies. In development there is no Caddy, so it is the service's
 * published port on a different origin — which is why the service's WEB_ORIGIN includes
 * this page's origin in dev.
 *
 * **Throws in production when it is unset, rather than falling back.** The fallback
 * is real and load-bearing in development: webpack reports `env.config (ignored)`
 * under `tutor dev`, so this value is genuinely undefined there. In production the
 * same silence would point every student's browser at the wrong place, where every
 * call fails for a reason nothing on screen explains. A thrown error reaches the
 * caller's catch and is shown.
 */
export const apiBase = (): string => {
  const configured = (getConfig() as { CLASSROOM_API_URL?: string }).CLASSROOM_API_URL;
  if (configured) { return configured; }
  if (process.env.NODE_ENV === 'development') { return DEV_FALLBACK; }
  throw new Error(
    'The classroom is not configured: CLASSROOM_API_URL is missing. '
    + "This comes from the Tutor plugin's MFE runtime config.",
  );
};

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** What axios throws, as far as this file reads it. */
interface HttpError {
  message?: string;
  response?: { status?: number; data?: { detail?: string } };
}

async function call<T>(method: Method, path: string, data?: unknown): Promise<T> {
  try {
    const response = await getAuthenticatedHttpClient().request({
      url: `${apiBase()}${path}`,
      method,
      data,
      // The service is not the LMS and has no CSRF token endpoint, so the client must not
      // go looking for one. A cookie is only a credential here when the request opts in
      // with a header a hostile page cannot add (see the service's `auth.py`).
      isCsrfExempt: true,
    } as Parameters<ReturnType<typeof getAuthenticatedHttpClient>['request']>[0]);
    return response.data as T;
  } catch (cause) {
    const error = cause as HttpError;
    // FastAPI puts the message in `detail`.
    throw new Error(
      error.response?.data?.detail
      ?? (error.response?.status ? `Request failed (${error.response.status}).` : error.message)
      ?? 'Could not reach the classroom server.',
    );
  }
}

/** Who the server thinks you are. Also what refreshes the login cookie before a socket
 * opens, since a socket cannot refresh it itself. */
export const me = () => call<{ id: string; username: string; name: string }>('get', '/api/me');

export const searchTexts = (title: string) => call<TextResult[]>(
  'get',
  `/api/texts?${new URLSearchParams({ title, limit: '20' })}`,
);

/** The first and last day a class is held, as `YYYY-MM-DD`. Either may be left out or null. */
export interface ClassDates { startsOn?: string | null; endsOn?: string | null }

export const createRoom = (
  hostPassword: string,
  textId: string,
  name?: string,
  dates: ClassDates = {},
) => call<CreatedRoom>(
  'post',
  '/api/rooms',
  {
    hostPassword,
    textId,
    ...(name?.trim() ? { name: name.trim() } : {}),
    ...(dates.startsOn ? { startsOn: dates.startsOn } : {}),
    ...(dates.endsOn ? { endsOn: dates.endsOn } : {}),
  },
);

/** When a class is held, as the service has it. */
export const getClassDates = (code: string) => call<ClassDates>(
  'get',
  `/api/rooms/${encodeURIComponent(code)}`,
);

/** Say when the class is held. A null (or missing) date clears it. The teacher's. */
export const setClassDates = (code: string, dates: ClassDates) => call<void>(
  'put',
  `/api/rooms/${encodeURIComponent(code)}/dates`,
  { startsOn: dates.startsOn || null, endsOn: dates.endsOn || null },
);

/** The classes this account is in. What the code screen shows, so a code is entered once. */
export const myClasses = () => call<ClassSummary[]>('get', '/api/me/classes');

/** Become a member of a class. The one step that needs the code. Safe to repeat. */
export const joinRoom = (code: string) => call<JoinedRoom>(
  'post',
  `/api/rooms/${encodeURIComponent(code)}/join`,
);

// -- the teacher's tools -----------------------------------------------------

export const listMembers = (code: string) => call<Member[]>(
  'get',
  `/api/rooms/${encodeURIComponent(code)}/members`,
);

export const removeMember = (code: string, memberId: string) => call<void>(
  'delete',
  `/api/rooms/${encodeURIComponent(code)}/members/${encodeURIComponent(memberId)}`,
);

/** A student leaves the class for good. They can rejoin with the code, and keep their notes. */
export const leaveClass = (code: string) => call<void>(
  'post',
  `/api/rooms/${encodeURIComponent(code)}/leave`,
);

/** Give the class a new code. The old one stops working at once. */
export const changeCode = (code: string) => call<{ code: string }>(
  'post',
  `/api/rooms/${encodeURIComponent(code)}/change-code`,
);

/** Archive the class: for when the course is over. Ending *today's session* is separate. */
export const archiveClass = (code: string) => call<void>(
  'post',
  `/api/rooms/${encodeURIComponent(code)}/archive`,
);

// -- notes (students only, for now) ----------------------------------------------

const notesPath = (code: string) => `/api/rooms/${encodeURIComponent(code)}/notes`;

/** My notes in this class. Only ever the caller's own. */
export const listNotes = (code: string) => call<Note[]>('get', notesPath(code));

export const createNote = (code: string, note: NewNote) => call<Note>('post', notesPath(code), note);

/**
 * Change a note's colour and/or words. Where it is anchored never changes: different words
 * are a different note. `body: null` clears the words, leaving a plain highlight; leaving
 * `body` out changes nothing.
 */
export const updateNote = (
  code: string,
  id: string,
  change: { color?: NoteColor; body?: string | null },
) => call<Note>('patch', `${notesPath(code)}/${encodeURIComponent(id)}`, change);

export const deleteNote = (code: string, id: string) => call<void>(
  'delete',
  `${notesPath(code)}/${encodeURIComponent(id)}`,
);
