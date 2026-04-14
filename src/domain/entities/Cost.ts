export interface CostBreakdown {
  input: number;
  output: number;
  total: number;
}

export interface CostEstimate {
  session: CostBreakdown;
  weekly: CostBreakdown;
  monthly: CostBreakdown;
}

export type CostPeriod = 'session' | 'weekly' | 'monthly';
export type CostModel = 'sonnet' | 'haiku' | 'opus';