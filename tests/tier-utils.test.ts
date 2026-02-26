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

  it('returns flat 20% for all valid budgets', () => {
    expect(getCommissionFromBudget(25000)).toBe(20);
    expect(getCommissionFromBudget(30000)).toBe(20);
    expect(getCommissionFromBudget(40000)).toBe(20);
    expect(getCommissionFromBudget(70000)).toBe(20);
    expect(getCommissionFromBudget(100000)).toBe(20);
    expect(getCommissionFromBudget(500000)).toBe(20);
    expect(getCommissionFromBudget(1000000)).toBe(20);
  });

  it('commission is same regardless of budget amount', () => {
    const budgets = [25000, 40000, 70000, 100000];
    const commissions = budgets.map(b => getCommissionFromBudget(b)!);
    commissions.forEach(c => expect(c).toBe(20));
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

  it('returns flat 20% commission for all brackets', () => {
    expect(getBudgetBracket(25000)?.commission).toBe(20);
    expect(getBudgetBracket(50000)?.commission).toBe(20);
    expect(getBudgetBracket(80000)?.commission).toBe(20);
    expect(getBudgetBracket(200000)?.commission).toBe(20);
  });
});
