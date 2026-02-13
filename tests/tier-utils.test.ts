import { describe, it, expect } from 'vitest';
import {
  getCampaignTierFromBudget,
  getDurationForTier,
  getCommissionForTier,
  getEstimatedReach,
  TIER_CONFIG,
  MIN_BUDGET_TL,
  MAX_BUDGET_TL,
} from '@/server/lib/tierUtils';

// =========================================================================
// getCampaignTierFromBudget
// =========================================================================
describe('getCampaignTierFromBudget', () => {
  it('returns null for budget below minimum', () => {
    expect(getCampaignTierFromBudget(19999)).toBeNull();
    expect(getCampaignTierFromBudget(0)).toBeNull();
    expect(getCampaignTierFromBudget(-1000)).toBeNull();
  });

  it('returns C for 20k-39,999', () => {
    expect(getCampaignTierFromBudget(20000)).toBe('C');
    expect(getCampaignTierFromBudget(30000)).toBe('C');
    expect(getCampaignTierFromBudget(39999)).toBe('C');
  });

  it('returns B for 40k-69,999', () => {
    expect(getCampaignTierFromBudget(40000)).toBe('B');
    expect(getCampaignTierFromBudget(55000)).toBe('B');
    expect(getCampaignTierFromBudget(69999)).toBe('B');
  });

  it('returns A for 70k-99,999', () => {
    expect(getCampaignTierFromBudget(70000)).toBe('A');
    expect(getCampaignTierFromBudget(85000)).toBe('A');
    expect(getCampaignTierFromBudget(99999)).toBe('A');
  });

  it('returns S for 100k+', () => {
    expect(getCampaignTierFromBudget(100000)).toBe('S');
    expect(getCampaignTierFromBudget(500000)).toBe('S');
    expect(getCampaignTierFromBudget(1000000)).toBe('S');
  });

  // Boundary tests
  it('boundary: 39999.99 is still C', () => {
    expect(getCampaignTierFromBudget(39999.99)).toBe('C');
  });

  it('boundary: 40000 crosses to B', () => {
    expect(getCampaignTierFromBudget(40000)).toBe('B');
  });
});

// =========================================================================
// getDurationForTier
// =========================================================================
describe('getDurationForTier', () => {
  it('C tier = 7 days', () => expect(getDurationForTier('C')).toBe(7));
  it('B tier = 14 days', () => expect(getDurationForTier('B')).toBe(14));
  it('A tier = 21 days', () => expect(getDurationForTier('A')).toBe(21));
  it('S tier = 30 days', () => expect(getDurationForTier('S')).toBe(30));
});

// =========================================================================
// getCommissionForTier
// =========================================================================
describe('getCommissionForTier', () => {
  it('C tier = 20%', () => expect(getCommissionForTier('C')).toBe(20));
  it('B tier = 15%', () => expect(getCommissionForTier('B')).toBe(15));
  it('A tier = 12%', () => expect(getCommissionForTier('A')).toBe(12));
  it('S tier = 10%', () => expect(getCommissionForTier('S')).toBe(10));

  it('commission decreases as tier increases', () => {
    const tiers = ['C', 'B', 'A', 'S'] as const;
    for (let i = 1; i < tiers.length; i++) {
      expect(getCommissionForTier(tiers[i])).toBeLessThan(getCommissionForTier(tiers[i - 1]));
    }
  });
});

// =========================================================================
// getEstimatedReach
// =========================================================================
describe('getEstimatedReach', () => {
  it('returns min < max', () => {
    for (const tier of ['C', 'B', 'A', 'S'] as const) {
      const reach = getEstimatedReach(tier, 30000);
      expect(reach.min).toBeLessThan(reach.max);
    }
  });

  it('higher budget = higher reach', () => {
    const lowReach = getEstimatedReach('C', 20000);
    const highReach = getEstimatedReach('C', 39000);
    expect(highReach.min).toBeGreaterThan(lowReach.min);
    expect(highReach.max).toBeGreaterThan(lowReach.max);
  });
});

// =========================================================================
// Constants
// =========================================================================
describe('Tier constants', () => {
  it('MIN_BUDGET is 20000', () => expect(MIN_BUDGET_TL).toBe(20000));
  it('MAX_BUDGET is 1000000', () => expect(MAX_BUDGET_TL).toBe(1000000));

  it('all tiers have consistent boundaries', () => {
    expect(TIER_CONFIG.C.minBudget).toBe(20000);
    expect(TIER_CONFIG.C.maxBudget).toBeLessThan(TIER_CONFIG.B.minBudget);
    expect(TIER_CONFIG.B.maxBudget).toBeLessThan(TIER_CONFIG.A.minBudget);
    expect(TIER_CONFIG.A.maxBudget).toBeLessThan(TIER_CONFIG.S.minBudget);
  });
});
