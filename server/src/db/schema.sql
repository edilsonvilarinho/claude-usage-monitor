-- Schema SQLite para o Claude Usage Monitor Sync Server
-- Criado na Fase 2 (boilerplate aqui para referência)

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_snapshots (
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  date TEXT NOT NULL,          -- YYYY-MM-DD
  max_weekly INTEGER NOT NULL DEFAULT 0,
  max_session INTEGER NOT NULL DEFAULT 0,
  max_credits INTEGER,
  session_window_count INTEGER NOT NULL DEFAULT 1,
  session_accum INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by_device TEXT NOT NULL,
  PRIMARY KEY (email, date)
);

CREATE TABLE IF NOT EXISTS session_windows (
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  date TEXT NOT NULL,          -- YYYY-MM-DD
  resets_at_minute INTEGER NOT NULL,
  resets_at_iso TEXT NOT NULL,
  peak INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (email, date, resets_at_minute)
);

CREATE TABLE IF NOT EXISTS time_series_points (
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  date TEXT NOT NULL,          -- YYYY-MM-DD (índice)
  ts INTEGER NOT NULL,         -- unix ms
  session INTEGER NOT NULL,
  weekly INTEGER NOT NULL,
  credits INTEGER,
  PRIMARY KEY (email, ts)
);
CREATE INDEX IF NOT EXISTS idx_time_series_date ON time_series_points (email, date);

CREATE TABLE IF NOT EXISTS usage_snapshots (
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  ts INTEGER NOT NULL,         -- unix ms
  session INTEGER NOT NULL,
  weekly INTEGER NOT NULL,
  PRIMARY KEY (email, ts)
);

CREATE TABLE IF NOT EXISTS user_settings (
  email TEXT PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
  payload TEXT NOT NULL,       -- JSON
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_cursors (
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  last_pulled_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (email, device_id)
);

CREATE TABLE IF NOT EXISTS cli_usage_events (
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  ts INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (email, ts, session_id, tool_name)
);
