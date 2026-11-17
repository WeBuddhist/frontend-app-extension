import { useEffect, useState } from 'react';
import { useIntl } from '@edx/frontend-platform/i18n';
import { Button, Form, ModalDialog } from '@openedx/paragon';

import messages from './messages';
import { NOTE_COLORS, type NoteColor, type NoteLayer } from './types';

interface Props {
  isOpen: boolean;
  /** True when making a note; false when looking at or changing one that exists. */
  isNew: boolean;
  /** The words the note is on, shown so it is clear what is being annotated. */
  quote: string;
  layer: NoteLayer;
  initialColor: NoteColor;
  initialBody: string;
  /** Save. Rejects with a message to show; resolves when it has been stored. */
  onSave: (color: NoteColor, body: string) => Promise<void>;
  /** Delete the note. Only offered for one that exists. */
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

const colorNames = {
  yellow: messages.colorYellow,
  green: messages.colorGreen,
  blue: messages.colorBlue,
  pink: messages.colorPink,
} as const;

/**
 * Making or changing one note: its colour and its words.
 *
 * The words are optional. A note with none is a highlight, which is what the colour
 * buttons over a selection make in one press; this is for when there is something to say.
 */
const NoteDialog = ({
  isOpen, isNew, quote, layer, initialColor, initialBody, onSave, onDelete, onClose,
}: Props) => {
  const intl = useIntl();
  const [color, setColor] = useState<NoteColor>(initialColor);
  const [body, setBody] = useState(initialBody);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A different note, or the same dialog opened again, starts from what that note says.
  useEffect(() => {
    if (isOpen) { setColor(initialColor); setBody(initialBody); setError(null); }
  }, [isOpen, initialColor, initialBody, quote]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalDialog
      title={intl.formatMessage(isNew ? messages.noteDialogNew : messages.noteDialogEdit)}
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      hasCloseButton
      isFullscreenOnMobile
      isOverflowVisible={false}
      className="classroom-note-dialog"
    >
      <ModalDialog.Header>
        <ModalDialog.Title>
          {intl.formatMessage(isNew ? messages.noteDialogNew : messages.noteDialogEdit)}
        </ModalDialog.Title>
      </ModalDialog.Header>

      <ModalDialog.Body>
        <blockquote className={`classroom-note-dialog__quote classroom-note-dialog__quote--${layer}`} lang={layer === 'source' ? 'bo' : 'en'}>
          {quote}
        </blockquote>

        <fieldset className="classroom-note-dialog__colors">
          <legend>{intl.formatMessage(messages.noteColorLabel)}</legend>
          {NOTE_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={option === color}
              aria-label={intl.formatMessage(colorNames[option])}
              className={`classroom-selection-bar__swatch classroom-note--${option}${option === color ? ' classroom-selection-bar__swatch--chosen' : ''}`}
              onClick={() => setColor(option)}
            />
          ))}
        </fieldset>

        <Form.Group>
          <Form.Label>{intl.formatMessage(messages.noteBodyLabel)}</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            maxLength={4000}
            value={body}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
          />
          <Form.Text>{intl.formatMessage(messages.noteBodyHelp)}</Form.Text>
        </Form.Group>
        <p className="classroom-page__sub">{intl.formatMessage(messages.notesPrivate)}</p>
        {error && <p className="classroom-page__error">{error}</p>}
      </ModalDialog.Body>

      <ModalDialog.Footer>
        {onDelete && (
          <Button
            variant="outline-danger"
            disabled={busy}
            onClick={() => run(async () => { await onDelete(); })}
          >
            {intl.formatMessage(messages.deleteNote)}
          </Button>
        )}
        <ModalDialog.CloseButton variant="tertiary">
          {intl.formatMessage(messages.cancel)}
        </ModalDialog.CloseButton>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => run(() => onSave(color, body))}
        >
          {intl.formatMessage(busy ? messages.saving : messages.saveNote)}
        </Button>
      </ModalDialog.Footer>
    </ModalDialog>
  );
};

export default NoteDialog;
