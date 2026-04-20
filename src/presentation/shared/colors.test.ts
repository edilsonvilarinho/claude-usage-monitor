import { describe, it, expect } from 'vitest';
import { colorForPct, barClass } from './colors';

describe('colorForPct', () => {
  it('returns green below 60%', () => {
    expect(colorForPct(0)).toBe('#22c55e');
    expect(colorForPct(59)).toBe('#22c55e');
  });

  it('returns amber between 60% and 80%', () => {
    expect(colorForPct(60)).toBe('#f59e0b');
    expect(colorForPct(79)).toBe('#f59e0b');
  });

  it('returns red at 80% and above', () => {
    expect(colorForPct(80)).toBe('#ef4444');
    expect(colorForPct(100)).toBe('#ef4444');
    expect(colorForPct(150)).toBe('#ef4444');
  });
});

describe('barClass', () => {
  it('returns empty below 60%', () => {
    expect(barClass(0)).toBe('');
    expect(barClass(59)).toBe('');
  });

  it('returns warn between 60% and 80%', () => {
    expect(barClass(60)).toBe('warn');
    expect(barClass(79)).toBe('warn');
  });

  it('returns crit at 80% and above', () => {
    expect(barClass(80)).toBe('crit');
    expect(barClass(100)).toBe('crit');
    expect(barClass(150)).toBe('crit');
  });
});
