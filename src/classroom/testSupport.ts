/**
 * Stand-ins for what jsdom lacks, for tests that render Paragon components which measure
 * themselves. Call before rendering.
 *
 * Put here, and not in the project's `setupTest.js`: that file is not loaded by the test
 * runner's configuration, which was found by probing for the global rather than assumed.
 */

export const installResizeObserver = (): void => {
  const target = globalThis as unknown as { ResizeObserver?: unknown };
  if (target.ResizeObserver) { return; }
  target.ResizeObserver = class ResizeObserver {
    observe() { /* jsdom has no layout, so there is nothing to measure */ }

    unobserve() { /* nothing to measure */ }

    disconnect() { /* nothing to measure */ }
  };
};
