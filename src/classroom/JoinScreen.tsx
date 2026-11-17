import { useEffect, useState } from 'react';
import { useIntl } from '@edx/frontend-platform/i18n';
import { Button, Form, Spinner } from '@openedx/paragon';

import messages from './messages';
import {
  createRoom, joinRoom, myClasses, searchTexts,
} from './api';
import type { ClassSummary, CreatedRoom, TextResult } from './types';

type Mode = 'home' | 'start' | 'created';

interface Props {
  /** A code from the address (`?room=CODE`), to fill the field. */
  initialCode: string;
  /** Open on the teacher's start screen, for the "Start a class" link on the schools pages. */
  startMode?: boolean;
  onEnter: (code: string) => void;
}

const ROOM_CODE_LENGTH = 6;

/**
 * Everything before a class: your classes, joining one with a code, and starting one.
 *
 * Three screens rather than three routes. A class code is not a URL — it is read off a
 * whiteboard — and the password that lets a teacher start a class must never reach the
 * address bar, where it would land in history.
 *
 * **The code is entered once.** Joining records the account as a member, so from then on
 * the class is in the list at the top and one click opens it, from any device.
 */
const JoinScreen = ({ initialCode, startMode = false, onEnter }: Props) => {
  const intl = useIntl();
  const [mode, setMode] = useState<Mode>(startMode ? 'start' : 'home');
  const [code, setCode] = useState(initialCode);

  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [classesError, setClassesError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TextResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [textId, setTextId] = useState('');
  const [className, setClassName] = useState('');
  const [hostPassword, setHostPassword] = useState('');

  const [created, setCreated] = useState<CreatedRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'home') { return undefined; }
    let cancelled = false;
    myClasses()
      .then((loaded) => { if (!cancelled) { setClasses(loaded); } })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setClassesError(cause instanceof Error ? cause.message : 'Could not load your classes.');
          setClasses([]);
        }
      });
    return () => { cancelled = true; };
  }, [mode]);

  const go = (next: Mode) => { setMode(next); setError(null); };

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length !== ROOM_CODE_LENGTH) { return; }
    setBusy(true);
    setError(null);
    try {
      // The one step that needs the code: it makes this account a member. After it the
      // class is in the list and the code is not needed again.
      await joinRoom(clean);
      onEnter(clean);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not join the class.');
    } finally {
      setBusy(false);
    }
  };

  // A class the student left stays in their list. Pressing it rejoins first (no code: they are
  // already a member of record, and the server knows the account), then goes in.
  const enterFromList = async (entry: ClassSummary) => {
    if (!entry.left) { onEnter(entry.code); return; }
    setError(null);
    try {
      await joinRoom(entry.code);
      onEnter(entry.code);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not rejoin the class.');
    }
  };

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearching(true);
    setError(null);
    try {
      // Live against the library. There is no local catalogue to go stale, and
      // nothing is stored until a class is actually created.
      setResults(await searchTexts(query.trim()));
      // Clear the choice with the results. Keeping it leaves Start enabled while
      // nothing on screen is highlighted, and the class is created for a text the
      // teacher can no longer see.
      setTextId('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reach the library.');
    } finally {
      setSearching(false);
    }
  };

  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setCreated(await createRoom(hostPassword, textId, className));
      setMode('created');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the class.');
    } finally {
      setBusy(false);
    }
  };

  const problem = error && <p className="classroom-page__error">{error}</p>;

  // -- the class is ready -------------------------------------------------
  if (mode === 'created' && created) {
    return (
      <div className="classroom-page classroom-page__entry">
        <h1>{intl.formatMessage(messages.readyHeading)}</h1>
        <p className="classroom-page__sub">{intl.formatMessage(messages.readySub)}</p>
        <p className="classroom-page__big-code">{created.code}</p>
        <p className="classroom-page__sub">{intl.formatMessage(messages.readyKeep)}</p>

        <Button variant="primary" onClick={() => onEnter(created.code)}>
          {intl.formatMessage(messages.openText)}
        </Button>
      </div>
    );
  }

  // -- starting a class ---------------------------------------------------
  if (mode === 'start') {
    return (
      <div className="classroom-page classroom-page__entry">
        <Button variant="link" className="classroom-page__back" onClick={() => go('home')}>
          {`← ${intl.formatMessage(messages.back)}`}
        </Button>
        <h1>{intl.formatMessage(messages.startHeading)}</h1>
        <p className="classroom-page__sub">{intl.formatMessage(messages.startSub)}</p>

        <Form onSubmit={search}>
          <Form.Group>
            <Form.Label>{intl.formatMessage(messages.searchLabel)}</Form.Label>
            <div className="classroom-page__search">
              <Form.Control
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                autoComplete="off"
              />
              <Button type="submit" variant="outline-primary" disabled={searching}>
                {searching
                  ? <Spinner animation="border" size="sm" screenReaderText="loading" />
                  : intl.formatMessage(messages.searchLabel)}
              </Button>
            </div>
            <Form.Text>{intl.formatMessage(messages.searchHelp)}</Form.Text>
          </Form.Group>
        </Form>

        {results.length > 0 && (
          <ul className="classroom-page__results">
            {results.map((text) => (
              <li key={text.id}>
                <Button
                  variant={textId === text.id ? 'primary' : 'outline-primary'}
                  onClick={() => setTextId(text.id)}
                  className="classroom-page__result"
                  lang={text.language || undefined}
                >
                  {text.title}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {!searching && query && results.length === 0 && (
          <p className="classroom-page__sub">{intl.formatMessage(messages.noTexts)}</p>
        )}

        <Form onSubmit={start}>
          <Form.Group>
            <Form.Label>{intl.formatMessage(messages.classNameLabel)}</Form.Label>
            <Form.Control
              value={className}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClassName(e.target.value)}
              autoComplete="off"
              maxLength={255}
            />
            <Form.Text>{intl.formatMessage(messages.classNameHelp)}</Form.Text>
          </Form.Group>
          <Form.Group>
            <Form.Label>{intl.formatMessage(messages.hostPasswordLabel)}</Form.Label>
            <Form.Control
              type="password"
              value={hostPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHostPassword(
                e.target.value,
              )}
              autoComplete="current-password"
            />
          </Form.Group>
          <Button type="submit" variant="primary" disabled={busy || !textId || !hostPassword}>
            {intl.formatMessage(busy ? messages.starting : messages.start)}
          </Button>
        </Form>
        {problem}
      </div>
    );
  }

  // -- your classes, and joining a new one ----------------------------------
  return (
    <div className="classroom-page classroom-page__entry classroom-page__join">
      <h1>{intl.formatMessage(messages.yourClasses)}</h1>

      {classes === null && (
        <p className="classroom-page__sub">{intl.formatMessage(messages.loadingClasses)}</p>
      )}
      {classesError && <p className="classroom-page__error">{classesError}</p>}
      {classes !== null && classes.length === 0 && !classesError && (
        <p className="classroom-page__sub">{intl.formatMessage(messages.noClasses)}</p>
      )}
      {classes !== null && classes.length > 0 && (
        <ul className="classroom-classes">
          {classes.map((entry) => (
            <li key={entry.code}>
              <button
                type="button"
                className="classroom-classes__item"
                onClick={() => enterFromList(entry)}
              >
                <span className="classroom-classes__name" lang="bo">{entry.name}</span>
                <span className="classroom-classes__meta">
                  <span
                    className={`classroom-classes__role classroom-classes__role--${entry.role}`}
                  >
                    {intl.formatMessage(
                      entry.role === 'teacher' ? messages.roleTeacher : messages.roleStudent,
                    )}
                  </span>
                  {entry.left ? (
                    <span className="classroom-classes__left">{intl.formatMessage(messages.leftRejoin)}</span>
                  ) : (
                    <span>{intl.formatMessage(messages.memberCount, { count: entry.memberCount })}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Form onSubmit={join} className="classroom-classes__join">
        <h2>{intl.formatMessage(messages.heading)}</h2>
        <Form.Group>
          <Form.Label>{intl.formatMessage(messages.codeLabel)}</Form.Label>
          <Form.Control
            value={code}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCode(
              e.target.value.toUpperCase(),
            )}
            maxLength={ROOM_CODE_LENGTH}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <Form.Text>{intl.formatMessage(messages.joinOnce)}</Form.Text>
        </Form.Group>
        <Button
          type="submit"
          variant="primary"
          disabled={busy || code.trim().length !== ROOM_CODE_LENGTH}
        >
          {intl.formatMessage(busy ? messages.joining : messages.join)}
        </Button>
        {problem}
      </Form>

      <p className="classroom-page__switch">
        {`${intl.formatMessage(messages.startFromList)} `}
        <Button variant="link" onClick={() => go('start')}>
          {intl.formatMessage(messages.startLink)}
        </Button>
      </p>
    </div>
  );
};

export default JoinScreen;
