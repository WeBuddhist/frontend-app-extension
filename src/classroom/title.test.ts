import { splitTitle } from './ClassroomPage';

describe('splitTitle', () => {
  it('puts the bracketed English gloss beneath the Tibetan name', () => {
    expect(splitTitle('བྱང་ཆུབ། (The Precious Lamp — Tibetan root text)')).toEqual({
      main: 'བྱང་ཆུབ།',
      sub: 'The Precious Lamp — Tibetan root text',
    });
  });

  it('leaves a title with no bracket whole', () => {
    expect(splitTitle('བྱང་ཆུབ།')).toEqual({ main: 'བྱང་ཆུབ།', sub: null });
  });

  it('does not split on a bracket in the middle of a title', () => {
    expect(splitTitle('Part (one) of the text')).toEqual({
      main: 'Part (one) of the text',
      sub: null,
    });
  });

  it('does not strip a title that is only a bracket', () => {
    expect(splitTitle('(untitled)')).toEqual({ main: '(untitled)', sub: null });
  });
});
