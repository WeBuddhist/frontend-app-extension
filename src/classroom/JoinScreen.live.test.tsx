/**
 * @jest-environment-options {"url": "http://localhost:2003", "customExportConditions": ["node"]}
 *
 * The code screen against a live server: a teacher starts a class and sees its code; a
 * student joins with it and then finds it in their list without the code. Skipped unless
 * CLASSROOM_API_URL is set.
 *
 *   CLASSROOM_API_URL=http://localhost:8010 CLASSROOM_HOST_PASSWORD=… \
 *   CLASSROOM_TOKEN_TEACHER=… CLASSROOM_TOKEN_STUDENT=… npm test -- JoinScreen.live
 */

import { IntlProvider } from '@edx/frontend-platform/i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  API, PASSWORD, as, hasTokens, http,
} from './liveSupport';
import JoinScreen from './JoinScreen';

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ CLASSROOM_API_URL: process.env.CLASSROOM_API_URL }),
}));
jest.mock('@edx/frontend-platform/auth', () => ({
  // eslint-disable-next-line global-require
  getAuthenticatedHttpClient: () => require('./liveSupport').fakeAuthenticatedClient(),
}));

const describeLive = API && hasTokens() ? describe : describe.skip;

const show = (onEnter = jest.fn(), startMode = false) => {
  render(
    <IntlProvider locale="en">
      <JoinScreen initialCode="" startMode={startMode} onEnter={onEnter} />
    </IntlProvider>,
  );
  return onEnter;
};

describeLive('the code screen, against a live server', () => {
  let code = '';

  afterAll(async () => {
    if (code) { await http('POST', `${API}/api/rooms/${code}/archive`, undefined, 'teacher'); }
  });

  it('a teacher starts a class and is shown its code', async () => {
    as('teacher');
    const onEnter = show(jest.fn(), true);

    await userEvent.type(screen.getByLabelText(/find a text|search/i), 'བྱང་ཆུབ');
    await userEvent.click(screen.getAllByRole('button', { name: /search|find/i })[0]);
    await waitFor(() => expect(document.querySelectorAll('.classroom-page__result').length).toBeGreaterThan(0), { timeout: 20000 });
    await userEvent.click(document.querySelector('.classroom-page__result') as Element);

    await userEvent.type(screen.getByLabelText(/class name/i), 'Screen test class');
    await userEvent.type(screen.getByLabelText(/password/i), PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: /^start/i }));

    await waitFor(() => expect(document.querySelector('.classroom-page__big-code')).not.toBeNull(), { timeout: 30000 });
    code = document.querySelector('.classroom-page__big-code')?.textContent ?? '';
    expect(code).toHaveLength(6);

    await userEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(onEnter).toHaveBeenCalledWith(code);
  }, 90000);

  it('a student joins with the code once, then finds the class in their list', async () => {
    as('student');
    const onEnter = show();

    await userEvent.type(screen.getByLabelText(/code/i), code);
    await userEvent.click(screen.getByRole('button', { name: /^join/i }));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith(code), { timeout: 15000 });

    // A second visit: no code, but the class is there.
    document.body.innerHTML = '';
    const again = show();
    await waitFor(() => expect(screen.getByText('Screen test class')).toBeTruthy(), { timeout: 15000 });
    await userEvent.click(screen.getByText('Screen test class'));
    expect(again).toHaveBeenCalledWith(code);
  }, 60000);

  it('a wrong code says so', async () => {
    as('student');
    show();
    await userEvent.type(screen.getByLabelText(/code/i), 'ZZZZZZ');
    await userEvent.click(screen.getByRole('button', { name: /^join/i }));
    await waitFor(() => expect(document.querySelector('.classroom-page__error')).not.toBeNull(), { timeout: 15000 });
  }, 40000);
});
