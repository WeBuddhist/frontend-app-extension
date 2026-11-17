/** The teacher's tools: members (built for a long class), the code, and archiving. */

import { IntlProvider } from '@edx/frontend-platform/i18n';
import {
  render, screen, waitFor, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ManageClass from './ManageClass';
import * as api from './api';
import type { Member } from './types';

import { installResizeObserver } from './testSupport';

jest.mock('./api');
const mocked = api as jest.Mocked<typeof api>;

const member = (id: string, username: string, name = '', role: Member['role'] = 'student'): Member => ({
  id, username, name, role, joinedAt: '2026-03-12T09:00:00', lastSeenAt: null,
});

const members: Member[] = [
  member('t1', 'dorje', 'Dorje', 'teacher'),
  member('s2', 'tsering', ''),
  member('s1', 'pema', 'Pema Lhamo'),
  member('s3', 'karma', 'Karma'),
];

const show = () => {
  const handlers = { onClose: jest.fn(), onCodeChanged: jest.fn(), onArchived: jest.fn() };
  render(
    <IntlProvider locale="en">
      <ManageClass code="ABC234" isOpen {...handlers} />
    </IntlProvider>,
  );
  return handlers;
};

const names = () => Array.from(document.querySelectorAll('.classroom-manage__members .classroom-manage__name'))
  .map((n) => n.textContent);

beforeAll(() => { installResizeObserver(); });

beforeEach(() => {
  jest.resetAllMocks();
  mocked.listMembers.mockResolvedValue(members);
});

describe('Members', () => {
  it('counts the students in the tab, and lists them alphabetically', async () => {
    show();
    await screen.findByText('Pema Lhamo');
    expect(screen.getByRole('tab', { name: 'Members (3)' })).toBeTruthy();
    expect(names()).toEqual(['Karma', 'Pema Lhamo', 'tsering']);
  });

  it('shows the teacher once, above the list, with nothing to remove', async () => {
    show();
    await screen.findByText('Pema Lhamo');
    const teacher = document.querySelector('.classroom-manage__member--teacher') as HTMLElement;
    expect(within(teacher).getByText('Dorje')).toBeTruthy();
    expect(within(teacher).getByText('Teaching')).toBeTruthy();
    expect(within(teacher).queryByRole('button')).toBeNull();
    expect(names()).not.toContain('Dorje');
  });

  it('shows the username under a name, and when they joined, and falls back to the username', async () => {
    show();
    await screen.findByText('Pema Lhamo');
    // The date is the viewer's own locale's, so the test does not insist on one spelling.
    expect(screen.getByText(/@pema · Joined .*Mar.*2026/)).toBeTruthy();
    expect(names()).toContain('tsering');
  });

  it('finds a member by name or by username, ignoring case', async () => {
    show();
    await screen.findByText('Pema Lhamo');
    await userEvent.type(screen.getByRole('searchbox'), 'LHAM');
    expect(names()).toEqual(['Pema Lhamo']);
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'tser');
    expect(names()).toEqual(['tsering']);
  });

  it('says so when a search finds no one', async () => {
    show();
    await screen.findByText('Pema Lhamo');
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No one matches "zzz".')).toBeTruthy();
  });

  it('says so, with what to do, when no one has joined', async () => {
    mocked.listMembers.mockResolvedValue([members[0]]);
    show();
    expect(await screen.findByText(/no one has joined yet/i)).toBeTruthy();
  });

  it('stays usable with a long class: every student listed, and a search narrows it at once', async () => {
    const many = [members[0], ...Array.from({ length: 120 }, (_, i) => member(`s${i}`, `student${i}`, `Student ${String(i).padStart(3, '0')}`))];
    mocked.listMembers.mockResolvedValue(many);
    show();
    await screen.findByText('Student 000');
    expect(screen.getByRole('tab', { name: 'Members (120)' })).toBeTruthy();
    expect(names()).toHaveLength(120);
    await userEvent.type(screen.getByRole('searchbox'), '117');
    expect(names()).toEqual(['Student 117']);
  });

  it('asks before removing, right where it was pressed, and removes no one yet', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Pema Lhamo from the class' }));
    expect(screen.getByText('Remove Pema Lhamo?')).toBeTruthy();
    expect(mocked.removeMember).not.toHaveBeenCalled();
  });

  it('removes the member that was confirmed, then refreshes the list', async () => {
    mocked.removeMember.mockResolvedValue(undefined);
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Pema Lhamo from the class' }));
    await userEvent.click(screen.getByRole('button', { name: /yes, remove/i }));
    expect(mocked.removeMember).toHaveBeenCalledWith('ABC234', 's1');
    await waitFor(() => expect(mocked.listMembers).toHaveBeenCalledTimes(2));
  });

  it('lets the teacher change their mind', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Pema Lhamo from the class' }));
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByText('Remove Pema Lhamo?')).toBeNull();
    expect(mocked.removeMember).not.toHaveBeenCalled();
  });

  it('asks about one member at a time', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Pema Lhamo from the class' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove Karma from the class' }));
    expect(screen.queryByText('Remove Pema Lhamo?')).toBeNull();
    expect(screen.getByText('Remove Karma?')).toBeTruthy();
  });

  it('shows what went wrong rather than failing silently', async () => {
    mocked.removeMember.mockRejectedValue(new Error('No such member'));
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Pema Lhamo from the class' }));
    await userEvent.click(screen.getByRole('button', { name: /yes, remove/i }));
    expect((await screen.findByRole('alert')).textContent).toBe('No such member');
  });
});

