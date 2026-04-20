import { vi } from 'vitest';

// Silence winston logs during tests — no file I/O noise
vi.mock('winston', () => {
  const noop = () => {};
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return {
    default: {
      createLogger: () => logger,
      format: {
        combine: noop, timestamp: noop, printf: noop, colorize: noop, simple: noop,
      },
      transports: { Console: class {}, File: class {} },
    },
  };
});

// Prevent real log file creation
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: actual };
});
