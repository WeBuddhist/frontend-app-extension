/**
 * The icons for the header's buttons: one family, so they read as a set.
 *
 * All drawn the same way (a 24-unit box, a 1.8 stroke, round ends) and sized by their
 * props. Drawn here rather than imported from Paragon's icon barrel, one of whose icons threw
 * a webpack initialisation error (see `Contents.tsx`), and the set below is small.
 */

interface IconProps {
  /** Pixels. The header's buttons use 22. */
  size?: number;
}

const make = (paths: string[]) => function Icon({ size = 22 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
};

/** A bulleted list: the text's table of contents. */
export const ContentsIcon = make([
  'M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01',
]);

/** A large and a small letter A: how the text is shown. */
export const ReadingIcon = make([
  'M21 14h-5', 'M16 16v-3.5a2.5 2.5 0 0 1 5 0V16', 'M4.5 13h6', 'M3 16l4.5-9 4.5 9',
]);

/** A page with lines: my notes. */
export const NotesIcon = make([
  'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z',
  'M14 2v4a2 2 0 0 0 2 2h4',
  'M10 9H8', 'M16 13H8', 'M16 17H8',
]);

/** A downward chevron, for a button that opens a menu. */
export const ChevronIcon = make(['M6 9l6 6 6-6']);

/** A cross: close. */
export const CloseIcon = make(['M18 6L6 18', 'M6 6l12 12']);

/** An arrow leaving through a door frame: leave the class. */
export const LeaveIcon = make(['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9']);

/** An upward chevron: the previous line. */
export const ChevronUpIcon = make(['M18 15l-6-6-6 6']);

/** Two arrows chasing round, balanced about the centre of the box: catch up with the teacher. */
export const SyncIcon = make([
  'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8',
  'M21 3v5h-5',
  'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16',
  'M8 16H3v5',
]);
