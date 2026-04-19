import { getSettings } from './settingsService';
import { DailySnapshot, CurrentSessionWindow, UsageData } from '../models/usageData';

const DEFAULT_MONTHLY_BUDGET = 50;

const MODEL_RATES = {
  sonnet: { input: 3.0, output: 15.0 },
  haiku: { input: 0.25, output: 1.25 },
  opus: { input: 15.0, output: 75.0 },
} as const;

type ModelType = keyof typeof MODEL_RATES;

// Base de tokens assumida em 100% de utilização.
// O seletor de modelo representa "qual modelo estou usando na sessão".
// A mesma % de utilização com Opus deve custar ~5× mais que Sonnet (taxas 5× maiores).
// Por isso Sonnet e Opus usam a mesma base de tokens — a diferença de custo vem
// exclusivamente das taxas por token. Haiku tem base 4× maior pois é um modelo
// muito mais barato e o plano permite muito mais tokens com ele.
// Valores são estimativas — a API não expõe limites brutos de tokens.
function getTokensPerPercent(model: ModelType): number {
  switch (model) {
    case 'haiku':
      return 4_000_000;  // 4× mais tokens que Sonnet → custo 100% ≈ $3
    case 'opus':
      return 1_000_000;  // mesma base do Sonnet → custo 100% ≈ $45 (5× Sonnet)
    case 'sonnet':
    default:
      return 1_000_000;  // custo 100% ≈ $9
  }
}

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: ModelType = 'sonnet'
): number {
  const rates = MODEL_RATES[model];
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;
  return inputCost + outputCost;
}

export interface CostBreakdown {
  total: number;
  input: number;
  output: number;
  model: ModelType;
  inputTokens: number;
  outputTokens: number;
}

export interface CostEstimate {
  session: CostBreakdown;
  weekly: CostBreakdown;
  monthly: CostBreakdown;
  budget: number;
  budgetPercentage: number;
  sessionPct: number;
  weeklyPct: number;
  modelRates: { input: number; output: number };
}

export function percentToTokens(percent: number, model: ModelType = 'sonnet'): number {
  return Math.round((percent / 100) * getTokensPerPercent(model));
}

function estimateTokensFromPercent(
  sessionPercent: number,
  weeklyPercent: number,
  model: ModelType = 'sonnet'
): { sessionInput: number; sessionOutput: number; weeklyInput: number; weeklyOutput: number } {
  const tokensPerPct = getTokensPerPercent(model);

  // 50% input / 50% output split assumed (industry average for chat workloads)
  const sessionInput = Math.round((sessionPercent / 100) * tokensPerPct * 0.5);
  const sessionOutput = Math.round((sessionPercent / 100) * tokensPerPct * 0.5);

  // Weekly quota estimated as 7× the per-session quota
  const weeklyInput = Math.round((weeklyPercent / 100) * tokensPerPct * 7 * 0.5);
  const weeklyOutput = Math.round((weeklyPercent / 100) * tokensPerPct * 7 * 0.5);

  return { sessionInput, sessionOutput, weeklyInput, weeklyOutput };
}

export function calculateCostEstimate(
  data: UsageData,
  dailyHistory: DailySnapshot[],
  currentWindow: CurrentSessionWindow | null
): CostEstimate {
  const settings = getSettings();
  const model = (settings.costModel ?? 'sonnet') as ModelType;
  const budget = settings.monthlyBudget ?? DEFAULT_MONTHLY_BUDGET;

  const sessionPct = data.five_hour.utilization;
  const weeklyPct = data.seven_day.utilization;

  const { sessionInput, sessionOutput, weeklyInput, weeklyOutput } = estimateTokensFromPercent(
    sessionPct,
    weeklyPct,
    model
  );

  const session = {
    total: calculateCost(sessionInput, sessionOutput, model),
    input: calculateCost(sessionInput, 0, model),
    output: calculateCost(0, sessionOutput, model),
    model,
    inputTokens: sessionInput,
    outputTokens: sessionOutput,
  };

  const weekly = {
    total: calculateCost(weeklyInput, weeklyOutput, model),
    input: calculateCost(weeklyInput, 0, model),
    output: calculateCost(0, weeklyOutput, model),
    model,
    inputTokens: weeklyInput,
    outputTokens: weeklyOutput,
  };

  // Monthly = weekly extrapolated by 30/7 ≈ 4.3
  const monthlyInput = Math.round(weeklyInput * (30 / 7));
  const monthlyOutput = Math.round(weeklyOutput * (30 / 7));

  const monthly = {
    total: calculateCost(monthlyInput, monthlyOutput, model),
    input: calculateCost(monthlyInput, 0, model),
    output: calculateCost(0, monthlyOutput, model),
    model,
    inputTokens: monthlyInput,
    outputTokens: monthlyOutput,
  };

  const budgetPercentage = Math.round((monthly.total / budget) * 100);

  return {
    session,
    weekly,
    monthly,
    budget,
    budgetPercentage,
    sessionPct,
    weeklyPct,
    modelRates: MODEL_RATES[model],
  };
}

export function getCostModelLabel(model: ModelType): string {
  switch (model) {
    case 'haiku':
      return 'Haiku';
    case 'opus':
      return 'Opus';
    case 'sonnet':
    default:
      return 'Sonnet';
  }
}
