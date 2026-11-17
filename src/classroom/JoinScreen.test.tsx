/** The code screen: your classes, joining once with a code, and starting a class. */

import { IntlProvider } from '@edx/frontend-platform/i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import JoinScreen from './JoinScreen';
import * as api from './api';
import type { ClassSummary } from './types';

jest.mock('./api');
const mocked = api as jest.Mocked<typeof api>;

const classes: ClassSummary[] = [
  {
    code: 'ABC234', name: 'Tuesday study', title: 'A Text', role: 'student', memberCount: 12, lastSeenAt: null,
  },
  {
    code: 'XYZ789', name: 'Sunday teaching', title: 'Another', role: 'teacher', memberCount: 1, lastSeenAt: null,
  },
];

const show = (props: Partial<React.ComponentProps<typeof JoinScreen>> = {}) => {
  const onEnter = jest.fn();
  render(
    <IntlProvider locale="en">
      <JoinScreen initialCode="" onEnter={onEnter} {...props} />
    </IntlProvider>,
  );
  return onEnter;
};

beforeEach(() => {
  jest.resetAllMocks();
  mocked.myClasses.mockResolvedValue(classes);
});

describe('your classes', () => {
  it('lists the classes this account is in, with a role and a member count', async () => {
    show();
    await screen.findByText('Tuesday study');
    expect(screen.getByText('Sunday teaching')).toBeTruthy();
    expect(screen.getByText('Student')).toBeTruthy();
    expect(screen.getByText("You're the teacher")).toBeTruthy();
    expect(screen.getByText('12 members')).toBeTruthy();
    expect(screen.getByText('1 member')).toBeTruthy();
  });

  it('opens a class with one click and no code', async () => {
    const onEnter = show();
    await userEvent.click(await screen.findByText('Tuesday study'));
    expect(onEnter).toHaveBeenCalledWith('ABC234');
    expect(mocked.joinRoom).not.toHaveBeenCalled();
  });

  it('keeps a class the student left in the list, and rejoins it with one press and no code', async () => {
    mocked.myClasses.mockResolvedValue([{ ...classes[0], left: true }]);
    mocked.joinRoom.mockResolvedValue({} as never);
    const onEnter = show();
    await userEvent.click(await screen.findByText(/you left/i));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith('ABC234'));
    expect(mocked.joinRoom).toHaveBeenCalledWith('ABC234');
  });

  it('says so, kindly, when there are none yet', async () => {
    mocked.myClasses.mockResolvedValue([]);
    show();
    await screen.findByText(/not in any classes yet/i);
  });

  it('still offers the code field when the list cannot be loaded', async () => {
    mocked.myClasses.mockRejectedValue(new Error('Cannot reach the classroom server.'));
    show();
    await screen.findByText('Cannot reach the classroom server.');
    expect(screen.getByLabelText(/code/i)).toBeTruthy();
  });
});

describe('when a class is held', () => {
  const dated = (startsOn: string | null, endsOn: string | null) => mocked.myClasses.mockResolvedValue(
    [{ ...classes[0], startsOn, endsOn }],
  );

  it('shows the days on the class', async () => {
    dated('2099-03-12', '2099-04-30');
    show();
    await screen.findByText(/Starts Mar 12, 2099/);
  });

  it('says a class has ended once its last day has passed', async () => {
    dated('2020-03-12', '2020-04-30');
    show();
    await screen.findByText(/Ended Apr 30, 2020/);
  });

  it('shows a range while it runs, or one open end alone', async () => {
    dated('2020-03-12', '2099-04-30');
    show();
    await screen.findByText(/Mar 12, 2020 – Apr 30, 2099/);
  });

  it('shows nothing when no days were given', async () => {
    dated(null, null);
    show();
    await screen.findByText('Tuesday study');
    expect(document.querySelector('.classroom-classes__dates')).toBeNull();
  });
});

