import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as os from 'os';
import {
  getSettings,
  saveSettings,
  getCloudSyncSecrets,
  setCloudSyncSecrets,
  getOutbox,
  setOutbox,
  appendOutbox,
  clearOutbox,
  OutboxItem,
  CloudSyncSettings,
} from './settingsService';
import { getAccessToken } from './credentialService';
import { getAccountData, saveAccountData } from './settingsService';
import {
  mergeDailySnapshots,
  mergeSessionWindows,
  mergeCurrentWindow,
  mergeTimeSeries,
  mergeUsageHistory,
  SyncDailySnapshot,
  SyncSessionWindow,
  SyncTimeSeriesPoint,
  SyncUsageSnapshot,
  SyncCurrentWindow,
  SyncPullResponse,
  AuthExchangeResponse,
} from '@claude-usage/shared';
import type { AccountData } from './settingsService';

// Backoff em minutos: [1, 2, 5, 10, 30]
const BACKOFF_MINUTES = [1, 2, 5, 10, 30];

export interface SyncStatus {
  enabled: boolean;
  lastSyncAt: number;
  lastError: string;
  pendingOps: number;
  jwtExpiresAt: number;
  email: string;
}

class SyncService extends EventEmitter {
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private backoffTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffCount = 0;
  private temporarilyDisabled = false;
  private isSyncing = false;
  private jwtEmail = '';

  async init(): Promise<void> {
    const settings = getSettings();
    const cloudSync = settings.cloudSync;
    if (!cloudSync.enabled) return;

    const secrets = getCloudSyncSecrets();

    // Decodifica email do JWT se existir
    if (secrets.jwt) {
      this.jwtEmail = this.decodeEmailFromJwt(secrets.jwt);
    }

    this.schedulePeriodicSync(cloudSync.syncIntervalMinutes);
  }

  async enable(serverUrl: string, deviceLabel?: string): Promise<void> {
    try {
      const settings = getSettings();
      let { deviceId } = settings.cloudSync;

      if (!deviceId) {
        deviceId = crypto.randomUUID();
      }

      const label = deviceLabel ?? os.hostname();

      const accessToken = await getAccessToken();
      const exchangeResp = await this.doExchange(serverUrl, accessToken, deviceId, label);

      setCloudSyncSecrets({ jwt: exchangeResp.jwt, jwtExpiresAt: exchangeResp.expiresAt });
      this.jwtEmail = exchangeResp.email;

      const updatedCloudSync: CloudSyncSettings = {
        ...settings.cloudSync,
        enabled: true,
        serverUrl,
        deviceId,
        deviceLabel: label,
        lastSyncError: '',
      };
      saveSettings({ cloudSync: updatedCloudSync });

      this.temporarilyDisabled = false;
      this.backoffCount = 0;

      // Snapshot inicial
      await this.doSnapshot(serverUrl, exchangeResp.jwt);

      this.schedulePeriodicSync(updatedCloudSync.syncIntervalMinutes);
      this.emit('sync-event', { type: 'enabled', payload: { email: exchangeResp.email } });
    } catch (err) {
      this.handleError('enable', err);
    }
  }

