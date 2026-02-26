import { describe, it, expect } from 'vitest';
import { CalculationService } from '@/server/services/calculationService';

// =========================================================================
// 1. calculateSharePercent (views-based)
// =========================================================================
describe('CalculationService.calculateSharePercent', () => {
  it('returns raw share when below 40% cap', () => {
    const share = CalculationService.calculateSharePercent(100, 1000);
    expect(share).toBe(0.10);
  });

  it('caps at 40% (Robin Hood)', () => {
    const share = CalculationService.calculateSharePercent(900, 1000);
    expect(share).toBe(0.40);
  });

  it('returns 0 when campaign has no views', () => {
    const share = CalculationService.calculateSharePercent(100, 0);
    expect(share).toBe(0);
  });

  it('returns 0 when submission has no views', () => {
    const share = CalculationService.calculateSharePercent(0, 1000);
    expect(share).toBe(0);
  });

  it('caps at exactly 40% when share is exactly 40%', () => {
    const share = CalculationService.calculateSharePercent(400, 1000);
    expect(share).toBe(0.40);
  });
});

// =========================================================================
// 2. calculateNetBudget
// =========================================================================
describe('CalculationService.calculateNetBudget', () => {
  it('calculates net budget for 20% commission', () => {
    const result = CalculationService.calculateNetBudget(30000, 20);
    expect(result.netBudgetTL).toBe(24000);
    expect(result.netMultiplier).toBe(0.80);
  });

  it('calculates net budget for 10% commission', () => {
    const result = CalculationService.calculateNetBudget(100000, 10);
    expect(result.netBudgetTL).toBe(90000);
    expect(result.netMultiplier).toBe(0.90);
  });

  it('handles 0% commission', () => {
    const result = CalculationService.calculateNetBudget(50000, 0);
    expect(result.netBudgetTL).toBe(50000);
  });
});

// =========================================================================
// 3. checkInsuranceThresholds (budget-based, views-only)
// =========================================================================
describe('CalculationService.checkInsuranceThresholds', () => {
  it('passes when all thresholds met (25k-39k bracket)', () => {
    const result = CalculationService.checkInsuranceThresholds(30000, 5, 60000);
    expect(result.passed).toBe(true);
    expect(result.failedChecks).toHaveLength(0);
  });

  it('fails when submissions below threshold', () => {
    const result = CalculationService.checkInsuranceThresholds(30000, 2, 60000);
    expect(result.passed).toBe(false);
    expect(result.failedChecks.some(c => c.includes('Submissions'))).toBe(true);
  });

  it('fails when views below threshold', () => {
    const result = CalculationService.checkInsuranceThresholds(30000, 5, 10000);
    expect(result.passed).toBe(false);
    expect(result.failedChecks.some(c => c.includes('Views'))).toBe(true);
  });

  it('reports multiple failures simultaneously', () => {
    const result = CalculationService.checkInsuranceThresholds(100000, 1, 1000);
    expect(result.passed).toBe(false);
    expect(result.failedChecks).toHaveLength(2); // submissions + views
  });

  it('passes 100k+ bracket with high metrics', () => {
    const result = CalculationService.checkInsuranceThresholds(100000, 20, 2_000_000);
    expect(result.passed).toBe(true);
  });
});

// =========================================================================
// 4. getInsuranceThresholds (budget brackets)
// =========================================================================
describe('CalculationService.getInsuranceThresholds', () => {
  it('returns lowest thresholds for 25k-39k', () => {
    const t = CalculationService.getInsuranceThresholds(25000);
    expect(t.minSubmissions).toBe(3);
    expect(t.minViews).toBe(50_000);
  });

  it('returns mid thresholds for 40k-69k', () => {
    const t = CalculationService.getInsuranceThresholds(50000);
    expect(t.minSubmissions).toBe(5);
    expect(t.minViews).toBe(200_000);
  });

  it('returns higher thresholds for 70k-99k', () => {
    const t = CalculationService.getInsuranceThresholds(80000);
    expect(t.minSubmissions).toBe(8);
    expect(t.minViews).toBe(500_000);
  });

  it('returns highest thresholds for 100k+', () => {
    const t = CalculationService.getInsuranceThresholds(200000);
    expect(t.minSubmissions).toBe(15);
    expect(t.minViews).toBe(1_500_000);
  });

  it('thresholds increase with budget', () => {
    const budgets = [25000, 40000, 70000, 100000];
    for (let i = 1; i < budgets.length; i++) {
      const prev = CalculationService.getInsuranceThresholds(budgets[i - 1]);
      const curr = CalculationService.getInsuranceThresholds(budgets[i]);
      expect(curr.minSubmissions).toBeGreaterThanOrEqual(prev.minSubmissions);
      expect(curr.minViews).toBeGreaterThanOrEqual(prev.minViews);
    }
  });
});

