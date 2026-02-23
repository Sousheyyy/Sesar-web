// Campaign budget utilities (no tiers - budget brackets determine commission & estimates)

// Minimum NET budget after commission deduction (the amount distributed to creators)
export const MIN_NET_BUDGET_TL = 20000;
// Minimum GROSS budget (depends on commission rate — at 20% commission: 20000 / 0.8 = 25000)
export const MIN_BUDGET_TL = 25000;
export const MAX_BUDGET_TL = 1000000;
export const MIN_DURATION_DAYS = 5;
export const MAX_DURATION_DAYS = 30;

/**
 * Calculate the minimum gross budget needed to achieve MIN_NET_BUDGET_TL after commission
 */
export function getMinBudgetForCommission(commissionPercent: number): number {
    return Math.ceil(MIN_NET_BUDGET_TL / (1 - commissionPercent / 100));
}

interface BudgetBracket {
    minBudget: number;
    maxBudget: number;
    commission: number;
    reachMin: number;
    reachMax: number;
    likeMinRate: number;
    likeMaxRate: number;
    shareMinRate: number;
    shareMaxRate: number;
}

const BUDGET_BRACKETS: BudgetBracket[] = [
    { minBudget: 100000, maxBudget: 1000000, commission: 10, reachMin: 20, reachMax: 35, likeMinRate: 0.06, likeMaxRate: 0.09, shareMinRate: 0.015, shareMaxRate: 0.022 },
    { minBudget: 70000,  maxBudget: 99999,   commission: 12, reachMin: 15, reachMax: 28, likeMinRate: 0.05, likeMaxRate: 0.08, shareMinRate: 0.012, shareMaxRate: 0.018 },
    { minBudget: 40000,  maxBudget: 69999,   commission: 15, reachMin: 12, reachMax: 22, likeMinRate: 0.05, likeMaxRate: 0.07, shareMinRate: 0.01,  shareMaxRate: 0.015 },
    { minBudget: 25000,  maxBudget: 39999,   commission: 20, reachMin: 8,  reachMax: 15, likeMinRate: 0.04, likeMaxRate: 0.06, shareMinRate: 0.008, shareMaxRate: 0.012 },
];

/**
 * Get the budget bracket for a given budget
 */
export function getBudgetBracket(budgetTL: number): BudgetBracket | null {
    if (budgetTL < MIN_BUDGET_TL) return null;
    for (const bracket of BUDGET_BRACKETS) {
        if (budgetTL >= bracket.minBudget) return bracket;
    }
    return null;
}

/**
 * Get commission percentage based on budget bracket
 */
export function getCommissionFromBudget(budgetTL: number): number | null {
    const bracket = getBudgetBracket(budgetTL);
    return bracket ? bracket.commission : null;
}

/**
 * Get estimated reach (view count range) based on budget and campaign duration
 * Duration factor: durationDays / 15 (15 days = 1.0x baseline)
 */
export function getEstimatedReach(budgetTL: number, durationDays: number): { min: number; max: number } {
    const bracket = getBudgetBracket(budgetTL);
    if (!bracket) return { min: 0, max: 0 };
    const durationFactor = durationDays / 15;
    return {
        min: Math.round(budgetTL * bracket.reachMin * durationFactor),
        max: Math.round(budgetTL * bracket.reachMax * durationFactor),
    };
}

/**
 * Get estimated engagement (likes, shares) based on budget and duration
 */
export function getEstimatedEngagement(budgetTL: number, durationDays: number): {
    likes: { min: number; max: number };
    shares: { min: number; max: number };
} {
    const bracket = getBudgetBracket(budgetTL);
    if (!bracket) return {
        likes: { min: 0, max: 0 },
        shares: { min: 0, max: 0 },
    };
    const reach = getEstimatedReach(budgetTL, durationDays);
    return {
        likes: { min: Math.round(reach.min * bracket.likeMinRate), max: Math.round(reach.max * bracket.likeMaxRate) },
        shares: { min: Math.round(reach.min * bracket.shareMinRate), max: Math.round(reach.max * bracket.shareMaxRate) },
    };
}