  async disable(wipeRemote = false): Promise<void> {
    this.clearTimers();

    try {
      if (wipeRemote) {
        const settings = getSettings();
        const secrets = getCloudSyncSecrets();
        if (secrets.jwt && settings.cloudSync.serverUrl) {
          await fetch(`${settings.cloudSync.serverUrl}/sync/account`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${secrets.jwt}` },
          }).catch(() => {}); // fire and forget — ignora erros
        }
      }
    } catch {
      // silencioso
    }

    setCloudSyncSecrets({ jwt: '', jwtExpiresAt: 0 });
    clearOutbox();
    this.jwtEmail = '';

    const settings = getSettings();
    saveSettings({
      cloudSync: {
        ...settings.cloudSync,
        enabled: false,
        lastSyncError: '',
        lastSyncAt: 0,
        lastPullCursor: 0,
      },
    });

    this.emit('sync-event', { type: 'disabled', payload: {} });
  }

  async syncNow(): Promise<void> {
    if (this.temporarilyDisabled) return;
    if (this.isSyncing) return;

    const settings = getSettings();
    const cloudSync = settings.cloudSync;
    if (!cloudSync.enabled) return;

    this.isSyncing = true;
    this.emit('sync-event', { type: 'sync-started', payload: {} });

    try {
      const jwt = await this.ensureValidJwt(cloudSync.serverUrl, cloudSync.deviceId, cloudSync.deviceLabel);
      if (!jwt) return;

      await this.flushOutbox(cloudSync.serverUrl, jwt);
      await this.doPull(cloudSync.serverUrl, jwt, cloudSync.lastPullCursor);

      const now = Date.now();
      saveSettings({
        cloudSync: {
          ...getSettings().cloudSync,
          lastSyncAt: now,
          lastSyncError: '',
        },
      });
      this.backoffCount = 0;
      this.emit('sync-event', { type: 'sync-success', payload: { at: now } });
    } catch (err) {
      this.handleError('syncNow', err);
    } finally {
      this.isSyncing = false;
    }
  }

  enqueuePush(accountData: AccountData): void {
    const settings = getSettings();
    if (!settings.cloudSync.enabled) return;
    if (this.temporarilyDisabled) return;

    const item: OutboxItem = {
      op: 'push',
      payload: this.buildPushPayload(accountData, settings.cloudSync.deviceId),
      attemptCount: 0,
      lastError: '',
      queuedAt: Date.now(),
    };

    appendOutbox(item);

    // Tenta sync imediatamente em background
    void this.syncNow();
  }

  getStatus(): SyncStatus {
    const settings = getSettings();
    const cloudSync = settings.cloudSync;
    const secrets = getCloudSyncSecrets();
    return {
      enabled: cloudSync.enabled,
      lastSyncAt: cloudSync.lastSyncAt,
      lastError: cloudSync.lastSyncError,
      pendingOps: getOutbox().length,
      jwtExpiresAt: secrets.jwtExpiresAt,
      email: this.jwtEmail,
    };
  }

  // ─── Privados ─────────────────────────────────────────────────────────────

  private async doExchange(
    serverUrl: string,
    accessToken: string,
    deviceId: string,
    deviceLabel: string,
  ): Promise<AuthExchangeResponse> {
    const resp = await fetch(`${serverUrl}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, deviceId, deviceLabel }),
    });

    if (resp.status === 401) {
      throw new Error('AUTH_401');
    }
    if (!resp.ok) {
      throw new Error(`Exchange failed: ${resp.status}`);
    }

    return resp.json() as Promise<AuthExchangeResponse>;
  }

