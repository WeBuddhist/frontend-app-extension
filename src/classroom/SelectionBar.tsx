import type { CSSProperties } from 'react';
import { useIntl } from '@edx/frontend-platform/i18n';
import { Button } from '@openedx/paragon';

import { hasTibetan } from './dictionary';
import { AddNoteIcon, DictionaryIcon } from './icons';
import type { UsableSelection } from './useNoteSelection';
import messages from './messages';
import { NOTE_COLORS, type NoteColor } from './types';

interface Props {
  selection: UsableSelection;
  /** Highlight the selection in this colour, with no note. */
  onColor: (color: NoteColor) => void;
  /** Add a note to the selection. */
  onNote: () => void;
  /** Show what the selected words mean. Offered only for Tibetan. */
  onLookUp?: () => void;
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
  selection, onColor, onNote, onLookUp, busy = false,
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
      <div className="classroom-selection-bar__colors">
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
      </div>
      <span className="classroom-selection-bar__divider" aria-hidden="true" />
      <Button
        variant="tertiary"
        size="sm"
        className="classroom-selection-bar__action"
        aria-label={intl.formatMessage(messages.addNote)}
        title={intl.formatMessage(messages.addNote)}
        disabled={busy}
        onClick={onNote}
      >
        <AddNoteIcon size={16} />
        <span className="classroom-selection-bar__label">{intl.formatMessage(messages.addNote)}</span>
      </Button>
      {onLookUp && hasTibetan(selection.anchor.quote) && (
        <Button
          variant="tertiary"
          size="sm"
          className="classroom-selection-bar__action"
          aria-label={intl.formatMessage(messages.lookUp)}
          title={intl.formatMessage(messages.lookUp)}
          onClick={onLookUp}
        >
          <DictionaryIcon size={16} />
          <span className="classroom-selection-bar__label">{intl.formatMessage(messages.lookUp)}</span>
        </Button>
      )}
    </div>
  );
};

export default SelectionBar;
