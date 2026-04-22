import { Hono } from 'hono';
import {
  SyncPushRequestSchema,
  type SyncDailySnapshot,
  type SyncSessionWindow,
  type SyncTimeSeriesPoint,
  type SyncUsageSnapshot,
  type SyncCurrentWindow,
  type SyncSettings,
  type SyncCliEvent,
} from '@claude-usage/shared';
import { getDb } from '../db/client';
import { logger } from '../logger';
import type { JwtPayload } from '../services/jwt';

export const syncRoute = new Hono();

function getUser(c: { get(key: string): unknown }): JwtPayload {
  return c.get('user') as JwtPayload;
}

// POST /sync/push
syncRoute.post('/push', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  const parsed = SyncPushRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }

  const { daily, sessionWindows, timeSeries, usageSnapshots, currentWindow, settings, cliEvents } =
    parsed.data;
  const { email, deviceId } = getUser(c);
  const now = Date.now();
  const db = getDb();

  try {
    db.transaction(() => {
      db.prepare(`UPDATE devices SET last_seen = ? WHERE device_id = ?`).run(now, deviceId);

      const upsertDaily = db.prepare(`
        INSERT INTO daily_snapshots
          (email, date, max_weekly, max_session, max_credits, session_window_count, session_accum, updated_at, updated_by_device)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(email, date) DO UPDATE SET
          max_weekly = MAX(max_weekly, excluded.max_weekly),
          max_session = MAX(max_session, excluded.max_session),
          max_credits = CASE
            WHEN excluded.max_credits IS NULL THEN max_credits
            WHEN max_credits IS NULL THEN excluded.max_credits
            ELSE MAX(max_credits, excluded.max_credits)
          END,
          session_window_count = MAX(session_window_count, excluded.session_window_count),
          session_accum = MAX(session_accum, excluded.session_accum),
          updated_at = MAX(updated_at, excluded.updated_at),
          updated_by_device = CASE WHEN excluded.updated_at > updated_at THEN excluded.updated_by_device ELSE updated_by_device END
      `);

      for (const snap of daily as SyncDailySnapshot[]) {
        upsertDaily.run(
          email,
          snap.date,
          snap.maxWeekly,
          snap.maxSession,
          snap.maxCredits ?? null,
          snap.sessionWindowCount,
          snap.sessionAccum,
          snap.updatedAt,
          snap.updatedByDevice,
        );
      }

      const upsertWindow = db.prepare(`
        INSERT INTO session_windows
          (email, date, resets_at_minute, resets_at_iso, peak, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(email, date, resets_at_minute) DO UPDATE SET
          peak = MAX(peak, excluded.peak),
          updated_at = MAX(updated_at, excluded.updated_at),
          resets_at_iso = CASE WHEN excluded.updated_at > updated_at THEN excluded.resets_at_iso ELSE resets_at_iso END
      `);

      for (const w of sessionWindows as SyncSessionWindow[]) {
        upsertWindow.run(email, w.date, w.resetsAtMinute, w.resetsAt, w.peak, w.updatedAt);
      }

      const insertTs = db.prepare(`
        INSERT OR IGNORE INTO time_series_points (email, date, ts, session, weekly, credits)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const p of timeSeries as SyncTimeSeriesPoint[]) {
        insertTs.run(email, p.date, p.ts, p.session, p.weekly, p.credits ?? null);
      }

      const insertSnap = db.prepare(`
        INSERT OR IGNORE INTO usage_snapshots (email, ts, session, weekly)
        VALUES (?, ?, ?, ?)
      `);
      for (const s of usageSnapshots as SyncUsageSnapshot[]) {
        insertSnap.run(email, s.ts, s.session, s.weekly);
      }

      if (cliEvents && cliEvents.length > 0) {
        // manter apenas o evento mais recente por session_id (os tokens são cumulativos do transcript)
        const latestBySession = new Map<string, SyncCliEvent>();
        for (const ev of cliEvents as SyncCliEvent[]) {
          const cur = latestBySession.get(ev.sessionId);
          if (!cur || ev.ts > cur.ts) latestBySession.set(ev.sessionId, ev);
        }
        const deleteCli = db.prepare(`DELETE FROM cli_usage_events WHERE email = ? AND session_id = ?`);
        const insertCli = db.prepare(`
          INSERT OR REPLACE INTO cli_usage_events
            (email, ts, session_id, tool_name, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const ev of latestBySession.values()) {
          const existing = db.prepare(`SELECT ts FROM cli_usage_events WHERE email = ? AND session_id = ?`).get(email, ev.sessionId) as { ts: number } | undefined;
          if (!existing || ev.ts >= existing.ts) {
            deleteCli.run(email, ev.sessionId);
            insertCli.run(email, ev.ts, ev.sessionId, ev.toolName, ev.inputTokens, ev.outputTokens, ev.cacheReadTokens, ev.cacheCreationTokens);
          }
        }
      }

      if (currentWindow || settings) {
        const existing = db
          .prepare(`SELECT payload FROM user_settings WHERE email = ?`)
          .get(email) as { payload: string } | undefined;

        const existingPayload: {
          currentWindow?: SyncCurrentWindow;
          settings?: SyncSettings;
        } = existing ? JSON.parse(existing.payload) : {};

        if (currentWindow) {
          const cur = currentWindow as SyncCurrentWindow;
          const prev = existingPayload.currentWindow;
          if (!prev || cur.resetsAt >= prev.resetsAt) {
            existingPayload.currentWindow = {
              resetsAt: cur.resetsAt,
              peak: Math.max(cur.peak, prev?.peak ?? 0),
              updatedAt: Math.max(cur.updatedAt, prev?.updatedAt ?? 0),
            };
          } else {
            existingPayload.currentWindow = {
              ...prev,
              peak: Math.max(prev.peak, cur.peak),
              updatedAt: Math.max(prev.updatedAt, cur.updatedAt),
            };
          }
        }

        if (settings) {
          const s = settings as SyncSettings;
          const prev = existingPayload.settings;
          if (!prev || s.updatedAt >= prev.updatedAt) {
            existingPayload.settings = s;
          }
        }

        db.prepare(`
          INSERT INTO user_settings (email, payload, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
        `).run(email, JSON.stringify(existingPayload), now);
      }
    })();

    logger.info(
      { email, deviceId, daily: daily.length, sessionWindows: sessionWindows.length },
      'Push accepted',
    );

    if (cliEvents && cliEvents.length > 0) {
      logger.info(
        {
          email,
          deviceId,
          count: cliEvents.length,
          events: cliEvents.map((e) => ({
            tool: e.toolName,
            session: e.sessionId,
            in: e.inputTokens,
            out: e.outputTokens,
            cacheRead: e.cacheReadTokens,
            cacheCreate: e.cacheCreationTokens,
          })),
        },
        'CLI events received',
      );
    }
    return c.json({ accepted: true, mergedAt: now });
  } catch (err) {
    logger.error({ err, email }, 'Push failed');
    return c.json({ error: 'internal_error' }, 500);
  }
});

