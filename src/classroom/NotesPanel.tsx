import { useState } from 'react';
import { useIntl } from '@edx/frontend-platform/i18n';

import { AddNoteIcon, LockIcon, NotesIcon } from './icons';
import messages from './messages';
import SidePanel, { PHONE } from './SidePanel';
import {
  NOTE_COLORS, type Note, type NoteColor, type NoteLayer,
} from './types';

interface Props {
  isOpen: boolean;
  notes: Note[];
  loading: boolean;
  error: string | null;
  /** Where each line comes in the text, to list notes in reading order. */
  order: Map<string, number>;
  /** Notes whose words are no longer in the text. */
  detached: Set<string>;
  /**
   * The side of the text the reader has hidden, if any. Its notes are tagged, since their words
   * are not on the page.
   */
  hiddenLayer?: NoteLayer | null;
  onClose: () => void;
  /** Go to a note's line. The note is named too, so its words can be shown there. */
  onGoTo: (segmentId: string, noteId: string) => void;
  onEdit: (id: string) => void;
}

const colorNames = {
  yellow: messages.colorYellow,
  green: messages.colorGreen,
  blue: messages.colorBlue,
  pink: messages.colorPink,
} as const;

/**
 * Everything the student has marked in this class, in the order it is read.
 *
 * Each note is one compact card: the words, quiet, with a slim bar in the highlight's colour
 * beside them, and what the student wrote. Pressing the card goes to its line; the pen in its corner opens the note to
 * change it. A note whose words have gone from the text is still listed, and says so, rather
 * than being lost. With many notes, a row of colours over the list narrows it to one colour.
 *
 * A side panel, so the list can stay open beside the text while going from note to note. On a
 * phone, where it covers the text, it puts itself away so the line can be seen.
 */
const NotesPanel = ({
  isOpen, notes, loading, error, order, detached, hiddenLayer = null, onClose, onGoTo, onEdit,
}: Props) => {
  const intl = useIntl();
  const [only, setOnly] = useState<NoteColor | null>(null);
  const inReadingOrder = [...notes].sort((a, b) => (
    (order.get(a.segmentId) ?? Infinity) - (order.get(b.segmentId) ?? Infinity)
    || a.startOffset - b.startOffset
  ));
  // Only the colours actually used are offered, and only when there is more than one.
  const used = NOTE_COLORS.filter((c) => notes.some((n) => n.color === c));
  // A colour no longer used (its last note deleted or recoloured) filters nothing: with its button
  // gone, there would be no way back to "All".
  const active = only && used.length > 1 && used.includes(only) ? only : null;
  const shown = active ? inReadingOrder.filter((n) => n.color === active) : inReadingOrder;

  if (!isOpen) { return null; }

  const goTo = (note: Note) => {
    onGoTo(note.segmentId, note.id);
    if (window.innerWidth < PHONE) { onClose(); }
  };

  return (
    <SidePanel
      title={intl.formatMessage(messages.notesHeading)}
      closeLabel={intl.formatMessage(messages.close)}
      onClose={onClose}
      className="classroom-notes-panel"
    >
      <div className="classroom-drawer__body classroom-notes-panel__body-wrap">
        <div className="classroom-notes-panel__meta">
          <p className="classroom-notes-panel__intro">
            <LockIcon size={14} />
            <span>{intl.formatMessage(messages.notesPrivate)}</span>
          </p>
          {notes.length > 0 && (
            <span className="classroom-notes-panel__count">
              {intl.formatMessage(messages.notesCount, { count: notes.length })}
            </span>
          )}
        </div>

        {used.length > 1 && (
          <div className="classroom-notes-panel__filters" role="group" aria-label={intl.formatMessage(messages.notesFilterLabel)}>
            <button
              type="button"
              className={`classroom-notes-panel__filter${active === null ? ' classroom-notes-panel__filter--on' : ''}`}
              aria-pressed={active === null}
              onClick={() => setOnly(null)}
            >
              {intl.formatMessage(messages.notesFilterAll)}
            </button>
            {used.map((color) => (
              <button
                key={color}
                type="button"
                className={`classroom-notes-panel__filter classroom-notes-panel__filter--dot${active === color ? ' classroom-notes-panel__filter--on' : ''}`}
                aria-pressed={active === color}
                aria-label={intl.formatMessage(messages.notesFilterColor, {
                  color: intl.formatMessage(colorNames[color]),
                })}
                onClick={() => setOnly(active === color ? null : color)}
              >
                <span className={`classroom-notes-panel__dot classroom-note--${color}`} />
              </button>
            ))}
          </div>
        )}

        {loading && <p className="classroom-notes-panel__status">{intl.formatMessage(messages.notesLoading)}</p>}
        {error && <p className="classroom-page__error">{error}</p>}

        {!loading && !error && notes.length === 0 && (
          <div className="classroom-dictionary__notice">
            <span className="classroom-dictionary__notice-icon" aria-hidden="true"><NotesIcon size={22} /></span>
            <p className="classroom-dictionary__notice-title">{intl.formatMessage(messages.notesEmptyTitle)}</p>
            <p className="classroom-dictionary__notice-body">{intl.formatMessage(messages.notesEmpty)}</p>
          </div>
        )}
        {notes.length > 0 && shown.length === 0 && (
          <p className="classroom-notes-panel__status">{intl.formatMessage(messages.notesFilteredEmpty)}</p>
        )}

        <ul className="classroom-notes-panel__list">
          {shown.map((note) => {
            const lost = detached.has(note.id);
            const hidden = !lost && note.layer === hiddenLayer;
            const content = (
              <>
                <span
                  className={`classroom-notes-panel__quote classroom-notes-panel__quote--${note.color}`}
                  lang={note.layer === 'source' ? 'bo' : 'en'}
                >
                  {note.quote}
                </span>
                {note.body && <span className="classroom-notes-panel__body">{note.body}</span>}
                {hidden && (
                  <span className="classroom-notes-panel__hidden">
                    {intl.formatMessage(note.layer === 'source' ? messages.sideHiddenSource : messages.sideHiddenTranslation)}
                  </span>
                )}
                {lost && <span className="classroom-notes-panel__lost">{intl.formatMessage(messages.textChanged)}</span>}
              </>
            );
            return (
              <li key={note.id} className={`classroom-notes-panel__item${lost ? ' classroom-notes-panel__item--lost' : ''}`}>
                {lost ? (
                  <div className="classroom-notes-panel__card">{content}</div>
                ) : (
                  <button
                    type="button"
                    className="classroom-notes-panel__card"
                    title={intl.formatMessage(messages.goToNote)}
                    onClick={() => goTo(note)}
                  >
                    <span className="sr-only">{intl.formatMessage(messages.goToNote)}: </span>
                    {content}
                  </button>
                )}
                <button
                  type="button"
                  className="classroom-notes-panel__edit"
                  aria-label={intl.formatMessage(messages.editNote)}
                  title={intl.formatMessage(messages.editNote)}
                  onClick={() => onEdit(note.id)}
                >
                  <AddNoteIcon size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </SidePanel>
  );
};

export default NotesPanel;
