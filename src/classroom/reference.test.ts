/** The library's segment labels survive the trip into lines. */

import { loadText } from './text';

jest.mock('./api', () => ({ apiBase: () => 'http://sync.test' }));

it('carries each segment\'s reference into its line, and leaves none where there is none', async () => {
  global.fetch = jest.fn(async (url: string) => {
    const path = new URL(url).pathname.replace('/library', '');
    const body = path.endsWith('/content')
      ? 'abcdef'
      : {
        items: [
          {
            id: 's1', reference: 'I-1', lines: [{ start: 0, end: 3 }], type: 'front_matter',
          },
          {
            id: 's2', reference: null, lines: [{ start: 3, end: 6 }], type: 'verse',
          },
        ],
        has_more: false,
      };
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as unknown as typeof fetch;

  const lines = await loadText('ed');
  expect(lines.map((line) => line.reference)).toEqual(['I-1', undefined]);
});