describe('Class code', () => {
  const openTab = async () => {
    const handlers = show();
    await screen.findByText('Pema Lhamo');
    await userEvent.click(screen.getByRole('tab', { name: 'Class code' }));
    return handlers;
  };

  it('shows the code large, for the board', async () => {
    await openTab();
    expect(screen.getByLabelText('ABC234').textContent).toBe('ABC234');
  });

  it('copies the code', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await openTab();
    await userEvent.click(screen.getByRole('button', { name: /copy code/i }));
    expect(writeText).toHaveBeenCalledWith('ABC234');
    expect(await screen.findByRole('button', { name: /copied/i })).toBeTruthy();
  });

  it('asks before changing the code, and changes nothing yet', async () => {
    await openTab();
    await userEvent.click(screen.getByRole('button', { name: /change the code/i }));
    expect(screen.getByText('Change the code?')).toBeTruthy();
    expect(mocked.changeCode).not.toHaveBeenCalled();
  });

  it('changes it once confirmed, tells the page, and says what to write on the board', async () => {
    mocked.changeCode.mockResolvedValue({ code: 'NEW234' });
    const { onCodeChanged } = await openTab();
    await userEvent.click(screen.getByRole('button', { name: /change the code/i }));
    await userEvent.click(screen.getByRole('button', { name: /yes, change it/i }));
    await waitFor(() => expect(onCodeChanged).toHaveBeenCalledWith('NEW234'));
    expect((await screen.findByRole('status')).textContent).toMatch(/NEW234/);
  });

  it('lets the teacher back out', async () => {
    await openTab();
    await userEvent.click(screen.getByRole('button', { name: /change the code/i }));
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByText('Change the code?')).toBeNull();
  });
});

describe('Archive', () => {
  const openTab = async () => {
    const handlers = show();
    await screen.findByText('Pema Lhamo');
    await userEvent.click(screen.getByRole('tab', { name: 'Archive' }));
    return handlers;
  };

  it('asks before archiving, with a warning, and archives only on the second press', async () => {
    mocked.archiveClass.mockResolvedValue(undefined);
    const { onArchived } = await openTab();

    await userEvent.click(screen.getByRole('button', { name: 'Archive this class' }));
    expect(screen.getByText(/cannot be undone/i, { selector: '.classroom-manage__question' })).toBeTruthy();
    expect(mocked.archiveClass).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /yes, archive it/i }));
    await waitFor(() => expect(onArchived).toHaveBeenCalled());
    expect(mocked.archiveClass).toHaveBeenCalledWith('ABC234');
  });

  it('lets the teacher back out of archiving', async () => {
    await openTab();
    await userEvent.click(screen.getByRole('button', { name: 'Archive this class' }));
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByRole('button', { name: /yes, archive it/i })).toBeNull();
    expect(mocked.archiveClass).not.toHaveBeenCalled();
  });

  it('forgets a half-made choice when the teacher moves to another tab', async () => {
    await openTab();
    await userEvent.click(screen.getByRole('button', { name: 'Archive this class' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Members (3)' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Archive' }));
    expect(screen.queryByRole('button', { name: /yes, archive it/i })).toBeNull();
  });
});

describe('changing the code', () => {
  it('keeps showing the new code after the page follows it', async () => {
    mocked.changeCode.mockResolvedValue({ code: 'NEW234' });
    const handlers = { onClose: jest.fn(), onCodeChanged: jest.fn(), onArchived: jest.fn() };
    const view = (code: string) => (
      <IntlProvider locale="en">
        <ManageClass code={code} isOpen {...handlers} />
      </IntlProvider>
    );
    const { rerender } = render(view('ABC234'));
    await screen.findByText('Pema Lhamo');
    await userEvent.click(screen.getByRole('tab', { name: 'Class code' }));
    await userEvent.click(await screen.findByRole('button', { name: /change the code/i }));
    await userEvent.click(await screen.findByRole('button', { name: /yes, change it/i }));
    await waitFor(() => expect(handlers.onCodeChanged).toHaveBeenCalledWith('NEW234'));
    // The page has followed the code, as it does in the app.
    rerender(view('NEW234'));
    expect((await screen.findByRole('status')).textContent).toMatch(/NEW234/);
  });
});
