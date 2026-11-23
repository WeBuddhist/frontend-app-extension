/**
 * Looking up Tibetan words in Padma's dictionaries (https://padma.io).
 *
 * Padma's API is public: no key and no login, and it answers any site. The reader calls
 * it straight from the browser, and **without** the Academy cookie, because Padma has no
 * business seeing who our students are.
 *
 * One request looks a word up in many dictionaries at once. The answer comes as two lists
 * that line up position by position, one of definitions and one of which dictionary each
 * came from, grouped by word. That is reshaped here into something a page can draw:
 * each word, then each dictionary, then what that dictionary says.
 */

const API = 'https://api.padma.io/dictionary_lookup';

export interface Dictionary {
  /** What Padma calls it. */
  id: string;
  /** What a reader calls it. */
  name: string;
}

/** Every dictionary Padma offers, in the order they are offered. */
export const DICTIONARIES: Dictionary[] = [
  { id: 'erik_pema_kunsang', name: 'Erik Pema Kunsang' },
  { id: 'ives_waldo', name: 'Ives Waldo' },
  { id: 'jeffrey_hopkins', name: 'Jeffrey Hopkins' },
  { id: '84000', name: '84000' },
  { id: 'monlam', name: 'Monlam' },
  { id: 'lobsang_monlam', name: 'Lobsang Monlam' },
  { id: 'jim_welby', name: 'Jim Welby' },
  { id: 'tsepak_rigdzin', name: 'Tsepak Rigdzin' },
  { id: 'verb_lexicon', name: 'Verb lexicon' },
  { id: 'tibetan_multi', name: 'Tibetan multi' },
  { id: 'tibetan_medicine', name: 'Tibetan medicine' },
  { id: 'lotus_king_trust', name: 'Lotus King' },
  { id: 'laine_abbreviations', name: 'Laine abbreviations' },
  { id: 'tsig_dzo_chenmo', name: 'Tsig Dzo Chenmo' },
  { id: 'dag_yig', name: 'Dag Yig' },
  { id: 'sera', name: 'Sera' },
  { id: 'mahavyutpatti', name: 'Mahavyutpatti' },
  { id: 'negi_sanskrit', name: 'Negi Sanskrit' },
  { id: 'chandra_sanskrit', name: 'Chandra Sanskrit' },
  { id: 'yogacharabhumi_sanskrit', name: 'Yogacharabhumi Sanskrit' },
];

/**
 * The ones asked by default: four in English, one in Tibetan. All twenty at once is a wall
 * of text; a student who wants more can turn them on.
 */
export const DEFAULT_DICTIONARIES = ['erik_pema_kunsang', 'ives_waldo', 'jeffrey_hopkins', '84000', 'monlam'];

const nameOf = (id: string) => DICTIONARIES.find((d) => d.id === id)?.name ?? id;

export interface DictionaryEntry {
  dictionary: string;
  name: string;
  /** What the dictionary says, one item per entry it has for the word. */
  definitions: string[];
}

export interface WordMeaning {
  word: string;
  /** In the order the dictionaries were asked for. Empty when none of them knew it. */
  entries: DictionaryEntry[];
}

export interface LookupResult {
  query: string;
  /** True when the phrase was not found whole and was looked up word by word instead. */
  split: boolean;
  /** Empty when nothing was found at all. */
  words: WordMeaning[];
}

interface PadmaAnswer {
  search_query?: string;
  tokens?: string[];
  text?: string[][];
  source?: string[][];
}

// ---------------------------------------------------------------------------------------
// Tidying what the dictionaries say
// ---------------------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'",
};

/**
 * Jeffrey Hopkins' entries come in a bracketed markup, such as
 * `[E: [s: [c.s: [b:C] «citta» ] [c.e: [HP] «mind» ] ] ]`, where `c.e` is an English
 * meaning and `c.s` a Sanskrit one. Pull those out and say them plainly. Anything that is
 * not in that shape is returned as it came.
 */
