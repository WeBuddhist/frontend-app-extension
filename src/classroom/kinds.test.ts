/**
 * The structural kinds the reader styles must be ones the library actually returns.
 *
 * Regression. The styles once used `title`, `homage`, `outline` and `colophon`,
 * taken from the old classroom app's own vocabulary. The library returns
 * `front_matter`, `back_matter`, `verse` and `paragraph`, so not one of those rules
 * could ever match — forty lines of CSS that looked like a feature and were inert.
 *
 * This reads the stylesheet rather than the API, so it runs without a server. The
 * list below is the contract; if the library adds a kind, add it here deliberately.
 */

import fs from 'fs';
import path from 'path';

/** Checked against /v2/editions/{id}/segmentation/segments across several texts. */
const LIBRARY_KINDS = ['front_matter', 'back_matter', 'verse', 'paragraph'];

/** Not kinds — state and affordance modifiers on the same block. */
const NOT_KINDS = ['current', 'pickable'];

const stylesheet = path.resolve(__dirname, '../../../brand-openedx/paragon/_extension.scss');

const describeIfPresent = fs.existsSync(stylesheet) ? describe : describe.skip;

describeIfPresent('the reader’s structural kinds', () => {
  const scss = fs.readFileSync(stylesheet, 'utf8');
  const styled = [...new Set(
    [...scss.matchAll(/classroom-reader__line--([a-z_]+)/g)].map((m) => m[1]),
  )].filter((k) => !NOT_KINDS.includes(k));

  it('styles no kind the library never sends', () => {
    const unknown = styled.filter((k) => !LIBRARY_KINDS.includes(k));
    expect(unknown).toEqual([]);
  });

  it('styles every kind the library does send', () => {
    const missing = LIBRARY_KINDS.filter((k) => !styled.includes(k));
    expect(missing).toEqual([]);
  });
});
