import { useIntl } from '@edx/frontend-platform/i18n';

import { ChevronIcon, ChevronUpIcon } from './icons';
import messages from './messages';

interface Props {
  /** Whether there is a line before the current one to go back to. */
  hasPrevious: boolean;
  /** Whether there is a line after the current one to go on to. */
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/**
 * Two buttons that float over the text for the teacher: back a line, on a line.
 *
 * Pressing a line moves the class, but a teacher reading aloud wants to go on without reaching
 * for the line they are about to read, and a long line can run past the screen. These stay in
 * the same corner whatever the text does, so they can be pressed without looking.
 */
const LineStepper = ({
  hasPrevious, hasNext, onPrevious, onNext,
}: Props) => {
  const intl = useIntl();
  return (
    <div className="classroom-stepper" role="group" aria-label={intl.formatMessage(messages.stepperLabel)}>
      <button
        type="button"
        className="classroom-stepper__button"
        onClick={onPrevious}
        disabled={!hasPrevious}
      >
        <ChevronUpIcon size={20} />
        <span className="classroom-stepper__label">{intl.formatMessage(messages.previousLine)}</span>
      </button>
      <button
        type="button"
        className="classroom-stepper__button"
        onClick={onNext}
        disabled={!hasNext}
      >
        <ChevronIcon size={20} />
        <span className="classroom-stepper__label">{intl.formatMessage(messages.nextLine)}</span>
      </button>
    </div>
  );
};

export default LineStepper;
