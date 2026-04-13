import { getSettings } from './settingsService';
import { DailySnapshot, CurrentSessionWindow, UsageData } from '../models/usageData';

const DEFAULT_MONTHLY_BUDGET = 50;

const MODEL_RATES = {
  sonnet: { input: 3.0, output: 15.0 },
  haiku: { input: 0.25, output: 1.25 },
  opus: { input: 15.0, output: 75.0 },
} as const;

type ModelType = keyof typeof MODEL_RATES;

function getTokensPerPercent(model: ModelType): number {
  switch (model) {
    case 'haiku':
      return 4_000_000;
    case 'opus':
      return 10_000;
    case 'sonnet':
    default:
      return 1_000_000;
  }
}

function calculateCost(
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
}

export interface CostEstimate {
  session: CostBreakdown;
  weekly: CostBreakdown;
  monthly: CostBreakdown;
  budget: number;
  budgetPercentage: number;
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

  const sessionInput = Math.round((sessionPercent / 100) * tokensPerPct * 0.5);
  const sessionOutput = Math.round((sessionPercent / 100) * tokensPerPct * 0.5);

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
  };

  const weekly = {
    total: calculateCost(weeklyInput, weeklyOutput, model),
    input: calculateCost(weeklyInput, 0, model),
    output: calculateCost(0, weeklyOutput, model),
    model,
  };

  const monthlyPct = weeklyPct * 4;
  const { weeklyInput: _mInput, weeklyOutput: _mOutput, sessionInput: _sInput, sessionOutput: _sOutput } = estimateTokensFromPercent(monthlyPct, monthlyPct * 7, model);
  const monthlyInput = Math.round(_mInput * 4.3);
  const monthlyOutput = Math.round(_mOutput * 4.3);

  const monthly = {
    total: calculateCost(monthlyInput, monthlyOutput, model),
    input: calculateCost(monthlyInput, 0, model),
    output: calculateCost(0, monthlyOutput, model),
    model,
  };

  const budgetPercentage = Math.round((monthly.total / budget) * 100);

  return {
    session,
    weekly,
    monthly,
    budget,
    budgetPercentage,
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
