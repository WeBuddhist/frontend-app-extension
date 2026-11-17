import { useIntl } from '@edx/frontend-platform/i18n';
import { Button, ModalDialog } from '@openedx/paragon';

import messages from './messages';
import type { Note } from './types';

interface Props {
  isOpen: boolean;
  notes: Note[];
  loading: boolean;
  error: string | null;
  /** Where each line comes in the text, to list notes in reading order. */
  order: Map<string, number>;
  /** Notes whose words are no longer in the text. */
  detached: Set<string>;
  onClose: () => void;
  onGoTo: (segmentId: string) => void;
  onEdit: (id: string) => void;
}

/**
 * Everything the student has marked in this class, in the order it is read.
 *
 * Tapping a note goes to its line; the note stays attached to its words either way. A note
 * whose words have gone from the text is still listed, and says so, rather than being lost.
 */
const NotesPanel = ({
  isOpen, notes, loading, error, order, detached, onClose, onGoTo, onEdit,
}: Props) => {
  const intl = useIntl();
  const inReadingOrder = [...notes].sort((a, b) => (
    (order.get(a.segmentId) ?? Infinity) - (order.get(b.segmentId) ?? Infinity)
    || a.startOffset - b.startOffset
  ));

  return (
    <ModalDialog
      title={intl.formatMessage(messages.notesHeading)}
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      hasCloseButton
      isFullscreenOnMobile
      isOverflowVisible={false}
      className="classroom-notes-panel"
    >
      <ModalDialog.Header>
        <ModalDialog.Title>{intl.formatMessage(messages.notesHeading)}</ModalDialog.Title>
      </ModalDialog.Header>

      <ModalDialog.Body>
        <p className="classroom-notes-panel__intro">{intl.formatMessage(messages.notesPrivate)}</p>
        {loading && <p className="classroom-page__sub">{intl.formatMessage(messages.notesLoading)}</p>}
        {error && <p className="classroom-page__error">{error}</p>}
        {!loading && !error && notes.length === 0 && (
          <p>{intl.formatMessage(messages.notesEmpty)}</p>
        )}
        <ul className="classroom-notes-panel__list">
          {inReadingOrder.map((note) => (
            <li key={note.id} className="classroom-notes-panel__item">
              <blockquote
                className={`classroom-notes-panel__quote classroom-note--${note.color}`}
                lang={note.layer === 'source' ? 'bo' : 'en'}
              >
                {note.quote}
              </blockquote>
              {note.body && <p className="classroom-notes-panel__body">{note.body}</p>}
              {detached.has(note.id) && (
                <p className="classroom-page__sub">{intl.formatMessage(messages.textChanged)}</p>
              )}
              <div className="classroom-notes-panel__actions">
                <Button
                  variant="tertiary"
                  size="sm"
                  className="classroom-notes-panel__action"
                  disabled={detached.has(note.id)}
                  onClick={() => { onGoTo(note.segmentId); onClose(); }}
                >
                  {intl.formatMessage(messages.goToNote)}
                </Button>
                <Button
                  variant="tertiary"
                  size="sm"
                  className="classroom-notes-panel__action"
                  onClick={() => onEdit(note.id)}
                >
                  {intl.formatMessage(messages.editNote)}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </ModalDialog.Body>

      <ModalDialog.Footer>
        <ModalDialog.CloseButton variant="tertiary" className="classroom-notes-panel__close">
          {intl.formatMessage(messages.close)}
        </ModalDialog.CloseButton>
      </ModalDialog.Footer>
    </ModalDialog>
  );
};

export default NotesPanel;
