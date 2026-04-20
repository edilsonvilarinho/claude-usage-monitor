import { colorForPct } from '../../shared/colors';

export class TrayIcon {
  private lastRendered: { session: number; weekly: number } | null = null;

  render(sessionPct: number, weeklyPct: number): void {
    const canvas = document.getElementById('tray-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 64;
    const cx = size / 2;
    const cy = size / 2;
    ctx.clearRect(0, 0, size, size);

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const bgColor = isDark ? 'rgba(28, 28, 28, 0.90)' : 'rgba(235, 235, 235, 0.95)';
    const textColor = isDark ? '#ffffff' : '#111111';
    const trackColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';

    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - 1, 0, Math.PI * 2);
    ctx.fillStyle = bgColor;
    ctx.fill();

    const maxPct = Math.max(sessionPct, weeklyPct);
    const arcRadius = size / 2 - 7;
    const arcWidth = 8;

    ctx.beginPath();
    ctx.arc(cx, cy, arcRadius, 0, Math.PI * 2);
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = arcWidth;
    ctx.stroke();

    const color = colorForPct(maxPct);
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.min(maxPct, 100) / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, arcRadius, startAngle, endAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = arcWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.fillStyle = textColor;

    this.lastRendered = { session: sessionPct, weekly: weeklyPct };

    canvas.toBlob((blob) => {
      if (!blob) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        window.claudeUsage.sendTrayIcon(reader.result as string);
      };
      reader.readAsDataURL(blob);
    }, 'image/png');
  }
}
