import { useIntl } from '@edx/frontend-platform/i18n';

import messages from './messages';

interface Props {
  /** Whether the teacher is in the class right now. */
  live: boolean;
  /** The teacher ended the session: there is nobody to catch up with. */
  ended?: boolean;
  /** There is nowhere to go until the teacher has picked a line. */
  disabled: boolean;
  onSync: () => void;
}

/**
 * A student's way back to the teacher, as a "Live" pill: a dot that blinks red while the teacher
 * is here and rests in a muted red when they are not, so it also says whether anyone is teaching.
 * Pressing it takes the student's reader to the line the class is on.
 *
 * Always there, in the same corner as the teacher's back/on buttons, because the reader no longer
 * catches up by itself after they make a note. It does the same whether or not "Follow the
 * teacher" is on.
 */
const SyncButton = ({
  live, ended = false, disabled, onSync,
}: Props) => {
  const intl = useIntl();
  return (
    <div className="classroom-stepper classroom-stepper--live">
      <button
        type="button"
        className={`classroom-stepper__button classroom-live ${live ? 'classroom-live--on' : ''}`}
        onClick={onSync}
        disabled={disabled}
        aria-label={intl.formatMessage(messages.syncWithTeacher)}
        title={intl.formatMessage(
          // eslint-disable-next-line no-nested-ternary
          ended ? messages.syncEndedHint : live ? messages.syncLiveHint : messages.syncOfflineHint,
        )}
      >
        <span className="classroom-live__dot" aria-hidden="true" />
        <span className="classroom-live__label" aria-hidden="true">{intl.formatMessage(ended ? messages.endedLabel : messages.liveLabel)}</span>
      </button>
    </div>
  );
};

export default SyncButton;
