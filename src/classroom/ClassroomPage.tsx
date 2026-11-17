import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useIntl } from '@edx/frontend-platform/i18n';
import { Button, Form } from '@openedx/paragon';

import JoinScreen from './JoinScreen';
import Reader from './Reader';
import messages from './messages';
import { recallHostToken } from './api';
import { useRoom } from './useRoom';
import { useText } from './useText';

interface Session {
  code: string;
  displayName: string;
}

const Classroom = ({ session, onLeave }: { session: Session; onLeave: () => void }) => {
  const intl = useIntl();
  // Holding the token is what makes this client a teacher. The server checks it again
  // on every move; this only decides what the interface offers.
  // Memoised: this is a synchronous localStorage read, and the component re-renders
  // on every presence update and every move.
  const hostToken = useMemo(() => recallHostToken(session.code), [session.code]);
  const teaching = Boolean(hostToken);
  // Following is on by default and can be turned off, because a student who scrolls
  // up to re-read a line would otherwise be yanked forward on the teacher's next tap,
  // mid-sentence, with no way to stop it.
  const [follow, setFollow] = useState(true);
  const {
    connected, state, error, closed, joinRejected, endClass, goto,
  } = useRoom(session.code, session.displayName, hostToken);
  // The room tells us which edition it pinned; the text is loaded from that, once.
  const text = useText(state?.editionId);

  if (closed || joinRejected) {
    return (
      <div className="classroom-page classroom-page__notice">
        <h1>
          {intl.formatMessage(closed ? messages.classEnded : messages.couldNotJoin)}
        </h1>
        {!closed && error && <p>{error}</p>}
        <Button variant="outline-primary" onClick={onLeave}>
          {intl.formatMessage(messages.back)}
        </Button>
      </div>
    );
  }

  return (
    <div className="classroom-page">
      <Helmet><title>{state?.title ?? intl.formatMessage(messages.pageTitle)}</title></Helmet>

      <header className="classroom-page__header">
        <div>
          <h1>{state?.title ?? session.code}</h1>
          <p className="classroom-page__meta">
            {connected
              ? intl.formatMessage(messages.present, {
                count: state?.participantCount ?? 1,
              })
              : intl.formatMessage(messages.connecting)}
          </p>
        </div>
        <div className="classroom-page__controls">
          <Form.Switch
            checked={follow}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFollow(
              e.target.checked,
            )}
          >
            {intl.formatMessage(messages.follow)}
          </Form.Switch>
        </div>
        {teaching && (
          <div className="classroom-page__host">
            <span>{intl.formatMessage(messages.teaching)}</span>
            <Button variant="outline-danger" size="sm" onClick={endClass}>
              {intl.formatMessage(messages.endClass)}
            </Button>
          </div>
        )}
      </header>

      {(error || text.error) && (
        <p className="classroom-page__error">{error ?? text.error}</p>
      )}

      <main className="classroom-page__text">
        {text.loading && <p>{intl.formatMessage(messages.loadingText)}</p>}
        {!text.loading && text.lines.length > 0 && (
          <Reader
            lines={text.lines}
            currentSegmentId={state?.currentSegmentId ?? null}
            onPick={teaching ? goto : undefined}
            follow={follow}
          />
        )}
        {!text.loading && text.lines.length === 0 && !text.error && (
          <p>{intl.formatMessage(messages.waiting)}</p>
        )}
      </main>
    </div>
  );
};

/**
 * The classroom.
 *
 * At this step it shows the *segment id* the class is on rather than the text. That is
 * on purpose: it proves the whole chain — browser, socket, server, database, back to
 * every other browser — before any rendering work exists. If something is
 * fundamentally wrong, this is where it shows up, and cheaply.
 */
const ClassroomPage = () => {
  const intl = useIntl();
  const initialCode = new URLSearchParams(window.location.search).get('room') ?? '';
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return (
      <>
        <Helmet><title>{intl.formatMessage(messages.pageTitle)}</title></Helmet>
        <JoinScreen
          initialCode={initialCode.toUpperCase()}
          onEnter={(code, displayName) => setSession({ code, displayName })}
        />
      </>
    );
  }

  return <Classroom session={session} onLeave={() => setSession(null)} />;
};

export default ClassroomPage;
