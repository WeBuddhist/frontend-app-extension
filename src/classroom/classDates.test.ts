import { datesInOrder, phaseOf, todayIso } from './classDates';

describe('where a class is in its dates', () => {
  it('is upcoming before the first day, running through the last, finished after', () => {
    expect(phaseOf('2026-03-12', '2026-04-30', '2026-03-11')).toBe('upcoming');
    expect(phaseOf('2026-03-12', '2026-04-30', '2026-03-12')).toBe('running');
    expect(phaseOf('2026-03-12', '2026-04-30', '2026-04-30')).toBe('running');
    expect(phaseOf('2026-03-12', '2026-04-30', '2026-05-01')).toBe('finished');
  });

  it('copes with only one end given, or none', () => {
    expect(phaseOf('2026-03-12', null, '2026-01-01')).toBe('upcoming');
    expect(phaseOf('2026-03-12', null, '2030-01-01')).toBe('running');
    expect(phaseOf(null, '2026-04-30', '2026-05-01')).toBe('finished');
    expect(phaseOf(null, null, '2026-05-01')).toBe('running');
  });

  it('reads today in the reader\'s own calendar', () => {
    expect(todayIso(new Date(2026, 2, 5))).toBe('2026-03-05');
  });

  it('knows whether two days are in order', () => {
    expect(datesInOrder('2026-03-12', '2026-03-12')).toBe(true);
    expect(datesInOrder('2026-03-12', '2026-03-11')).toBe(false);
    expect(datesInOrder('', '2026-03-11')).toBe(true);
  });
});
