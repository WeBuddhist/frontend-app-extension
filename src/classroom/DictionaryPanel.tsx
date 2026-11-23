import { useLayoutEffect, useRef, useState } from 'react';
import { useIntl } from '@edx/frontend-platform/i18n';
import { Button } from '@openedx/paragon';

import {
  DEFAULT_DICTIONARIES, DICTIONARIES, hasTibetan, recallDictionaries, rememberDictionaries,
  type WordMeaning,
} from './dictionary';
import { ChevronIcon, DictionaryIcon, SlidersIcon } from './icons';
import messages from './messages';
import SidePanel from './SidePanel';
import { useLookup } from './useLookup';

interface Props {
  isOpen: boolean;
  /** The words to look up: the last ones the reader chose. */
  query: string | null;
  onClose: () => void;
}

/** A definition, in the script it is written in: some dictionaries answer in Tibetan. */
const Definition = ({ text }: { text: string }) => (
  <p className="classroom-dictionary__definition" lang={hasTibetan(text) && !/[a-z]{3}/i.test(text) ? 'bo' : undefined}>
    {text}
  </p>
);

/**
 * Where the page cannot be measured (tests, mostly), a meaning past this many letters is taken
 * to be cut short. In a browser, whether it is cut is measured.
 */
const LONG = 180;

/**
 * What one dictionary says: the meaning first, where the eye lands, with the dictionary's name
 * over it as a small label, the way a quotation names its source. The first meaning shows
 * straight away, cut to a few lines; "Show more" opens the rest.
 */
const Entry = ({ entry }: { entry: WordMeaning['entries'][number] }) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  // Whether the first meaning runs past the lines it is given: only then is "Show more" offered
  // for it, so the button never opens onto nothing new.
  const [cut, setCut] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (open || !card) { return undefined; }
    const measure = () => {
      const first = card.querySelector('.classroom-dictionary__definition');
      if (!first) { setCut(false); return; }
      setCut(first.clientHeight === 0
        ? (entry.definitions[0]?.length ?? 0) > LONG
        : first.scrollHeight > first.clientHeight + 1);
    };
    measure();
    // Measured again if the card changes width, or a font arrives and the lines wrap anew.
    if (typeof ResizeObserver === 'undefined') { return undefined; }
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  }, [open, entry.definitions]);
  const longer = entry.definitions.length > 1 || cut;
  const shown = open ? entry.definitions : entry.definitions.slice(0, 1);
  return (
    <article ref={cardRef} className={`classroom-dictionary__entry${open ? '' : ' classroom-dictionary__entry--short'}`}>
      <p className="classroom-dictionary__source">
        <span className="classroom-dictionary__name">{entry.name}</span>
        {entry.definitions.length > 1 && (
          <span className="classroom-dictionary__count">
            {intl.formatMessage(messages.dictionaryEntries, { count: entry.definitions.length })}
          </span>
        )}
      </p>
      <div className="classroom-dictionary__definitions">
        {shown.map((text) => <Definition key={text} text={text} />)}
      </div>
      {longer && (
        <button
          type="button"
          className="classroom-dictionary__more"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
        >
          {intl.formatMessage(open ? messages.dictionaryShowLess : messages.dictionaryShowMore)}
          <span className="classroom-dictionary__chevron" aria-hidden="true"><ChevronIcon size={14} /></span>
        </button>
      )}
    </article>
  );
};

/**
 * One word, and what each dictionary says it means. A line over the cards says they are
 * meanings from that many dictionaries, so the names on them read as sources.
 */
const Word = ({ meaning, showWord }: { meaning: WordMeaning; showWord: boolean }) => {
  const intl = useIntl();
  return (
    <section className="classroom-dictionary__word">
      {showWord && <h3 className="classroom-dictionary__term" lang="bo">{meaning.word}</h3>}
      {meaning.entries.length === 0 ? (
        <p className="classroom-dictionary__missing">{intl.formatMessage(messages.dictionaryWordNotFound)}</p>
      ) : (
        <p className="classroom-dictionary__from">
          {intl.formatMessage(messages.dictionaryMeaningsFrom, { count: meaning.entries.length })}
        </p>
      )}
      {meaning.entries.map((entry) => <Entry key={entry.dictionary} entry={entry} />)}
    </section>
  );
};

/** Placeholder cards while the dictionaries are asked, the shape of what is coming. */
const Loading = ({ label }: { label: string }) => (
  <div className="classroom-dictionary__loading" role="status" aria-label={label}>
    {[0, 1, 2].map((n) => (
      <div key={n} className="classroom-dictionary__skeleton">
        <span className="classroom-dictionary__bone classroom-dictionary__bone--title" />
        <span className="classroom-dictionary__bone" />
        <span className="classroom-dictionary__bone classroom-dictionary__bone--short" />
      </div>
    ))}
  </div>
);

