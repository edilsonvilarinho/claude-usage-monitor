export function applyTimelineBounds(workStartMin: number, workEndMin: number, minutosAtuais: number, momentoDoReset: number, resetCrossesDay: boolean) {
  const timelineStartMin = Math.min(workStartMin, minutosAtuais, workEndMin);
  const timelineEndMin = Math.max(
    workEndMin,
    minutosAtuais,
    resetCrossesDay ? workEndMin : Math.min(momentoDoReset, 24 * 60)
  );
  return { timelineStartMin, timelineEndMin };
}

export function pctOf(min: number, timelineStartMin: number, totalRange: number): number {
  return Math.max(0, Math.min(100, (min - timelineStartMin) / totalRange * 100));
}

export function detectCollision(resetPct: number, endPct: number, startPct: number, nowPct: number, PROXIMITY = 10): boolean {
  return (
    Math.abs(resetPct - endPct) < PROXIMITY ||
    Math.abs(resetPct - startPct) < PROXIMITY ||
    Math.abs(resetPct - nowPct) < PROXIMITY ||
    resetPct > 100 - PROXIMITY ||
    resetPct < PROXIMITY
  );
}

export function gap(a: number, b: number): number {
  return Math.abs(a - b);
}
