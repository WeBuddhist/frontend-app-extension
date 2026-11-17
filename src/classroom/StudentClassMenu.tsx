import { useIntl } from '@edx/frontend-platform/i18n';
import { Dropdown } from '@openedx/paragon';

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

/** A target: the reader is held on the line the teacher is on. */
const FollowIcon = icon([
  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
]);
/** An arrow leaving a doorway: out of the class. */
const LeaveIcon = icon([
  'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
  'M16 17l5-5-5-5',
  'M21 12H9',
]);

interface Props {
  /** Whether the reader is kept on the line the teacher is on. */
  follow: boolean;
  /** There is nobody to follow: the teacher ended the session. */
  followDisabled?: boolean;
  onFollow: (follow: boolean) => void;
  /** The student asked to leave: the page asks them to confirm. */
  onLeave: () => void;
}

/**
 * What a student can do about the class, behind one "Class" button set like the teacher's: follow
 * the teacher or not, and leave. They were a switch and a button of their own, crowding the
 * header.
 */
const StudentClassMenu = ({
  follow, followDisabled = false, onFollow, onLeave,
}: Props) => {
  const intl = useIntl();
  return (
    <Dropdown className="classroom-class-menu" alignRight>
      <Dropdown.Toggle id="classroom-class-menu" variant="tertiary" size="sm" className="classroom-class-menu__toggle">
        {intl.formatMessage(messages.classMenu)}
        <ChevronIcon size={18} />
      </Dropdown.Toggle>
      <Dropdown.Menu className="classroom-class-menu__menu">
        {/* Not a Dropdown.Item: those close the menu when pressed, and a switch is better left in
            view so the student sees it change. A plain element with the same look and the keys
            a switch answers to. */}
        <div
          className={`dropdown-item classroom-class-menu__item ${followDisabled ? 'classroom-class-menu__item--disabled' : ''}`}
          role="menuitemcheckbox"
          aria-checked={follow}
          aria-disabled={followDisabled || undefined}
          tabIndex={0}
          onClick={() => { if (!followDisabled) { onFollow(!follow); } }}
          onKeyDown={(event) => {
            if (followDisabled) { return; }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onFollow(!follow);
            }
          }}
        >
          <FollowIcon />
          <span className="classroom-class-menu__text">
            <span className="classroom-class-menu__title">{intl.formatMessage(messages.follow)}</span>
            <span className="classroom-class-menu__hint">{intl.formatMessage(messages.followHint)}</span>
          </span>
          <span
            className={`classroom-class-menu__switch ${follow ? 'classroom-class-menu__switch--on' : ''}`}
            aria-hidden="true"
          />
        </div>
        <Dropdown.Item
          className="classroom-class-menu__item classroom-class-menu__item--danger"
          onClick={onLeave}
        >
          <LeaveIcon />
          <span className="classroom-class-menu__text">
            <span className="classroom-class-menu__title">{intl.formatMessage(messages.leaveClass)}</span>
            <span className="classroom-class-menu__hint">{intl.formatMessage(messages.leaveHint)}</span>
          </span>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default StudentClassMenu;