/**
 * What the selected words mean, from Padma's dictionaries.
 *
 * Top to bottom: the words, large, as they are written in the text; which dictionaries are
 * searched (a small button that opens a row of on/off chips, rather than a long list of
 * checkboxes in the way of the meanings); then the meanings, a card per dictionary.
 *
 * A phrase is looked up whole first; if no dictionary has it whole, it is shown word by word,
 * and the panel says so. The choice of dictionaries is kept in this browser.
 *
 * A side panel, so it can stay open while reading: select the next words, press "Look up",
 * and the panel shows those instead, with nothing to close in between.
 */
const DictionaryPanel = ({ isOpen, query, onClose }: Props) => {
  const intl = useIntl();
  const [chosen, setChosen] = useState<string[]>(recallDictionaries);
  const [picking, setPicking] = useState(false);
  const { state, retry } = useLookup(isOpen ? query : null, chosen);

  const choose = (ids: string[]) => {
    const ordered = DICTIONARIES.map((d) => d.id).filter((d) => ids.includes(d));
    setChosen(ordered);
    rememberDictionaries(ordered);
  };
  const toggle = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id];
    // At least one, or there is nothing to ask.
    if (next.length > 0) { choose(next); }
  };
  const isDefault = chosen.join(',') === DEFAULT_DICTIONARIES.join(',');

  if (!isOpen) { return null; }

  return (
    <SidePanel
      title={intl.formatMessage(messages.dictionaryHeading)}
      closeLabel={intl.formatMessage(messages.close)}
      onClose={onClose}
      className="classroom-dictionary"
    >
      <div className="classroom-drawer__body classroom-dictionary__body">
        <p className="classroom-dictionary__query" lang="bo">{query}</p>

        <div className="classroom-dictionary__tools">
          <button
            type="button"
            className="classroom-dictionary__picker-toggle"
            aria-expanded={picking}
            onClick={() => setPicking((open) => !open)}
          >
            <SlidersIcon size={16} />
            {intl.formatMessage(messages.dictionaryPicker, { count: chosen.length, total: DICTIONARIES.length })}
            <span className="classroom-dictionary__chevron" aria-hidden="true"><ChevronIcon size={14} /></span>
          </button>
        </div>

        {picking && (
          <div className="classroom-dictionary__picker">
            <ul className="classroom-dictionary__chips" aria-label={intl.formatMessage(messages.dictionaryChoose)}>
              {DICTIONARIES.map((d) => {
                const on = chosen.includes(d.id);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      className={`classroom-dictionary__chip${on ? ' classroom-dictionary__chip--on' : ''}`}
                      aria-pressed={on}
                      // The last one on stays on: with none there is nothing to search.
                      disabled={on && chosen.length === 1}
                      onClick={() => toggle(d.id)}
                    >
                      {d.name}
                    </button>
                  </li>
                );
              })}
            </ul>
            {!isDefault && (
              <button type="button" className="classroom-dictionary__reset" onClick={() => choose(DEFAULT_DICTIONARIES)}>
                {intl.formatMessage(messages.dictionaryReset)}
              </button>
            )}
          </div>
        )}

        <div className="classroom-dictionary__results">
          {state.status === 'loading' && <Loading label={intl.formatMessage(messages.dictionaryLoading)} />}

          {state.status === 'failed' && (
            <div className="classroom-dictionary__notice" role="alert">
              <p className="classroom-dictionary__notice-body">{state.error}</p>
              <Button variant="outline-primary" size="sm" onClick={retry}>
                {intl.formatMessage(messages.dictionaryRetry)}
              </Button>
            </div>
          )}

          {state.status === 'done' && state.result.words.length === 0 && (
            <div className="classroom-dictionary__notice">
              <span className="classroom-dictionary__notice-icon" aria-hidden="true"><DictionaryIcon size={22} /></span>
              <p className="classroom-dictionary__notice-title">{intl.formatMessage(messages.dictionaryNotFoundTitle)}</p>
              <p className="classroom-dictionary__notice-body">{intl.formatMessage(messages.dictionaryNotFound)}</p>
              {!picking && (
                <button type="button" className="classroom-dictionary__reset" onClick={() => setPicking(true)}>
                  {intl.formatMessage(messages.dictionaryChoose)}
                </button>
              )}
            </div>
          )}

          {state.status === 'done' && state.result.words.length > 0 && (
            <>
              {state.result.split && (
                <p className="classroom-dictionary__split">{intl.formatMessage(messages.dictionarySplit)}</p>
              )}
              {state.result.words.map((meaning, index) => (
                <Word
                  // The same word can come twice in a phrase.
                  // eslint-disable-next-line react/no-array-index-key
                  key={`${meaning.word}-${index}`}
                  meaning={meaning}
                  showWord={state.result.split}
                />
              ))}
            </>
          )}
        </div>

        <p className="classroom-dictionary__credit">{intl.formatMessage(messages.dictionarySource)}</p>
      </div>
    </SidePanel>
  );
};

export default DictionaryPanel;
