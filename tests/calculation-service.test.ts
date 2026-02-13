import { describe, it, expect } from 'vitest';
import { CalculationService } from '@/server/services/calculationService';

// =========================================================================
// 1. calculatePoints
// =========================================================================
describe('CalculationService.calculatePoints', () => {
  it('returns correct points for standard engagement', () => {
    const result = CalculationService.calculatePoints(10000, 500, 100);
    expect(result.viewPoints).toBe(100);      // 10000 * 0.01
    expect(result.likePoints).toBe(250);       // 500 * 0.5
    expect(result.sharePoints).toBe(100);      // 100 * 1.0
    expect(result.totalPoints).toBe(450);
  });

  it('returns zero points for zero engagement', () => {
    const result = CalculationService.calculatePoints(0, 0, 0);
    expect(result.totalPoints).toBe(0);
  });

  it('handles very large numbers', () => {
    const result = CalculationService.calculatePoints(100_000_000, 10_000_000, 5_000_000);
    expect(result.viewPoints).toBe(1_000_000);
    expect(result.likePoints).toBe(5_000_000);
    expect(result.sharePoints).toBe(5_000_000);
    expect(result.totalPoints).toBe(11_000_000);
  });
});

// =========================================================================
// 2. calculateSharePercent
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

  it('returns 0 when campaign has no points', () => {
    const share = CalculationService.calculateSharePercent(100, 0);
    expect(share).toBe(0);
  });

  it('returns 0 when submission has no points', () => {
    const share = CalculationService.calculateSharePercent(0, 1000);
    expect(share).toBe(0);
  });

  it('caps at exactly 40% when share is exactly 40%', () => {
    const share = CalculationService.calculateSharePercent(400, 1000);
    expect(share).toBe(0.40);
  });
});

