export interface UsageSnapshot {
  ts: number;      // unix ms
  session: number; // percentual inteiro 0-999
  weekly: number;  // percentual inteiro 0-999
}

/** Um ponto de coleta da série temporal diária (um por poll bem-sucedido) */
export interface TimeSeriesPoint {
  ts: number;       // unix ms
  session: number;  // utilization bruta da API (inteiro, pode ser > 100)
  weekly: number;   // utilization bruta da API (inteiro, pode ser > 100)
  credits?: number; // % de créditos usados (0-100), presente só quando extra_usage.is_enabled
}

/** Janela de sessão de 5h completada — usada como marcador no gráfico e para sessionAccum */
export interface SessionWindowRecord {
  resetsAt: string; // ISO datetime — quando esta janela resetou
  peak: number;     // pico de utilization observado (inteiro, pode ser > 100)
  date: string;     // YYYY-MM-DD — dia ao qual esta janela pertence
}

/** Estado da janela de sessão corrente — persistido para detectar resets após restart */
export interface CurrentSessionWindow {
  resetsAt: string; // five_hour.resets_at atual da API
  peak: number;     // maior utilization visto nesta janela até agora
}

export interface DailySnapshot {
  date: string;          // 'YYYY-MM-DD' (local timezone)
  maxWeekly: number;     // max weekly % seen that day (integer 0-999)
  maxSession: number;    // peak session % of current/last window (integer 0-999)
  maxCredits?: number;   // max credits % seen that day (integer 0-100), only when enabled
  sessionWindowCount?: number; // # of 5h windows that started today (default 1)
  sessionAccum?: number;  // sum of peaks of completed windows (current excluded)
}

export interface UsageWindow {
  utilization: number; // 0.0 to 100.0 (percentage)
  resets_at: string;   // ISO datetime string
}

export interface ExtraUsage {
  is_enabled: boolean;
  monthly_limit: number; // cents
  used_credits: number;  // cents
}

export interface UsageData {
  five_hour: UsageWindow;
  seven_day: UsageWindow;
  seven_day_sonnet?: UsageWindow;
  sonnet_only?: UsageWindow;
  extra_usage?: ExtraUsage;
}

export interface ProfileData {
  account: {
    display_name: string;
    email: string;
    has_claude_pro: boolean;
    has_claude_max: boolean;
  };
}

export interface CredentialsFile {
  claudeAiOauth: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // Unix milliseconds
    scopes?: string[];
    subscriptionType?: string;
  };
}
