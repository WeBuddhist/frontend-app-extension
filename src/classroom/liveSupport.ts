/**
 * Shared by the `.live` tests: two accounts talking to a real sync server from one jsdom.
 *
 * In a real browser the Academy login is cookies, and one browser is one account. A test
 * needs two accounts at once, so it stands in for the browser: requests carry the current
 * account's token as an `Authorization` header and sockets as `auth.token`, both of which
 * the server accepts for exactly this purpose. Switch account with `as(...)` **before**
 * rendering, and wait for that render's socket to settle before switching again.
 *
 * Tokens come from the LMS, or `scripts/make_test_login.py` in the service repo:
 *   CLASSROOM_TOKEN_TEACHER, CLASSROOM_TOKEN_STUDENT.
 */

export const API = process.env.CLASSROOM_API_URL;
export const PASSWORD = process.env.CLASSROOM_HOST_PASSWORD ?? '';

const TOKENS: Record<string, string | undefined> = {
  teacher: process.env.CLASSROOM_TOKEN_TEACHER,
  student: process.env.CLASSROOM_TOKEN_STUDENT,
  other: process.env.CLASSROOM_TOKEN_OTHER,
};

let current = 'teacher';
export const as = (who: 'teacher' | 'student' | 'other') => { current = who; };
export const tokenOf = (who: string = current) => TOKENS[who] ?? '';
export const hasTokens = () => Boolean(TOKENS.teacher && TOKENS.student);

interface Result { status: number; data: any }

/** jsdom has XMLHttpRequest but not fetch, so setup calls use it. */
export const http = (
  method: string,
  url: string,
  body?: unknown,
  who: string = current,
): Promise<Result> => new Promise((resolve, reject) => {
  const request = new XMLHttpRequest();
  request.open(method, url, true);
  request.setRequestHeader('content-type', 'application/json');
  request.setRequestHeader('authorization', `JWT ${tokenOf(who)}`);
  request.onload = () => {
    let data: any = null;
    try { data = request.responseText ? JSON.parse(request.responseText) : null; } catch { /* no body */ }
    resolve({ status: request.status, data });
  };
  request.onerror = () => reject(new Error(`${method} ${url} failed`));
  request.send(body === undefined ? null : JSON.stringify(body));
});

/**
 * What `getAuthenticatedHttpClient()` returns, over `http`: the same shape the real one
 * has, throwing what axios throws on a non-2xx.
 */
export const fakeAuthenticatedClient = () => ({
  request: async ({ url, method, data }: { url: string; method: string; data?: unknown }) => {
    const result = await http(method.toUpperCase(), url, data);
    if (result.status >= 400) {
      const error: any = new Error(`Request failed with status code ${result.status}`);
      error.response = { status: result.status, data: result.data };
      throw error;
    }
    return { data: result.data, status: result.status };
  },
});