describe('someone who teaches a class', () => {
  it('is told they are the teacher, and that pressing it carries on teaching', async () => {
    show();
    await screen.findByText('Sunday teaching');
    expect(screen.getByRole('heading', { name: 'Classes you teach' })).toBeTruthy();
    expect(screen.getByText('Continue teaching')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start another class' })).toBeTruthy();
  });

  it('has joining with a code as a small option at the bottom, opened when wanted', async () => {
    mocked.joinRoom.mockResolvedValue({} as never);
    const onEnter = show();
    await screen.findByText('Sunday teaching');
    expect(screen.queryByLabelText(/code/i)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Join a class' }));
    await userEvent.type(await screen.findByLabelText(/code/i), 'abc234');
    await userEvent.click(screen.getByRole('button', { name: /^join$/i }));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith('ABC234'));
  });

  it('still sees a failure to rejoin a class they left', async () => {
    mocked.myClasses.mockResolvedValue([{ ...classes[1] }, { ...classes[0], left: true }]);
    mocked.joinRoom.mockRejectedValue(new Error('That class has been archived'));
    show();
    await userEvent.click(await screen.findByText(/you left/i));
    expect(await screen.findByText('That class has been archived')).toBeTruthy();
  });
});

describe('joining with a code', () => {
  // No classes yet: the code form is open from the start, as it is the point of the page.
  beforeEach(() => { mocked.myClasses.mockResolvedValue([]); });

  it('records membership first, then enters', async () => {
    mocked.joinRoom.mockResolvedValue({
      code: 'ABC234', name: null, title: 'A Text', role: 'student',
    });
    const onEnter = show();
    await userEvent.type((await screen.findByLabelText(/code/i)), 'abc234');
    await userEvent.click(screen.getByRole('button', { name: /^join/i }));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith('ABC234'));
    expect(mocked.joinRoom).toHaveBeenCalledWith('ABC234');
  });

  it('does not submit an incomplete code', async () => {
    show();
    await userEvent.type((await screen.findByLabelText(/code/i)), 'ABC');
    expect((screen.getByRole('button', { name: /^join/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the server\'s reason and stays put when the code is refused', async () => {
    mocked.joinRoom.mockRejectedValue(new Error('No such class'));
    const onEnter = show();
    await userEvent.type((await screen.findByLabelText(/code/i)), 'ZZZZZZ');
    await userEvent.click(screen.getByRole('button', { name: /^join/i }));
    await screen.findByText('No such class');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('fills the field from a code in the address', async () => {
    show({ initialCode: 'ABC234' });
    expect(((await screen.findByLabelText(/code/i)) as HTMLInputElement).value).toBe('ABC234');
  });
});

describe('starting a class', () => {
  it('opens on the start screen from the "Start a class" link', () => {
    show({ startMode: true });
    expect(screen.getByLabelText(/class name/i)).toBeTruthy();
    expect(mocked.myClasses).not.toHaveBeenCalled();
  });

  it('shows the code to write on the board, with no recovery code, then opens the class', async () => {
    mocked.searchTexts.mockResolvedValue([{ id: 't1', title: 'A Text', language: 'bo' }]);
    mocked.createRoom.mockResolvedValue({
      code: 'NEW234', name: 'Mine', title: 'A Text', editionId: 'e', segmentationId: 's', segmentCount: 3,
    });
    const onEnter = show({ startMode: true });

    await userEvent.type(screen.getByLabelText(/find a text|search/i), 'text');
    await userEvent.click(screen.getAllByRole('button', { name: /search|find/i })[0]);
    await userEvent.click(await screen.findByRole('button', { name: 'A Text' }));
    await userEvent.type(screen.getByLabelText(/class name/i), 'Mine');
    await userEvent.type(screen.getByLabelText(/password/i), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /^start/i }));

    expect(mocked.createRoom).toHaveBeenCalledWith('pw', 't1', 'Mine', { startsOn: '', endsOn: '' });
    await screen.findByText('NEW234');
    expect(screen.queryByText(/recovery/i)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(onEnter).toHaveBeenCalledWith('NEW234');
  });

  it('shows why a class could not be started', async () => {
    mocked.searchTexts.mockResolvedValue([{ id: 't1', title: 'A Text', language: 'bo' }]);
    mocked.createRoom.mockRejectedValue(new Error('Wrong host password'));
    show({ startMode: true });
    await userEvent.type(screen.getByLabelText(/find a text|search/i), 'text');
    await userEvent.click(screen.getAllByRole('button', { name: /search|find/i })[0]);
    await userEvent.click(await screen.findByRole('button', { name: 'A Text' }));
    await userEvent.type(screen.getByLabelText(/password/i), 'nope');
    await userEvent.click(screen.getByRole('button', { name: /^start/i }));
    await screen.findByText('Wrong host password');
  });
});
