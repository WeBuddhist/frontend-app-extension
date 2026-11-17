import { useIntl } from '@edx/frontend-platform/i18n';
import { Dropdown } from '@openedx/paragon';

import ConfirmDialog from './ConfirmDialog';

import { ChevronIcon } from './icons';
import messages from './messages';

/** Small line icons, drawn here rather than imported (see `ReadingOptions.tsx` for why). */
const icon = (paths: string[]) => function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="classroom-class-menu__icon"
    >
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
};

/** Two people: the members. */
const ManageIcon = icon([
  'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
  'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  'M23 21v-2a4 4 0 0 0-3-3.87',
  'M16 3.13a4 4 0 0 1 0 7.75',
]);
/** An arrow leaving a doorway: everyone goes back out to their list of classes. */
const EndIcon = icon([
  'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
  'M16 17l5-5-5-5',
  'M21 12H9',
]);

interface Props {
  /** Open the tools for the class: members, the code, archiving. */
  onManage: () => void;
  /** Whether the "end today's session?" question is showing. */
  confirmingEnd: boolean;
  onAskEnd: () => void;
  onCancelEnd: () => void;
  /** The teacher said yes: end today's session for everyone. */
  onEnd: () => void;
}

/**
 * Everything a teacher does *to the class* behind one button, so the header carries one
 * control for it instead of three.
 *
 * Ending the session asks first. It sends everyone back to their list at once, and it was
 * one press away from the teacher's other buttons.
 */
const ClassMenu = ({
  onManage, confirmingEnd, onAskEnd, onCancelEnd, onEnd,
}: Props) => {
  const intl = useIntl();
  return (
    <>
      <Dropdown className="classroom-class-menu" alignRight>
        <Dropdown.Toggle id="classroom-class-menu" variant="tertiary" size="sm" className="classroom-class-menu__toggle">
          {intl.formatMessage(messages.classMenu)}
          <ChevronIcon size={18} />
        </Dropdown.Toggle>
        <Dropdown.Menu className="classroom-class-menu__menu">
          <Dropdown.Item className="classroom-class-menu__item" onClick={onManage}>
            <ManageIcon />
            <span className="classroom-class-menu__text">
              <span className="classroom-class-menu__title">{intl.formatMessage(messages.manage)}</span>
              <span className="classroom-class-menu__hint">{intl.formatMessage(messages.manageHint)}</span>
            </span>
          </Dropdown.Item>
          <Dropdown.Item
            className="classroom-class-menu__item classroom-class-menu__item--danger"
            onClick={onAskEnd}
          >
            <EndIcon />
            <span className="classroom-class-menu__text">
              <span className="classroom-class-menu__title">{intl.formatMessage(messages.endSession)}</span>
              <span className="classroom-class-menu__hint">{intl.formatMessage(messages.endSessionHint)}</span>
            </span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>

      <ConfirmDialog
        isOpen={confirmingEnd}
        title={intl.formatMessage(messages.endSessionTitle)}
        confirmLabel={intl.formatMessage(messages.endSession)}
        onConfirm={onEnd}
        onCancel={onCancelEnd}
      >
        <p>{intl.formatMessage(messages.endSessionBody)}</p>
      </ConfirmDialog>
    </>
  );
};

export default ClassMenu;
