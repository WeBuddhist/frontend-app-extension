/**
 * When a class is held, and where it is in that.
 *
 * Plain calendar days (`YYYY-MM-DD`), as the service stores them: no time and no zone, so a
 * course "from 12 March to 30 April" reads the same everywhere. "Today" is the reader's own day.
 */

export type Phase = 'upcoming' | 'running' | 'finished';

/** The reader's today as `YYYY-MM-DD`, in their own calendar. */
export const todayIso = (now: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** Before it starts, while it runs, or after it ends. Days compare as text, which is their order. */
export const phaseOf = (
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
  today: string = todayIso(),
): Phase => {
  if (startsOn && today < startsOn) { return 'upcoming'; }
  if (endsOn && today > endsOn) { return 'finished'; }
  return 'running';
};

/** A stored day as a date at local midnight, which is what the date formatter wants. */
export const dayOf = (iso: string): Date => new Date(`${iso}T00:00:00`);

/** Whether the two days are in order: a class cannot end before it starts. */
export const datesInOrder = (startsOn: string, endsOn: string): boolean => (
  !startsOn || !endsOn || endsOn >= startsOn
);
