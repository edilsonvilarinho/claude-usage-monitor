export function filterChangedPoints(points: { session: number; weekly: number; credits?: number | null; ts: number }[]) {
  if (points.length === 0) return [];
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    if (curr.session !== prev.session || curr.weekly !== prev.weekly || curr.credits !== prev.credits) {
      result.push(curr);
    }
  }
  return result;
}
