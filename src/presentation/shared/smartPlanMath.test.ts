import { describe, it, expect } from 'vitest';
import { applyTimelineBounds, pctOf, detectCollision, gap } from './smartPlanMath';

describe('applyTimelineBounds', () => {
  it('returns correct bounds when tudo normal', () => {
    const result = applyTimelineBounds(540, 1080, 800, 720, false);
    expect(result.timelineStartMin).toBe(540);
    expect(result.timelineEndMin).toBe(1080);
  });

  it('uses current time when before work start', () => {
    const result = applyTimelineBounds(540, 1080, 500, 480, false);
    expect(result.timelineStartMin).toBe(500);
  });

  it('crosses day resets include full day', () => {
    const result = applyTimelineBounds(540, 1080, 800, 480, true);
    expect(result.timelineEndMin).toBe(1080);
    expect(result.timelineStartMin).toBe(540);
  });
});

describe('pctOf', () => {
  it('returns 0 at start', () => {
    expect(pctOf(0, 0, 100)).toBe(0);
  });

  it('returns 100 at end', () => {
    expect(pctOf(100, 0, 100)).toBe(100);
  });

  it('returns 50 at middle', () => {
    expect(pctOf(50, 0, 100)).toBe(50);
  });

  it('clamps negative values', () => {
    expect(pctOf(-10, 0, 100)).toBe(0);
  });

  it('clamps over 100 values', () => {
    expect(pctOf(150, 0, 100)).toBe(100);
  });
});

describe('detectCollision', () => {
  it('detects collision with end marker', () => {
    expect(detectCollision(95, 90, 0, 0, 10)).toBe(true);
  });

  it('detects collision with start marker', () => {
    expect(detectCollision(5, 100, 10, 0, 10)).toBe(true);
  });

  it('detects collision with now marker', () => {
    expect(detectCollision(50, 100, 0, 45, 10)).toBe(true);
  });

  it('no collision when far apart', () => {
    expect(detectCollision(50, 100, 0, 10, 10)).toBe(false);
  });
});

describe('gap', () => {
  it('calculates absolute difference', () => {
    expect(gap(90, 50)).toBe(40);
    expect(gap(50, 90)).toBe(40);
  });
});
