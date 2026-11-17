import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useIntl } from '@edx/frontend-platform/i18n';
import { Button, useToggle } from '@openedx/paragon';

import JoinScreen from './JoinScreen';
import Contents from './Contents';
import LineStepper from './LineStepper';
import StudentClassMenu from './StudentClassMenu';
import SyncButton from './SyncButton';
import ClassMenu from './ClassMenu';
import Head from '../Head';
import ConfirmDialog from './ConfirmDialog';
import { NotesIcon } from './icons';
import ManageClass from './ManageClass';
import NoteDialog from './NoteDialog';
import NotesPanel from './NotesPanel';
import SelectionBar from './SelectionBar';
import Reader from './Reader';
import ReadingOptions from './ReadingOptions';
import * as api from './api';
import messages from './messages';
import { useRoom } from './useRoom';
import { headingsBySegment } from './outline';
import {
  forgetSession, pickSession, recallSession, rememberSession,
} from './session';
import { relocate, type Mark } from './anchors';
import type { LineMarks } from './Reader';
import type { Note, NoteColor } from './types';
import { useNoteSelection, type UsableSelection } from './useNoteSelection';
import { useHideOnScroll } from './useHideOnScroll';
import { useNotes } from './useNotes';
import { useOutline } from './useOutline';
import { useText } from './useText';
import {
  recallLayout, recallSectionTitles, recallTextSize, recallView, rememberLayout,
  rememberSectionTitles, rememberTextSize,
  rememberView, type LayoutMode, type TextSize, type ViewMode,
} from './view';

/**
 * A text's title often arrives as the Tibetan name with an English gloss in brackets,
 * such as `བྱང་ཆུབ་… (The Precious Lamp — Tibetan root text)`. Set on one line, the two
 * scripts fight: a display Tibetan face beside a Latin serif at the same size. Split at
 * the closing bracket so the name is the heading and the gloss sits beneath it.
 * A title with no trailing bracket is left whole.
 */
export const splitTitle = (title: string): { main: string; sub: string | null } => {
  const match = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(title);
  return match && match[1] ? { main: match[1], sub: match[2] } : { main: title, sub: null };
};

/** Why a class stopped being live for someone, said in words they can act on. */
const endedMessages = {
  session: { title: 'sessionEndedTitle', body: 'sessionEndedBody' },
  archived: { title: 'archivedTitle', body: 'archivedBody' },
  removed: { title: 'removedTitle', body: 'removedBody' },
  left: { title: 'leftTitle', body: 'leftBody' },
} as const;

interface ClassroomProps {
  code: string;
  onLeave: () => void;
  /** The teacher changed the code; the page follows so a refresh finds the class. */
  onCodeChanged: (code: string) => void;
}

