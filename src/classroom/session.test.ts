import {
  forgetSession, MAX_AGE_MS, pickSession, recallSession, rememberSession,
} from './session';

const teacher = { code: 'ABC234' };

beforeEach(() => localStorage.clear());

describe('remembering a session', () => {
  it('brings back what was remembered', () => {
    rememberSession(teacher);
    expect(recallSession()).toEqual(teacher);
  });

  it('forgets on request', () => {
    rememberSession(teacher);
    forgetSession();
    expect(recallSession()).toBeNull();
  });

  it('lets a stale entry lapse, so a forgotten class cannot trap anyone', () => {
    rememberSession(teacher);
    expect(recallSession(Date.now() + MAX_AGE_MS + 1000)).toBeNull();
  });

  it('treats a corrupt entry as nothing rather than throwing', () => {
    localStorage.setItem('wbac:session', '{not json');
    expect(recallSession()).toBeNull();
    localStorage.setItem('wbac:session', JSON.stringify({ code: 5 }));
    expect(recallSession()).toBeNull();
  });

  it('survives storage that throws', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(recallSession()).toBeNull();
    spy.mockRestore();
  });
});

describe('which session to start in', () => {
  it('does not resume from a plain address, so a fresh visit gets the code screen', () => {
    expect(pickSession('', teacher)).toBeNull();
  });

  it('resumes when the address names the same class, in either case', () => {
    expect(pickSession('?room=ABC234', teacher)).toEqual(teacher);
    expect(pickSession('?room=abc234', teacher)).toEqual(teacher);
  });

  it('goes to a different class when the address names one', () => {
    expect(pickSession('?room=ZZZ999', teacher)).toBeNull();
  });

  it('never resumes over a request to start a new class', () => {
    expect(pickSession('?teach=1', teacher)).toBeNull();
    expect(pickSession('?teach=1&room=ABC234', teacher)).toBeNull();
  });

  it('has nothing to resume when nothing was remembered', () => {
    expect(pickSession('?room=ABC234', null)).toBeNull();
  });
});
