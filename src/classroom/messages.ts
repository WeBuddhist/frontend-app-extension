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
  nameLabel: {
    id: 'extension.classroom.nameLabel',
    defaultMessage: 'Your name',
    description: 'Label for the display name field.',
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
    defaultMessage: '{count, plural, one {# person} other {# people}} here',
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
  teacherPrompt: {
    id: 'extension.classroom.teacherPrompt',
    defaultMessage: 'Teaching today?',
    description: 'Label before the link to the teacher screen.',
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
  recoveryLabel: {
    id: 'extension.classroom.recoveryLabel',
    defaultMessage: 'Recovery code',
    description: 'Label for the host token.',
  },
  recoveryHelp: {
    id: 'extension.classroom.recoveryHelp',
    defaultMessage: 'Shown once. If this browser forgets the room, or you switch device, this is what gets you back in control.',
    description: 'Why the recovery code matters.',
  },
  openText: {
    id: 'extension.classroom.openText',
    defaultMessage: 'Open the text',
    description: 'Button that enters the classroom as the teacher.',
  },
  // -- taking back control -----------------------------------------------
  resumeHeading: {
    id: 'extension.classroom.resumeHeading',
    defaultMessage: 'Take back control',
    description: 'Heading of the screen that restores a teacher.',
  },
  resumeSub: {
    id: 'extension.classroom.resumeSub',
    defaultMessage: 'Use the recovery code you were shown when the class was created.',
    description: 'Subtitle on the take-back-control screen.',
  },
  resumeLink: {
    id: 'extension.classroom.resumeLink',
    defaultMessage: 'Take back control',
    description: 'Link to the screen that restores a teacher.',
  },
  alreadyRunning: {
    id: 'extension.classroom.alreadyRunning',
    defaultMessage: 'Already running a class?',
    description: 'Label before the take-back-control link.',
  },
  resume: {
    id: 'extension.classroom.resume',
    defaultMessage: 'Resume teaching',
    description: 'Button that restores the teacher.',
  },
  checking: {
    id: 'extension.classroom.checking',
    defaultMessage: 'Checking…',
    description: 'Shown while a recovery code is verified.',
  },
  classEnded: {
    id: 'extension.classroom.classEnded',
    defaultMessage: 'This class has ended',
    description: 'Heading shown once the teacher ends the class.',
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
  endClass: {
    id: 'extension.classroom.endClass',
    defaultMessage: 'End class',
    description: 'Button the teacher uses to end the class for everyone.',
  },
  teaching: {
    id: 'extension.classroom.teaching',
    defaultMessage: 'You are teaching this class',
    description: 'Shown to the teacher, who holds the host token.',
  },
});

export default messages;
