import { vi } from 'vitest';
// Test wall clock is independent of CI execution date; calendar tests inject explicit clocks too.
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-30T03:00:00Z'));