  private async doSnapshot(serverUrl: string, jwt: string): Promise<void> {
    const resp = await fetch(`${serverUrl}/sync/snapshot`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (resp.status === 401) throw new Error('AUTH_401');
    if (!resp.ok) throw new Error(`Snapshot failed: ${resp.status}`);

    const data = await resp.json() as SyncPullResponse;
    this.applyPullResponse(data);

    saveSettings({
      cloudSync: {
        ...getSettings().cloudSync,
        lastPullCursor: data.serverTime,
      },
    });
  }

  private async doPull(serverUrl: string, jwt: string, since: number): Promise<void> {
    const url = `${serverUrl}/sync/pull?since=${since}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (resp.status === 401) throw new Error('AUTH_401');
    if (!resp.ok) throw new Error(`Pull failed: ${resp.status}`);

    const data = await resp.json() as SyncPullResponse;
    this.applyPullResponse(data);

    saveSettings({
      cloudSync: {
        ...getSettings().cloudSync,
        lastPullCursor: data.serverTime,
      },
    });
  }

  private applyPullResponse(data: SyncPullResponse): void {
    const accountData = getAccountData();
    const settings = getSettings();
    const deviceId = settings.cloudSync.deviceId;

    const localDaily: SyncDailySnapshot[] = (accountData.dailyHistory ?? []).map(d => ({
      date: d.date,
      maxWeekly: d.maxWeekly ?? 0,
      maxSession: d.maxSession ?? 0,
      sessionWindowCount: d.sessionWindowCount ?? 0,
      sessionAccum: d.sessionAccum ?? 0,
      updatedAt: Date.now(),
      updatedByDevice: deviceId,
    }));

    const localWindows: SyncSessionWindow[] = (accountData.sessionWindows ?? []).map(w => ({
      date: w.date ?? w.resetsAt.slice(0, 10),
      resetsAt: w.resetsAt,
      resetsAtMinute: Math.floor(new Date(w.resetsAt).getTime() / 60000),
      peak: w.peak ?? 0,
      updatedAt: Date.now(),
    }));

    const localTimeSeries: SyncTimeSeriesPoint[] = Object.entries(accountData.timeSeries ?? {}).flatMap(
      ([date, pts]) => (pts ?? []).map(p => ({ ...p, date })),
    );

    const localUsage: SyncUsageSnapshot[] = (accountData.usageHistory ?? []).map(s => ({
      ts: s.ts,
      session: s.session,
      weekly: s.weekly,
    }));

    const mergedDaily = mergeDailySnapshots(localDaily, data.daily ?? []);
    const mergedWindows = mergeSessionWindows(localWindows, data.sessionWindows ?? []);
    const mergedTimeSeries = mergeTimeSeries(localTimeSeries, data.timeSeries ?? []);
    const mergedUsage = mergeUsageHistory(localUsage, data.usageSnapshots ?? []);

    const localCurrentWindow: SyncCurrentWindow | undefined = accountData.currentSessionWindow
      ? {
          resetsAt: accountData.currentSessionWindow.resetsAt,
          peak: accountData.currentSessionWindow.peak ?? 0,
          updatedAt: Date.now(),
        }
      : undefined;

    const mergedCurrent = mergeCurrentWindow(localCurrentWindow, data.currentWindow);

    // Reconstruir dailyHistory no formato local
    const newDailyHistory = mergedDaily.map(d => ({
      date: d.date,
      maxWeekly: d.maxWeekly,
      maxSession: d.maxSession,
      maxCredits: d.maxCredits,
      sessionWindowCount: d.sessionWindowCount,
      sessionAccum: d.sessionAccum,
    }));

    // Reconstruir sessionWindows no formato local
    const newSessionWindows = mergedWindows.map(w => ({
      date: w.date,
      resetsAt: w.resetsAt,
      peak: w.peak,
    }));

    // Reconstruir timeSeries no formato local (Record<string, TimeSeriesPoint[]>)
    const newTimeSeries: AccountData['timeSeries'] = {};
    for (const pt of mergedTimeSeries) {
      const d = pt.date;
      if (!newTimeSeries[d]) newTimeSeries[d] = [];
      newTimeSeries[d]!.push({ ts: pt.ts, session: pt.session, weekly: pt.weekly, ...(pt.credits !== undefined ? { credits: pt.credits } : {}) });
    }

    // Reconstruir usageHistory
    const newUsageHistory = mergedUsage.map(u => ({ ts: u.ts, session: u.session, weekly: u.weekly }));

    const updates: Partial<AccountData> = {
      dailyHistory: newDailyHistory as AccountData['dailyHistory'],
      sessionWindows: newSessionWindows as AccountData['sessionWindows'],
      timeSeries: newTimeSeries,
      usageHistory: newUsageHistory as AccountData['usageHistory'],
    };

    if (mergedCurrent) {
      updates.currentSessionWindow = {
        resetsAt: mergedCurrent.resetsAt,
        peak: mergedCurrent.peak,
      } as AccountData['currentSessionWindow'];
    }

    saveAccountData(updates);
  }

  private async flushOutbox(serverUrl: string, jwt: string): Promise<void> {
    const outbox = getOutbox();
    if (outbox.length === 0) return;

    const failed: OutboxItem[] = [];

    for (const item of outbox) {
      try {
        if (item.op === 'push') {
          const resp = await fetch(`${serverUrl}/sync/push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify(item.payload),
          });

