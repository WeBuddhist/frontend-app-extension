/**
 * Pinning notes to words. These are the parts that go quietly wrong, so they are tested
 * with real Tibetan and with the cases that break naive versions: a selection that cuts a
 * syllable, a line that was edited, the same words twice, characters outside the BMP.
 */

import {
  buildAnchor, pieces, relocate, selectionToAnchor, snap, type Mark,
} from './anchors';

// བྱང་ཆུབ་སེམས་དཔའི་སྤྱོད་པ། : "bodhisattva's conduct", five syllables joined by tsek.
const TIB = 'བྱང་ཆུབ་སེམས་དཔའི་སྤྱོད་པ།';
const chars = (s: string) => Array.from(s);
const at = (s: string, span: { start: number; end: number } | null) => (
  span ? chars(s).slice(span.start, span.end).join('') : null
);

describe('snap: Tibetan', () => {
  it('widens a selection that stops mid-syllable to the whole syllable', () => {
    // From inside the first syllable to inside the second.
    expect(at(TIB, snap(TIB, 2, 6))).toBe('བྱང་ཆུབ');
  });

  it('never cuts a stack of letters in half', () => {
    // ྱ is stacked under བ; a selection starting between them must take the whole syllable.
    const span = snap(TIB, 1, 4);
    expect(at(TIB, span)?.startsWith('བྱ')).toBe(true);
  });

  it('leaves a selection that already sits on boundaries exactly as it is', () => {
    const start = chars(TIB).indexOf('ཆ');
    const end = chars(TIB).indexOf('ས');
    // 'ཆུབ་' without the tsek that follows
    expect(at(TIB, snap(TIB, start, end - 1))).toBe('ཆུབ');
  });

  it('does not begin or end a highlight on the tsek that joins syllables', () => {
    // Selected through the tsek after the first syllable: the tsek is dropped.
    expect(at(TIB, snap(TIB, 0, 4))?.endsWith('་')).toBe(false);
    expect(at(TIB, snap(TIB, 3, 8))?.startsWith('་')).toBe(false);
  });

  it('keeps a shad, which ends a phrase and is part of what was read', () => {
    expect(at(TIB, snap(TIB, 0, chars(TIB).length))?.endsWith('།')).toBe(true);
  });

  it('works across a line break inside a verse', () => {
    const verse = 'བྱང་ཆུབ\nསེམས་དཔའ';
    expect(at(verse, snap(verse, 2, 9))).toBe('བྱང་ཆུབ\nསེམས');
  });
});

describe('snap: other text', () => {
  it('widens to whole words', () => {
    const text = 'Homage to the Guru Mañjuśrī!';
    // From inside "the" to inside "Mañjuśrī".
    expect(at(text, snap(text, 11, 22))).toBe('the Guru Mañjuśrī');
  });

  it('keeps accented letters and apostrophes inside a word', () => {
    expect(at("a teacher's Mañjuśrī", snap("a teacher's Mañjuśrī", 4, 8))).toBe("teacher's");
  });

  it('trims the space and line break a browser tends to pick up', () => {
    expect(at('one two three', snap('one two three', 3, 8))).toBe('two');
    expect(at('one\ntwo', snap('one\ntwo', 0, 4))).toBe('one');
  });

  it('is null when only space was selected', () => {
    expect(snap('a   b', 1, 4)).toBeNull();
    expect(snap('abc', 2, 2)).toBeNull();
  });

  it('accepts a backwards selection', () => {
    expect(at('one two', snap('one two', 7, 4))).toBe('two');
  });

  it('stays inside the text however far out the offsets are', () => {
    expect(at('one two', snap('one two', -5, 99))).toBe('one two');
  });
});

describe('buildAnchor', () => {
  it('keeps the words and a little around them', () => {
    const anchor = buildAnchor('one two three four', 4, 7);
    expect(anchor).toEqual({
      start: 4, end: 7, quote: 'two', prefix: 'one ', suffix: ' three four',
    });
  });

  it('limits how much context it keeps', () => {
    const text = `${'x'.repeat(100)}WORDS${'y'.repeat(100)}`;
    const anchor = buildAnchor(text, 100, 105);
    expect(anchor.prefix).toHaveLength(24);
    expect(anchor.suffix).toHaveLength(24);
  });

  it('counts a character outside the basic plane once', () => {
    const text = 'a😀b word';
    const anchor = buildAnchor(text, 4, 8);
    expect(anchor.quote).toBe('word');
    expect(anchor.prefix).toBe('a😀b ');
  });
});