const Classroom = ({ code, onLeave, onCodeChanged }: ClassroomProps) => {
  const intl = useIntl();
  // Following is on by default and can be turned off, because a student who scrolls
  // up to re-read a line would otherwise be yanked forward on the teacher's next tap,
  // mid-sentence, with no way to stop it.
  const [follow, setFollow] = useState(true);
  const [view, setView] = useState<ViewMode>(recallView);
  const [layout, setLayout] = useState<LayoutMode>(recallLayout);
  const [sectionTitles, setSectionTitles] = useState(recallSectionTitles);
  const [textSize, setTextSize] = useState<TextSize>(recallTextSize);
  const [jump, setJump] = useState<{ segmentId: string; n: number; exact?: boolean } | null>(null);
  const [managing, openManage, closeManage] = useToggle(false);
  const headerRef = useRef<HTMLElement>(null);
  const headerHidden = useHideOnScroll(headerRef);
  const [confirmingEnd, askEnd, cancelEnd] = useToggle(false);
  const [confirmingLeave, openLeave, closeLeaveDialog] = useToggle(false);
  const [leaveFailed, setLeaveFailed] = useState(false);
  // A failure belongs to one attempt: opening or closing the question starts clean.
  const askLeave = () => { setLeaveFailed(false); openLeave(); };
  const cancelLeave = () => { setLeaveFailed(false); closeLeaveDialog(); };
  const {
    connected, state, error, ended, joinRejected, endSession, goto,
  } = useRoom(code);
  // The server says what this account is in this class. It decides what the interface
  // offers; the server checks again on every message, so this is a convenience and not
  // the boundary.
  const teaching = state?.role === 'teacher';
  // The teacher ended today's session. A student stays to read and review; a teacher is shown the
  // notice instead (see `useRoom`).
  const sessionOver = !teaching && Boolean(state?.sessionEnded);

  // Notes are for students, for now. A teacher sees no highlights, no popup and no panel,
  // so nothing in their view competes with a tap that moves the class.
  const notesOn = state?.role === 'student';
  const noteStore = useNotes(code, notesOn);
  const [panelOpen, openPanel, closePanel] = useToggle(false);
  /** The note dialog: making one on a selection, or looking at one that exists. */
  const [dialog, setDialog] = useState<
  { kind: 'new'; selection: UsableSelection } | { kind: 'edit'; id: string } | null
  >(null);
  const { selection, clear: clearSelection } = useNoteSelection(notesOn && !dialog);
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [highlightError, setHighlightError] = useState<string | null>(null);
  // The room tells us which edition it pinned; the text is loaded from that, once.
  const text = useText(state?.editionId, state?.translationEditionId);
  const outline = useOutline(state?.editionId);
  // The class's own name when it has one (a teacher may call it "Tuesday study group"),
  // with the text's title beneath it so the name never hides what is being read.
  const title = splitTitle(state?.name ?? code);
  const subtitle = title.sub ?? (state && state.name !== state.title ? state.title : null);
  const headings = useMemo(() => headingsBySegment(outline), [outline]);

  // Where each of the student's notes is now. Normally exactly where it was saved; if the
  // library has edited a line they are searched for, and a note whose words are gone is
  // listed as "text changed" rather than drawn on the wrong ones.
  const { marks, detached, order } = useMemo(() => {
    const byLine = new Map(text.lines.map((line) => [line.id, line]));
    const placed = new Map<string, LineMarks>();
    const lost = new Set<string>();
    noteStore.notes.forEach((note) => {
      const line = byLine.get(note.segmentId);
      const layerText = note.layer === 'source' ? line?.text : line?.translation;
      // The text has not loaded yet: nothing to place against, and nothing to call lost.
      if (!line || layerText === undefined) {
        if (text.lines.length > 0) { lost.add(note.id); }
        return;
      }
      const span = relocate(layerText, note);
      if (!span) { lost.add(note.id); return; }
      const mark: Mark = {
        id: note.id, start: span.start, end: span.end, color: note.color, hasBody: Boolean(note.body),
      };
      const entry = placed.get(note.segmentId) ?? {};
      entry[note.layer] = [...(entry[note.layer] ?? []), mark];
      placed.set(note.segmentId, entry);
    });
    return {
      marks: placed,
      detached: lost,
      order: new Map(text.lines.map((line) => [line.id, line.idx])),
    };
  }, [noteStore.notes, text.lines]);

  const noteById = (id: string): Note | undefined => noteStore.notes.find((n) => n.id === id);
  const editing = dialog?.kind === 'edit' ? noteById(dialog.id) : undefined;

  /** Highlight the selection in one press, with no note. */
  const highlight = async (color: NoteColor) => {
    if (!selection) { return; }
    setSavingHighlight(true);
    setHighlightError(null);
    try {
      await noteStore.create({
        segmentId: selection.segmentId,
        layer: selection.layer,
        startOffset: selection.anchor.start,
        endOffset: selection.anchor.end,
        quote: selection.anchor.quote,
        prefix: selection.anchor.prefix,
        suffix: selection.anchor.suffix,
        color,
        body: null,
      });
      clearSelection();
    } catch (cause) {
      setHighlightError(cause instanceof Error ? cause.message : 'Could not save that.');
    } finally {
      setSavingHighlight(false);
    }
  };

  /** Save the dialog: a new note on the selection, or a change to one that exists. */
  const saveNote = async (color: NoteColor, body: string) => {
    const words = body.trim() || null;
    if (dialog?.kind === 'new') {
      const { selection: chosen } = dialog;
      await noteStore.create({
        segmentId: chosen.segmentId,
        layer: chosen.layer,
        startOffset: chosen.anchor.start,
        endOffset: chosen.anchor.end,
        quote: chosen.anchor.quote,
        prefix: chosen.anchor.prefix,
        suffix: chosen.anchor.suffix,
        color,
        body: words,
      });
      clearSelection();
    } else if (dialog?.kind === 'edit') {
      await noteStore.update(dialog.id, { color, body: words });
    }
    setDialog(null);
  };

  // Following the teacher scrolls the screen, and a screen that moves under a half-made
  // selection, or an open note, loses it. So while the student is at it the reader holds still.
  // It does not then jump to catch up when they finish: the "Sync with teacher" button is how
  // they choose to go back.
  const notesBusy = Boolean(selection) || Boolean(dialog) || panelOpen;

  // Offered only when there is something to choose between.
  const hasTranslation = text.lines.some((line) => Boolean(line.translation));
  const chooseView = (next: ViewMode) => { setView(next); rememberView(next); };
  const chooseSectionTitles = (next: boolean) => {
    setSectionTitles(next);
    rememberSectionTitles(next);
  };
  // Leaving for good: the server takes them out of the class, then they go to their list.
  const leaveForGood = async () => {
    setLeaveFailed(false);
    try {
      await api.leaveClass(code);
    } catch {
      setLeaveFailed(true);
      return;
    }
    cancelLeave();
    forgetSession();
    onLeave();
  };

  const jumpTo = (segmentId: string, exact = false) => {
    setJump((previous) => ({ segmentId, n: (previous?.n ?? 0) + 1, exact }));
    // Only the teacher's jump moves the class. A student looking ahead moves no one.
    if (teaching) { goto(segmentId); }
  };
  // Where the class is in the text, for the teacher's back/on buttons. Before it has begun
  // there is no line to go back from, and "on" means the first.
  const currentIndex = text.lines.findIndex((line) => line.id === state?.currentSegmentId);
  const step = (by: -1 | 1) => {
    const target = text.lines[currentIndex < 0 ? 0 : currentIndex + by];
    if (target) { jumpTo(target.id, true); }
  };
  const chooseTextSize = (next: TextSize) => { setTextSize(next); rememberTextSize(next); };
  const chooseLayout = (next: LayoutMode) => { setLayout(next); rememberLayout(next); };

  // A class that was archived, or one this account is not in, is not one to come back to.
  // Forgetting it means the next refresh lands on the list of classes rather than on the
  // same dead end. A session that merely ended is kept: the class is still theirs.
  useEffect(() => {
    if (joinRejected || ended === 'archived' || ended === 'removed' || ended === 'left') { forgetSession(); }
  }, [ended, joinRejected]);

  if (ended) {
    const words = endedMessages[ended];
    return (
      <div className="classroom-page classroom-page__notice">
        <h1>{intl.formatMessage(messages[words.title])}</h1>
        <p>{intl.formatMessage(messages[words.body])}</p>
        <Button variant="outline-primary" onClick={onLeave}>
          {intl.formatMessage(messages.backToClasses)}
        </Button>
      </div>
    );
  }

  if (joinRejected) {
    return (
      <div className="classroom-page classroom-page__notice">
        <h1>{intl.formatMessage(messages.couldNotJoin)}</h1>
        {error && <p>{error}</p>}
        <Button variant="outline-primary" onClick={onLeave}>
          {intl.formatMessage(messages.backToClasses)}
        </Button>
      </div>
    );
  }

  return (
    <div className="classroom-page">
      <Head title={state?.name ?? intl.formatMessage(messages.pageTitle)} />

      <header ref={headerRef} className={`classroom-page__header${headerHidden ? ' classroom-page__header--hidden' : ''}`}>
        <div className="classroom-page__head">
          <div className="classroom-page__title">
            <h1 lang="bo">{title.main}</h1>
            {subtitle && <p className="classroom-page__subtitle" lang="en">{subtitle}</p>}
          </div>

          {/* Who is here, over the controls: they are about the same thing, the room as it is
              now, and sit together at the right. */}
          <div className="classroom-page__side">
            {/* Whose class this is, and who is here: the teacher's to know. A student is told
                neither, and is not shown how many others are in the class. */}
            {teaching && (
              <div className="classroom-page__status-row classroom-page__status-row--teaching">
                <span className="classroom-page__pill">{intl.formatMessage(messages.roleTeacher)}</span>
                <p className="classroom-page__meta">
                  <span
                    className={`classroom-page__status ${connected ? 'classroom-page__status--live' : ''}`}
                    aria-hidden="true"
                  />
                  {connected
                    ? intl.formatMessage(messages.present, {
                      count: state?.participantCount ?? 1,
                    })
                    : intl.formatMessage(messages.connecting)}
                </p>
              </div>
            )}

            <div className="classroom-page__controls">
              {outline.length > 0 && (
                <Contents
                  outline={outline}
                  onJump={jumpTo}
                  currentSegmentId={state?.currentSegmentId ?? null}
                  order={order}
                />
              )}
              {notesOn && (
              <Button
                variant="tertiary"
                size="sm"
                className="classroom-notes-button"
                aria-label={intl.formatMessage(messages.notesButton)}
                title={intl.formatMessage(messages.notesButton)}
                onClick={openPanel}
              >
                <NotesIcon />
              </Button>
              )}
              <ReadingOptions
                view={view}
                onView={chooseView}
                layout={layout}
                onLayout={chooseLayout}
                textSize={textSize}
                onTextSize={chooseTextSize}
                hasTranslation={hasTranslation}
                hasOutline={outline.length > 0}
                sectionTitles={sectionTitles}
                onSectionTitles={chooseSectionTitles}
              />
              {/* One button for everything a teacher does to the class, in place of a badge
                and two buttons: the header is for reading, and was crowded. */}
              {teaching && (
              <ClassMenu
                onManage={openManage}
                confirmingEnd={confirmingEnd}
                onAskEnd={askEnd}
                onCancelEnd={cancelEnd}
                onEnd={() => { cancelEnd(); endSession(); }}
              />
              )}
              {/* Following and leaving, for a student, behind one button like the teacher's. */}
              {!teaching && (
              <StudentClassMenu
                follow={follow}
                followDisabled={sessionOver}
                onFollow={setFollow}
                onLeave={askLeave}
              />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Told, not sent away: the reader and the notes stay, and only the teacher's lead stops. */}
      {sessionOver && (
        <div className="classroom-page__waiting classroom-page__ended" role="status">
          <span>{intl.formatMessage(messages.sessionOverBanner)}</span>
          <Button variant="link" size="sm" className="classroom-page__ended-back" onClick={onLeave}>
            {intl.formatMessage(messages.backToClasses)}
          </Button>
        </div>
      )}

      {state && !teaching && !sessionOver && !state.teacherHere && (
        <p className="classroom-page__waiting" role="status">
          {intl.formatMessage(messages.waitingForTeacher)}
        </p>
      )}

      {(error || text.error) && (
        <p className="classroom-page__error">{error ?? text.error}</p>
      )}

      <main className="classroom-page__text">
        {text.loading && <p>{intl.formatMessage(messages.loadingText)}</p>}
        {!text.loading && text.lines.length > 0 && (
          <Reader
            lines={text.lines}
            currentSegmentId={state?.currentSegmentId ?? null}
            // Pressing a line moves the class there and brings it to the middle of the screen, as the
            // Next and Previous buttons do, so the line the class is on is always the one in focus.
            onPick={teaching ? (segmentId) => jumpTo(segmentId, true) : undefined}
            follow={follow && !teaching && !sessionOver}
            paused={notesBusy}
            view={view}
            layout={layout}
            textSize={textSize}
            headings={sectionTitles ? headings : undefined}
            jump={jump}
            marks={notesOn ? marks : undefined}
            onMarkOpen={notesOn ? (id) => setDialog({ kind: 'edit', id }) : undefined}
          />
        )}
        {!text.loading && text.lines.length === 0 && !text.error && (
          <p>{intl.formatMessage(messages.waiting)}</p>
        )}
      </main>

      {teaching && text.lines.length > 0 && (
        <LineStepper
          hasPrevious={currentIndex > 0}
          hasNext={currentIndex < text.lines.length - 1}
          onPrevious={() => step(-1)}
          onNext={() => step(1)}
        />
      )}

      {!teaching && text.lines.length > 0 && (
        <SyncButton
          live={Boolean(state?.teacherHere) && !sessionOver}
          ended={sessionOver}
          disabled={sessionOver || !state?.currentSegmentId}
          onSync={() => { if (state?.currentSegmentId) { jumpTo(state.currentSegmentId, true); } }}
        />
      )}

      {notesOn && selection && !dialog && (
        <SelectionBar
          selection={selection}
          busy={savingHighlight}
          onColor={highlight}
          onNote={() => setDialog({ kind: 'new', selection })}
        />
      )}
      {notesOn && highlightError && (
        <p className="classroom-page__error classroom-note-toast" role="alert">{highlightError}</p>
      )}

      {notesOn && dialog?.kind === 'new' && (
        <NoteDialog
          isOpen
          isNew
          quote={dialog.selection.anchor.quote}
          layer={dialog.selection.layer}
          initialColor="yellow"
          initialBody=""
          onSave={saveNote}
          onClose={() => setDialog(null)}
        />
      )}
      {notesOn && editing && (
        <NoteDialog
          isOpen
          isNew={false}
          quote={editing.quote}
          layer={editing.layer}
          initialColor={editing.color}
          initialBody={editing.body ?? ''}
          onSave={saveNote}
          onDelete={async () => { await noteStore.remove(editing.id); setDialog(null); }}
          onClose={() => setDialog(null)}
        />
      )}
      {notesOn && (
        <NotesPanel
          isOpen={panelOpen}
          notes={noteStore.notes}
          loading={noteStore.loading}
          error={noteStore.error}
          order={order}
          detached={detached}
          onClose={closePanel}
          onGoTo={(segmentId) => setJump((previous) => ({ segmentId, n: (previous?.n ?? 0) + 1 }))}
          onEdit={(id) => { closePanel(); setDialog({ kind: 'edit', id }); }}
        />
      )}

      {teaching && (
        <ManageClass
          code={code}
          isOpen={managing}
          onClose={closeManage}
          // Left open on a changed code: the new one is what the teacher came to read off.
          onCodeChanged={onCodeChanged}
          onArchived={() => { closeManage(); forgetSession(); onLeave(); }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmingLeave}
        title={intl.formatMessage(messages.leaveTitle)}
        confirmLabel={intl.formatMessage(messages.leaveClass)}
        onConfirm={leaveForGood}
        onCancel={cancelLeave}
      >
        <p>{intl.formatMessage(messages.leaveBody)}</p>
        {leaveFailed && <p role="alert" className="classroom-confirm__error">{intl.formatMessage(messages.leaveFailed)}</p>}
      </ConfirmDialog>
    </div>
  );
};

/**
 * The classroom: a list of your classes, and the live class itself.
 *
 * Needs the Academy login (the route is wrapped in `AuthenticatedPageRoute`, which sends
 * a logged-out visitor to log in and brings them back). Everything about *who you are* and
 * *whether you teach this class* comes from that login, checked by the server.
 */
const ClassroomPage = () => {
  const intl = useIntl();
  const params = new URLSearchParams(window.location.search);
  const initialCode = params.get('room') ?? '';
  const startMode = params.get('teach') === '1';
  // Resume the class this browser was in, so a refresh does not send anyone back to the
  // list of classes mid-lesson.
  const [code, setCode] = useState<string | null>(
    () => pickSession(window.location.search, recallSession())?.code ?? null,
  );

  const enter = (next: string) => {
    rememberSession({ code: next });
    // The address then names the class, so a refresh (or a copied link) comes back to
    // it. Replaced rather than pushed, so Back still leaves the page. Only the code that
    // is already written on the board goes here: never the teacher's password.
    window.history.replaceState(null, '', `${window.location.pathname}?room=${next}`);
    setCode(next);
  };

  const leave = () => {
    forgetSession();
    window.history.replaceState(null, '', window.location.pathname);
    setCode(null);
  };

  if (!code) {
    return (
      <>
        <Head title={intl.formatMessage(messages.pageTitle)} />
        <JoinScreen
          initialCode={initialCode.toUpperCase()}
          startMode={startMode}
          onEnter={enter}
        />
      </>
    );
  }

  return <Classroom code={code} onLeave={leave} onCodeChanged={enter} />;
};

export default ClassroomPage;
