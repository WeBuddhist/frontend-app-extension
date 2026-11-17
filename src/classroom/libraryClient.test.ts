/** Talking to the library through the service: the login, and not asking for the same thing twice. */

import { allSpans, clearTextCache, library } from './text';
import { me } from './api';

jest.mock('./api', () => ({ apiBase: () => 'http://sync.test', me: jest.fn() }));

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
const status = (code: number) => ({ ok: false, status: code, json: async () => null }) as Response;

beforeEach(() => {
  jest.resetAllMocks();
  clearTextCache();
  (me as jest.Mock).mockResolvedValue({ id: 'u1' });
});

describe('the login', () => {
  it('is sent with every call', async () => {
    global.fetch = jest.fn(async () => ok({})) as unknown as typeof fetch;
    await library('/v2/texts');
    expect(global.fetch).toHaveBeenCalledWith('http://sync.test/library/v2/texts', {
      credentials: 'include',
      headers: { 'USE-JWT-COOKIE': 'true' },
    });
  });

  it('is renewed, and the call tried once more, when it has run out', async () => {
    const calls = [status(401), ok({ items: [] })];
    global.fetch = jest.fn(async () => calls.shift() as Response) as unknown as typeof fetch;
    await expect(library('/v2/texts')).resolves.toEqual({ items: [] });
    expect(me).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after that one retry', async () => {
    global.fetch = jest.fn(async () => status(401)) as unknown as typeof fetch;
    await expect(library('/v2/texts')).rejects.toThrow('(401)');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('segment lists', () => {
  const page = { items: [{ id: 's1', lines: [{ start: 0, end: 3 }] }], has_more: false };

  it('are fetched once per edition, however many parts of the page want them', async () => {
    global.fetch = jest.fn(async () => ok(page)) as unknown as typeof fetch;
    const [a, b, c] = await Promise.all([allSpans('ed'), allSpans('ed'), allSpans('ed')]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await allSpans('other');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('are asked for again after a failure, not remembered as failed', async () => {
    const calls = [status(500), ok(page)];
    global.fetch = jest.fn(async () => calls.shift() as Response) as unknown as typeof fetch;
    await expect(allSpans('ed')).rejects.toThrow();
    await expect(allSpans('ed')).resolves.toHaveLength(1);
  });
});