          if (resp.status === 401) throw new Error('AUTH_401');
          if (!resp.ok) throw new Error(`Push failed: ${resp.status}`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg === 'AUTH_401') throw new Error('AUTH_401');
        failed.push({ ...item, attemptCount: item.attemptCount + 1, lastError: errorMsg });
      }
    }

    if (failed.length > 0) {
      setOutbox(failed);
    } else {
      clearOutbox();
    }
  }

  private async ensureValidJwt(serverUrl: string, deviceId: string, deviceLabel: string): Promise<string | null> {
    const secrets = getCloudSyncSecrets();
    const FIVE_MIN = 5 * 60 * 1000;

    if (secrets.jwt && secrets.jwtExpiresAt > Date.now() + FIVE_MIN) {
      return secrets.jwt;
    }

    // Re-exchange
    try {
      const accessToken = await getAccessToken();
      const exchangeResp = await this.doExchange(serverUrl, accessToken, deviceId, deviceLabel);
      setCloudSyncSecrets({ jwt: exchangeResp.jwt, jwtExpiresAt: exchangeResp.expiresAt });
      this.jwtEmail = exchangeResp.email;
      return exchangeResp.jwt;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'AUTH_401') {
        this.temporarilyDisabled = true;
        const csettings = getSettings();
        saveSettings({
          cloudSync: {
            ...csettings.cloudSync,
            lastSyncError: 'Autenticação falhou — re-habilite o cloud sync',
          },
        });
        this.emit('sync-event', { type: 'sync-error', payload: { error: 'auth-failed' } });
        return null;
      }
      throw err;
    }
  }

  private buildPushPayload(accountData: AccountData, deviceId: string): object {
    const daily: SyncDailySnapshot[] = (accountData.dailyHistory ?? []).map(d => ({
      date: d.date,
      maxWeekly: d.maxWeekly ?? 0,
      maxSession: d.maxSession ?? 0,
      sessionWindowCount: d.sessionWindowCount ?? 0,
      sessionAccum: d.sessionAccum ?? 0,
      updatedAt: Date.now(),
      updatedByDevice: deviceId,
    }));

    const sessionWindows: SyncSessionWindow[] = (accountData.sessionWindows ?? []).map(w => ({
      date: w.date ?? w.resetsAt.slice(0, 10),
      resetsAt: w.resetsAt,
      resetsAtMinute: Math.floor(new Date(w.resetsAt).getTime() / 60000),
      peak: w.peak ?? 0,
      updatedAt: Date.now(),
    }));

    const timeSeries: SyncTimeSeriesPoint[] = Object.entries(accountData.timeSeries ?? {}).flatMap(
      ([date, pts]) => (pts ?? []).map(p => ({ ...p, date })),
    );

    const usageSnapshots: SyncUsageSnapshot[] = (accountData.usageHistory ?? []).map(s => ({
      ts: s.ts,
      session: s.session,
      weekly: s.weekly,
    }));

    const currentWindow: SyncCurrentWindow | undefined = accountData.currentSessionWindow
      ? {
          resetsAt: accountData.currentSessionWindow.resetsAt,
          peak: accountData.currentSessionWindow.peak ?? 0,
          updatedAt: Date.now(),
        }
      : undefined;

    return {
      deviceId,
      daily,
      sessionWindows,
      timeSeries,
      usageSnapshots,
      ...(currentWindow ? { currentWindow } : {}),
    };
  }

  private handleError(context: string, err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[SyncService] ${context} error:`, msg);

    const settings = getSettings();
    saveSettings({
      cloudSync: {
        ...settings.cloudSync,
        lastSyncError: msg,
      },
    });

    this.scheduleBackoff();
    this.emit('sync-event', { type: 'sync-error', payload: { error: msg } });
  }

  private scheduleBackoff(): void {
    if (this.backoffTimer) clearTimeout(this.backoffTimer);
    const idx = Math.min(this.backoffCount, BACKOFF_MINUTES.length - 1);
    const delayMs = BACKOFF_MINUTES[idx]! * 60 * 1000;
    this.backoffCount++;
    this.backoffTimer = setTimeout(() => {
      this.backoffTimer = null;
      void this.syncNow();
    }, delayMs);
  }

  private schedulePeriodicSync(intervalMinutes: number): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
    const intervalMs = intervalMinutes * 60 * 1000;
    this.syncTimer = setInterval(() => {
      void this.syncNow();
    }, intervalMs);
  }

  private clearTimers(): void {
    if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null; }
    if (this.backoffTimer) { clearTimeout(this.backoffTimer); this.backoffTimer = null; }
  }

  private decodeEmailFromJwt(jwt: string): string {
    try {
      const parts = jwt.split('.');
      if (parts.length < 2) return '';
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf-8')) as Record<string, unknown>;
      return typeof payload['email'] === 'string' ? payload['email'] : '';
    } catch {
      return '';
    }
  }
}

export const syncService = new SyncService();