// =========================================================================
// 5. filterEligibleSubmissions (views-only, 0.01% threshold)
// =========================================================================
describe('CalculationService.filterEligibleSubmissions', () => {
  const submissions = [
    { id: 'sub1', lastViewCount: 20000 },  // 20% of 100k → eligible
    { id: 'sub2', lastViewCount: 50 },     // 0.05% → eligible (above 0.01%)
    { id: 'sub3', lastViewCount: 0 },      // 0% → ineligible
    { id: 'sub4', lastViewCount: 5000 },   // 5% → eligible
    { id: 'sub5', lastViewCount: 75000 },  // 75% → eligible
  ];
  const totalViews = 100000;

  it('filters by 0.01% contribution threshold', () => {
    const eligible = CalculationService.filterEligibleSubmissions(submissions, totalViews);
    expect(eligible.map(s => s.id)).toEqual(['sub1', 'sub2', 'sub4', 'sub5']);
  });

  it('returns empty when total views is 0', () => {
    const eligible = CalculationService.filterEligibleSubmissions(submissions, 0);
    expect(eligible).toHaveLength(0);
  });

  it('excludes submissions below 0.01% share', () => {
    const eligible = CalculationService.filterEligibleSubmissions(
      [{ id: 'a', lastViewCount: 9 }], 100000 // 0.009% < 0.01%
    );
    expect(eligible).toHaveLength(0);
  });

  it('includes submission at exactly 0.01% share', () => {
    const eligible = CalculationService.filterEligibleSubmissions(
      [{ id: 'a', lastViewCount: 10 }], 100000 // 0.01% exactly
    );
    expect(eligible).toHaveLength(1);
  });

  it('includes all when everyone has meaningful views', () => {
    const eligible = CalculationService.filterEligibleSubmissions(
      [
        { id: 'a', lastViewCount: 5000 },
        { id: 'b', lastViewCount: 3000 },
        { id: 'c', lastViewCount: 2000 },
      ],
      10000
    );
    expect(eligible).toHaveLength(3);
  });
});

// =========================================================================
// 6. calculateApproximateEarnings (views-based)
// =========================================================================
describe('CalculationService.calculateApproximateEarnings', () => {
  it('calculates proportional earnings without Robin Hood', () => {
    const result = CalculationService.calculateApproximateEarnings(
      { lastViewCount: 10000, estimatedEarnings: 0, sharePercent: 0 },
      100000,
      { totalBudget: 30000, commissionPercent: 20 }
    );
    // netBudget = 24000, raw share = 10000/100000 = 10%
    expect(result.approximateEarningsTL).toBe(2400);
    expect(result.approximateSharePercent).toBe(10);
  });

  it('returns zero when submission has no views', () => {
    const result = CalculationService.calculateApproximateEarnings(
      { lastViewCount: 0, estimatedEarnings: 0, sharePercent: 0 },
      100000,
      { totalBudget: 30000, commissionPercent: 20 }
    );
    expect(result.approximateEarningsTL).toBe(0);
  });

  it('returns zero when campaign has no views', () => {
    const result = CalculationService.calculateApproximateEarnings(
      { lastViewCount: 10000, estimatedEarnings: 0, sharePercent: 0 },
      0,
      { totalBudget: 30000, commissionPercent: 20 }
    );
    expect(result.approximateEarningsTL).toBe(0);
  });

  it('preserves confirmed earnings', () => {
    const result = CalculationService.calculateApproximateEarnings(
      { lastViewCount: 10000, estimatedEarnings: 500, sharePercent: 0.05 },
      100000,
      { totalBudget: 30000, commissionPercent: 20 }
    );
    expect(result.confirmedEarningsTL).toBe(500);
    expect(result.confirmedSharePercent).toBe(0.05);
  });

  it('caps approximate share at 40%', () => {
    const result = CalculationService.calculateApproximateEarnings(
      { lastViewCount: 90000, estimatedEarnings: 0, sharePercent: 0 },
      100000,
      { totalBudget: 30000, commissionPercent: 20 }
    );
    // netBudget = 24000, rawShare = 90% but capped at 40%
    expect(result.approximateSharePercent).toBe(40);
    expect(result.approximateEarningsTL).toBe(9600); // 24000 * 0.40
  });
});

