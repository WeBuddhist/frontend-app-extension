/** Looking words up in Padma: asking, falling back to word by word, and tidying the answer. */

import {
  DEFAULT_DICTIONARIES, clearLookupCache, lookup, readBracketed, recallDictionaries,
  rememberDictionaries, reshape, tidy,
} from './dictionary';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
const status = (code: number) => ({ ok: false, status: code, json: async () => ({ detail: 'Not Found' }) }) as Response;

const urlOf = (call: unknown[]) => new URL(call[0] as string);

beforeEach(() => {
  clearLookupCache();
  localStorage.clear();
});

describe('asking Padma', () => {
  it('asks for the whole phrase first, without the Academy cookie', async () => {
    global.fetch = jest.fn(async () => ok({
      tokens: ['བྱང་ཆུབ་སེམས་'], text: [['bodhicitta']], source: [['ives_waldo']],
    })) as unknown as typeof fetch;

    const result = await lookup('བྱང་ཆུབ་སེམས');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [call] = (global.fetch as jest.Mock).mock.calls;
    const url = urlOf(call);
    expect(url.origin + url.pathname).toBe('https://api.padma.io/dictionary_lookup');
    expect(url.searchParams.get('query')).toBe('བྱང་ཆུབ་སེམས');
    expect(url.searchParams.get('tokenize')).toBe('false');
    expect(url.searchParams.get('matching')).toBe('exact');
    expect(url.searchParams.get('dictionaries')).toBe(DEFAULT_DICTIONARIES.join(','));
    expect(call[1]).toMatchObject({ credentials: 'omit' });
    expect(result).toEqual({
      query: 'བྱང་ཆུབ་སེམས',
      split: false,
      words: [{
        word: 'བྱང་ཆུབ་སེམས་',
        entries: [{ dictionary: 'ives_waldo', name: 'Ives Waldo', definitions: ['bodhicitta'] }],
      }],
    });
  });

  it('goes word by word when the phrase is not found whole', async () => {
    const answers = [status(404), ok({
      tokens: ['སེམས་ཅན་', 'ཀཀཀ་'], text: [['sentient being'], []], source: [['ives_waldo'], []],
    })];
    global.fetch = jest.fn(async () => answers.shift()) as unknown as typeof fetch;

    const result = await lookup('སེམས་ཅན་ཀཀཀ');

    expect(urlOf((global.fetch as jest.Mock).mock.calls[1]).searchParams.get('tokenize')).toBe('true');
    expect(result.split).toBe(true);
    expect(result.words.map((w) => [w.word, w.entries.length])).toEqual([['སེམས་ཅན་', 1], ['ཀཀཀ་', 0]]);
  });

  it('says nothing was found when neither way finds anything', async () => {
    global.fetch = jest.fn(async () => status(404)) as unknown as typeof fetch;
    await expect(lookup('ཀཀཀ')).resolves.toEqual({ query: 'ཀཀཀ', split: true, words: [] });
  });

  it('fails plainly when Padma is down or out of reach', async () => {
    global.fetch = jest.fn(async () => status(500)) as unknown as typeof fetch;
    await expect(lookup('སེམས')).rejects.toThrow('(500)');
    global.fetch = jest.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    await expect(lookup('སེམས')).rejects.toThrow('Could not reach the dictionary.');
  });

  it('says plainly when the answer cannot be read', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token '<'"); },
    })) as unknown as typeof fetch;
    await expect(lookup('སེམས')).rejects.toThrow('The dictionary sent an answer that could not be read.');
  });

  it('asks once for the same words in the same dictionaries', async () => {
    global.fetch = jest.fn(async () => ok({ tokens: ['སེམས་'], text: [['mind']], source: [['84000']] })) as unknown as typeof fetch;
    await lookup('སེམས');
    await lookup('སེམས');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await lookup('སེམས', ['monlam']);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('reshaping the answer', () => {
  it('groups by dictionary in the order asked, and drops repeats', () => {
    const words = reshape({
      tokens: ['སེམས་'],
      text: [['sems mo', 'mind', 'mind', 'awareness']],
      source: [['monlam', 'ives_waldo', 'ives_waldo', 'ives_waldo']],
    }, ['ives_waldo', 'monlam']);
    expect(words[0].entries).toEqual([
      { dictionary: 'ives_waldo', name: 'Ives Waldo', definitions: ['mind', 'awareness'] },
      { dictionary: 'monlam', name: 'Monlam', definitions: ['sems mo'] },
    ]);
  });
});

describe('tidying a definition', () => {
  it('decodes entities, breaks lines and drops the fencing marks', () => {
    expect(tidy(' pure &amp; total\\npresence  粍བོདཧི粎 ')).toBe('pure & total\npresence བོདཧི');
  });

  it('reads Jeffrey Hopkins\' bracketed entries plainly', () => {
    const raw = '[E: [s: [c.s: [b:C] «bodhicitta» ] [c.e: [HP] «mind of enlightenment» ] '
      + '[c.e: mngon par byang chub pa » «manifest enlightenment༿TGP 78༾» ] ]';
    expect(readBracketed(raw)).toBe('mind of enlightenment; manifest enlightenment\nSanskrit: bodhicitta');
  });

  it('leaves anything else as it is', () => {
    expect(readBracketed('1) cognition')).toBe('1) cognition');
  });
});

describe('the reader\'s choice of dictionaries', () => {
  it('starts with the defaults, and keeps a choice in the list\'s own order', () => {
    expect(recallDictionaries()).toEqual(DEFAULT_DICTIONARIES);
    rememberDictionaries(['monlam', 'ives_waldo', 'gone_now']);
    expect(recallDictionaries()).toEqual(['ives_waldo', 'monlam']);
  });
});
