import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useIntl } from '@edx/frontend-platform/i18n';
import {
  Button, Form, ModalDialog, Tab, Tabs,
} from '@openedx/paragon';

import {
  archiveClass, changeCode, getClassDates, listMembers, removeMember, setClassDates,
} from './api';
import { datesInOrder } from './classDates';
import messages from './messages';
import type { Member } from './types';

interface Props {
  code: string;
  isOpen: boolean;
  onClose: () => void;
  /** The class has a new code. The page follows it, so a refresh finds the class. */
  onCodeChanged: (code: string) => void;
  /** The class was archived. The page returns to the list of classes. */
  onArchived: () => void;
}

/** Initials for the circle beside a name: up to two letters, whatever the script. */
const initialsOf = (name: string) => Array.from(
  name.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0] ?? '')
    .join(''),
).slice(0, 2).join('').toUpperCase();

/**
 * The teacher's tools for a class that lasts months, in three tabs so each can be as
 * roomy as it needs: **Members** (a searchable list, built for fifty or five hundred),
 * **Class code**, and **Archive**.
 *
 * Every action that cannot be taken back, or that affects other people, asks first, inline
 * and in the place it was pressed, so a misplaced tap never removes someone or changes the
 * code under a room full of students.
 *
 * Everything here is checked again on the server against the Academy login, so a student
 * who somehow opened this could do nothing with it.
 */
