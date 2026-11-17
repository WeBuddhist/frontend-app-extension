import { act, renderHook } from '@testing-library/react';

import { useHideOnScroll } from './useHideOnScroll';

const scrollTo = (y: number) => {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
    jest.runOnlyPendingTimers();
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => setTimeout(() => cb(0), 0) as unknown as number);
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('hiding the header while reading', () => {
  it('hides on the way down, returns on the way up, and stays shown near the top', () => {
    const { result } = renderHook(() => useHideOnScroll());
    scrollTo(400);
    expect(result.current).toBe(true);
    scrollTo(380);
    expect(result.current).toBe(false);
    scrollTo(900);
    expect(result.current).toBe(true);
    scrollTo(50);
    expect(result.current).toBe(false);
  });

  it('does not hide while keyboard focus is inside the header', () => {
    const header = document.createElement('header');
    const button = document.createElement('button');
    header.appendChild(button);
    document.body.appendChild(header);
    button.focus();
    const { result } = renderHook(() => useHideOnScroll({ current: header }));
    scrollTo(500);
    expect(result.current).toBe(false);
    button.blur();
    scrollTo(900);
    expect(result.current).toBe(true);
    header.remove();
  });
});