describe('relocate', () => {
  const asNote = (text: string, quote: string, from = 0) => {
    const a = buildAnchor(text, text.indexOf(quote, from), text.indexOf(quote, from) + quote.length);
    return {
      startOffset: a.start, endOffset: a.end, quote: a.quote, prefix: a.prefix, suffix: a.suffix,
    };
  };

  it('keeps the words where they were when nothing changed', () => {
    const text = 'one two three';
    expect(relocate(text, asNote(text, 'two'))).toEqual({ start: 4, end: 7 });
  });

  it('follows the words when text is added before them', () => {
    const before = 'one two three';
    const saved = asNote(before, 'two');
    expect(relocate('NEW one two three', saved)).toEqual({ start: 8, end: 11 });
  });

  it('uses the surroundings to pick the right one when the words occur twice', () => {
    const before = 'the cat sat. the dog sat.';
    const saved = asNote(before, 'sat', before.indexOf('sat', 14));
    // An edit that shifts everything: the *second* "sat" is still the one meant.
    const after = '>>> the cat sat. the dog sat.';
    const found = relocate(after, saved);
    expect(after.slice(found!.start, found!.end)).toBe('sat');
    expect(found!.start).toBe(after.lastIndexOf('sat'));
  });

  it('is null when the words are gone, rather than pointing at the wrong ones', () => {
    const saved = asNote('one two three', 'two');
    expect(relocate('one four three', saved)).toBeNull();
  });

  it('is null for an empty quote', () => {
    expect(relocate('abc', {
      startOffset: 0, endOffset: 0, quote: '', prefix: '', suffix: '',
    })).toBeNull();
  });

  it('finds Tibetan words again after an edit', () => {
    const saved = asNote(TIB, 'ཆུབ');
    const found = relocate(`༄༅། ${TIB}`, saved);
    expect(at(`༄༅། ${TIB}`, found)).toBe('ཆུབ');
  });
});

describe('pieces', () => {
  const mark = (id: string, start: number, end: number, color: Mark['color'] = 'yellow', hasBody = false): Mark => ({
    id, start, end, color, hasBody,
  });

  it('is the whole text, plain, when there are no notes', () => {
    expect(pieces('hello', [])).toEqual([{
      text: 'hello', ids: [], color: null, hasBody: false,
    }]);
  });

  it('cuts the text around one highlight, and loses nothing', () => {
    const out = pieces('hello world', [mark('a', 6, 11)]);
    expect(out.map((p) => p.text)).toEqual(['hello ', 'world']);
    expect(out.map((p) => p.text).join('')).toBe('hello world');
    expect(out[1]).toMatchObject({ ids: ['a'], color: 'yellow' });
    expect(out[0].ids).toEqual([]);
  });

  it('shows both highlights where two overlap, newest colour on top', () => {
    const out = pieces('abcdef', [mark('old', 0, 4, 'yellow'), mark('new', 2, 6, 'green')]);
    expect(out.map((p) => [p.text, p.ids, p.color])).toEqual([
      ['ab', ['old'], 'yellow'],
      ['cd', ['old', 'new'], 'green'],
      ['ef', ['new'], 'green'],
    ]);
  });

  it('keeps nested and adjacent highlights apart', () => {
    const out = pieces('abcdef', [mark('outer', 0, 6), mark('inner', 2, 4, 'pink'), mark('next', 4, 6, 'blue')]);
    expect(out.map((p) => p.text).join('')).toBe('abcdef');
    expect(out.find((p) => p.text === 'cd')?.ids).toEqual(['outer', 'inner']);
    expect(out.find((p) => p.text === 'ef')?.color).toBe('blue');
  });

  it('says when any note covering a piece has words', () => {
    expect(pieces('abc', [mark('a', 0, 3, 'yellow', true)])[0].hasBody).toBe(true);
    expect(pieces('abc', [mark('a', 0, 3)])[0].hasBody).toBe(false);
  });

  it('ignores a range that falls outside the text or is empty', () => {
    expect(pieces('abc', [mark('a', 5, 9), mark('b', 2, 2)]).map((p) => p.ids)).toEqual([[]]);
  });

  it('clips a range that runs past the end', () => {
    expect(pieces('abc', [mark('a', 1, 99)]).map((p) => p.text)).toEqual(['a', 'bc']);
  });

  it('cuts by code points, so a character outside the basic plane is never split', () => {
    const out = pieces('a😀b', [mark('a', 1, 2)]);
    expect(out.map((p) => p.text)).toEqual(['a', '😀', 'b']);
  });
});

