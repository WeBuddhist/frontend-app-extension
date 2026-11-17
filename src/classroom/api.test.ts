/**
 * Where the classroom service is, and what happens when nobody said.
 *
 * Regression: apiBase() used to fall back to a development URL unconditionally, so a
 * production deployment with no CLASSROOM_API_URL pointed every student's browser at
 * their own machine, and every call failed for a reason nothing on screen explained.
 */

const config: { CLASSROOM_API_URL?: string } = {};

jest.mock('@edx/frontend-platform', () => ({ getConfig: () => config }));

// eslint-disable-next-line import/first
import { apiBase } from './api';

const withEnv = (value: string | undefined, body: () => void) => {
  const previous = process.env.NODE_ENV;
  // NODE_ENV is read-only in the types but writable at runtime, which is how the
  // bundler sets it.
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
  try {
    body();
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = previous;
  }
};

describe('apiBase', () => {
  afterEach(() => { delete config.CLASSROOM_API_URL; });

  it('uses what the Tutor plugin configured', () => {
    config.CLASSROOM_API_URL = 'https://apps.example.org/classroom-api';
    withEnv('production', () => {
      expect(apiBase()).toBe('https://apps.example.org/classroom-api');
    });
  });

  it('falls back in development, where env.config is genuinely absent', () => {
    withEnv('development', () => {
      expect(apiBase()).toBe('http://localhost:8010');
    });
  });

  it('throws in production rather than pointing at the student’s own machine', () => {
    withEnv('production', () => {
      expect(() => apiBase()).toThrow(/CLASSROOM_API_URL/);
    });
  });

  it('says where the setting comes from, so the message is actionable', () => {
    withEnv('production', () => {
      expect(() => apiBase()).toThrow(/Tutor plugin/);
    });
  });
});