// =========================================================================
// 7. computeRobinHoodShares (views-based)
// =========================================================================
describe('CalculationService.computeRobinHoodShares', () => {
  it('distributes proportionally when no one exceeds cap', () => {
    const submissions = [
      { id: 'a', lastViewCount: 3000 },
      { id: 'b', lastViewCount: 3000 },
      { id: 'c', lastViewCount: 4000 },
    ];
    const results = CalculationService.computeRobinHoodShares(submissions, 10000, 24000);

    expect(results).toHaveLength(3);
    expect(results.find(r => r.id === 'a')!.sharePercent).toBeCloseTo(0.30, 2);
    expect(results.find(r => r.id === 'c')!.sharePercent).toBeCloseTo(0.40, 2);
    expect(results.find(r => r.id === 'a')!.earningsTL).toBeCloseTo(7200, 0);
    expect(results.find(r => r.id === 'c')!.earningsTL).toBeCloseTo(9600, 0);
  });

  it('caps dominant creator at 40% and redistributes', () => {
    const submissions = [
      { id: 'a', lastViewCount: 80000 },  // 80% → cap at 40%
      { id: 'b', lastViewCount: 10000 },  // 10%
      { id: 'c', lastViewCount: 10000 },  // 10%
    ];
    const results = CalculationService.computeRobinHoodShares(submissions, 100000, 24000);

    const aSub = results.find(r => r.id === 'a')!;
    expect(aSub.sharePercent).toBe(0.40);

    // Remaining 60% redistributed proportionally between b and c
    const bSub = results.find(r => r.id === 'b')!;
    const cSub = results.find(r => r.id === 'c')!;
    expect(bSub.sharePercent).toBeCloseTo(0.30, 2);
    expect(cSub.sharePercent).toBeCloseTo(0.30, 2);
  });

  it('caps at most 2 creators at 40%', () => {
    const submissions = [
      { id: 'a', lastViewCount: 50000 },  // 50% → cap
      { id: 'b', lastViewCount: 40000 },  // 40% → cap
      { id: 'c', lastViewCount: 10000 },  // 10%
    ];
    const results = CalculationService.computeRobinHoodShares(submissions, 100000, 24000);

    expect(results.find(r => r.id === 'a')!.sharePercent).toBe(0.40);
    expect(results.find(r => r.id === 'b')!.sharePercent).toBe(0.40);
    expect(results.find(r => r.id === 'c')!.sharePercent).toBeCloseTo(0.20, 2);
  });

  it('returns empty for empty submissions', () => {
    const results = CalculationService.computeRobinHoodShares([], 10000, 24000);
    expect(results).toHaveLength(0);
  });

  it('returns empty for zero campaign views', () => {
    const results = CalculationService.computeRobinHoodShares(
      [{ id: 'a', lastViewCount: 1000 }], 0, 24000
    );
    expect(results).toHaveLength(0);
  });

  it('total earnings sum to netBudget', () => {
    const submissions = [
      { id: 'a', lastViewCount: 3000 },
      { id: 'b', lastViewCount: 5000 },
      { id: 'c', lastViewCount: 2000 },
    ];
    const results = CalculationService.computeRobinHoodShares(submissions, 10000, 24000);
    const totalEarnings = results.reduce((sum, r) => sum + r.earningsTL, 0);
    expect(totalEarnings).toBeCloseTo(24000, 0);
  });

  it('single submission gets capped at 40% (excess stays with artist)', () => {
    const results = CalculationService.computeRobinHoodShares(
      [{ id: 'a', lastViewCount: 10000 }],
      10000,
      24000
    );
    // Single creator still gets capped at 40% — no uncapped creators to redistribute to
    expect(results[0].sharePercent).toBeCloseTo(0.40, 2);
    expect(results[0].earningsTL).toBeCloseTo(9600, 0); // 24000 * 0.40
  });
});

// =========================================================================
// 8. Constants validation
// =========================================================================
describe('CalculationService constants', () => {
  it('min eligible contribution is 0.01%', () => {
    expect(CalculationService.MIN_ELIGIBLE_CONTRIBUTION).toBe(0.0001);
  });

  it('max submissions per creator is 10', () => {
    expect(CalculationService.MAX_SUBMISSIONS_PER_CREATOR).toBe(10);
  });
});
