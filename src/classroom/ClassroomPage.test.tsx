/**
 * The classroom page: what each kind of person sees, and the ways a class can end.
 *
 * The connection, the text and the outline are replaced with stand-ins; what is checked is
 * what the page does with them.
 */

import { IntlProvider } from '@edx/frontend-platform/i18n';
import {
  render, screen, waitFor, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ClassroomPage from './ClassroomPage';
import * as api from './api';
import { recallSession, rememberSession } from './session';
import { useRoom, type Room } from './useRoom';
import { useText } from './useText';
import type { RoomState } from './types';

import { installResizeObserver } from './testSupport';

jest.mock('./api');
jest.mock('./useRoom');
jest.mock('./useText');
jest.mock('./useOutline', () => ({ useOutline: () => [] }));
jest.mock('react-helmet', () => ({ Helmet: () => null }));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedUseRoom = useRoom as jest.MockedFunction<typeof useRoom>;
const mockedUseText = useText as jest.MockedFunction<typeof useText>;

const state = (overrides: Partial<RoomState> = {}): RoomState => ({
  code: 'ABC234',
  name: 'Tuesday study group',
  editionId: 'ed',
  segmentationId: 'seg',
  title: 'བྱང་ཆུབ། (The Lamp)',
  currentSegmentId: null,
  participantCount: 3,
  teacherHere: true,
  role: 'student',
  ...overrides,
});

const goto = jest.fn();
const endSession = jest.fn();

const room = (overrides: Partial<Room> = {}): Room => ({
  connected: true,
  state: state(),
  error: null,
  ended: null,
  joinRejected: false,
  goto,
  endSession,
  ...overrides,
});

const open = (search = '?room=ABC234') => {
  window.history.replaceState(null, '', `/classroom${search}`);
  rememberSession({ code: 'ABC234' });
  return render(
    <IntlProvider locale="en"><ClassroomPage /></IntlProvider>,
  );
};

beforeAll(() => { installResizeObserver(); });

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  mockedUseRoom.mockReturnValue(room());
  mockedApi.myClasses.mockResolvedValue([]);
  mockedApi.listMembers.mockResolvedValue([]);
  mockedApi.listNotes.mockResolvedValue([]);
  mockedUseText.mockReturnValue({ lines: [], loading: false, error: null });
});

/** The teacher's tools live behind one "Class" button. */
const openClassMenu = () => userEvent.click(screen.getByRole('button', { name: 'Class' }));
const openManage = async () => {
  await openClassMenu();
  await userEvent.click(await screen.findByRole('button', { name: /manage class/i }));
};

describe('a student', () => {
  it('sees the class name, with the text\'s title beneath it', () => {
    open();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tuesday study group');
    expect(screen.getByText('བྱང་ཆུབ། (The Lamp)')).toBeTruthy();
  });

  it('is told to wait when the teacher is not here yet, and may read ahead meanwhile', () => {
    mockedUseRoom.mockReturnValue(room({ state: state({ teacherHere: false }) }));
    open();
    expect(screen.getByRole('status').textContent).toMatch(/waiting for the teacher/i);
  });

  it('is not told to wait once the teacher is here', () => {
    open();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('is offered none of the teacher\'s controls', () => {
    open();
    expect(screen.queryByRole('button', { name: /manage class/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /end session/i })).toBeNull();
    expect(screen.queryByText(/^code /i)).toBeNull();
    expect(screen.queryByText('Teaching')).toBeNull();
  });

  it('is not shown how many are in the class', () => {
    open();
    expect(screen.queryByText(/online/)).toBeNull();
  });

  it('can turn following off, from the Class menu', async () => {
    open();
    await openClassMenu();
    const follow = await screen.findByRole('menuitemcheckbox', { name: /follow the teacher/i });
    expect(follow.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(follow);
    // The menu stays open so the switch can be seen to change.
    expect((await screen.findByRole('menuitemcheckbox', { name: /follow the teacher/i })).getAttribute('aria-checked')).toBe('false');
  });
});

describe('when the teacher ends the session', () => {
  beforeEach(() => {
    mockedUseRoom.mockReturnValue(room({ state: state({ sessionEnded: true, teacherHere: false }) }));
  });

  it('keeps the student in the class and tells them, instead of sending them away', () => {
    open();
    expect(screen.getByRole('status').textContent).toMatch(/ended today's session/i);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tuesday study group');
    expect(screen.queryByText(/waiting for the teacher to arrive/i)).toBeNull();
  });

  it('still lets them leave the screen from the banner', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: /back to your classes/i }));
    expect(await screen.findByText('Your classes')).toBeTruthy();
  });

  it('keeps their notes in reach', () => {
    open();
    expect(screen.getByRole('button', { name: /my notes/i })).toBeTruthy();
  });

  it('turns the pill to Ended and takes away following and syncing', async () => {
    Element.prototype.scrollIntoView = jest.fn();
    mockedUseText.mockReturnValue({
      lines: [{
        id: 'a', idx: 0, source: 'x', translation: null, kind: 'paragraph', label: 'a',
      }] as never,
      loading: false,
      error: null,
    });
    mockedUseRoom.mockReturnValue(room({
      state: state({ sessionEnded: true, teacherHere: false, currentSegmentId: 'a' }),
    }));
    open();
    const pill = screen.getByRole('button', { name: 'Sync with teacher' }) as HTMLButtonElement;
    expect(pill.disabled).toBe(true);
    expect(pill.textContent).toMatch(/ended/i);
    await openClassMenu();
    expect((await screen.findByRole('menuitemcheckbox', { name: /follow the teacher/i })).getAttribute('aria-disabled')).toBe('true');
  });

  it('shows the teacher the notice, since they are the one who ended it', () => {
    mockedUseRoom.mockReturnValue(room({ ended: 'session', state: state({ role: 'teacher' }) }));
    open();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/session has ended/i);
  });
});

