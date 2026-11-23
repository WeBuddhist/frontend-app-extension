/**
 * What a reader shows of a text that has a translation.
 *
 * A personal choice, never synced: a student who wants the English only and a teacher
 * who wants both can sit in the same class. Only the segment id is shared, and it names
 * a line whichever way it is displayed.
 */

export type ViewMode = 'source' | 'translation' | 'both';

export const VIEW_MODES: ViewMode[] = ['source', 'translation', 'both'];

const STORAGE_KEY = 'classroom.view';

export const DEFAULT_VIEW: ViewMode = 'both';

/** Remembered per browser. Storage can be missing or throw (private windows), so the
 * page must work without it. */
export const recallView = (): ViewMode => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return VIEW_MODES.includes(stored as ViewMode) ? (stored as ViewMode) : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
};

export const rememberView = (view: ViewMode): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // Not remembering is fine; the choice still applies to this visit.
  }
};

/**
 * How the text is laid out. Segmented sets each line on its own, so a line is easy to
 * point at; prose runs the lines together as a book would. Personal and never synced,
 * like the view: the segment id marks the same line either way.
 */
export type LayoutMode = 'segmented' | 'prose';

export const LAYOUT_MODES: LayoutMode[] = ['segmented', 'prose'];

const LAYOUT_KEY = 'classroom.layout';

export const DEFAULT_LAYOUT: LayoutMode = 'segmented';

export const recallLayout = (): LayoutMode => {
  try {
    const stored = window.localStorage.getItem(LAYOUT_KEY);
    return LAYOUT_MODES.includes(stored as LayoutMode)
      ? (stored as LayoutMode)
      : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
};

export const rememberLayout = (layout: LayoutMode): void => {
  try {
    window.localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // Not remembering is fine; the choice still applies to this visit.
  }
};

/**
 * Whether section headings are drawn into the text where each section begins. Personal
 * and never synced. On by default: it is how a reader sees where they are.
 */
const TITLES_KEY = 'classroom.sectionTitles';

export const recallSectionTitles = (): boolean => {
  try {
    return window.localStorage.getItem(TITLES_KEY) !== 'hidden';
  } catch {
    return true;
  }
};

export const rememberSectionTitles = (shown: boolean): void => {
  try {
    window.localStorage.setItem(TITLES_KEY, shown ? 'shown' : 'hidden');
  } catch {
    // Not remembering is fine; the choice still applies to this visit.
  }
};

/**
 * Whether a student's own highlights are drawn in the text. Personal and never synced. On by
 * default; hidden, the text reads clean, and the notes are all still there in "My notes".
 */
const HIGHLIGHTS_KEY = 'classroom.highlights';

export const recallHighlights = (): boolean => {
  try {
    return window.localStorage.getItem(HIGHLIGHTS_KEY) !== 'hidden';
  } catch {
    return true;
  }
};

export const rememberHighlights = (shown: boolean): void => {
  try {
    window.localStorage.setItem(HIGHLIGHTS_KEY, shown ? 'shown' : 'hidden');
  } catch {
    // Not remembering is fine; the choice still applies to this visit.
  }
};

/**
 * How large the text is set. Personal and never synced: a reader across the room and a
 * reader on a phone want different sizes. Steps rather than a free slider, so there are
 * four sizes to talk about, and the middle one is what the page was designed at.
 */
export type TextSize = 'small' | 'medium' | 'large' | 'xlarge';

export const TEXT_SIZES: TextSize[] = ['small', 'medium', 'large', 'xlarge'];

/** What each step multiplies the reader's base size by. */
export const TEXT_SCALE: Record<TextSize, number> = {
  small: 0.88, medium: 1, large: 1.2, xlarge: 1.45,
};

export const DEFAULT_TEXT_SIZE: TextSize = 'medium';

const SIZE_KEY = 'classroom.textSize';

export const recallTextSize = (): TextSize => {
  try {
    const stored = window.localStorage.getItem(SIZE_KEY);
    return TEXT_SIZES.includes(stored as TextSize) ? (stored as TextSize) : DEFAULT_TEXT_SIZE;
  } catch {
    return DEFAULT_TEXT_SIZE;
  }
};

export const rememberTextSize = (size: TextSize): void => {
  try {
    window.localStorage.setItem(SIZE_KEY, size);
  } catch {
    // Not remembering is fine; the choice still applies to this visit.
  }
};