// GET /sync/pull?since=<ts>
syncRoute.get('/pull', (c) => {
  const { email, deviceId } = getUser(c);
  const sinceParam = c.req.query('since');
  const since = sinceParam ? Number(sinceParam) : 0;
  const now = Date.now();
  const db = getDb();

  try {
    const daily = db
      .prepare(
        `SELECT date, max_weekly, max_session, max_credits, session_window_count, session_accum, updated_at, updated_by_device
         FROM daily_snapshots WHERE email = ? AND updated_at > ?`,
      )
      .all(email, since) as Array<{
      date: string;
      max_weekly: number;
      max_session: number;
      max_credits: number | null;
      session_window_count: number;
      session_accum: number;
      updated_at: number;
      updated_by_device: string;
    }>;

    const sessionWindows = db
      .prepare(
        `SELECT date, resets_at_iso, resets_at_minute, peak, updated_at
         FROM session_windows WHERE email = ? AND updated_at > ?`,
      )
      .all(email, since) as Array<{
      date: string;
      resets_at_iso: string;
      resets_at_minute: number;
      peak: number;
      updated_at: number;
    }>;

    const timeSeries = db
      .prepare(
        `SELECT date, ts, session, weekly, credits
         FROM time_series_points WHERE email = ? AND ts > ?`,
      )
      .all(email, since) as Array<{
      date: string;
      ts: number;
      session: number;
      weekly: number;
      credits: number | null;
    }>;

    const usageSnapshots = db
      .prepare(`SELECT ts, session, weekly FROM usage_snapshots WHERE email = ? AND ts > ?`)
      .all(email, since) as Array<{ ts: number; session: number; weekly: number }>;

    const settingsRow = db
      .prepare(`SELECT payload FROM user_settings WHERE email = ?`)
      .get(email) as { payload: string } | undefined;

    const settingsPayload: {
      currentWindow?: SyncCurrentWindow;
      settings?: SyncSettings;
    } = settingsRow ? JSON.parse(settingsRow.payload) : {};

    db.prepare(`
      INSERT INTO sync_cursors (email, device_id, last_pulled_at)
      VALUES (?, ?, ?)
      ON CONFLICT(email, device_id) DO UPDATE SET last_pulled_at = excluded.last_pulled_at
    `).run(email, deviceId, now);

    return c.json({
      daily: daily.map((r) => ({
        date: r.date,
        maxWeekly: r.max_weekly,
        maxSession: r.max_session,
        maxCredits: r.max_credits ?? undefined,
        sessionWindowCount: r.session_window_count,
        sessionAccum: r.session_accum,
        updatedAt: r.updated_at,
        updatedByDevice: r.updated_by_device,
      })),
      sessionWindows: sessionWindows.map((r) => ({
        date: r.date,
        resetsAt: r.resets_at_iso,
        resetsAtMinute: r.resets_at_minute,
        peak: r.peak,
        updatedAt: r.updated_at,
      })),
      timeSeries: timeSeries.map((r) => ({
        date: r.date,
        ts: r.ts,
        session: r.session,
        weekly: r.weekly,
        credits: r.credits ?? undefined,
      })),
      usageSnapshots: usageSnapshots.map((r) => ({
        ts: r.ts,
        session: r.session,
        weekly: r.weekly,
      })),
      currentWindow: settingsPayload.currentWindow,
      settings: settingsPayload.settings,
      serverTime: now,
    });
  } catch (err) {
    logger.error({ err, email }, 'Pull failed');
    return c.json({ error: 'internal_error' }, 500);
  }
});