describe('catching up with the teacher', () => {
  beforeEach(() => { Element.prototype.scrollIntoView = jest.fn(); });

  const lines = () => mockedUseText.mockReturnValue({
    lines: ['a', 'b'].map((id, idx) => ({
      id, idx, source: `line ${id}`, translation: null, kind: 'paragraph', label: id,
    })) as never,
    loading: false,
    error: null,
  });

  it('is always offered to a student, and takes them to the line the class is on', async () => {
    lines();
    mockedUseRoom.mockReturnValue(room({ state: state({ currentSegmentId: 'b' }) }));
    open();
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Sync with teacher' }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('is there but unavailable before the teacher has picked a line', () => {
    lines();
    open();
    expect((screen.getByRole('button', { name: 'Sync with teacher' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('leaving', () => {
  it('a student can leave the class for good, after being asked', async () => {
    mockedApi.leaveClass.mockResolvedValue(undefined);
    open();
    await openClassMenu();
    await userEvent.click(await screen.findByRole('button', { name: /^leave class/i }));
    // Asked first: nothing has happened yet.
    expect(mockedApi.leaveClass).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Leave class' }));
    expect(await screen.findByText('Your classes')).toBeTruthy();
    expect(mockedApi.leaveClass).toHaveBeenCalledWith('ABC234');
    expect(window.location.search).toBe('');
    expect(recallSession()).toBeNull();
  });

  it('does not show an old failure when the question is asked again', async () => {
    mockedApi.leaveClass.mockRejectedValueOnce(new Error('nope'));
    open();
    await openClassMenu();
    await userEvent.click(await screen.findByRole('button', { name: /^leave class/i }));
    let dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Leave class' }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await openClassMenu();
    await userEvent.click(await screen.findByRole('button', { name: /^leave class/i }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('can think better of it', async () => {
    open();
    await openClassMenu();
    await userEvent.click(await screen.findByRole('button', { name: /^leave class/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(mockedApi.leaveClass).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('stays in the class and says so if leaving fails', async () => {
    mockedApi.leaveClass.mockRejectedValue(new Error('nope'));
    open();
    await openClassMenu();
    await userEvent.click(await screen.findByRole('button', { name: /^leave class/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Leave class' }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Your classes')).toBeNull();
  });

  it('a teacher has no such button: ending the session is how they leave', () => {
    mockedUseRoom.mockReturnValue(room({ state: state({ role: 'teacher' }) }));
    open();
    expect(screen.queryByRole('button', { name: /^leave class/i })).toBeNull();
  });
});

describe('the teacher', () => {
  beforeEach(() => {
    mockedUseRoom.mockReturnValue(room({ state: state({ role: 'teacher' }) }));
  });

  it('has no sync button: there is nobody to catch up with', () => {
    mockedUseText.mockReturnValue({
      lines: [{
        id: 'a', idx: 0, source: 'x', translation: null, kind: 'paragraph', label: 'a',
      }] as never,
      loading: false,
      error: null,
    });
    open();
    expect(screen.queryByRole('button', { name: 'Sync with teacher' })).toBeNull();
  });

  it('brings a pressed line into focus as well as moving the class there', async () => {
    Element.prototype.scrollIntoView = jest.fn();
    mockedUseText.mockReturnValue({
      lines: ['a', 'b'].map((id, idx) => ({
        id, idx, text: `line ${id}`, kind: 'paragraph', reference: id,
      })) as never,
      loading: false,
      error: null,
    });
    open();
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    await userEvent.click(screen.getByText('line b'));
    expect(goto).toHaveBeenCalledWith('b');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  describe('the floating back and on buttons', () => {
    beforeEach(() => { Element.prototype.scrollIntoView = jest.fn(); });

    const three = () => mockedUseText.mockReturnValue({
      lines: ['a', 'b', 'c'].map((id, idx) => ({
        id, idx, source: `line ${id}`, translation: null, kind: 'paragraph', label: id,
      })) as never,
      loading: false,
      error: null,
    });
    const at = (currentSegmentId: string | null) => mockedUseRoom.mockReturnValue(
      room({ state: state({ role: 'teacher', currentSegmentId }) }),
    );

    it('take the class on and back a line', async () => {
      three();
      at('b');
      open();
      await userEvent.click(screen.getByRole('button', { name: 'Next line' }));
      expect(goto).toHaveBeenLastCalledWith('c');
      await userEvent.click(screen.getByRole('button', { name: 'Previous line' }));
      expect(goto).toHaveBeenLastCalledWith('a');
    });

    it('begin at the first line when the class has not begun', async () => {
      three();
      at(null);
      open();
      expect((screen.getByRole('button', { name: 'Previous line' }) as HTMLButtonElement).disabled).toBe(true);
      await userEvent.click(screen.getByRole('button', { name: 'Next line' }));
      expect(goto).toHaveBeenCalledWith('a');
    });

    it('stop at either end of the text', () => {
      three();
      at('c');
      open();
      expect((screen.getByRole('button', { name: 'Next line' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('are not shown to a student', () => {
      three();
      mockedUseRoom.mockReturnValue(room());
      open();
      expect(screen.queryByRole('button', { name: 'Next line' })).toBeNull();
    });
  });

  it('is told they are teaching it, beside who is here', () => {
    open();
    const pill = screen.getByText('Teaching');
    expect(pill.className).toContain('classroom-page__pill');
    expect(pill.nextElementSibling?.className).toContain('classroom-page__meta');
  });

  it('has one button for the class, not a row of them, and no code always on show', () => {
    open();
    expect(screen.getByRole('button', { name: 'Class' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /manage class/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /end session/i })).toBeNull();
    // The code is one tab away, in Manage class, not stuck to the header.
    expect(screen.queryByText(/^code /i)).toBeNull();
    expect(screen.queryByText('ABC234')).toBeNull();
  });

  it('puts who is here over the controls, in the same column', () => {
    open();
    const side = document.querySelector('.classroom-page__side') as HTMLElement;
    expect(side.children[0].className).toContain('classroom-page__status-row');
    expect(side.children[1].className).toContain('classroom-page__controls');
    expect(side.textContent).toContain('online');
  });

  it('finds Manage class and End session in the Class menu', async () => {
    open();
    await openClassMenu();
    expect(await screen.findByRole('button', { name: /manage class/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /end session/i })).toBeTruthy();
  });

  it('is not told to wait for a teacher, being the teacher', () => {
    mockedUseRoom.mockReturnValue(room({ state: state({ role: 'teacher', teacherHere: false }) }));
    open();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('has no one to follow, so no follow switch', () => {
    open();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('asks before ending the session, and does nothing if the teacher changes their mind', async () => {
    open();
    await openClassMenu();
    await userEvent.click(await screen.findByRole('button', { name: /end session/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /end today's session\?/i })).toBeTruthy();
    expect(endSession).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: /^cancel$/i }));
    expect(endSession).not.toHaveBeenCalled();
  });

  it('ends today\'s session, not the class, once confirmed', async () => {
    open();
    await openClassMenu();
    await userEvent.click(await screen.findByRole('button', { name: /end session/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^end session$/i }));
    expect(endSession).toHaveBeenCalledTimes(1);
    expect(mockedApi.archiveClass).not.toHaveBeenCalled();
  });

  it('opens the tools for managing the class', async () => {
    open();
    await openManage();
    await waitFor(() => expect(mockedApi.listMembers).toHaveBeenCalledWith('ABC234'));
    expect(await screen.findByRole('tab', { name: 'Class code' })).toBeTruthy();
  });

  it('follows a changed code, so a refresh finds the class under its new code', async () => {
    mockedApi.changeCode.mockResolvedValue({ code: 'NEW234' });
    open();
    await openManage();
    await userEvent.click(await screen.findByRole('tab', { name: 'Class code' }));
    await userEvent.click(await screen.findByRole('button', { name: /change the code/i }));
    await userEvent.click(await screen.findByRole('button', { name: /yes, change it/i }));
    await waitFor(() => expect(window.location.search).toBe('?room=NEW234'));
    expect(recallSession()?.code).toBe('NEW234');
  });

  it('leaves for the list, and forgets the class, once it is archived', async () => {
    mockedApi.archiveClass.mockResolvedValue(undefined);
    open();
    await openManage();
    await userEvent.click(await screen.findByRole('tab', { name: 'Archive' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Archive this class' }));
    await userEvent.click(screen.getByRole('button', { name: /yes, archive it/i }));
    await waitFor(() => expect(screen.getByText('Your classes')).toBeTruthy());
    expect(recallSession()).toBeNull();
    expect(window.location.search).toBe('');
  });
});

describe('when a class stops being live', () => {
  it('says the session ended, and keeps the class so a refresh still finds it', async () => {
    mockedUseRoom.mockReturnValue(room({ ended: 'session' }));
    open();
    expect(screen.getByRole('heading').textContent).toMatch(/session has ended/i);
    expect(screen.getByText(/still in your list/i)).toBeTruthy();
    expect(recallSession()?.code).toBe('ABC234');
  });

  it.each([
    ['archived', /has been archived/i],
    ['removed', /no longer in this class/i],
  ] as const)('says the class was %s, and forgets it', async (ended, words) => {
    mockedUseRoom.mockReturnValue(room({ ended }));
    open();
    expect(screen.getByRole('heading').textContent).toMatch(words);
    await waitFor(() => expect(recallSession()).toBeNull());
  });

  it('explains a refused join in the server\'s words, and forgets the class', async () => {
    mockedUseRoom.mockReturnValue(room({
      state: null, joinRejected: true, error: 'You are not in this class. Join it with its code first.',
    }));
    open();
    expect(screen.getByText(/not in this class/i)).toBeTruthy();
    await waitFor(() => expect(recallSession()).toBeNull());
  });

  it('goes back to the list of classes', async () => {
    mockedUseRoom.mockReturnValue(room({ ended: 'session' }));
    open();
    await userEvent.click(screen.getByRole('button', { name: /back to your classes/i }));
    expect(await screen.findByText('Your classes')).toBeTruthy();
    expect(window.location.search).toBe('');
  });
});

describe('getting in', () => {
  it('shows the list of classes, not the last class, on a fresh visit', async () => {
    window.history.replaceState(null, '', '/classroom');
    rememberSession({ code: 'ABC234' });
    render(<IntlProvider locale="en"><ClassroomPage /></IntlProvider>);
    expect(await screen.findByText('Your classes')).toBeTruthy();
    expect(mockedUseRoom).not.toHaveBeenCalled();
  });

  it('goes straight back into the class on a refresh', () => {
    open('?room=ABC234');
    expect(mockedUseRoom).toHaveBeenCalledWith('ABC234');
  });

  it('writes the code into the address and remembers it when a class is chosen', async () => {
    window.history.replaceState(null, '', '/classroom');
    mockedApi.myClasses.mockResolvedValue([{
      code: 'ABC234', name: 'Tuesday study', title: 'A', role: 'student', memberCount: 2, lastSeenAt: null,
    }]);
    render(<IntlProvider locale="en"><ClassroomPage /></IntlProvider>);
    await userEvent.click(await screen.findByText('Tuesday study'));
    expect(window.location.search).toBe('?room=ABC234');
    expect(recallSession()?.code).toBe('ABC234');
    expect(mockedUseRoom).toHaveBeenCalledWith('ABC234');
  });
});
