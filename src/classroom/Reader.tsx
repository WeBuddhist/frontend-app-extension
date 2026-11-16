import { useEffect, useRef } from 'react';

import type { Line } from './text';

interface Props {
  lines: Line[];
  currentSegmentId: string | null;
  /** Set for the teacher. Clicking a line moves the whole class to it. */
  onPick?: (segmentId: string) => void;
  /** Whether to scroll the current line into view when it changes. */
  follow: boolean;
}

/**
 * The text, with the line the class is on marked.
 *
 * Scrolling is driven by the **segment id** changing, never by a position or an
 * offset. That is what makes one teacher's click land on the same line on a phone, a
 * tablet and a projector, at any font size.
 *
 * A teacher's line is a real `<button>` and a student's is a `<p>`. Not a lint
 * workaround: a line the teacher can press is a control, and a screen reader should
 * say so. A student's line is prose, and announcing it as a button would be a lie.
 */
const Reader = ({
  lines, currentSegmentId, onPick, follow,
}: Props) => {
  const currentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!follow || !currentSegmentId) { return; }
    currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentSegmentId, follow]);

  return (
    <div className="classroom-reader" lang="bo">
      {lines.map((line) => {
        const current = line.id === currentSegmentId;
        const className = [
          'classroom-reader__line',
          line.kind ? `classroom-reader__line--${line.kind}` : '',
          current ? 'classroom-reader__line--current' : '',
        ].filter(Boolean).join(' ');

        if (onPick) {
          return (
            <button
              key={line.id}
              type="button"
              ref={(node) => { if (current) { currentRef.current = node; } }}
              className={`${className} classroom-reader__line--pickable`}
              onClick={() => onPick(line.id)}
              aria-current={current ? 'true' : undefined}
            >
              {line.text}
            </button>
          );
        }

        return (
          <p
            key={line.id}
            ref={(node) => { if (current) { currentRef.current = node; } }}
            className={className}
            aria-current={current ? 'true' : undefined}
          >
            {line.text}
          </p>
        );
      })}
    </div>
  );
};

export default Reader;