const ManageClass = ({
  code, isOpen, onClose, onCodeChanged, onArchived,
}: Props) => {
  const intl = useIntl();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** The one thing awaiting a yes: removing a member, changing the code, or archiving. */
  const [confirming, setConfirming] = useState<
  { kind: 'remove'; id: string } | { kind: 'code' } | { kind: 'archive' } | null
  >(null);
  const [copied, setCopied] = useState(false);
  const [changedTo, setChangedTo] = useState<string | null>(null);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [datesSaved, setDatesSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      setMembers(await listMembers(code));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the members.');
      setMembers([]);
    }
  }, [code]);

  // Read through a ref: the dialog starts afresh when it *opens*, not whenever the code changes.
  // Changing the code changes the `code` prop (and so `load`) while the dialog is still open, and
  // resetting then would wipe the very notice that shows the new code.
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setConfirming(null);
      setQuery('');
      setChangedTo(null);
      setDatesSaved(false);
      loadRef.current();
      (async () => {
        try {
          const dates = await getClassDates(code);
          setStartsOn(dates?.startsOn ?? '');
          setEndsOn(dates?.endsOn ?? '');
        } catch {
          // The dates are an extra: the other tabs work without them.
        }
      })();
    }
  // The code is read when the dialog opens; changing it later does not reload anything.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /** Run one of the tools, showing whatever goes wrong rather than failing silently. */
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (member: Member) => member.name || member.username;

  const students = useMemo(
    () => (members ?? []).filter((member) => member.role !== 'teacher'),
    [members],
  );
  const teachers = useMemo(
    () => (members ?? []).filter((member) => member.role === 'teacher'),
    [members],
  );

  // Alphabetical, so a name can be found by eye as well as by search; the server's own
  // order (by when they joined) is not one anybody looks things up in.
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? students.filter((m) => `${m.name} ${m.username}`.toLowerCase().includes(needle))
      : students;
    return [...matches].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  }, [students, query]);

  const joined = (member: Member) => (member.joinedAt
    ? intl.formatMessage(messages.joinedOn, {
      date: intl.formatDate(member.joinedAt, { day: 'numeric', month: 'short', year: 'numeric' }),
    })
    : '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (an insecure page, an old browser): the code is on screen to read.
    }
  };

  const remove = (member: Member) => run(async () => {
    await removeMember(code, member.id);
    setConfirming(null);
    await load();
  });

  const newCode = () => run(async () => {
    const result = await changeCode(code);
    setConfirming(null);
    setChangedTo(result.code);
    onCodeChanged(result.code);
  });

  const saveDates = () => run(async () => {
    await setClassDates(code, { startsOn, endsOn });
    setDatesSaved(true);
  });

  const archive = () => run(async () => {
    await archiveClass(code);
    onArchived();
  });

  return (
    <ModalDialog
      title={intl.formatMessage(messages.manageHeading)}
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      hasCloseButton
      isFullscreenOnMobile
      isOverflowVisible={false}
      className="classroom-manage"
    >
      <ModalDialog.Header>
        <ModalDialog.Title>{intl.formatMessage(messages.manageHeading)}</ModalDialog.Title>
      </ModalDialog.Header>

      <ModalDialog.Body>
        {error && <p className="classroom-page__error" role="alert">{error}</p>}

        <Tabs variant="tabs" id="classroom-manage-tabs" defaultActiveKey="members" onSelect={() => setConfirming(null)}>
          {/* -- Members -------------------------------------------------------- */}
          <Tab eventKey="members" title={`${intl.formatMessage(messages.tabMembers)} (${students.length})`}>
            <div className="classroom-manage__panel">
              <Form.Control
                type="search"
                className="classroom-manage__search"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                placeholder={intl.formatMessage(messages.searchMembers)}
                aria-label={intl.formatMessage(messages.searchMembers)}
                autoComplete="off"
              />

              {members === null && (
                <p className="classroom-page__sub">{intl.formatMessage(messages.loadingMembers)}</p>
              )}

              {/* The teacher, once, above the list: never lost among fifty names, and
                  with nothing to remove. */}
              {teachers.map((member) => (
                <div key={member.id} className="classroom-manage__member classroom-manage__member--teacher">
                  <span className="classroom-manage__avatar" aria-hidden="true">{initialsOf(nameOf(member))}</span>
                  <span className="classroom-manage__who">
                    <span className="classroom-manage__name">{nameOf(member)}</span>
                    <span className="classroom-manage__meta">{member.name ? `@${member.username}` : ''}</span>
                  </span>
                  <span className="classroom-classes__role classroom-classes__role--teacher">
                    {intl.formatMessage(messages.roleTeacher)}
                  </span>
                </div>
              ))}

              {members !== null && students.length === 0 && (
                <p className="classroom-manage__empty">{intl.formatMessage(messages.onlyYou)}</p>
              )}
              {students.length > 0 && shown.length === 0 && (
                <p className="classroom-manage__empty">
                  {intl.formatMessage(messages.noMatches, { query: query.trim() })}
                </p>
              )}

              {/* Only this part scrolls, so the search and the tabs stay in reach however
                  long the class is. */}
              <ul className="classroom-manage__members">
                {shown.map((member) => {
                  const asking = confirming?.kind === 'remove' && confirming.id === member.id;
                  return (
                    <li key={member.id} className="classroom-manage__member">
                      <span className="classroom-manage__avatar" aria-hidden="true">{initialsOf(nameOf(member))}</span>
                      <span className="classroom-manage__who">
                        <span className="classroom-manage__name">{nameOf(member)}</span>
                        <span className="classroom-manage__meta">
                          {[member.name ? `@${member.username}` : '', joined(member)].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {asking ? (
                        <span className="classroom-manage__ask">
                          <span className="classroom-manage__question">
                            {intl.formatMessage(messages.removeQuestion, { name: nameOf(member) })}
                          </span>
                          <Button variant="danger" size="sm" disabled={busy} onClick={() => remove(member)}>
                            {intl.formatMessage(messages.removeYes)}
                          </Button>
                          <Button variant="tertiary" size="sm" disabled={busy} onClick={() => setConfirming(null)}>
                            {intl.formatMessage(messages.cancel)}
                          </Button>
                        </span>
                      ) : (
                        <Button
                          variant="tertiary"
                          size="sm"
                          className="classroom-manage__remove"
                          disabled={busy}
                          onClick={() => setConfirming({ kind: 'remove', id: member.id })}
                          aria-label={intl.formatMessage(messages.removeMemberLabel, { name: nameOf(member) })}
                        >
                          {intl.formatMessage(messages.removeMember)}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="classroom-manage__hint">{intl.formatMessage(messages.removeHelp)}</p>
            </div>
          </Tab>

          {/* -- Class code ------------------------------------------------------ */}
          <Tab eventKey="code" title={intl.formatMessage(messages.tabCode)}>
            <div className="classroom-manage__panel">
              {changedTo && (
                <p className="classroom-manage__notice" role="status">
                  {intl.formatMessage(messages.codeChangedNotice, { code: changedTo })}
                </p>
              )}
              <div className="classroom-manage__codecard">
                <p className="classroom-manage__code" aria-label={code}>{code}</p>
                <Button variant="tertiary" size="sm" className="classroom-manage__button" onClick={copy}>
                  {intl.formatMessage(copied ? messages.codeCopied : messages.copyCode)}
                </Button>
              </div>
              <p className="classroom-manage__hint">{intl.formatMessage(messages.changeCodeHelp)}</p>
              {confirming?.kind === 'code' ? (
                <div className="classroom-manage__confirm">
                  <span className="classroom-manage__question">
                    {intl.formatMessage(messages.changeCodeQuestion)}
                  </span>
                  <Button variant="primary" size="sm" disabled={busy} onClick={newCode}>
                    {intl.formatMessage(messages.changeCodeYes)}
                  </Button>
                  <Button variant="tertiary" size="sm" disabled={busy} onClick={() => setConfirming(null)}>
                    {intl.formatMessage(messages.cancel)}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="tertiary"
                  size="sm"
                  className="classroom-manage__button"
                  disabled={busy}
                  onClick={() => setConfirming({ kind: 'code' })}
                >
                  {intl.formatMessage(messages.changeCode)}
                </Button>
              )}
            </div>
          </Tab>

          {/* -- Dates ----------------------------------------------------------- */}
          <Tab eventKey="dates" title={intl.formatMessage(messages.tabDates)}>
            <div className="classroom-manage__panel">
              <h3 className="classroom-manage__heading">{intl.formatMessage(messages.datesHeading)}</h3>
              <p className="classroom-manage__hint">{intl.formatMessage(messages.datesHelp)}</p>
              <div className="classroom-page__dates">
                <Form.Group>
                  <Form.Label>{intl.formatMessage(messages.startsLabel)}</Form.Label>
                  <Form.Control
                    type="date"
                    value={startsOn}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setStartsOn(e.target.value);
                      setDatesSaved(false);
                    }}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>{intl.formatMessage(messages.endsLabel)}</Form.Label>
                  <Form.Control
                    type="date"
                    value={endsOn}
                    min={startsOn || undefined}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setEndsOn(e.target.value);
                      setDatesSaved(false);
                    }}
                  />
                </Form.Group>
              </div>
              {!datesInOrder(startsOn, endsOn) && (
                <p className="classroom-page__error" role="alert">{intl.formatMessage(messages.datesOutOfOrder)}</p>
              )}
              <Button
                variant="primary"
                size="sm"
                disabled={busy || !datesInOrder(startsOn, endsOn)}
                onClick={saveDates}
              >
                {intl.formatMessage(messages.saveDates)}
              </Button>
              {datesSaved && <p className="classroom-manage__hint" role="status">{intl.formatMessage(messages.datesSaved)}</p>}
            </div>
          </Tab>

          {/* -- Archive --------------------------------------------------------- */}
          <Tab eventKey="archive" title={intl.formatMessage(messages.tabArchive)}>
            <div className="classroom-manage__panel">
              <div className="classroom-manage__danger">
                <h3 className="classroom-manage__heading">{intl.formatMessage(messages.archiveClass)}</h3>
                <p className="classroom-manage__hint">{intl.formatMessage(messages.archiveHelp)}</p>
                {confirming?.kind === 'archive' ? (
                  <div className="classroom-manage__confirm">
                    <span className="classroom-manage__question">{intl.formatMessage(messages.archiveWarning)}</span>
                    <Button variant="danger" size="sm" disabled={busy} onClick={archive}>
                      {intl.formatMessage(messages.archiveConfirm)}
                    </Button>
                    <Button variant="tertiary" size="sm" className="classroom-manage__button" disabled={busy} onClick={() => setConfirming(null)}>
                      {intl.formatMessage(messages.cancel)}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="tertiary"
                    size="sm"
                    className="classroom-manage__button classroom-manage__button--danger"
                    disabled={busy}
                    onClick={() => setConfirming({ kind: 'archive' })}
                  >
                    {intl.formatMessage(messages.archiveClass)}
                  </Button>
                )}
              </div>
            </div>
          </Tab>
        </Tabs>
      </ModalDialog.Body>
    </ModalDialog>
  );
};

export default ManageClass;
