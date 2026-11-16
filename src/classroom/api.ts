/**
 * HTTP calls to the classroom sync service, and where the host token is kept.
 *
 * Deliberately plain `fetch` rather than `getAuthenticatedHttpClient()`: this service
 * is not the LMS and does not read Open edX's JWT, so attaching one would send the
 * user's token to a service that has no use for it.
 *
 * Field names are camelCase on the wire. `camelCaseObject` is not used here — the
 * server already speaks camelCase, and converting would hide a mismatch rather than
 * surface it.
 */

import { getConfig } from '@edx/frontend-platform';

import type { CreatedRoom, TextResult } from './types';

/**
 * Set by the Tutor plugin's MFE runtime config. In production it is a path on this
 * MFE's own origin (Caddy proxies it); in development there is no Caddy, so it is the
 * service's published port on a different origin — which is why the service's
 * WEB_ORIGIN includes this page's origin in dev.
 */
export const apiBase = (): string => (getConfig() as { CLASSROOM_API_URL?: string })
  .CLASSROOM_API_URL ?? 'http://localhost:8010';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    // FastAPI puts the message in `detail`.
    const body = await response.json().catch(() => ({})) as { detail?: string };
    throw new Error(body.detail ?? `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const searchTexts = (title: string) => request<TextResult[]>(
  `/api/texts?${new URLSearchParams({ title, limit: '20' })}`,
);

export const createRoom = (hostPassword: string, textId: string) => request<CreatedRoom>(
  '/api/rooms',
  { method: 'POST', body: JSON.stringify({ hostPassword, textId }) },
);

/**
 * Check a recovery code before relying on it, so a mismatch surfaces while the teacher
 * can still do something about it rather than when their first tap is refused mid-class.
 * A 410 means the code is right but the class is over.
 */
export const verifyHost = (code: string, hostToken: string) => request<{ ok: true }>(
  `/api/rooms/${code}/verify-host`,
  { method: 'POST', body: JSON.stringify({ hostToken }) },
);

// ---------------------------------------------------------------------------
// Host token storage
// ---------------------------------------------------------------------------

/**
 * The host token is shown once by the server and kept here. Anyone holding it can drive
 * the room, so it stays in this browser and is never put in the URL, where it would end
 * up in history and in anything the teacher shares.
 */
const hostKey = (code: string) => `wbac:host:${code.toUpperCase()}`;

export function rememberHostToken(code: string, token: string): void {
  try {
    localStorage.setItem(hostKey(code), token);
  } catch {
    // Private browsing or blocked storage. The teacher keeps the recovery code instead.
  }
}

export function recallHostToken(code: string): string | undefined {
  try {
    return localStorage.getItem(hostKey(code)) ?? undefined;
  } catch {
    return undefined;
  }
}