describe('selectionToAnchor', () => {
  const build = (html: string) => {
    document.body.innerHTML = `<div class="root">${html}</div>`;
    return document.querySelector('.root') as Element;
  };
  const select = (startNode: Node, startOffset: number, endNode: Node, endOffset: number) => {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    return selection;
  };
  const layer = (n: number) => document.querySelectorAll('[data-layer]')[n];

  beforeEach(() => {
    // jsdom has no layout, so a Range has no box of its own.
    // jsdom has no DOMRect either, so a plain box stands in for one.
    Range.prototype.getBoundingClientRect = () => ({
      x: 10, y: 20, top: 20, left: 10, width: 30, height: 10, bottom: 30, right: 40, toJSON: () => ({}),
    }) as DOMRect;
  });

  it('turns a selection inside one line into an anchor, counted from that line\'s own text', () => {
    const root = build('<p data-segment-id="s1"><span data-layer="source">one two three</span></p>');
    const text = layer(0).firstChild!;
    const result = selectionToAnchor(select(text, 4, text, 7), root);
    expect(result).toMatchObject({
      ok: true, segmentId: 's1', layer: 'source', anchor: { start: 4, end: 7, quote: 'two' },
    });
  });

  it('counts from the line\'s text, whatever else is on the page before it', () => {
    const root = build(
      '<p data-segment-id="s1"><span data-layer="source">first line</span></p>'
      + '<p data-segment-id="s2"><span data-layer="source">second line</span></p>',
    );
    const text = layer(1).firstChild!;
    const result = selectionToAnchor(select(text, 0, text, 6), root);
    expect(result).toMatchObject({ ok: true, segmentId: 's2', anchor: { start: 0, end: 6, quote: 'second' } });
  });

  it('is not thrown by highlights already drawn inside the line', () => {
    const root = build(
      '<p data-segment-id="s1"><span data-layer="source">one <mark>two</mark> three four</span></p>',
    );
    const tail = layer(0).lastChild!; // " three four"
    const result = selectionToAnchor(select(tail, 1, tail, 6), root);
    expect(result).toMatchObject({ ok: true, anchor: { quote: 'three', start: 8, end: 13 } });
  });

  it('knows which text a selection is on', () => {
    const root = build(
      '<p data-segment-id="s1"><span data-layer="source">བྱང་ཆུབ</span><span data-layer="translation">enlightenment</span></p>',
    );
    const text = layer(1).firstChild!;
    expect(selectionToAnchor(select(text, 0, text, 13), root)).toMatchObject({ ok: true, layer: 'translation' });
  });

  it('refuses a selection that crosses two lines', () => {
    const root = build(
      '<p data-segment-id="s1"><span data-layer="source">one</span></p>'
      + '<p data-segment-id="s2"><span data-layer="source">two</span></p>',
    );
    expect(selectionToAnchor(select(layer(0).firstChild!, 0, layer(1).firstChild!, 3), root).ok).toBe(false);
  });

  it('refuses a selection that crosses the source and its translation', () => {
    const root = build(
      '<p data-segment-id="s1"><span data-layer="source">one</span><span data-layer="translation">uno</span></p>',
    );
    expect(selectionToAnchor(select(layer(0).firstChild!, 0, layer(1).firstChild!, 3), root).ok).toBe(false);
  });

  it('refuses a selection outside the reader', () => {
    const root = build('<p data-segment-id="s1"><span data-layer="source">one</span></p>');
    const outside = document.createElement('div');
    outside.innerHTML = '<span data-layer="source" data-x>elsewhere</span>';
    document.body.appendChild(outside);
    const text = outside.querySelector('span')!.firstChild!;
    expect(selectionToAnchor(select(text, 0, text, 5), root).ok).toBe(false);
  });

  it('refuses nothing selected, and a selection of only space', () => {
    const root = build('<p data-segment-id="s1"><span data-layer="source">a   b</span></p>');
    const text = layer(0).firstChild!;
    expect(selectionToAnchor(select(text, 1, text, 1), root).ok).toBe(false);
    expect(selectionToAnchor(select(text, 1, text, 4), root).ok).toBe(false);
    expect(selectionToAnchor(null, root).ok).toBe(false);
  });

  it('widens a selection to whole words, as it will be saved', () => {
    const root = build('<p data-segment-id="s1"><span data-layer="source">Homage to the Guru</span></p>');
    const text = layer(0).firstChild!;
    const result = selectionToAnchor(select(text, 8, text, 12), root);
    expect(result).toMatchObject({ ok: true, anchor: { quote: 'to the' } });
  });

  it('gives where to put the popup', () => {
    const root = build('<p data-segment-id="s1"><span data-layer="source">one two</span></p>');
    const text = layer(0).firstChild!;
    const result = selectionToAnchor(select(text, 0, text, 3), root);
    expect(result.ok && result.rect.top).toBe(20);
  });
});

describe('relocate with repeated words', () => {
  it('picks the occurrence whose surroundings match, past astral characters', () => {
    const text = '\u{1F600}x one x two x three';
    const note = {
      startOffset: 99, endOffset: 100, quote: 'x', prefix: 'two ', suffix: ' three',
    };
    // "x" occurs three times; the one after "two " is the third, at code point 13.
    expect(relocate(text, note)).toEqual({ start: 13, end: 14 });
  });
});
