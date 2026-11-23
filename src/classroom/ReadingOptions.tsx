import { useIntl } from '@edx/frontend-platform/i18n';
import { Dropdown } from '@openedx/paragon';

import { ReadingIcon } from './icons';
import messages from './messages';
import { VIEW_MODES, TEXT_SIZES } from './view';
import type { LayoutMode, TextSize, ViewMode } from './view';

interface Props {
  view: ViewMode;
  onView: (view: ViewMode) => void;
  layout: LayoutMode;
  onLayout: (layout: LayoutMode) => void;
  /** Whether the text has a translation. Without one there is nothing to choose. */
  hasTranslation: boolean;
  /** Whether the text has a table of contents. Without one there is nothing to show. */
  hasOutline: boolean;
  textSize: TextSize;
  onTextSize: (size: TextSize) => void;
  sectionTitles: boolean;
  onSectionTitles: (shown: boolean) => void;
  /** Whether the student's own highlights are drawn. Offered only to those who have notes. */
  highlights?: boolean;
  onHighlights?: (shown: boolean) => void;
}

/**
 * The small line icons beside the layout and contents choices, the same shapes the
 * library reader uses. Drawn here rather than imported from Paragon's icon barrel,
 * which threw a webpack initialisation error for one of its icons (see `Contents.tsx`),
 * and these four are not worth that risk.
 */
const lineIcon = (paths: string[], strokeWidth = 2) => function LineIcon(
  props: React.SVGProps<SVGSVGElement>,
) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
};

/** Prose: a dense block of text. */
const ProseIcon = lineIcon(['M3 4h18', 'M3 8h18', 'M3 12h18', 'M3 16h18', 'M3 20h18'], 2.4);
/** Segmented: a few evenly spaced lines. */
const SegmentedIcon = lineIcon(['M3 6h18', 'M3 12h18', 'M3 18h18']);
/** Show titles: a list. */
const ShowIcon = lineIcon(['M3 6h.01', 'M3 12h.01', 'M3 18h.01', 'M8 6h13', 'M8 12h13', 'M8 18h13']);
/** Hide titles: a list struck through. */
const HideIcon = lineIcon(['M11 12H3', 'M16 6H3', 'M16 18H3', 'm19 10-4 4', 'm15 10 4 4']);
/** An eye, and an eye struck through: the student's highlights drawn or not. */
const EyeIcon = lineIcon([
  'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z',
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
]);
const EyeOffIcon = lineIcon([
  'M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68',
  'M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61',
  'M14.12 14.12a3 3 0 1 1-4.24-4.24',
  'M2 2l20 20',
]);

