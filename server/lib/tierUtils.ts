// Tier calculation utilities for backend

export type Tier = 'C' | 'B' | 'A' | 'S';

export const TIER_CONFIG = {
    C: { minBudget: 20000, maxBudget: 39999, duration: 7, commission: 20 },
    B: { minBudget: 40000, maxBudget: 69999, duration: 14, commission: 15 },
    A: { minBudget: 70000, maxBudget: 99999, duration: 21, commission: 12 },
    S: { minBudget: 100000, maxBudget: 1000000, duration: 30, commission: 10 },
} as const;

export const MIN_BUDGET_TL = 20000;
export const MAX_BUDGET_TL = 1000000;

/**
 * Calculate campaign tier based on total budget in TL
 * Boundary values go to upper tier (40k = B, 70k = A, 100k = S)
 */
export function getCampaignTierFromBudget(budgetTL: number): Tier | null {
    if (budgetTL < MIN_BUDGET_TL) return null;
    if (budgetTL >= 100000) return 'S';
    if (budgetTL >= 70000) return 'A';
    if (budgetTL >= 40000) return 'B';
    return 'C';
}

/**
 * Get campaign duration in days for a tier
 */
export function getDurationForTier(tier: Tier): number {
    return TIER_CONFIG[tier].duration;
}

/**
 * Get commission percentage for a tier
 */
export function getCommissionForTier(tier: Tier): number {
    return TIER_CONFIG[tier].commission;
}

/**
 * Get estimated reach (view count range) based on tier and budget
 */
export function getEstimatedReach(tier: Tier, budgetTL: number): { min: number; max: number } {
    switch (tier) {
        case 'C': return { min: budgetTL * 8, max: budgetTL * 15 };
        case 'B': return { min: budgetTL * 12, max: budgetTL * 22 };
        case 'A': return { min: budgetTL * 15, max: budgetTL * 28 };
        case 'S': return { min: budgetTL * 20, max: budgetTL * 35 };
    }
}

/**
 * Get estimated engagement (likes, shares) based on tier and reach
 */
export function getEstimatedEngagement(tier: Tier, budgetTL: number): {
    likes: { min: number; max: number };
    shares: { min: number; max: number };
} {
    const reach = getEstimatedReach(tier, budgetTL);
    switch (tier) {
        case 'C': return {
            likes: { min: Math.round(reach.min * 0.04), max: Math.round(reach.max * 0.06) },
            shares: { min: Math.round(reach.min * 0.008), max: Math.round(reach.max * 0.012) },
        };
        case 'B': return {
            likes: { min: Math.round(reach.min * 0.05), max: Math.round(reach.max * 0.07) },
            shares: { min: Math.round(reach.min * 0.01), max: Math.round(reach.max * 0.015) },
        };
        case 'A': return {
            likes: { min: Math.round(reach.min * 0.05), max: Math.round(reach.max * 0.08) },
            shares: { min: Math.round(reach.min * 0.012), max: Math.round(reach.max * 0.018) },
        };
        case 'S': return {
            likes: { min: Math.round(reach.min * 0.06), max: Math.round(reach.max * 0.09) },
            shares: { min: Math.round(reach.min * 0.015), max: Math.round(reach.max * 0.022) },
        };
    }
}
