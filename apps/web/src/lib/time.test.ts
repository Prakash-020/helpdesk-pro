import { describe, expect, it } from 'vitest';
import { timeAgo, dueIn } from './time';

describe('timeAgo', () => {
  it('formats recent times', () => {
    expect(timeAgo(new Date(Date.now() - 30_000))).toBe('just now');
    expect(timeAgo(new Date(Date.now() - 5 * 60_000))).toBe('5m ago');
    expect(timeAgo(new Date(Date.now() - 3 * 3_600_000))).toBe('3h ago');
    expect(timeAgo(new Date(Date.now() - 4 * 86_400_000))).toBe('4d ago');
  });
});

describe('dueIn', () => {
  it('returns null for no deadline', () => {
    expect(dueIn(null)).toBeNull();
  });
  it('labels future deadlines', () => {
    const r = dueIn(new Date(Date.now() + 2 * 3_600_000).toISOString())!;
    expect(r.overdue).toBe(false);
    expect(r.label).toMatch(/due in/);
  });
  it('labels past deadlines as overdue', () => {
    const r = dueIn(new Date(Date.now() - 3_600_000).toISOString())!;
    expect(r.overdue).toBe(true);
    expect(r.label).toMatch(/overdue/);
  });
});