export function readBracketed(text: string): string {
  if (!text.trimStart().startsWith('[E:')) { return text; }
  const english: string[] = [];
  const sanskrit: string[] = [];
  const pattern = /\[c\.([es]):[^«]*«([^»]*)»/g;
  let match = pattern.exec(text);
  while (match) {
    // A page reference such as ༿TGP 78༾ is for the printed book, not for a reader here.
    const words = match[2].replace(/༿[^༾]*༾/g, '').trim();
    const list = match[1] === 'e' ? english : sanskrit;
    if (words && !list.includes(words)) { list.push(words); }
    match = pattern.exec(text);
  }
  const parts = [english.join('; '), sanskrit.length ? `Sanskrit: ${sanskrit.join(', ')}` : ''];
  const plain = parts.filter(Boolean).join('\n');
  return plain || text;
}

/** One definition made fit to show: entities decoded, markup read, stray marks gone. */
export function tidy(text: string): string {
  return readBracketed(text)
    .replace(/&(#39|[a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole)
    // Some entries carry a literal backslash-n where a line break was meant.
    .replace(/\\n/g, '\n')
    // A pair of CJK characters some Tibetan dictionaries use to fence off a Sanskrit word.
    .replace(/[粍粎]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------------------
// Reshaping Padma's answer
// ---------------------------------------------------------------------------------------

/** Each word, then each dictionary in the order asked, then its definitions. */
export function reshape(answer: PadmaAnswer, asked: string[]): WordMeaning[] {
  const tokens = answer.tokens ?? [];
  return tokens.map((word, w) => {
    const texts = answer.text?.[w] ?? [];
    const sources = answer.source?.[w] ?? [];
    const byDictionary = new Map<string, string[]>();
    texts.forEach((raw, i) => {
      const dictionary = sources[i];
      const definition = tidy(raw ?? '');
      if (!dictionary || !definition) { return; }
      const list = byDictionary.get(dictionary) ?? [];
      // A dictionary sometimes repeats itself word for word.
      if (!list.includes(definition)) { list.push(definition); }
      byDictionary.set(dictionary, list);
    });
    const rank = (id: string) => {
      const at = asked.indexOf(id);
      return at === -1 ? asked.length : at;
    };
    const entries = [...byDictionary.entries()]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([dictionary, definitions]) => ({ dictionary, name: nameOf(dictionary), definitions }));
    return { word, entries };
  });
}

// ---------------------------------------------------------------------------------------
// Asking
// ---------------------------------------------------------------------------------------

export class LookupError extends Error {}

/**
 * One question to Padma. Null when it found nothing: it says so with a 404, not with an
 * empty list.
 */
async function ask(
  query: string,
  dictionaries: string[],
  tokenize: boolean,
  signal?: AbortSignal,
): Promise<PadmaAnswer | null> {
  const params = new URLSearchParams({
    query,
    matching: 'exact',
    dictionaries: dictionaries.join(','),
    tokenize: String(tokenize),
    mode: 'api',
  });
  let response: Response;
  try {
    response = await fetch(`${API}?${params}`, { credentials: 'omit', signal });
  } catch (cause) {
    if ((cause as Error)?.name === 'AbortError') { throw cause; }
    throw new LookupError('Could not reach the dictionary.');
  }
  if (response.status === 404) { return null; }
  if (!response.ok) { throw new LookupError(`The dictionary did not answer (${response.status}).`); }
  try {
    return await response.json();
  } catch {
    // A page in place of an answer (a proxy's error page, say): say so plainly, not in the
    // parser's words.
    throw new LookupError('The dictionary sent an answer that could not be read.');
  }
}

/** Answers already had, so looking the same words up twice asks once. Kept for the visit. */
const cache = new Map<string, LookupResult>();

export const clearLookupCache = () => cache.clear();

/**
 * What the selected words mean.
 *
 * The phrase is looked up whole first, because a dictionary often has the phrase as a
 * term of its own (བྱང་ཆུབ་སེམས་ is "bodhicitta", not "enlightenment" + "mind"). Only when
 * the whole of it is not in any dictionary is it split into words and each looked up.
 */
export async function lookup(
  query: string,
  dictionaries: string[] = DEFAULT_DICTIONARIES,
  signal?: AbortSignal,
): Promise<LookupResult> {
  const words = query.trim();
  const key = `${dictionaries.join(',')}|${words}`;
  const known = cache.get(key);
  if (known) { return known; }

  let split = false;
  let answer = await ask(words, dictionaries, false, signal);
  if (!answer) {
    split = true;
    answer = await ask(words, dictionaries, true, signal);
  }
  const meanings = answer ? reshape(answer, dictionaries) : [];
  const result: LookupResult = {
    query: words,
    split,
    words: meanings.some((m) => m.entries.length > 0) ? meanings : [],
  };
  cache.set(key, result);
  return result;
}

/** Whether there is Tibetan in the words: only Tibetan can be looked up. */
export const hasTibetan = (text: string) => /[ༀ-࿿]/.test(text);

// ---------------------------------------------------------------------------------------
// Which dictionaries this reader wants
// ---------------------------------------------------------------------------------------

const KEY = 'classroom.dictionaries';

export function recallDictionaries(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (Array.isArray(saved)) {
      // Kept in the list's own order, and only ones Padma still has.
      const chosen = DICTIONARIES.map((d) => d.id).filter((id) => saved.includes(id));
      if (chosen.length > 0) { return chosen; }
    }
  } catch {
    // Storage blocked or spoiled: the defaults will do.
  }
  return DEFAULT_DICTIONARIES;
}

export function rememberDictionaries(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* not kept; fine */ }
}