// GET /sync/snapshot — dump completo
syncRoute.get('/snapshot', (c) => {
  const { email } = getUser(c);
  const db = getDb();

  try {
    const daily = db
      .prepare(
        `SELECT date, max_weekly, max_session, max_credits, session_window_count, session_accum, updated_at, updated_by_device
         FROM daily_snapshots WHERE email = ?`,
      )
      .all(email) as Array<{
      date: string;
      max_weekly: number;
      max_session: number;
      max_credits: number | null;
      session_window_count: number;
      session_accum: number;
      updated_at: number;
      updated_by_device: string;
    }>;

    const sessionWindows = db
      .prepare(
        `SELECT date, resets_at_iso, resets_at_minute, peak, updated_at FROM session_windows WHERE email = ?`,
      )
      .all(email) as Array<{
      date: string;
      resets_at_iso: string;
      resets_at_minute: number;
      peak: number;
      updated_at: number;
    }>;

    const timeSeries = db
      .prepare(
        `SELECT date, ts, session, weekly, credits FROM time_series_points WHERE email = ?`,
      )
      .all(email) as Array<{
      date: string;
      ts: number;
      session: number;
      weekly: number;
      credits: number | null;
    }>;

    const usageSnapshots = db
      .prepare(`SELECT ts, session, weekly FROM usage_snapshots WHERE email = ?`)
      .all(email) as Array<{ ts: number; session: number; weekly: number }>;

    const settingsRow = db
      .prepare(`SELECT payload FROM user_settings WHERE email = ?`)
      .get(email) as { payload: string } | undefined;

    const settingsPayload: {
      currentWindow?: SyncCurrentWindow;
      settings?: SyncSettings;
    } = settingsRow ? JSON.parse(settingsRow.payload) : {};

    return c.json({
      daily: daily.map((r) => ({
        date: r.date,
        maxWeekly: r.max_weekly,
        maxSession: r.max_session,
        maxCredits: r.max_credits ?? undefined,
        sessionWindowCount: r.session_window_count,
        sessionAccum: r.session_accum,
        updatedAt: r.updated_at,
        updatedByDevice: r.updated_by_device,
      })),
      sessionWindows: sessionWindows.map((r) => ({
        date: r.date,
        resetsAt: r.resets_at_iso,
        resetsAtMinute: r.resets_at_minute,
        peak: r.peak,
        updatedAt: r.updated_at,
      })),
      timeSeries: timeSeries.map((r) => ({
        date: r.date,
        ts: r.ts,
        session: r.session,
        weekly: r.weekly,
        credits: r.credits ?? undefined,
      })),
      usageSnapshots: usageSnapshots.map((r) => ({
        ts: r.ts,
        session: r.session,
        weekly: r.weekly,
      })),
      currentWindow: settingsPayload.currentWindow,
      settings: settingsPayload.settings,
      serverTime: Date.now(),
    });
  } catch (err) {
    logger.error({ err, email }, 'Snapshot failed');
    return c.json({ error: 'internal_error' }, 500);
  }
});

// DELETE /sync/account
syncRoute.delete('/account', (c) => {
  const { email } = getUser(c);
  const db = getDb();

  try {
    db.transaction(() => {
      db.prepare(`DELETE FROM sync_cursors WHERE email = ?`).run(email);
      db.prepare(`DELETE FROM user_settings WHERE email = ?`).run(email);
      db.prepare(`DELETE FROM usage_snapshots WHERE email = ?`).run(email);
      db.prepare(`DELETE FROM time_series_points WHERE email = ?`).run(email);
      db.prepare(`DELETE FROM session_windows WHERE email = ?`).run(email);
      db.prepare(`DELETE FROM daily_snapshots WHERE email = ?`).run(email);
      db.prepare(`DELETE FROM devices WHERE email = ?`).run(email);
      db.prepare(`DELETE FROM users WHERE email = ?`).run(email);
    })();

    logger.info({ email }, 'Account data deleted');
    return c.json({ deleted: true });
  } catch (err) {
    logger.error({ err, email }, 'Account deletion failed');
    return c.json({ error: 'internal_error' }, 500);
  }
});
