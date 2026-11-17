import type { ReactNode } from 'react';
import { useIntl } from '@edx/frontend-platform/i18n';
import { Button, ModalDialog } from '@openedx/paragon';

import messages from './messages';

interface Props {
  isOpen: boolean;
  title: string;
  /** Said under the title: what will happen, in a sentence or two. */
  children: ReactNode;
  /** The words on the button that goes ahead: the action itself, never "OK". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The one way this classroom asks "are you sure?", so every such question looks and reads
 * alike: a plain title, what will happen, and two buttons the same height, the safe one on
 * the left and the one that goes ahead in red on the right.
 */
const ConfirmDialog = ({
  isOpen, title, children, confirmLabel, onConfirm, onCancel,
}: Props) => {
  const intl = useIntl();
  return (
    <ModalDialog
      title={title}
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      hasCloseButton={false}
      isOverflowVisible={false}
      className="classroom-confirm"
    >
      <ModalDialog.Header>
        <ModalDialog.Title>{title}</ModalDialog.Title>
      </ModalDialog.Header>
      <ModalDialog.Body className="classroom-confirm__body">
        {children}
      </ModalDialog.Body>
      <ModalDialog.Footer>
        <div className="classroom-confirm__actions">
          <Button variant="tertiary" className="classroom-confirm__cancel" onClick={onCancel}>
            {intl.formatMessage(messages.cancel)}
          </Button>
          <Button variant="danger" className="classroom-confirm__go" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </ModalDialog.Footer>
    </ModalDialog>
  );
};

export default ConfirmDialog;
