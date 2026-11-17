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
    expect(screen.getByText('Teaching')).toBeTruthy();
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

describe('joining with a code', () => {
  it('records membership first, then enters', async () => {
    mocked.joinRoom.mockResolvedValue({
      code: 'ABC234', name: null, title: 'A Text', role: 'student',
    });
    const onEnter = show();
    await userEvent.type(screen.getByLabelText(/code/i), 'abc234');
    await userEvent.click(screen.getByRole('button', { name: /^join/i }));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith('ABC234'));
    expect(mocked.joinRoom).toHaveBeenCalledWith('ABC234');
  });

  it('does not submit an incomplete code', async () => {
    show();
    await userEvent.type(screen.getByLabelText(/code/i), 'ABC');
    expect((screen.getByRole('button', { name: /^join/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the server\'s reason and stays put when the code is refused', async () => {
    mocked.joinRoom.mockRejectedValue(new Error('No such class'));
    const onEnter = show();
    await userEvent.type(screen.getByLabelText(/code/i), 'ZZZZZZ');
    await userEvent.click(screen.getByRole('button', { name: /^join/i }));
    await screen.findByText('No such class');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('fills the field from a code in the address', () => {
    show({ initialCode: 'ABC234' });
    expect((screen.getByLabelText(/code/i) as HTMLInputElement).value).toBe('ABC234');
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

    expect(mocked.createRoom).toHaveBeenCalledWith('pw', 't1', 'Mine');
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