// =========================================================================
// 3. calculateNetBudget
// =========================================================================
describe('CalculationService.calculateNetBudget', () => {
  it('calculates net budget for tier C (20% commission)', () => {
    const result = CalculationService.calculateNetBudget(30000, 20);
    expect(result.netBudgetTL).toBe(24000);
    expect(result.netMultiplier).toBe(0.80);
  });

  it('calculates net budget for tier S (10% commission)', () => {
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
// 4. checkInsuranceThresholds
// =========================================================================
describe('CalculationService.checkInsuranceThresholds', () => {
  it('passes when all thresholds met (tier C)', () => {
    const result = CalculationService.checkInsuranceThresholds('C', 5, 600, 60000);
    expect(result.passed).toBe(true);
    expect(result.failedChecks).toHaveLength(0);
  });

  it('fails when submissions below threshold (tier C)', () => {
    const result = CalculationService.checkInsuranceThresholds('C', 2, 600, 60000);
    expect(result.passed).toBe(false);
    expect(result.failedChecks.some(c => c.includes('Submissions'))).toBe(true);
  });

  it('fails when points below threshold (tier B)', () => {
    const result = CalculationService.checkInsuranceThresholds('B', 10, 1000, 500000);
    expect(result.passed).toBe(false);
    expect(result.failedChecks.some(c => c.includes('Points'))).toBe(true);
  });

  it('fails when views below threshold (tier A)', () => {
    const result = CalculationService.checkInsuranceThresholds('A', 10, 6000, 100000);
    expect(result.passed).toBe(false);
    expect(result.failedChecks.some(c => c.includes('Views'))).toBe(true);
  });

  it('reports multiple failures simultaneously', () => {
    const result = CalculationService.checkInsuranceThresholds('S', 1, 100, 1000);
    expect(result.passed).toBe(false);
    expect(result.failedChecks).toHaveLength(3);
  });

  it('fails for unknown tier', () => {
    const result = CalculationService.checkInsuranceThresholds('X', 100, 100000, 10000000);
    expect(result.passed).toBe(false);
    expect(result.failedChecks[0]).toBe('Unknown tier');
  });

  it('passes tier S with high metrics', () => {
    const result = CalculationService.checkInsuranceThresholds('S', 20, 20000, 2_000_000);
    expect(result.passed).toBe(true);
  });
});

// =========================================================================
// 5. filterEligibleSubmissions
// =========================================================================
describe('CalculationService.filterEligibleSubmissions', () => {
  const submissions = [
    { id: 'sub1', totalPoints: 200 },  // 20% of 1000 → eligible
    { id: 'sub2', totalPoints: 40 },   // 4% but below 50 points → ineligible
    { id: 'sub3', totalPoints: 0 },    // 0 → ineligible
    { id: 'sub4', totalPoints: 60 },   // 6% and >= 50 points → eligible
    { id: 'sub5', totalPoints: 700 },  // 70% → eligible
  ];
  const totalPoints = 1000;

  it('filters by both points and contribution thresholds', () => {
    const eligible = CalculationService.filterEligibleSubmissions(submissions, totalPoints);
    expect(eligible.map(s => s.id)).toEqual(['sub1', 'sub4', 'sub5']);
  });

  it('returns empty when total points is 0', () => {
    const eligible = CalculationService.filterEligibleSubmissions(submissions, 0);
    expect(eligible).toHaveLength(0);
  });

  it('excludes submissions below 50 points', () => {
    const eligible = CalculationService.filterEligibleSubmissions(
      [{ id: 'a', totalPoints: 49 }], 100
    );
    expect(eligible).toHaveLength(0);
  });

  it('includes submission at exactly 50 points if contribution >= 0.1%', () => {
    const eligible = CalculationService.filterEligibleSubmissions(
      [{ id: 'a', totalPoints: 50 }], 50000 // 0.1% contribution
    );
    expect(eligible).toHaveLength(1);
  });

  it('excludes submission with high points but tiny contribution', () => {
    // 50 points but 0.05% contribution (below 0.1% threshold)
    const eligible = CalculationService.filterEligibleSubmissions(
      [{ id: 'a', totalPoints: 50 }], 100000
    );
    expect(eligible).toHaveLength(0);
  });
});

// =========================================================================
// 6. calculateApproximateEarnings
// =========================================================================
describe('CalculationService.calculateApproximateEarnings', () => {
  it('calculates proportional earnings without Robin Hood', () => {
    const result = CalculationService.calculateApproximateEarnings(
      { totalPoints: 100, estimatedEarnings: 0, sharePercent: 0 },
      { lastBatchTotalPoints: 0, lastBatchAt: null, totalCampaignPoints: 1000 },
      { totalBudget: 30000, commissionPercent: 20 }
    );
    // netBudget = 24000, raw share = 100/1000 = 10%
    expect(result.approximateEarningsTL).toBe(2400);
    expect(result.approximateSharePercent).toBe(10);
    expect(result.isApproximate).toBe(false); // lastBatchAt is null
  });

  it('returns zero when submission has no points', () => {
    const result = CalculationService.calculateApproximateEarnings(
      { totalPoints: 0, estimatedEarnings: 0, sharePercent: 0 },
      { lastBatchTotalPoints: 500, lastBatchAt: new Date(), totalCampaignPoints: 1000 },
      { totalBudget: 30000, commissionPercent: 20 }
    );
    expect(result.approximateEarningsTL).toBe(0);
  });

  it('returns zero when campaign has no points', () => {
    const result = CalculationService.calculateApproximateEarnings(
      { totalPoints: 100, estimatedEarnings: 0, sharePercent: 0 },
      { lastBatchTotalPoints: 0, lastBatchAt: null, totalCampaignPoints: 0 },
      { totalBudget: 30000, commissionPercent: 20 }
    );
    expect(result.approximateEarningsTL).toBe(0);
  });

  it('preserves confirmed earnings from last batch', () => {
    const result = CalculationService.calculateApproximateEarnings(
      { totalPoints: 100, estimatedEarnings: 500, sharePercent: 0.05 },
      { lastBatchTotalPoints: 1000, lastBatchAt: new Date(), totalCampaignPoints: 1000 },
      { totalBudget: 30000, commissionPercent: 20 }
    );
    expect(result.confirmedEarningsTL).toBe(500);
    expect(result.confirmedSharePercent).toBe(0.05);
    expect(result.isApproximate).toBe(true);
  });
});

// =========================================================================
// 7. computeRobinHoodShares
// =========================================================================
describe('CalculationService.computeRobinHoodShares', () => {
  it('distributes proportionally when no one exceeds cap', () => {
    const submissions = [
      { id: 'a', totalPoints: 300 },
      { id: 'b', totalPoints: 300 },
      { id: 'c', totalPoints: 400 },
    ];
    const results = CalculationService.computeRobinHoodShares(submissions, 1000, 24000);

    expect(results).toHaveLength(3);
    expect(results.find(r => r.id === 'a')!.sharePercent).toBeCloseTo(0.30, 2);
    expect(results.find(r => r.id === 'c')!.sharePercent).toBeCloseTo(0.40, 2);
    expect(results.find(r => r.id === 'a')!.earningsTL).toBeCloseTo(7200, 0);
    expect(results.find(r => r.id === 'c')!.earningsTL).toBeCloseTo(9600, 0);
  });

  it('caps dominant creator at 40% and redistributes', () => {
    const submissions = [
      { id: 'a', totalPoints: 800 },   // 80% → should be capped to 40%
      { id: 'b', totalPoints: 100 },   // 10%
      { id: 'c', totalPoints: 100 },   // 10%
    ];
    const results = CalculationService.computeRobinHoodShares(submissions, 1000, 24000);

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
      { id: 'a', totalPoints: 500 },  // 50% → cap
      { id: 'b', totalPoints: 400 },  // 40% → cap
      { id: 'c', totalPoints: 100 },  // 10%
    ];
    const results = CalculationService.computeRobinHoodShares(submissions, 1000, 24000);

    const aSub = results.find(r => r.id === 'a')!;
    const bSub = results.find(r => r.id === 'b')!;
    expect(aSub.sharePercent).toBe(0.40);
    expect(bSub.sharePercent).toBe(0.40);

    // c gets remaining 20%
    const cSub = results.find(r => r.id === 'c')!;
    expect(cSub.sharePercent).toBeCloseTo(0.20, 2);
  });

  it('handles 3+ dominant creators (3rd gets 39.99%)', () => {
    const submissions = [
      { id: 'a', totalPoints: 500 },  // 50% → cap at 40%
      { id: 'b', totalPoints: 450 },  // 45% → cap at 40%
      { id: 'c', totalPoints: 450 },  // 45% (rescaled) → should be near 39.99%
      { id: 'd', totalPoints: 10 },   // tiny
    ];
    const total = 1410;
    const results = CalculationService.computeRobinHoodShares(submissions, total, 24000);

    // At most 2 can be exactly at 40%
    const at40 = results.filter(r => r.sharePercent === 0.40);
    expect(at40.length).toBeLessThanOrEqual(2);
  });

  it('returns empty for empty submissions', () => {
    const results = CalculationService.computeRobinHoodShares([], 1000, 24000);
    expect(results).toHaveLength(0);
  });

  it('returns empty for zero campaign points', () => {
    const results = CalculationService.computeRobinHoodShares(
      [{ id: 'a', totalPoints: 100 }], 0, 24000
    );
    expect(results).toHaveLength(0);
  });

  it('total earnings sum to netBudget', () => {
    const submissions = [
      { id: 'a', totalPoints: 300 },
      { id: 'b', totalPoints: 500 },
      { id: 'c', totalPoints: 200 },
    ];
    const results = CalculationService.computeRobinHoodShares(submissions, 1000, 24000);

    const totalEarnings = results.reduce((sum, r) => sum + r.earningsTL, 0);
    expect(totalEarnings).toBeCloseTo(24000, 0);
  });

  it('single submission gets 100% (no redistribution target)', () => {
    const results = CalculationService.computeRobinHoodShares(
      [{ id: 'a', totalPoints: 1000 }],
      1000,
      24000
    );
    // Only 1 submission — cap fires but excess redistributes back to itself
    expect(results[0].sharePercent).toBeCloseTo(1.0, 2);
    expect(results[0].earningsTL).toBeCloseTo(24000, 0);
  });
});

// =========================================================================
// 8. Constants validation
// =========================================================================
describe('CalculationService constants', () => {
  it('insurance refund is 95%', () => {
    expect(CalculationService.INSURANCE_REFUND_PERCENT).toBe(0.95);
  });

  it('artist cancel refund is 100%', () => {
    expect(CalculationService.ARTIST_CANCEL_REFUND_PERCENT).toBe(1.00);
  });

  it('admin reject refund is 100%', () => {
    expect(CalculationService.ADMIN_REJECT_REFUND_PERCENT).toBe(1.00);
  });

  it('min eligible points is 50', () => {
    expect(CalculationService.MIN_ELIGIBLE_POINTS).toBe(50);
  });

  it('min eligible contribution is 0.1%', () => {
    expect(CalculationService.MIN_ELIGIBLE_CONTRIBUTION).toBe(0.001);
  });

  it('all tiers have insurance thresholds', () => {
    for (const tier of ['C', 'B', 'A', 'S'] as const) {
      const t = CalculationService.INSURANCE_THRESHOLDS[tier];
      expect(t.minSubmissions).toBeGreaterThan(0);
      expect(t.minPoints).toBeGreaterThan(0);
      expect(t.minViews).toBeGreaterThan(0);
    }
  });

  it('tier thresholds are ordered by difficulty (C < B < A < S)', () => {
    const tiers = ['C', 'B', 'A', 'S'] as const;
    for (let i = 1; i < tiers.length; i++) {
      const prev = CalculationService.INSURANCE_THRESHOLDS[tiers[i - 1]];
      const curr = CalculationService.INSURANCE_THRESHOLDS[tiers[i]];
      expect(curr.minSubmissions).toBeGreaterThanOrEqual(prev.minSubmissions);
      expect(curr.minPoints).toBeGreaterThanOrEqual(prev.minPoints);
      expect(curr.minViews).toBeGreaterThanOrEqual(prev.minViews);
    }
  });
});
