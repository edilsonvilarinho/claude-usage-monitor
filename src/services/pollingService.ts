import { EventEmitter } from 'events';
import { powerMonitor } from 'electron';
import { fetchUsageData } from './usageApiService';
import { UsageData } from '../models/usageData';

const POLL_NORMAL_MS   = 7 * 60 * 1000;  // 7 min
const POLL_FAST_MS     = 5 * 60 * 1000;  // 5 min
const POLL_IDLE_MS     = 20 * 60 * 1000; // 20 min
const POLL_ERROR_BASE  = 60 * 1000;      // 1 min base for backoff
const POLL_ERROR_MAX   = 20 * 60 * 1000; // 20 min cap
const IDLE_THRESHOLD   = 10 * 60;        // 10 min in seconds
const FAST_CYCLES      = 2;              // how many fast polls after spike

export class PollingService extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private lastData: UsageData | null = null;
  private errorCount = 0;
  private fastCyclesLeft = 0;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.poll();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async triggerNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.poll();
  }

  private isIdle(): boolean {
    try {
      return powerMonitor.getSystemIdleTime() >= IDLE_THRESHOLD;
    } catch {
      return false;
    }
  }

  private nextInterval(): number {
    if (this.errorCount > 0) {
      return Math.min(POLL_ERROR_BASE * Math.pow(2, this.errorCount - 1), POLL_ERROR_MAX);
    }
    if (this.isIdle()) {
      return POLL_IDLE_MS;
    }
    if (this.fastCyclesLeft > 0) {
      return POLL_FAST_MS;
    }
    return POLL_NORMAL_MS;
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      const data = await fetchUsageData();
      this.errorCount = 0;

      // Detect usage spike (>1% increase in either window)
      if (this.lastData) {
        const sessionDelta = data.five_hour.utilization - this.lastData.five_hour.utilization;
        const weeklyDelta = data.seven_day.utilization - this.lastData.seven_day.utilization;
        if (sessionDelta > 0.01 || weeklyDelta > 0.01) {
          this.fastCyclesLeft = FAST_CYCLES;
        }
      }

      if (this.fastCyclesLeft > 0) {
        this.fastCyclesLeft--;
      }

      this.lastData = data;
      this.emit('usage-updated', data);
    } catch (err) {
      this.errorCount = Math.min(this.errorCount + 1, 8); // cap exponent
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[PollingService] Error fetching usage:', error.message);
      this.emit('error', error);
    }

    if (!this.running) return;

    const delay = this.nextInterval();
    this.timer = setTimeout(() => void this.poll(), delay);
  }
}

export const pollingService = new PollingService();
