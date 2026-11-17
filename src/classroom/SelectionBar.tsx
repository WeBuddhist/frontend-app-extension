import type { CSSProperties } from 'react';
import { useIntl } from '@edx/frontend-platform/i18n';
import { Button } from '@openedx/paragon';

import type { UsableSelection } from './useNoteSelection';
import messages from './messages';
import { NOTE_COLORS, type NoteColor } from './types';

interface Props {
  selection: UsableSelection;
  /** Highlight the selection in this colour, with no note. */
  onColor: (color: NoteColor) => void;
  /** Add a note to the selection. */
  onNote: () => void;
  busy?: boolean;
}

const colorNames = {
  yellow: messages.colorYellow,
  green: messages.colorGreen,
  blue: messages.colorBlue,
  pink: messages.colorPink,
} as const;

/**
 * What appears over selected words: four colours, and "Add note".
 *
 * On a laptop it floats beside the selection. On a phone it sits along the bottom of the
 * screen (the stylesheet decides), because a phone has its own Copy menu over a selection
 * and ours would collide with it.
 *
 * Pressing a button must not take the selection away from the text, or there would be
 * nothing left to highlight: `mousedown` is not allowed to move focus off it.
 */
const SelectionBar = ({
  selection, onColor, onNote, busy = false,
}: Props) => {
  const intl = useIntl();
  const { rect } = selection;
  const style = {
    '--selection-top': `${rect.top}px`,
    '--selection-bottom': `${rect.bottom}px`,
    '--selection-left': `${rect.left + rect.width / 2}px`,
  } as CSSProperties;

  return (
    <div
      className="classroom-selection-bar"
      role="toolbar"
      aria-label={intl.formatMessage(messages.selectionLabel)}
      style={style}
      onMouseDown={(event) => event.preventDefault()}
    >
      {NOTE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          disabled={busy}
          className={`classroom-selection-bar__swatch classroom-note--${color}`}
          aria-label={intl.formatMessage(messages.highlightColor, {
            color: intl.formatMessage(colorNames[color]),
          })}
          onClick={() => onColor(color)}
        />
      ))}
      <Button variant="tertiary" size="sm" disabled={busy} onClick={onNote}>
        {intl.formatMessage(messages.addNote)}
      </Button>
    </div>
  );
};

export default SelectionBar;
