/**
 * @jest-environment-options {"url": "http://localhost:2003", "customExportConditions": ["node"]}
 *
 * The teacher's whole path, against a live server: find a text, start a class, see
 * the room code and the recovery code, then take back control with that code.
 * Skipped unless CLASSROOM_API_URL is set.
 *
 *   CLASSROOM_API_URL=http://localhost:8010 CLASSROOM_HOST_PASSWORD=… \
 *     npm test -- JoinScreen.live
 */

import { IntlProvider } from '@edx/frontend-platform/i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import JoinScreen from './JoinScreen';

const API = process.env.CLASSROOM_API_URL;
const PASSWORD = process.env.CLASSROOM_HOST_PASSWORD ?? '';

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ CLASSROOM_API_URL: process.env.CLASSROOM_API_URL }),
}));

const describeLive = API ? describe : describe.skip;

// jsdom has XMLHttpRequest but not fetch, which every real browser has.
beforeAll(() => {
  (global as any).fetch = (url: string, init?: RequestInit) => new Promise(
    (resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open(init?.method ?? 'GET', url, true);
      Object.entries((init?.headers ?? {}) as Record<string, string>)
        .forEach(([k, v]) => request.setRequestHeader(k, v));
      request.onload = () => resolve({
        ok: request.status >= 200 && request.status < 300,
        status: request.status,
        json: () => Promise.resolve(JSON.parse(request.responseText || '{}')),
      });
      request.onerror = () => reject(new Error(`${url} failed`));
      request.send((init?.body as string) ?? null);
    },
  );
});

const show = (onEnter = jest.fn()) => {
  render(
    <IntlProvider locale="en">
      <JoinScreen initialCode="" onEnter={onEnter} />
    </IntlProvider>,
  );
  return onEnter;
};

describeLive('the teacher’s path', () => {
  it('offers a way to start a class from the join screen', () => {
    show();
    expect(screen.getByRole('button', { name: /start a class/i })).toBeTruthy();
  });

  it('searches the library, starts a class, and shows both codes', async () => {
    const onEnter = show();
    await userEvent.click(screen.getByRole('button', { name: /start a class/i }));

    await userEvent.type(screen.getByRole('textbox'), 'བྱང་ཆུབ');
    await userEvent.click(screen.getByRole('button', { name: /find a text/i }));

    // Results appear and one can be chosen. A title search returns several, so this
    // takes the first rather than asserting there is exactly one.
    const results = await screen.findAllByRole('button', { name: /བྱང་ཆུབ/ }, { timeout: 20000 });
    expect(results.length).toBeGreaterThan(0);
    await userEvent.click(results[0]);

    await userEvent.type(screen.getByLabelText(/host password/i), PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: /^start$/i }));

    await waitFor(
      () => expect(screen.getByText(/your class is ready/i)).toBeTruthy(),
      { timeout: 20000 },
    );

    // The code for the board: six characters from the unambiguous alphabet.
    const code = screen.getByText(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(code.textContent).toHaveLength(6);

    // The recovery code, shown exactly once, and kept out of the URL.
    expect(screen.getByText(/recovery code/i)).toBeTruthy();
    expect(window.location.search).toBe('');

    await userEvent.click(screen.getByRole('button', { name: /open the text/i }));
    expect(onEnter).toHaveBeenCalledWith(code.textContent, 'Teacher');
  }, 120000);

  it('refuses a wrong host password rather than creating a room', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: /start a class/i }));
    await userEvent.type(screen.getByRole('textbox'), 'བྱང་ཆུབ');
    await userEvent.click(screen.getByRole('button', { name: /find a text/i }));
    await userEvent.click((await screen.findAllByRole('button', { name: /བྱང་ཆུབ/ }, { timeout: 20000 }))[0]);

    await userEvent.type(screen.getByLabelText(/host password/i), 'not-the-password');
    await userEvent.click(screen.getByRole('button', { name: /^start$/i }));

    await waitFor(
      () => expect(screen.getByText(/wrong host password/i)).toBeTruthy(),
      { timeout: 20000 },
    );
    expect(screen.queryByText(/your class is ready/i)).toBeNull();
  }, 120000);

  it('a wrong recovery code is refused before the teacher relies on it', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: /start a class/i }));
    await userEvent.click(screen.getByRole('button', { name: /take back control/i }));

    const fields = screen.getAllByRole('textbox');
    await userEvent.type(fields[0], 'ZZZZZZ');
    await userEvent.type(fields[1], 'not-a-real-token');
    await userEvent.click(screen.getByRole('button', { name: /resume teaching/i }));

    await waitFor(
      () => expect(screen.getByText(/wrong recovery code/i)).toBeTruthy(),
      { timeout: 20000 },
    );
  }, 120000);
});
