import { describe, it, expect } from 'vitest';
import { filterChangedPoints } from './timeSeries';

describe('filterChangedPoints', () => {
  it('returns empty array for empty input', () => {
    expect(filterChangedPoints([])).toEqual([]);
  });

  it('returns first point always', () => {
    const points = [{ ts: 1000, session: 50, weekly: 30 }];
    expect(filterChangedPoints(points)).toEqual(points);
  });

  it('keeps point when session changes', () => {
    const points = [
      { ts: 1000, session: 50, weekly: 30 },
      { ts: 2000, session: 60, weekly: 30 },
    ];
    expect(filterChangedPoints(points)).toEqual(points);
  });

  it('keeps point when weekly changes', () => {
    const points = [
      { ts: 1000, session: 50, weekly: 30 },
      { ts: 2000, session: 50, weekly: 40 },
    ];
    expect(filterChangedPoints(points)).toEqual(points);
  });

  it('filters duplicate points with same values', () => {
    const points = [
      { ts: 1000, session: 50, weekly: 30 },
      { ts: 2000, session: 50, weekly: 30 },
      { ts: 3000, session: 50, weekly: 30 },
    ];
    expect(filterChangedPoints(points)).toEqual([points[0]]);
  });

  it('filters only points that actually changed', () => {
    const points = [
      { ts: 1000, session: 50, weekly: 30 },
      { ts: 2000, session: 50, weekly: 30 },
      { ts: 3000, session: 60, weekly: 30 },
    ];
    expect(filterChangedPoints(points)).toEqual([points[0], points[2]]);
  });

  it('handles credits change', () => {
    const points = [
      { ts: 1000, session: 50, weekly: 30, credits: 10 },
      { ts: 2000, session: 50, weekly: 30, credits: 20 },
    ];
    expect(filterChangedPoints(points)).toEqual(points);
  });

  it('handles null credits', () => {
    const points = [
      { ts: 1000, session: 50, weekly: 30, credits: null },
      { ts: 2000, session: 50, weekly: 30, credits: null },
    ];
    expect(filterChangedPoints(points)).toEqual([points[0]]);
  });
});
