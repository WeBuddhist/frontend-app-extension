import { useState } from 'react';
import { useIntl } from '@edx/frontend-platform/i18n';
import { Button, Form, Spinner } from '@openedx/paragon';

import messages from './messages';
import {
  createRoom, rememberHostToken, searchTexts, verifyHost,
} from './api';
import type { CreatedRoom, TextResult } from './types';

type Mode = 'join' | 'start' | 'created' | 'resume';

interface Props {
  initialCode: string;
  onEnter: (code: string, displayName: string) => void;
}

const ROOM_CODE_LENGTH = 6;

/**
 * Everything before the classroom: joining one, starting one, and getting back
 * into one.
 *
 * Four screens rather than four routes. A room code is not a URL — it is read off a
 * whiteboard — and the recovery code must never reach the address bar, where it would
 * land in history and in anything the teacher shares.
 */
const JoinScreen = ({ initialCode, onEnter }: Props) => {
  const intl = useIntl();
  const [mode, setMode] = useState<Mode>('join');
  const [code, setCode] = useState(initialCode);
  const [displayName, setDisplayName] = useState('');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TextResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [textId, setTextId] = useState('');
  const [hostPassword, setHostPassword] = useState('');

  const [resumeCode, setResumeCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');

  const [created, setCreated] = useState<CreatedRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = (next: Mode) => { setMode(next); setError(null); };

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearching(true);
    setError(null);
    try {
      // Live against the library. There is no local catalogue to go stale, and
      // nothing is stored until a room is actually created.
      setResults(await searchTexts(query.trim()));
      // Clear the choice with the results. Keeping it leaves Start enabled while
      // nothing on screen is highlighted, and the room is created for a text the
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
      const room = await createRoom(hostPassword, textId);
      rememberHostToken(room.code, room.hostToken);
      setCreated(room);
      setMode('created');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the class.');
    } finally {
      setBusy(false);
    }
  };

  const resume = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const roomCode = resumeCode.trim().toUpperCase();
    try {
      // Checked against the server before it is trusted, so a wrong code fails here
      // rather than as silently refused taps once the class has started.
      await verifyHost(roomCode, recoveryCode.trim());
      rememberHostToken(roomCode, recoveryCode.trim());
      onEnter(roomCode, 'Teacher');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not restore control.');
    } finally {
      setBusy(false);
    }
  };

  const back = (to: Mode) => (
    <Button variant="link" className="classroom-page__back" onClick={() => go(to)}>
      {`← ${intl.formatMessage(messages.back)}`}
    </Button>
  );

  const problem = error && <p className="classroom-page__error">{error}</p>;

  // -- the room is ready --------------------------------------------------
  if (mode === 'created' && created) {
    return (
      <div className="classroom-page classroom-page__entry">
        <h1>{intl.formatMessage(messages.readyHeading)}</h1>
        <p className="classroom-page__sub">{intl.formatMessage(messages.readySub)}</p>
        <p className="classroom-page__big-code">{created.code}</p>

        <div className="classroom-page__recovery">
          <p className="classroom-page__recovery-label">
            {intl.formatMessage(messages.recoveryLabel)}
          </p>
          <code>{created.hostToken}</code>
          <p className="classroom-page__recovery-help">
            {intl.formatMessage(messages.recoveryHelp)}
          </p>
        </div>

        <Button variant="primary" onClick={() => onEnter(created.code, 'Teacher')}>
          {intl.formatMessage(messages.openText)}
        </Button>
      </div>
    );
  }

  // -- starting a class ---------------------------------------------------
  if (mode === 'start') {
    return (
      <div className="classroom-page classroom-page__entry">
        {back('join')}
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

        <p className="classroom-page__switch">
          {`${intl.formatMessage(messages.alreadyRunning)} `}
          <Button variant="link" onClick={() => go('resume')}>
            {intl.formatMessage(messages.resumeLink)}
          </Button>
        </p>
      </div>
    );
  }

  // -- taking back control ------------------------------------------------
  if (mode === 'resume') {
    return (
      <div className="classroom-page classroom-page__entry">
        {back('start')}
        <h1>{intl.formatMessage(messages.resumeHeading)}</h1>
        <p className="classroom-page__sub">{intl.formatMessage(messages.resumeSub)}</p>

        <Form onSubmit={resume}>
          <Form.Group>
            <Form.Label>{intl.formatMessage(messages.codeLabel)}</Form.Label>
            <Form.Control
              value={resumeCode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResumeCode(
                e.target.value.toUpperCase(),
              )}
              maxLength={ROOM_CODE_LENGTH}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>{intl.formatMessage(messages.recoveryLabel)}</Form.Label>
            <Form.Control
              value={recoveryCode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecoveryCode(
                e.target.value,
              )}
              autoComplete="off"
              spellCheck={false}
            />
          </Form.Group>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !resumeCode.trim() || !recoveryCode.trim()}
          >
            {intl.formatMessage(busy ? messages.checking : messages.resume)}
          </Button>
        </Form>
        {problem}
      </div>
    );
  }

  // -- joining ------------------------------------------------------------
  return (
    <div className="classroom-page classroom-page__entry classroom-page__join">
      <Form
        onSubmit={(event: React.FormEvent) => {
          event.preventDefault();
          const clean = code.trim().toUpperCase();
          if (clean.length === ROOM_CODE_LENGTH) { onEnter(clean, displayName.trim()); }
        }}
      >
        <h1>{intl.formatMessage(messages.heading)}</h1>

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
          <Form.Text>{intl.formatMessage(messages.codeHelp)}</Form.Text>
        </Form.Group>

        <Form.Group>
          <Form.Label>{intl.formatMessage(messages.nameLabel)}</Form.Label>
          <Form.Control
            value={displayName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(
              e.target.value,
            )}
            autoComplete="off"
          />
        </Form.Group>

        <Button
          type="submit"
          variant="primary"
          disabled={code.trim().length !== ROOM_CODE_LENGTH}
        >
          {intl.formatMessage(messages.join)}
        </Button>
      </Form>

      <p className="classroom-page__switch">
        {`${intl.formatMessage(messages.teacherPrompt)} `}
        <Button variant="link" onClick={() => go('start')}>
          {intl.formatMessage(messages.startLink)}
        </Button>
      </p>
    </div>
  );
};

export default JoinScreen;
