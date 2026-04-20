export function colorForPct(pct: number): string {
  if (pct >= 80) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#22c55e';
}

export function barClass(pct: number): string {
  if (pct >= 80) return 'crit';
  if (pct >= 60) return 'warn';
  return '';
}
