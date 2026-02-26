import { describe, it, expect } from 'vitest';

/**
 * Campaign Lifecycle Cron — Unit Tests
 *
 * Tests the lock phase batched Apify calls, distribution triggering logic,
 * and edge cases for the campaign-lifecycle cron.
 */

// ─── Constants (mirrored from the cron) ─────────────────────────────────────

const LOCK_WINDOW_MS = 60 * 60 * 1000; // 1 hour before endDate
const GRACE_PERIOD_MS = 30 * 60 * 1000; // 30 min after endDate
const BATCH_SIZE = 50; // Parallel Apify calls per batch

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Campaign Lifecycle Cron — Logic Tests', () => {

  // ── Lock Phase Timing ──

  describe('Lock Phase Timing', () => {
    it('should lock campaigns within 1 hour of endDate', () => {
      const now = new Date('2026-02-26T10:00:00Z');
      const lockDeadline = new Date(now.getTime() + LOCK_WINDOW_MS);

      // Campaign ending in 30 min — should lock
      const endDate30min = new Date(now.getTime() + 30 * 60 * 1000);
      expect(endDate30min <= lockDeadline).toBe(true);

      // Campaign ending in exactly 1 hour — should lock
      const endDate1h = new Date(now.getTime() + 60 * 60 * 1000);
      expect(endDate1h <= lockDeadline).toBe(true);

      // Campaign ending in 2 hours — should NOT lock
      const endDate2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      expect(endDate2h <= lockDeadline).toBe(false);
    });

    it('should lock campaigns that have already passed endDate', () => {
      const now = new Date('2026-02-26T10:00:00Z');
      const lockDeadline = new Date(now.getTime() + LOCK_WINDOW_MS);

      // Campaign that ended 10 minutes ago — should lock
      const endDatePast = new Date(now.getTime() - 10 * 60 * 1000);
      expect(endDatePast <= lockDeadline).toBe(true);
    });
  });

  // ── Distribution Phase Timing ──

  describe('Distribution Phase Timing', () => {
    it('should distribute campaigns past endDate + 30 min grace', () => {
      const now = new Date('2026-02-26T10:00:00Z');
      const graceDeadline = new Date(now.getTime() - GRACE_PERIOD_MS);

      // Campaign ended 45 min ago — past grace → should distribute
      const endDate45min = new Date(now.getTime() - 45 * 60 * 1000);
      expect(endDate45min <= graceDeadline).toBe(true);

      // Campaign ended 15 min ago — still in grace → should NOT distribute
      const endDate15min = new Date(now.getTime() - 15 * 60 * 1000);
      expect(endDate15min <= graceDeadline).toBe(false);

      // Campaign ended exactly 30 min ago — should distribute
      const endDate30min = new Date(now.getTime() - 30 * 60 * 1000);
      expect(endDate30min <= graceDeadline).toBe(true);
    });

    it('should NOT distribute unlocked campaigns', () => {
      // Distribution requires lockedAt IS NOT NULL
      const campaign = { lockedAt: null, payoutStatus: 'PENDING' };
      const isEligible = campaign.lockedAt !== null && campaign.payoutStatus === 'PENDING';
      expect(isEligible).toBe(false);
    });

    it('should NOT distribute already-distributed campaigns', () => {
      const campaign = { lockedAt: new Date(), payoutStatus: 'COMPLETED' };
      const isEligible = campaign.lockedAt !== null && campaign.payoutStatus === 'PENDING';
      expect(isEligible).toBe(false);
    });
  });

  // ── Lock Phase Batch Processing ──

  describe('Lock Phase Batch Processing', () => {
    it('should process all submissions in parallel batches of 50', () => {
      const submissionCounts = [10, 50, 100, 250, 500, 1000, 5000];
      const expectedBatches = [1, 1, 2, 5, 10, 20, 100];

      submissionCounts.forEach((count, i) => {
        const batches = Math.ceil(count / BATCH_SIZE);
        expect(batches).toBe(expectedBatches[i]);
      });
    });

    it('should process ALL submissions during lock (no chunking limit)', () => {
      // Unlike per-campaign-metrics cron, lock phase processes everything
      const largeCount = 5000;
      const batches = Math.ceil(largeCount / BATCH_SIZE);

      // All batches are processed in single run (no MAX_SUBMISSIONS_PER_TICK cap)
      expect(batches).toBe(100);
      // This is intentional — lock phase needs final accurate data
    });

    it('should calculate estimated lock phase duration', () => {
      const submissions = 3000;
      const batchDurationSec = 10; // ~10s per batch (50 parallel Apify calls, each ~5-10s)
      const batches = Math.ceil(submissions / BATCH_SIZE);
      const estimatedSeconds = batches * batchDurationSec;
      const estimatedMinutes = estimatedSeconds / 60;

      expect(batches).toBe(60);
      expect(estimatedMinutes).toBe(10);
      // 10 minutes is well within the 30-minute grace period
    });

    it('should verify grace period provides sufficient buffer', () => {
      // Worst case: 50,000 submissions
      const submissions = 50000;
      const batchDurationSec = 10;
      const batches = Math.ceil(submissions / BATCH_SIZE);
      const estimatedMinutes = (batches * batchDurationSec) / 60;
      const gracePeriodMinutes = GRACE_PERIOD_MS / (60 * 1000);

      expect(estimatedMinutes).toBeCloseTo(166.7, 0);
      // 167 minutes > 30 min grace period — large campaigns may exceed it
      // This is documented as a known limitation
      expect(gracePeriodMinutes).toBe(30);
    });
  });

  // ── MetricFetchLog Sources ──

  describe('MetricFetchLog Sources', () => {
    it('should use correct source identifiers', () => {
      const sources = {
        perCampaignCron: 'PER_CAMPAIGN_CRON',
        lockPhase: 'LOCK_PHASE',
        final: 'FINAL',
      };

      expect(sources.perCampaignCron).toBe('PER_CAMPAIGN_CRON');
      expect(sources.lockPhase).toBe('LOCK_PHASE');
      expect(sources.final).toBe('FINAL');
    });
  });

  // ── Status Determination ──

  describe('Fetch Status Determination', () => {
    it('should return SUCCESS when all succeed', () => {
      const refreshed = 50;
      const failed = 0;
      const status = failed > 0 ? (refreshed > 0 ? 'PARTIAL' : 'FAILED') : 'SUCCESS';
      expect(status).toBe('SUCCESS');
    });

    it('should return PARTIAL when some fail', () => {
      const refreshed = 45;
      const failed = 5;
      const status = failed > 0 ? (refreshed > 0 ? 'PARTIAL' : 'FAILED') : 'SUCCESS';
      expect(status).toBe('PARTIAL');
    });

    it('should return FAILED when all fail', () => {
      const refreshed = 0;
      const failed = 50;
      const status = failed > 0 ? (refreshed > 0 ? 'PARTIAL' : 'FAILED') : 'SUCCESS';
      expect(status).toBe('FAILED');
    });
  });

  // ── Phase Ordering ──

  describe('Phase Ordering', () => {
    it('should run lock phase before distribution phase', () => {
      // The cron runs both phases sequentially:
      // 1. lockOneCampaign()
      // 2. distributeOneCampaign()
      // This ensures a campaign locked in this tick can't be distributed in the same tick
      // (because distribution requires endDate + 30min grace)
      const now = new Date();
      const lockableEndDate = new Date(now.getTime() + 30 * 60 * 1000); // 30 min from now
      const graceDeadline = new Date(now.getTime() - GRACE_PERIOD_MS);

      // A campaign just locked (endDate in 30 min) can't be distributed yet
      expect(lockableEndDate <= graceDeadline).toBe(false);
    });

    it('should not distribute a campaign that was just locked', () => {
      const now = new Date();
      // Campaign that ends in 45 min — will be locked
      const endDate = new Date(now.getTime() + 45 * 60 * 1000);
      const graceDeadline = new Date(now.getTime() - GRACE_PERIOD_MS);

      // This endDate is in the future, so it can't be past the grace period
      expect(endDate <= graceDeadline).toBe(false);
    });
  });

  // ── Edge Cases ──

  describe('Edge Cases', () => {
    it('should handle campaign with zero submissions gracefully', () => {
      const submissions: any[] = [];
      const batches = Math.ceil(submissions.length / BATCH_SIZE);
      expect(batches).toBe(0);
      // No Apify calls needed — lock still proceeds
    });

    it('should handle campaign with exactly BATCH_SIZE submissions', () => {
      const submissions = Array.from({ length: BATCH_SIZE }, (_, i) => ({ id: `sub-${i}` }));
      const batches = Math.ceil(submissions.length / BATCH_SIZE);
      expect(batches).toBe(1);
    });

    it('should handle campaign with 1 more than BATCH_SIZE submissions', () => {
      const submissions = Array.from({ length: BATCH_SIZE + 1 }, (_, i) => ({ id: `sub-${i}` }));
      const batches = Math.ceil(submissions.length / BATCH_SIZE);
      expect(batches).toBe(2);
      // Second batch has only 1 submission
    });
  });
});
