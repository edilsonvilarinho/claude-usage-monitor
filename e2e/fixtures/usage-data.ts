/**
 * Fixtures de UsageData para diferentes cenários de teste.
 *
 * IMPORTANTE: utilization é um número que já representa percentual.
 * Exemplo: utilization=45 → exibe "45%", utilization=1600 → exibe "1600%"
 * O Dashboard.ts divide por 100 internamente para calcular proporções.
 */

export interface UsageWindow {
  utilization: number; // percentual (ex: 45 = 45%, 1600 = 1600%)
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
  extra_usage?: ExtraUsage;
}

// Uso normal — sessão 45%, semanal 72%
export const NORMAL_USAGE: UsageData = {
  five_hour: { utilization: 45, resets_at: '2026-04-20T17:00:00Z' },
  seven_day: { utilization: 72, resets_at: '2026-04-27T00:00:00Z' },
};

// Uso alto — sessão 85%, semanal 90%
export const HIGH_USAGE: UsageData = {
  five_hour: { utilization: 85, resets_at: '2026-04-20T17:00:00Z' },
  seven_day: { utilization: 90, resets_at: '2026-04-27T00:00:00Z' },
};

// Acima de 100% — sessão 1600%, semanal 105%
export const OVER_100_USAGE: UsageData = {
  five_hour: { utilization: 1600, resets_at: '2026-04-20T17:00:00Z' },
  seven_day: { utilization: 105, resets_at: '2026-04-27T00:00:00Z' },
};

// Uso baixo — sessão 3%, semanal 2%
export const LOW_USAGE: UsageData = {
  five_hour: { utilization: 3, resets_at: '2026-04-20T17:00:00Z' },
  seven_day: { utilization: 2, resets_at: '2026-04-27T00:00:00Z' },
};

// Próximo do reset — sessão 98%, semanal 35%
export const NEAR_RESET_USAGE: UsageData = {
  five_hour: { utilization: 98, resets_at: '2026-04-20T15:05:00Z' },
  seven_day: { utilization: 35, resets_at: '2026-04-27T00:00:00Z' },
};

// Sem uso — sessão 0%, semanal 0%
export const ZERO_USAGE: UsageData = {
  five_hour: { utilization: 0, resets_at: '2026-04-20T17:00:00Z' },
  seven_day: { utilization: 0, resets_at: '2026-04-27T00:00:00Z' },
};

// Com créditos extras — 60% usado (6000/10000 cents)
export const USAGE_WITH_CREDITS: UsageData = {
  five_hour: { utilization: 45, resets_at: '2026-04-20T17:00:00Z' },
  seven_day: { utilization: 72, resets_at: '2026-04-27T00:00:00Z' },
  extra_usage: { is_enabled: true, monthly_limit: 10000, used_credits: 6000 },
};

// Com Sonnet semanal — 38%
export const USAGE_WITH_SONNET: UsageData = {
  five_hour: { utilization: 45, resets_at: '2026-04-20T17:00:00Z' },
  seven_day: { utilization: 72, resets_at: '2026-04-27T00:00:00Z' },
  seven_day_sonnet: { utilization: 38, resets_at: '2026-04-27T00:00:00Z' },
};

// Com ambas as barras extras
export const USAGE_WITH_BOTH_EXTRAS: UsageData = {
  five_hour: { utilization: 45, resets_at: '2026-04-20T17:00:00Z' },
  seven_day: { utilization: 72, resets_at: '2026-04-27T00:00:00Z' },
  seven_day_sonnet: { utilization: 38, resets_at: '2026-04-27T00:00:00Z' },
  extra_usage: { is_enabled: true, monthly_limit: 10000, used_credits: 6000 },
};

// Extra usage desabilitado (is_enabled=false)
export const USAGE_CREDITS_DISABLED: UsageData = {
  five_hour: { utilization: 45, resets_at: '2026-04-20T17:00:00Z' },
  seven_day: { utilization: 72, resets_at: '2026-04-27T00:00:00Z' },
  extra_usage: { is_enabled: false, monthly_limit: 10000, used_credits: 6000 },
};
