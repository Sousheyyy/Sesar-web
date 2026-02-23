import { describe, it, expect } from 'vitest';
import {
  getCommissionFromBudget,
  getBudgetBracket,
  getEstimatedReach,
  getEstimatedEngagement,
  MIN_BUDGET_TL,
  MAX_BUDGET_TL,
  MIN_DURATION_DAYS,
  MAX_DURATION_DAYS,
} from '@/server/lib/tierUtils';

// =========================================================================
// getCommissionFromBudget
// =========================================================================
describe('getCommissionFromBudget', () => {
  it('returns null for budget below minimum', () => {
    expect(getCommissionFromBudget(24999)).toBeNull();
    expect(getCommissionFromBudget(0)).toBeNull();
    expect(getCommissionFromBudget(-1000)).toBeNull();
  });

  it('returns 20% for 25k-39,999', () => {
    expect(getCommissionFromBudget(25000)).toBe(20);
    expect(getCommissionFromBudget(30000)).toBe(20);
    expect(getCommissionFromBudget(39999)).toBe(20);
  });

  it('returns 15% for 40k-69,999', () => {
    expect(getCommissionFromBudget(40000)).toBe(15);
    expect(getCommissionFromBudget(55000)).toBe(15);
    expect(getCommissionFromBudget(69999)).toBe(15);
  });

  it('returns 12% for 70k-99,999', () => {
    expect(getCommissionFromBudget(70000)).toBe(12);
    expect(getCommissionFromBudget(85000)).toBe(12);
    expect(getCommissionFromBudget(99999)).toBe(12);
  });

  it('returns 10% for 100k+', () => {
    expect(getCommissionFromBudget(100000)).toBe(10);
    expect(getCommissionFromBudget(500000)).toBe(10);
    expect(getCommissionFromBudget(1000000)).toBe(10);
  });

  it('boundary: 39999.99 is still 20%', () => {
    expect(getCommissionFromBudget(39999.99)).toBe(20);
  });

  it('boundary: 40000 crosses to 15%', () => {
    expect(getCommissionFromBudget(40000)).toBe(15);
  });

  it('commission decreases as budget increases', () => {
    const budgets = [25000, 40000, 70000, 100000];
    const commissions = budgets.map(b => getCommissionFromBudget(b)!);
    for (let i = 1; i < commissions.length; i++) {
      expect(commissions[i]).toBeLessThan(commissions[i - 1]);
    }
  });
});

// =========================================================================
// getEstimatedReach (budget + duration based)
// =========================================================================
describe('getEstimatedReach', () => {
  it('returns min < max', () => {
    const reach = getEstimatedReach(30000, 15);
    expect(reach.min).toBeLessThan(reach.max);
  });

  it('returns {0,0} for budget below minimum', () => {
    const reach = getEstimatedReach(10000, 15);
    expect(reach.min).toBe(0);
    expect(reach.max).toBe(0);
  });

  it('higher budget = higher reach', () => {
    const low = getEstimatedReach(25000, 15);
    const high = getEstimatedReach(39000, 15);
    expect(high.min).toBeGreaterThan(low.min);
    expect(high.max).toBeGreaterThan(low.max);
  });

  it('longer duration = higher reach', () => {
    const short = getEstimatedReach(30000, 5);
    const long = getEstimatedReach(30000, 30);
    expect(long.min).toBeGreaterThan(short.min);
    expect(long.max).toBeGreaterThan(short.max);
  });

  it('duration factor: 15 days = 1.0x baseline', () => {
    const base = getEstimatedReach(50000, 15);
    const double = getEstimatedReach(50000, 30);
    expect(double.min).toBe(base.min * 2);
    expect(double.max).toBe(base.max * 2);
  });

  it('duration factor: 5 days = 1/3x of baseline', () => {
    const base = getEstimatedReach(50000, 15);
    const third = getEstimatedReach(50000, 5);
    expect(third.min).toBe(Math.round(base.min / 3));
    expect(third.max).toBe(Math.round(base.max / 3));
  });
});

// =========================================================================
// getEstimatedEngagement
// =========================================================================
describe('getEstimatedEngagement', () => {
  it('returns likes and shares with min < max', () => {
    const eng = getEstimatedEngagement(50000, 15);
    expect(eng.likes.min).toBeLessThan(eng.likes.max);
    expect(eng.shares.min).toBeLessThan(eng.shares.max);
  });

  it('returns zeros for budget below minimum', () => {
    const eng = getEstimatedEngagement(5000, 15);
    expect(eng.likes.min).toBe(0);
    expect(eng.shares.min).toBe(0);
  });
});

// =========================================================================
// Constants
// =========================================================================
describe('Budget constants', () => {
  it('MIN_BUDGET is 25000', () => expect(MIN_BUDGET_TL).toBe(25000));
  it('MAX_BUDGET is 1000000', () => expect(MAX_BUDGET_TL).toBe(1000000));
  it('MIN_DURATION is 5', () => expect(MIN_DURATION_DAYS).toBe(5));
  it('MAX_DURATION is 30', () => expect(MAX_DURATION_DAYS).toBe(30));
});

// =========================================================================
// getBudgetBracket
// =========================================================================
describe('getBudgetBracket', () => {
  it('returns null for budget below minimum', () => {
    expect(getBudgetBracket(24999)).toBeNull();
  });

  it('returns correct bracket for each range', () => {
    expect(getBudgetBracket(25000)?.commission).toBe(20);
    expect(getBudgetBracket(50000)?.commission).toBe(15);
    expect(getBudgetBracket(80000)?.commission).toBe(12);
    expect(getBudgetBracket(200000)?.commission).toBe(10);
  });
});
