const makeBreakdown = (total: number, model = 'sonnet') => ({
  total,
  input: total * 0.5,
  output: total * 0.5,
  model,
  inputTokens: 250000,
  outputTokens: 250000,
});

const makeEstimate = (budgetPct: number, budget = 50) => ({
  session: makeBreakdown(1.5),
  weekly: makeBreakdown(5.0),
  monthly: makeBreakdown((budgetPct / 100) * budget),
  budget,
  budgetPercentage: budgetPct,
  sessionPct: 45,
  weeklyPct: 72,
  modelRates: { input: 3.0, output: 15.0 },
});

// Verde: < 50% do orçamento
export const COST_GREEN = makeEstimate(40);

// Amarelo: 50–80% do orçamento
export const COST_YELLOW = makeEstimate(65);

// Vermelho: > 80% do orçamento
export const COST_RED = makeEstimate(90);
