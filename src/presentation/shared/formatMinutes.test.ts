import { describe, it, expect } from 'vitest';
import { formatMinutes } from './formatMinutes';

describe('formatMinutes', () => {
  it('formats 0 minutes', () => {
    expect(formatMinutes(0)).toBe('00:00');
  });

  it('formats 90 minutes', () => {
    expect(formatMinutes(90)).toBe('01:30');
  });

  it('formats 0 seconds padded', () => {
    expect(formatMinutes(60)).toBe('01:00');
  });

  it('handles wrap around midnight', () => {
    expect(formatMinutes(24 * 60 + 30)).toBe('00:30');
  });
});
