import { IntlProvider } from '@edx/frontend-platform/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ReadingOptions from './ReadingOptions';

const show = (hasTranslation: boolean, hasOutline = false, sectionTitles = true) => {
  const onView = jest.fn();
  const onLayout = jest.fn();
  const onSectionTitles = jest.fn();
  const onTextSize = jest.fn();
  render(
    <IntlProvider locale="en">
      <ReadingOptions
        view="both"
        onView={onView}
        layout="segmented"
        onLayout={onLayout}
        textSize="medium"
        onTextSize={onTextSize}
        hasTranslation={hasTranslation}
        hasOutline={hasOutline}
        sectionTitles={sectionTitles}
        onSectionTitles={onSectionTitles}
      />
    </IntlProvider>,
  );
  return {
    onView, onLayout, onSectionTitles, onTextSize,
  };
};

const open = () => userEvent.click(screen.getByRole('button', { name: 'Reading options' }));

describe('ReadingOptions', () => {
  it('offers source, translation and both when there is a translation', async () => {
    show(true);
    await open();
    expect(screen.getByText('Source')).toBeTruthy();
    expect(screen.getByText('Translation')).toBeTruthy();
    expect(screen.getByText('Source with Translation')).toBeTruthy();
  });

  it('offers only the layout when there is nothing to translate', async () => {
    show(false);
    await open();
    expect(screen.queryByText('Source with Translation')).toBeNull();
    expect(screen.getByText('Prose')).toBeTruthy();
    expect(screen.getByText('Segmented')).toBeTruthy();
  });

  it('reports the layout and the view that were chosen', async () => {
    const { onView, onLayout } = show(true);
    await open();
    await userEvent.click(screen.getByText('Prose'));
    expect(onLayout).toHaveBeenCalledWith('prose');
    // Choosing leaves the menu open, so another choice can follow without reopening.
    await userEvent.click(screen.getByText('Translation'));
    expect(onView).toHaveBeenCalledWith('translation');
  });

  it('marks the current choices', async () => {
    show(true);
    await open();
    const current = document.querySelectorAll('[aria-checked="true"]');
    expect(Array.from(current).map((node) => node.textContent)).toEqual(
      expect.arrayContaining(['Source with Translation', 'Segmented']),
    );
  });

  it('offers the table of contents choice only when the text has one', async () => {
    show(true, false);
    await open();
    expect(screen.queryByText('Table of Contents')).toBeNull();
  });

  it('reports a choice to hide the section titles', async () => {
    const { onSectionTitles } = show(true, true, true);
    await open();
    expect(screen.getByText('Table of Contents')).toBeTruthy();
    await userEvent.click(screen.getByText('Hide'));
    expect(onSectionTitles).toHaveBeenCalledWith(false);
  });

  it('offers four text sizes, the current one marked, and says which is chosen', async () => {
    const { onTextSize } = show(false);
    await open();
    const sizes = ['Small', 'Medium', 'Large', 'Extra large'];
    sizes.forEach((name) => expect(screen.getByRole('menuitemradio', { name })).toBeTruthy());
    expect(screen.getByRole('menuitemradio', { name: 'Medium' }).getAttribute('aria-checked')).toBe('true');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Large' }));
    expect(onTextSize).toHaveBeenCalledWith('large');
  });
});
