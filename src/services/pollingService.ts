import { EventEmitter } from 'events';
import { powerMonitor } from 'electron';
import { fetchUsageData } from './usageApiService';
import { UsageData } from '../models/usageData';

const POLL_NORMAL_MS         = 7 * 60 * 1000;  // 7 min
const POLL_FAST_MS           = 5 * 60 * 1000;  // 5 min
const POLL_IDLE_MS           = 20 * 60 * 1000; // 20 min
const POLL_ERROR_BASE        = 60 * 1000;      // 1 min base for backoff
const POLL_ERROR_MAX         = 20 * 60 * 1000; // 20 min cap
const POLL_RATE_LIMIT_BASE   = 5 * 60 * 1000;  // 5 min base for rate limit backoff
const POLL_RATE_LIMIT_MAX    = 60 * 60 * 1000; // 1 hour cap
const IDLE_THRESHOLD         = 10 * 60;        // 10 min in seconds
const FAST_CYCLES            = 2;              // how many fast polls after spike

export class PollingService extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private lastData: UsageData | null = null;
  private errorCount = 0;
  private rateLimited = false;
  private rateLimitedUntil = 0;
  private rateLimitCount = 0; // consecutive 429s — drives exponential backoff
  private fastCyclesLeft = 0;
  private running = false;

  restoreRateLimit(until: number, count = 1): void {
    if (until > Date.now()) {
      this.rateLimited = true;
      this.rateLimitedUntil = until;
      this.rateLimitCount = count;
    }
  }

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
    if (this.rateLimited && this.rateLimitedUntil > Date.now()) {
      console.warn('[PollingService] Skipping triggerNow — still rate limited');
      return;
    }
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
    if (this.rateLimited) {
      const remaining = this.rateLimitedUntil - Date.now();
      if (remaining > 0) return remaining;
      // Countdown expired — clear flag and fall through to normal interval
      this.rateLimited = false;
    }
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

    // Respect rate limit before making any request
    if (this.rateLimited && this.rateLimitedUntil > Date.now()) {
      const delay = this.nextInterval();
      this.timer = setTimeout(() => void this.poll(), delay);
      return;
    }

    try {
      const data = await fetchUsageData();
      this.errorCount = 0;
      this.rateLimited = false;
      this.rateLimitCount = 0;

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
      const error = err instanceof Error ? err : new Error(String(err));
      const isRateLimit = (err as { isRateLimit?: boolean }).isRateLimit === true;

      if (isRateLimit) {
        this.rateLimited = true;
        this.rateLimitCount++;
        const resetAt = (err as { resetAt?: number }).resetAt;
        const retryAfterMs = (err as { retryAfterMs?: number }).retryAfterMs;
        let waitMs: number;
        if (resetAt && resetAt > Date.now()) {
          // API told us exactly when via reset header — trust it
          waitMs = resetAt - Date.now();
        } else if (retryAfterMs && retryAfterMs > 0) {
          // API told us via Retry-After header — trust it
          waitMs = retryAfterMs;
        } else {
          // No hint from API — exponential backoff: 5m, 10m, 20m, 40m, 60m (cap)
          waitMs = Math.min(
            POLL_RATE_LIMIT_BASE * Math.pow(2, this.rateLimitCount - 1),
            POLL_RATE_LIMIT_MAX
          );
        }
        this.rateLimitedUntil = Date.now() + waitMs;
        const waitMin = Math.round(waitMs / 60000);
        const waitSec = Math.round((waitMs % 60000) / 1000);
        console.warn(`[PollingService] Rate limited (attempt ${this.rateLimitCount}) — cooling down for ${waitMin > 0 ? `${waitMin}m ${waitSec}s` : `${waitSec}s`}`);
        this.emit('rate-limited', this.rateLimitedUntil, this.rateLimitCount, resetAt);
      } else {
        this.rateLimited = false;
        this.errorCount = Math.min(this.errorCount + 1, 8);
        console.error('[PollingService] Error fetching usage:', error.message);
      }

      this.emit('error', error);
    }

    if (!this.running) return;

    const delay = this.nextInterval();
    this.timer = setTimeout(() => void this.poll(), delay);
  }
}

export const pollingService = new PollingService();
