import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateCost, percentToTokens, getCostModelLabel, calculateCostEstimate } from '../costService';
import { getSettings } from '../settingsService';
import type { UsageData } from '../models/usageData';

vi.mock('../settingsService', () => ({
  getSettings: vi.fn(() => ({
    costModel: 'sonnet',
    monthlyBudget: 50,
  })),
}));

describe('costService', () => {
  describe('calculateCost', () => {
    it('calculates cost for sonnet model', () => {
      const cost = calculateCost(500_000, 500_000, 'sonnet');
      expect(cost).toBe(9);
    });

    it('calculates cost for haiku model', () => {
      const cost = calculateCost(500_000, 500_000, 'haiku');
      expect(cost).toBe(0.75);
    });

    it('calculates cost for opus model', () => {
      const cost = calculateCost(5_000, 5_000, 'opus');
      expect(cost).toBe(0.45);
    });

    it('calculates cost with zero tokens', () => {
      const cost = calculateCost(0, 0, 'sonnet');
      expect(cost).toBe(0);
    });
  });

  describe('percentToTokens', () => {
    it('converts 50% to tokens for sonnet', () => {
      const tokens = percentToTokens(50, 'sonnet');
      expect(tokens).toBe(500_000);
    });

    it('converts 100% to tokens for sonnet', () => {
      const tokens = percentToTokens(100, 'sonnet');
      expect(tokens).toBe(1_000_000);
    });

    it('converts 50% to tokens for haiku', () => {
      const tokens = percentToTokens(50, 'haiku');
      expect(tokens).toBe(2_000_000);
    });
  });

  describe('getCostModelLabel', () => {
    it('returns Sonnet for sonnet', () => {
      expect(getCostModelLabel('sonnet')).toBe('Sonnet');
    });

    it('returns Haiku for haiku', () => {
      expect(getCostModelLabel('haiku')).toBe('Haiku');
    });

    it('returns Opus for opus', () => {
      expect(getCostModelLabel('opus')).toBe('Opus');
    });
  });

  describe('calculateCostEstimate', () => {
    const mockUsageData: UsageData = {
      five_hour: { utilization: 50, resets_at: new Date().toISOString() },
      seven_day: { utilization: 30, resets_at: new Date().toISOString() },
    } as UsageData;

    it('calculates cost estimate for given utilization', () => {
      const result = calculateCostEstimate(mockUsageData, [], null);

      expect(result.session.total).toBeGreaterThan(0);
      expect(result.weekly.total).toBeGreaterThan(0);
      expect(result.monthly.total).toBeGreaterThan(0);
    });

    it('returns default budget when not set', () => {
      const result = calculateCostEstimate(mockUsageData, [], null);
      expect(result.budget).toBe(50);
    });

    it('returns correct model', () => {
      const result = calculateCostEstimate(mockUsageData, [], null);
      expect(result.session.model).toBe('sonnet');
    });

    it('calculates budget percentage', () => {
      const result = calculateCostEstimate(mockUsageData, [], null);
      expect(result.budgetPercentage).toBeGreaterThanOrEqual(0);
    });
  });
});