// Tier calculation utilities for backend

export type Tier = 'D' | 'C' | 'B' | 'A' | 'S';

/**
 * Calculate campaign tier based on total budget in TL
 */
export function getCampaignTierFromBudget(budgetTL: number): Tier {
    if (budgetTL >= 100000) return 'S';
    if (budgetTL >= 60000) return 'A';
    if (budgetTL >= 30000) return 'B';
    if (budgetTL >= 15000) return 'C';
    return 'D'; // Below minimum
}

/**
 * Get minimum follower requirement for a campaign tier
 */
export function getMinFollowersForTier(tier: Tier): number {
    switch (tier) {
        case 'S': return 10000;
        case 'A': return 5000;
        case 'B': return 3000;
        case 'C': return 1000;
        case 'D': return 0;
    }
}

/**
 * Calculate maximum submissions based on budget
 * Formula: (budget / 1000) * 100
 */
export function getMaxSubmissionsFromBudget(budgetTL: number): number {
    return Math.floor((budgetTL / 1000) * 100);
}

/**
 * Calculate creator tier based on follower count
 */
export function getCreatorTierFromFollowers(followers: number): Tier {
    if (followers >= 50000) return 'S';
    if (followers >= 10000) return 'A';
    if (followers >= 5000) return 'B';
    if (followers >= 1000) return 'C';
    return 'D';
}

/**
 * Check if a creator's tier is eligible for a campaign tier
 */
export function isCreatorEligibleForCampaign(creatorTier: Tier | null, campaignTier: Tier): boolean {
    // If creator has no tier (not connected TikTok), treat as D tier
    const effectiveCreatorTier = creatorTier || 'D';

    const tierOrder: Tier[] = ['D', 'C', 'B', 'A', 'S'];
    const creatorIndex = tierOrder.indexOf(effectiveCreatorTier);
    const campaignIndex = tierOrder.indexOf(campaignTier);

    // Creator must have same or higher tier than campaign requirement
    return creatorIndex >= campaignIndex;
}