interface ChoiceProps {
  label: string;
  selected: boolean;
  onSelect: () => void;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

/**
 * One choice, drawn as a bordered tile: the chosen one is greyed with a dark outline, the
 * rest have a pale one. A button, not a menu item, so choosing leaves the menu open and
 * someone setting up the page can make several choices in one visit.
 */
const Choice = ({
  label, selected, onSelect, icon: Glyph,
}: ChoiceProps) => (
  <button
    type="button"
    role="menuitemradio"
    aria-checked={selected}
    className={`classroom-options__choice ${selected ? 'classroom-options__choice--selected' : ''}`}
    onClick={onSelect}
  >
    {Glyph && <Glyph />}
    <span>{label}</span>
  </button>
);

/**
 * One button in the header that opens the reading options, laid out as the library
 * reader's is: what to show, how to lay it out, whether to show section titles.
 *
 * Everything here is the reader's own preference. Nothing is sent to the class.
 */
const ReadingOptions = ({
  view, onView, layout, onLayout, textSize, onTextSize, hasTranslation, hasOutline,
  sectionTitles, onSectionTitles, highlights = true, onHighlights,
}: Props) => {
  const intl = useIntl();

  const viewLabels: Record<ViewMode, string> = {
    source: intl.formatMessage(messages.viewSource),
    translation: intl.formatMessage(messages.viewTranslation),
    both: intl.formatMessage(messages.viewBoth),
  };

  const sizeLabels: Record<TextSize, string> = {
    small: intl.formatMessage(messages.sizeSmall),
    medium: intl.formatMessage(messages.sizeMedium),
    large: intl.formatMessage(messages.sizeLarge),
    xlarge: intl.formatMessage(messages.sizeXLarge),
  };

  return (
    <Dropdown className="classroom-options" alignRight>
      <Dropdown.Toggle
        id="classroom-options"
        variant="tertiary"
        size="sm"
        aria-label={intl.formatMessage(messages.settingsLabel)}
        title={intl.formatMessage(messages.settingsLabel)}
        className="classroom-options__toggle"
      >
        <ReadingIcon />
      </Dropdown.Toggle>
      <Dropdown.Menu className="classroom-options__menu">
        {hasTranslation && (
          <div role="group" aria-label={intl.formatMessage(messages.viewHeading)}>
            <div className="classroom-options__stack">
              {VIEW_MODES.map((mode) => (
                <Choice
                  key={mode}
                  label={viewLabels[mode]}
                  selected={mode === view}
                  onSelect={() => onView(mode)}
                />
              ))}
            </div>
          </div>
        )}

        <div role="group" aria-labelledby="classroom-options-layout">
          <p className="classroom-options__heading" id="classroom-options-layout">
            {intl.formatMessage(messages.layoutHeading)}
          </p>
          <div className="classroom-options__pair">
            <Choice
              label={intl.formatMessage(messages.layoutProse)}
              icon={ProseIcon}
              selected={layout === 'prose'}
              onSelect={() => onLayout('prose')}
            />
            <Choice
              label={intl.formatMessage(messages.layoutSegmented)}
              icon={SegmentedIcon}
              selected={layout === 'segmented'}
              onSelect={() => onLayout('segmented')}
            />
          </div>
        </div>

        <div role="group" aria-labelledby="classroom-options-size">
          <p className="classroom-options__heading" id="classroom-options-size">
            {intl.formatMessage(messages.sizeHeading)}
          </p>
          <div className="classroom-options__sizes">
            {TEXT_SIZES.map((size, index) => (
              <button
                key={size}
                type="button"
                role="menuitemradio"
                aria-checked={size === textSize}
                aria-label={sizeLabels[size]}
                title={sizeLabels[size]}
                className={`classroom-options__choice classroom-options__size ${size === textSize ? 'classroom-options__choice--selected' : ''}`}
                onClick={() => onTextSize(size)}
              >
                {/* The letter itself grows with the step, so the row reads as a scale. */}
                <span aria-hidden="true" style={{ fontSize: 14 + index * 3 }}>A</span>
              </button>
            ))}
          </div>
        </div>

        {hasOutline && (
          <div role="group" aria-labelledby="classroom-options-toc">
            <p className="classroom-options__heading" id="classroom-options-toc">
              {intl.formatMessage(messages.tocHeading)}
            </p>
            <div className="classroom-options__pair">
              <Choice
                label={intl.formatMessage(messages.tocShow)}
                icon={ShowIcon}
                selected={sectionTitles}
                onSelect={() => onSectionTitles(true)}
              />
              <Choice
                label={intl.formatMessage(messages.tocHide)}
                icon={HideIcon}
                selected={!sectionTitles}
                onSelect={() => onSectionTitles(false)}
              />
            </div>
          </div>
        )}

        {onHighlights && (
          <div role="group" aria-labelledby="classroom-options-highlights">
            <p className="classroom-options__heading" id="classroom-options-highlights">
              {intl.formatMessage(messages.highlightsHeading)}
            </p>
            <div className="classroom-options__pair">
              <Choice
                label={intl.formatMessage(messages.tocShow)}
                icon={EyeIcon}
                selected={highlights}
                onSelect={() => onHighlights(true)}
              />
              <Choice
                label={intl.formatMessage(messages.tocHide)}
                icon={EyeOffIcon}
                selected={!highlights}
                onSelect={() => onHighlights(false)}
              />
            </div>
          </div>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default ReadingOptions;
