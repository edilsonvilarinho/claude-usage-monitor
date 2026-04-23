import type { CliSession, CliSessionTurn, SessionAnalytics } from '../domain/entities/Usage';

const RATES = {
  input: 3.0 / 1_000_000,
  output: 15.0 / 1_000_000,
  cacheRead: 0.30 / 1_000_000,
  cacheCreate: 3.75 / 1_000_000,
};

const SATURATED_COST_THRESHOLD = 0.05;
const SATURATED_TOKENS_THRESHOLD = 150_000;

export class AnalyticsFormatter {
  static compute(session: CliSession, turns: CliSessionTurn[]): SessionAnalytics {
    const averageContextPerTurn = turns.length > 0
      ? session.cacheReadTokens / turns.length
      : 0;

    // Próxima mensagem: contexto acumulado vira cache-read para o modelo
    const nextInteractionCost = session.inputTokens * RATES.cacheRead;

    // Economia = o que cacheReadTokens custaria a preço de input - o que custou de fato
    const cacheSavingsUSD = session.cacheReadTokens * (RATES.input - RATES.cacheRead);

    const isSaturated =
      nextInteractionCost > SATURATED_COST_THRESHOLD ||
      session.cacheReadTokens > SATURATED_TOKENS_THRESHOLD;

    return { averageContextPerTurn, nextInteractionCost, cacheSavingsUSD, isSaturated, turns };
  }

  static calcEffectiveCostUSD(session: CliSession): number {
    return (
      session.inputTokens * RATES.input +
      session.outputTokens * RATES.output +
      session.cacheReadTokens * RATES.cacheRead +
      session.cacheCreationTokens * RATES.cacheCreate
    );
  }

  static fmt4(v: number): string {
    return v.toFixed(4);
  }
}
