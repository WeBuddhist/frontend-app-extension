import { defineMessages } from '@edx/frontend-platform/i18n';

const messages = defineMessages({
  pageTitle: {
    id: 'extension.classroom.pageTitle',
    defaultMessage: 'Classroom',
    description: 'Classroom page title.',
  },
  heading: {
    id: 'extension.classroom.heading',
    defaultMessage: 'Join a class',
    description: 'Heading of the classroom join screen.',
  },
  codeLabel: {
    id: 'extension.classroom.codeLabel',
    defaultMessage: 'Room code',
    description: 'Label for the room code the teacher writes on the whiteboard.',
  },
  codeHelp: {
    id: 'extension.classroom.codeHelp',
    defaultMessage: 'Six letters and numbers, from your teacher.',
    description: 'Help text under the room code field.',
  },
  join: {
    id: 'extension.classroom.join',
    defaultMessage: 'Join',
    description: 'Button that joins a classroom.',
  },
  connecting: {
    id: 'extension.classroom.connecting',
    defaultMessage: 'Connecting…',
    description: 'Shown while the socket connects.',
  },
  present: {
    id: 'extension.classroom.present',
    defaultMessage: '{count} online',
    description: 'How many people are in the room.',
  },
  waiting: {
    id: 'extension.classroom.waiting',
    defaultMessage: 'Waiting for the teacher to begin.',
    description: 'Shown before the teacher has moved the class to a line.',
  },
  loadingText: {
    id: 'extension.classroom.loadingText',
    defaultMessage: 'Loading the text…',
    description: 'Shown while the text is fetched from the library.',
  },
  // -- starting a class ------------------------------------------------
  startHeading: {
    id: 'extension.classroom.startHeading',
    defaultMessage: 'Start a class',
    description: 'Heading of the teacher screen that creates a room.',
  },
  startSub: {
    id: 'extension.classroom.startSub',
    defaultMessage: 'Students will join with the code you get next.',
    description: 'Subtitle on the start-a-class screen.',
  },
  startLink: {
    id: 'extension.classroom.startLink',
    defaultMessage: 'Start a class',
    description: 'Link from the join screen to the teacher screen.',
  },
  searchLabel: {
    id: 'extension.classroom.searchLabel',
    defaultMessage: 'Find a text',
    description: 'Label for the library search field.',
  },
  searchHelp: {
    id: 'extension.classroom.searchHelp',
    defaultMessage: 'Search the library by title.',
    description: 'Help text under the library search field.',
  },
  searching: {
    id: 'extension.classroom.searching',
    defaultMessage: 'Searching…',
    description: 'Shown while the library is being searched.',
  },
  noTexts: {
    id: 'extension.classroom.noTexts',
    defaultMessage: 'No texts match that title.',
    description: 'Shown when a library search returns nothing.',
  },
  hostPasswordLabel: {
    id: 'extension.classroom.hostPasswordLabel',
    defaultMessage: 'Host password',
    description: 'Label for the shared password that permits creating a room.',
  },
  start: {
    id: 'extension.classroom.start',
    defaultMessage: 'Start',
    description: 'Button that creates the room.',
  },
  starting: {
    id: 'extension.classroom.starting',
    defaultMessage: 'Starting…',
    description: 'Shown on the start button while the room is created.',
  },
  // -- the room is ready -------------------------------------------------
  readyHeading: {
    id: 'extension.classroom.readyHeading',
    defaultMessage: 'Your class is ready',
    description: 'Heading shown once a room has been created.',
  },
  readySub: {
    id: 'extension.classroom.readySub',
    defaultMessage: 'Write this code on the board.',
    description: 'Instruction above the room code.',
  },
  openText: {
    id: 'extension.classroom.openText',
    defaultMessage: 'Open the text',
    description: 'Button that enters the classroom as the teacher.',
  },
  // -- taking back control -----------------------------------------------
  follow: {
    id: 'extension.classroom.follow',
    defaultMessage: 'Follow the teacher',
    description: 'Toggle that scrolls the reader to the line the class is on.',
  },
  couldNotJoin: {
    id: 'extension.classroom.couldNotJoin',
    defaultMessage: 'Could not join',
    description: 'Heading shown when the room code is refused.',
  },
  back: {
    id: 'extension.classroom.back',
    defaultMessage: 'Back',
    description: 'Button returning to the join screen.',
  },
  viewSource: {
    id: 'extension.classroom.view.source',
    defaultMessage: 'Source',
    description: 'View option: show only the original text.',
  },
  viewTranslation: {
    id: 'extension.classroom.view.translation',
    defaultMessage: 'Translation',
    description: 'View option: show only the translation.',
  },
  viewBoth: {
    id: 'extension.classroom.view.both',
    defaultMessage: 'Source with Translation',
    description: 'View option: show the original text with its translation beneath.',
  },
  syncWithTeacher: {
    id: 'extension.classroom.sync',
    defaultMessage: 'Sync with teacher',
    description: 'Button that takes a student to the line the class is on.',
  },
  liveLabel: {
    id: 'extension.classroom.live',
    defaultMessage: 'Live',
    description: 'Label on the pill that takes a student to the teacher\'s line.',
  },
  sessionOverBanner: {
    id: 'extension.classroom.sessionOver',
    defaultMessage: 'The teacher has ended today\'s session. You can keep reading and reviewing your notes.',
    description: 'Shown to a student who stays in the class after the teacher ends the session.',
  },
  endedLabel: {
    id: 'extension.classroom.endedLabel',
    defaultMessage: 'Ended',
    description: 'Label on the pill once the teacher has ended the session.',
  },
  syncEndedHint: {
    id: 'extension.classroom.sync.endedHint',
    defaultMessage: 'The session has ended.',
    description: 'Tooltip on the pill once the teacher has ended the session.',
  },
  syncLiveHint: {
    id: 'extension.classroom.sync.liveHint',
    defaultMessage: 'The teacher is live. Go to their line.',
    description: 'Tooltip on the Live pill while the teacher is in the class.',
  },
  syncOfflineHint: {
    id: 'extension.classroom.sync.offlineHint',
    defaultMessage: 'The teacher is not here right now. Go to the last line.',
    description: 'Tooltip on the Live pill while the teacher is away.',
  },
  stepperLabel: {
    id: 'extension.classroom.stepper.label',
    defaultMessage: 'Move the class',
    description: 'Accessible name of the floating buttons that move the class a line at a time.',
  },
  previousLine: {
    id: 'extension.classroom.stepper.previous',
    defaultMessage: 'Previous line',
    description: 'Button: take the class back one line.',
  },
  nextLine: {
    id: 'extension.classroom.stepper.next',
    defaultMessage: 'Next line',
    description: 'Button: take the class on one line.',
  },
  sizeHeading: {
    id: 'extension.classroom.size.heading',
    defaultMessage: 'Text size',
    description: 'Heading above the choice of how large the text is.',
  },
  sizeSmall: {
    id: 'extension.classroom.size.small',
    defaultMessage: 'Small',
    description: 'Text size: smaller than usual.',
  },
  sizeMedium: {
    id: 'extension.classroom.size.medium',
    defaultMessage: 'Medium',
    description: 'Text size: the usual one.',
  },
  sizeLarge: {
    id: 'extension.classroom.size.large',
    defaultMessage: 'Large',
    description: 'Text size: larger than usual.',
  },
  sizeXLarge: {
    id: 'extension.classroom.size.xlarge',
    defaultMessage: 'Extra large',
    description: 'Text size: the largest.',
  },
  layoutHeading: {
    id: 'extension.classroom.layout.heading',
    defaultMessage: 'Layout',
    description: 'Heading above the choice between prose and segmented layout.',
  },
  layoutProse: {
    id: 'extension.classroom.layout.prose',
    defaultMessage: 'Prose',
    description: 'Layout option: lines run together as continuous text.',
  },
  layoutSegmented: {
    id: 'extension.classroom.layout.segmented',
    defaultMessage: 'Segmented',
    description: 'Layout option: each line set on its own.',
  },
  viewHeading: {
    id: 'extension.classroom.view.heading',
    defaultMessage: 'Show',
    description: 'Heading above the choice between source, translation and both.',
  },
  settingsLabel: {
    id: 'extension.classroom.settings.label',
    defaultMessage: 'Reading options',
    description: 'Accessible name of the button that opens the reading options menu.',
  },
  tocHeading: {
    id: 'extension.classroom.toc.heading',
    defaultMessage: 'Table of Contents',
    description: 'Heading above the choice to show or hide section titles in the text.',
  },
  tocShow: {
    id: 'extension.classroom.toc.show',
    defaultMessage: 'Show',
    description: 'Option: draw section titles into the text.',
  },
  tocHide: {
    id: 'extension.classroom.toc.hide',
    defaultMessage: 'Hide',
    description: 'Option: leave section titles out of the text.',
  },
  contents: {
    id: 'extension.classroom.contents',
    defaultMessage: 'Table of Contents',
    description: 'Accessible name of the menu that jumps to a section of the text.',
  },
  viewLabel: {
    id: 'extension.classroom.view.label',
    defaultMessage: 'Choose what to show',
    description: 'Accessible name of the menu that chooses between source and translation.',
  },
  // -- your classes ------------------------------------------------------
  yourClasses: {
    id: 'extension.classroom.yourClasses',
    defaultMessage: 'Your classes',
    description: 'Heading above the list of classes this account is in.',
  },
  noClasses: {
    id: 'extension.classroom.noClasses',
    defaultMessage: 'You are not in any classes yet. Enter the code your teacher gave you below.',
    description: 'Shown when the account is in no classes.',
  },
  loadingClasses: {
    id: 'extension.classroom.loadingClasses',
    defaultMessage: 'Loading your classes…',
    description: 'Shown while the list of classes loads.',
  },
  roleTeacher: {
    id: 'extension.classroom.roleTeacher',
    defaultMessage: 'Teaching',
    description: 'Badge on a class this account teaches.',
  },
  roleStudent: {
    id: 'extension.classroom.roleStudent',
    defaultMessage: 'Student',
    description: 'Badge on a class this account is a student in.',
  },
  memberCount: {
    id: 'extension.classroom.memberCount',
    defaultMessage: '{count, plural, one {# member} other {# members}}',
    description: 'How many people are in a class.',
  },
  joinOnce: {
    id: 'extension.classroom.joinOnce',
    defaultMessage: 'You only need the code once. After that the class stays in your list.',
    description: 'Reassurance under the code field.',
  },
  joining: {
    id: 'extension.classroom.joining',
    defaultMessage: 'Joining…',
    description: 'Shown on the join button while joining.',
  },
  startFromList: {
    id: 'extension.classroom.startFromList',
    defaultMessage: 'Teaching?',
    description: 'Lead-in to the link that starts a class.',
  },
  classNameLabel: {
    id: 'extension.classroom.classNameLabel',
    defaultMessage: 'Class name',
    description: 'Label for the name a teacher gives the class.',
  },
  classNameHelp: {
    id: 'extension.classroom.classNameHelp',
    defaultMessage: 'Shown in each student\'s list. Leave it blank to use the text\'s title.',
    description: 'Help for the class name field.',
  },
  readyKeep: {
    id: 'extension.classroom.readyKeep',
    defaultMessage: 'Students join once with this code, and the class stays in their list. You will find it under Your classes too.',
    description: 'Explains that the code is needed once.',
  },
  // -- inside a class ----------------------------------------------------
  waitingForTeacher: {
    id: 'extension.classroom.waitingForTeacher',
    defaultMessage: 'Waiting for the teacher to arrive. You can read ahead in the meantime.',
    description: 'Shown to a student while the teacher is not connected.',
  },
  endSession: {
    id: 'extension.classroom.endSession',
    defaultMessage: 'End session',
    description: 'Button the teacher uses to end today\'s session. The class stays.',
  },
  sessionEndedTitle: {
    id: 'extension.classroom.sessionEndedTitle',
    defaultMessage: 'Today\'s session has ended',
    description: 'Heading shown when the teacher ends the session.',
  },
  sessionEndedBody: {
    id: 'extension.classroom.sessionEndedBody',
    defaultMessage: 'The class is still in your list, and it will be here next time.',
    description: 'Explains that ending a session does not end the class.',
  },
  archivedTitle: {
    id: 'extension.classroom.archivedTitle',
    defaultMessage: 'This class has been archived',
    description: 'Heading shown when the teacher archives the class.',
  },
  archivedBody: {
    id: 'extension.classroom.archivedBody',
    defaultMessage: 'It is over, and has left your list.',
    description: 'Explains what archiving means for a student.',
  },
  leftTitle: {
    id: 'extension.classroom.leftTitle',
    defaultMessage: 'You left this class',
    description: 'Heading shown when this account left the class (for example from another tab).',
  },
  leftBody: {
    id: 'extension.classroom.leftBody',
    defaultMessage: 'It is still in your list, and you can rejoin it from there without the code.',
    description: 'Explains that a class you left can be rejoined.',
  },
  removedTitle: {
    id: 'extension.classroom.removedTitle',
    defaultMessage: 'You are no longer in this class',
    description: 'Heading shown when the teacher removes a member.',
  },
  removedBody: {
    id: 'extension.classroom.removedBody',
    defaultMessage: 'The teacher removed you. If that was a mistake, ask them for the class code.',
    description: 'Explains a removal.',
  },
  backToClasses: {
    id: 'extension.classroom.backToClasses',
    defaultMessage: 'Back to your classes',
    description: 'Button that returns to the list of classes.',
  },
  // -- managing a class --------------------------------------------------
  manage: {
    id: 'extension.classroom.manage',
    defaultMessage: 'Manage class',
    description: 'Button that opens the teacher\'s tools.',
  },
  manageHeading: {
    id: 'extension.classroom.manageHeading',
    defaultMessage: 'Manage this class',
    description: 'Heading of the teacher\'s tools.',
  },
  codeSection: {
    id: 'extension.classroom.codeSection',
    defaultMessage: 'Class code',
    description: 'Heading of the section that shows and changes the code.',
  },
  changeCode: {
    id: 'extension.classroom.changeCode',
    defaultMessage: 'Change the code',
    description: 'Button that gives the class a new code.',
  },
  changeCodeHelp: {
    id: 'extension.classroom.changeCodeHelp',
    defaultMessage: 'Everyone already in the class stays in. Anyone who has not joined yet will need the new code.',
    description: 'Explains what changing the code does.',
  },
  membersHeading: {
    id: 'extension.classroom.membersHeading',
    defaultMessage: 'Members',
    description: 'Heading of the member list.',
  },
  loadingMembers: {
    id: 'extension.classroom.loadingMembers',
    defaultMessage: 'Loading members…',
    description: 'Shown while the member list loads.',
  },
  removeMember: {
    id: 'extension.classroom.removeMember',
    defaultMessage: 'Remove',
    description: 'Button that removes a member from the class.',
  },
  removeMemberLabel: {
    id: 'extension.classroom.removeMemberLabel',
    defaultMessage: 'Remove {name} from the class',
    description: 'Accessible name of a remove button.',
  },
  removeHelp: {
    id: 'extension.classroom.removeHelp',
    defaultMessage: 'A removed member can rejoin with the code. To keep someone out for good, remove them and then change the code.',
    description: 'Explains the limits of removing a member.',
  },
  archiveClass: {
    id: 'extension.classroom.archiveClass',
    defaultMessage: 'Archive this class',
    description: 'Button that archives the class.',
  },
  archiveHelp: {
    id: 'extension.classroom.archiveHelp',
    defaultMessage: 'For when the course is over. No one can join, and it leaves everyone\'s list. This cannot be undone.',
    description: 'Explains what archiving does.',
  },
  archiveConfirm: {
    id: 'extension.classroom.archiveConfirm',
    defaultMessage: 'Yes, archive it',
    description: 'Button that confirms archiving.',
  },
  cancel: {
    id: 'extension.classroom.cancel',
    defaultMessage: 'Cancel',
    description: 'Button that backs out of a confirmation.',
  },
  close: {
    id: 'extension.classroom.close',
    defaultMessage: 'Close',
    description: 'Button that closes a dialog.',
  },
  // -- notes (students only, for now) ----------------------------------
  notesButton: {
    id: 'extension.classroom.notes.button',
    defaultMessage: 'My notes',
    description: 'Accessible name of the button that opens the list of my notes.',
  },
  notesHeading: {
    id: 'extension.classroom.notes.heading',
    defaultMessage: 'My notes',
    description: 'Heading of the list of a student\'s notes.',
  },
  notesPrivate: {
    id: 'extension.classroom.notes.private',
    defaultMessage: 'Only you can see your notes.',
    description: 'Reassurance that notes are private.',
  },
  notesEmpty: {
    id: 'extension.classroom.notes.empty',
    defaultMessage: 'You have no notes yet. Select some words in the text to highlight them or to add a note.',
    description: 'Shown when a student has made no notes.',
  },
  notesLoading: {
    id: 'extension.classroom.notes.loading',
    defaultMessage: 'Loading your notes…',
    description: 'Shown while notes load.',
  },
  selectionLabel: {
    id: 'extension.classroom.notes.selectionLabel',
    defaultMessage: 'Highlight or note the selected words',
    description: 'Accessible name of the bar that appears over selected text.',
  },
  highlightColor: {
    id: 'extension.classroom.notes.highlightColor',
    defaultMessage: 'Highlight in {color}',
    description: 'Accessible name of a colour button that highlights the selection.',
  },
  colorYellow: { id: 'extension.classroom.notes.colorYellow', defaultMessage: 'yellow', description: 'A highlight colour.' },
  colorGreen: { id: 'extension.classroom.notes.colorGreen', defaultMessage: 'green', description: 'A highlight colour.' },
  colorBlue: { id: 'extension.classroom.notes.colorBlue', defaultMessage: 'blue', description: 'A highlight colour.' },
  colorPink: { id: 'extension.classroom.notes.colorPink', defaultMessage: 'pink', description: 'A highlight colour.' },
  addNote: {
    id: 'extension.classroom.notes.add',
    defaultMessage: 'Add note',
    description: 'Button that adds a note to the selected words.',
  },
  noteDialogNew: {
    id: 'extension.classroom.notes.dialogNew',
    defaultMessage: 'Add a note',
    description: 'Heading when making a note.',
  },
  noteDialogEdit: {
    id: 'extension.classroom.notes.dialogEdit',
    defaultMessage: 'Your note',
    description: 'Heading when looking at or changing a note.',
  },
  noteColorLabel: {
    id: 'extension.classroom.notes.colorLabel',
    defaultMessage: 'Colour',
    description: 'Label for the colour of a highlight.',
  },
  noteBodyLabel: {
    id: 'extension.classroom.notes.bodyLabel',
    defaultMessage: 'Your note',
    description: 'Label for the text of a note.',
  },
  noteBodyHelp: {
    id: 'extension.classroom.notes.bodyHelp',
    defaultMessage: 'Leave it empty to keep just the highlight.',
    description: 'Explains that a note can be a highlight alone.',
  },
  saveNote: {
    id: 'extension.classroom.notes.save',
    defaultMessage: 'Save',
    description: 'Button that saves a note.',
  },
  saving: {
    id: 'extension.classroom.notes.saving',
    defaultMessage: 'Saving…',
    description: 'Shown on the save button while saving.',
  },
  deleteNote: {
    id: 'extension.classroom.notes.delete',
    defaultMessage: 'Delete',
    description: 'Button that deletes a note.',
  },
  goToNote: {
    id: 'extension.classroom.notes.goTo',
    defaultMessage: 'Go to line',
    description: 'Button that scrolls to the line a note is on.',
  },
  editNote: {
    id: 'extension.classroom.notes.edit',
    defaultMessage: 'Edit',
    description: 'Button that edits a note.',
  },
  textChanged: {
    id: 'extension.classroom.notes.textChanged',
    defaultMessage: 'The text here has changed, so this note can no longer be placed.',
    description: 'Shown on a note whose words are no longer in the text.',
  },
  classMenu: {
    id: 'extension.classroom.classMenu',
    defaultMessage: 'Class',
    description: 'Button that opens the teacher\'s menu for the class.',
  },
  leaveClass: {
    id: 'extension.classroom.leaveClass',
    defaultMessage: 'Leave class',
    description: 'Button a student uses to leave the class.',
  },
  leaveTitle: {
    id: 'extension.classroom.leaveTitle',
    defaultMessage: 'Leave this class?',
    description: 'Question asked before a student leaves a class.',
  },
  leaveBody: {
    id: 'extension.classroom.leaveBody',
    defaultMessage: "You'll leave this class, and your notes here are kept. It stays in your list, so you can rejoin any time without the code.",
    description: 'Explains what leaving a class does.',
  },
  followHint: {
    id: 'extension.classroom.followHint',
    defaultMessage: 'Your reading moves with the class',
    description: 'Explains the follow-the-teacher menu item.',
  },
  leaveHint: {
    id: 'extension.classroom.leaveHint',
    defaultMessage: 'Your notes are kept',
    description: 'Explains the leave-class menu item.',
  },
  classesCount: {
    id: 'extension.classroom.classesCount',
    defaultMessage: '{count, plural, one {# class} other {# classes}}',
    description: 'How many classes are in the list, under the heading.',
  },
  lastOpened: {
    id: 'extension.classroom.lastOpened',
    defaultMessage: 'Opened {date}',
    description: 'When a class was last opened by this account.',
  },
  youTeach: {
    id: 'extension.classroom.youTeach',
    defaultMessage: "You're the teacher",
    description: 'Label on a class in your list that you teach.',
  },
  continueTeaching: {
    id: 'extension.classroom.continueTeaching',
    defaultMessage: 'Continue teaching',
    description: 'What pressing a class you teach does.',
  },
  classesYouTeach: {
    id: 'extension.classroom.classesYouTeach',
    defaultMessage: 'Classes you teach',
    description: 'Heading over the classes the account teaches.',
  },
  classesYouJoined: {
    id: 'extension.classroom.classesYouJoined',
    defaultMessage: 'Classes you joined',
    description: 'Heading over the classes the account is a student in, when it also teaches.',
  },
  haveCode: {
    id: 'extension.classroom.haveCode',
    defaultMessage: 'Have a code from a teacher?',
    description: 'Prompt beside the link that opens the join form.',
  },
  joinWithCode: {
    id: 'extension.classroom.joinWithCode',
    defaultMessage: 'Join a class',
    description: 'Link that opens the join-with-a-code form.',
  },
  startAnother: {
    id: 'extension.classroom.startAnother',
    defaultMessage: 'Start another class',
    description: 'Link, for someone who already teaches a class, to start a new one.',
  },
  leftRejoin: {
    id: 'extension.classroom.leftRejoin',
    defaultMessage: 'You left · Rejoin',
    description: 'Shown on a class in your list that you left; pressing it rejoins.',
  },
  leaveFailed: {
    id: 'extension.classroom.leaveFailed',
    defaultMessage: 'Could not leave the class. Please try again.',
    description: 'Shown when leaving a class fails.',
  },
  endSessionTitle: {
    id: 'extension.classroom.endSessionTitle',
    defaultMessage: 'End today\'s session?',
    description: 'Question asked before ending a session.',
  },
  endSessionBody: {
    id: 'extension.classroom.endSessionBody',
    defaultMessage: 'Everyone goes back to their list of classes. The class stays, and so does everyone\'s place in it, so you can start again any time.',
    description: 'Explains what ending a session does.',
  },
  manageHint: {
    id: 'extension.classroom.manageHint',
    defaultMessage: 'Members, the class code, archiving',
    description: 'Explains what the Manage class menu item opens.',
  },
  endSessionHint: {
    id: 'extension.classroom.endSessionHint',
    defaultMessage: 'Send everyone back to their classes',
    description: 'Explains what the End session menu item does.',
  },
  tabMembers: {
    id: 'extension.classroom.manage.tabMembers',
    defaultMessage: 'Members',
    description: 'Tab that lists the people in the class.',
  },
  tabCode: {
    id: 'extension.classroom.manage.tabCode',
    defaultMessage: 'Class code',
    description: 'Tab that shows and changes the class code.',
  },
  tabDates: {
    id: 'extension.classroom.manage.tabDates',
    defaultMessage: 'Dates',
    description: 'Tab for saying when the class is held.',
  },
  datesHeading: {
    id: 'extension.classroom.dates.heading',
    defaultMessage: 'When the class is held',
    description: 'Heading over the start and end dates.',
  },
  datesHelp: {
    id: 'extension.classroom.dates.help',
    defaultMessage: 'Shown to everyone in the class. It does not close the class: archiving is still up to you.',
    description: 'Explains the class dates.',
  },
  startsLabel: {
    id: 'extension.classroom.dates.starts',
    defaultMessage: 'First day (optional)',
    description: 'Label for the date a class starts.',
  },
  endsLabel: {
    id: 'extension.classroom.dates.ends',
    defaultMessage: 'Last day (optional)',
    description: 'Label for the date a class ends.',
  },
  datesOutOfOrder: {
    id: 'extension.classroom.dates.outOfOrder',
    defaultMessage: 'The last day cannot be before the first day.',
    description: 'Shown when the end date is before the start date.',
  },
  saveDates: {
    id: 'extension.classroom.dates.save',
    defaultMessage: 'Save dates',
    description: 'Button that saves the class dates.',
  },
  datesSaved: {
    id: 'extension.classroom.dates.saved',
    defaultMessage: 'Dates saved.',
    description: 'Confirms the class dates were saved.',
  },
  datesRange: {
    id: 'extension.classroom.dates.range',
    defaultMessage: '{start} – {end}',
    description: 'A class held between two days.',
  },
  datesFrom: {
    id: 'extension.classroom.dates.from',
    defaultMessage: 'From {start}',
    description: 'A class with a first day and no last day.',
  },
  datesUntil: {
    id: 'extension.classroom.dates.until',
    defaultMessage: 'Until {end}',
    description: 'A class with a last day and no first day.',
  },
  datesUpcoming: {
    id: 'extension.classroom.dates.upcoming',
    defaultMessage: 'Starts {start}',
    description: 'A class that has not started yet.',
  },
  datesFinished: {
    id: 'extension.classroom.dates.finished',
    defaultMessage: 'Ended {end}',
    description: 'A class whose last day has passed.',
  },
  tabArchive: {
    id: 'extension.classroom.manage.tabArchive',
    defaultMessage: 'Archive',
    description: 'Tab for archiving the class.',
  },
  searchMembers: {
    id: 'extension.classroom.manage.searchMembers',
    defaultMessage: 'Search by name or username',
    description: 'Placeholder and label of the member search field.',
  },
  noMatches: {
    id: 'extension.classroom.manage.noMatches',
    defaultMessage: 'No one matches "{query}".',
    description: 'Shown when a member search finds no one.',
  },
  onlyYou: {
    id: 'extension.classroom.manage.onlyYou',
    defaultMessage: 'No one has joined yet. Share the code so students can.',
    description: 'Shown when the teacher is the only member.',
  },
  joinedOn: {
    id: 'extension.classroom.manage.joinedOn',
    defaultMessage: 'Joined {date}',
    description: 'When a member joined.',
  },
  removeQuestion: {
    id: 'extension.classroom.manage.removeQuestion',
    defaultMessage: 'Remove {name}?',
    description: 'Question asked before removing a member.',
  },
  removeYes: {
    id: 'extension.classroom.manage.removeYes',
    defaultMessage: 'Yes, remove',
    description: 'Button that confirms removing a member.',
  },
  copyCode: {
    id: 'extension.classroom.manage.copyCode',
    defaultMessage: 'Copy code',
    description: 'Button that copies the class code.',
  },
  codeCopied: {
    id: 'extension.classroom.manage.codeCopied',
    defaultMessage: 'Copied',
    description: 'Shown after the class code was copied.',
  },
  changeCodeQuestion: {
    id: 'extension.classroom.manage.changeCodeQuestion',
    defaultMessage: 'Change the code?',
    description: 'Question asked before the code is changed.',
  },
  changeCodeYes: {
    id: 'extension.classroom.manage.changeCodeYes',
    defaultMessage: 'Yes, change it',
    description: 'Button that confirms changing the code.',
  },
  codeChangedNotice: {
    id: 'extension.classroom.manage.codeChangedNotice',
    defaultMessage: 'The code is now {code}. Write the new one on the board.',
    description: 'Shown after the code was changed.',
  },
  archiveWarning: {
    id: 'extension.classroom.manage.archiveWarning',
    defaultMessage: 'Archiving cannot be undone.',
    description: 'Warning shown with the archive confirmation.',
  },
  contentsHeading: {
    id: 'extension.classroom.contentsHeading',
    defaultMessage: 'Table of Contents',
    description: 'Heading of the table of contents drawer.',
  },
  closeContents: {
    id: 'extension.classroom.closeContents',
    defaultMessage: 'Close contents',
    description: 'Accessible name of the button that closes the contents drawer.',
  },
  expandSection: {
    id: 'extension.classroom.contents.expandSection',
    defaultMessage: 'Show what is under {title}',
    description: 'Accessible name of a button that opens a section of the contents.',
  },
  collapseSection: {
    id: 'extension.classroom.contents.collapseSection',
    defaultMessage: 'Hide what is under {title}',
    description: 'Accessible name of a button that closes a section of the contents.',
  },
});

export default messages;
