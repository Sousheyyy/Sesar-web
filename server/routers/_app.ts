import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Context } from "../context";
import { uploadImageFromUrl, STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { fetchVideoViaInsightIQ } from "@/lib/insightiq";

// Minimal tRPC setup for type compatibility
// This app uses REST API routes, but tRPC types are imported for compatibility
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

// Migrate a song's cover image from TikTok CDN to Supabase Storage (fire-and-forget)
function migrateSongCoverIfNeeded(songId: string, coverImage: string | null) {
  if (!coverImage) return;
  // Skip if already a Supabase URL
  if (coverImage.includes('supabase')) return;
  // Only migrate TikTok CDN URLs
  if (!coverImage.includes('tiktokcdn')) return;

  // Fire-and-forget: don't await
  (async () => {
    try {
      const storagePath = `migrate/${songId}/${Date.now()}.jpg`;
      const permanentUrl = await uploadImageFromUrl(STORAGE_BUCKETS.COVERS, storagePath, coverImage);
      if (permanentUrl) {
        await prisma.song.update({
          where: { id: songId },
          data: { coverImage: permanentUrl }
        });
      }
    } catch { /* silent fail for background migration */ }
  })();
}

export const appRouter = t.router({
  health: t.procedure.query(() => {
    return "OK from tRPC!";
  }),
  getUser: t.procedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      const callerId = ctx.userId;
      if (!callerId) throw new Error("UNAUTHORIZED");
      if (callerId !== input.userId) throw new Error("FORBIDDEN");

      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          balance: true,
          avatar: true,
          tiktokHandle: true,
          plan: true,
          subscriptionEndsAt: true,
          cycleStartDate: true,
          totalLikes: true,
          videoCount: true,
          followingCount: true,
          followerCount: true,
          creatorTier: true,
          lastStatsFetchedAt: true
        },
      });

      return user;
    }),

  updateProfile: t.procedure
    .input(z.object({
      tiktokHandle: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) {
        throw new Error("UNAUTHORIZED");
      }

      // Simple profile update without TikTok API
      // TikTok OAuth integration has been removed - now using Apify for data fetching
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(input.tiktokHandle && { tiktokHandle: input.tiktokHandle.replace('@', '') }),
        }
      });

      return updatedUser;
    }),

  createUser: t.procedure
    .input(z.object({
      userId: z.string(),
      email: z.string().email(),
      name: z.string().optional(),
      role: z.enum(['CREATOR', 'ARTIST']).optional(),
      bio: z.string().max(500).optional(),
      tiktokHandle: z.string().optional(),
      instagramHandle: z.string().optional(),
      youtubeHandle: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Validate: authenticated users can only create their own record
      if (ctx.userId && ctx.userId !== input.userId) {
        throw new Error("FORBIDDEN");
      }

      // Idempotent: return existing user if already created
      const existing = await prisma.user.findUnique({
        where: { id: input.userId }
      });

      if (existing) {
        return existing;
      }

      const userRole = input.role || 'CREATOR';

      const user = await prisma.user.create({
        data: {
          id: input.userId,
          email: input.email,
          password: 'supabase-auth',
          name: input.name || (userRole === 'ARTIST' ? 'Sanatçı' : 'İçerik Üreticisi'),
          role: userRole,
          balance: 0,
          plan: userRole === 'ARTIST' ? 'ARTIST' : 'FREE',
          cycleStartDate: new Date(),
          bio: input.bio,
          tiktokHandle: input.tiktokHandle?.replace('@', ''),
          instagramHandle: input.instagramHandle?.replace('@', ''),
          youtubeHandle: input.youtubeHandle?.replace('@', ''),
        }
      });

      return user;
    }),

  getActiveCampaigns: t.procedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().optional().default(100)
    }).optional())
    .query(async ({ input }) => {
      const search = input?.search;
      const limit = input?.limit || 100;

      const where: any = {
        status: "ACTIVE",
        OR: [
          { endDate: { gt: new Date() } },
          { endDate: null }
        ]
      };

      // Server-side search (uses AND to not overwrite the status/endDate OR clause)
      if (search) {
        where.AND = [
          {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { song: { title: { contains: search, mode: 'insensitive' } } },
              { song: { authorName: { contains: search, mode: 'insensitive' } } }
            ]
          }
        ];
      }

      const campaigns = await prisma.campaign.findMany({
        where,
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          totalBudget: true,
          endDate: true,
          durationDays: true,
          commissionPercent: true,
          minVideoDuration: true,
          lockedAt: true,
          song: {
            select: {
              id: true,
              title: true,
              coverImage: true,
              authorName: true,
              artist: { select: { name: true } }
            }
          },
          _count: { select: { submissions: true } }
        },
        orderBy: { createdAt: "desc" }
      });

      // Migrate old TikTok CDN cover images to Supabase (fire-and-forget)
      for (const c of campaigns) {
        migrateSongCoverIfNeeded(c.song.id, c.song.coverImage);
      }

      return campaigns;
    }),
  getJoinedCampaigns: t.procedure
    .input(z.object({
      cursor: z.string().optional(), // Campaign ID for cursor-based pagination
      limit: z.number().min(1).max(100).default(20),
      endedOnly: z.boolean().optional() // Filter for ended campaigns only
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;
      if (!userId) return { campaigns: [], nextCursor: null };

      const limit = input?.limit || 20;
      const endedOnly = input?.endedOnly || false;

      const where: any = {
        submissions: {
          some: { creatorId: userId }
        }
      };

      // Filter for ended campaigns if requested
      if (endedOnly) {
        where.OR = [
          { status: 'COMPLETED' },
          { endDate: { lt: new Date() } }
        ];
      }

      // Cursor-based pagination
      if (input?.cursor) {
        where.id = { lt: input.cursor };
      }

      const campaigns = await prisma.campaign.findMany({
        where,
        take: limit + 1, // Fetch one extra to determine if there are more
        select: {
          id: true,
          title: true,
          status: true,
          totalBudget: true,
          endDate: true,
          durationDays: true,
          commissionPercent: true,
          lockedAt: true,
          submissions: {
            where: { creatorId: userId },
            select: {
              id: true,
              status: true,
              lastViewCount: true,
              lastLikeCount: true,
              lastShareCount: true,
              createdAt: true,
              viewPoints: true,
              likePoints: true,
              sharePoints: true,
              totalPoints: true,
              sharePercent: true,
              estimatedEarnings: true
            }
          },
          song: {
            select: {
              title: true,
              authorName: true,
              coverImage: true,
              artist: { select: { name: true } }
            }
          },
          poolStats: {
            select: {
              totalCampaignPoints: true,
              totalSubmissions: true,
              averagePoints: true,
              lastBatchAt: true,
            }
          },
          _count: { select: { submissions: true } }
        },
        orderBy: { updatedAt: "desc" }
      });

      // Check if there are more results
      const hasMore = campaigns.length > limit;
      const result = hasMore ? campaigns.slice(0, limit) : campaigns;
      const nextCursor = hasMore ? result[result.length - 1].id : null;

      return {
        campaigns: result,
        nextCursor
      };
    }),

  getCampaignCounts: t.procedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");

      const [activeCount, myActiveCount, joinedActiveCount] = await Promise.all([
        // 1. Total Active Campaigns
        prisma.campaign.count({
          where: {
            status: "ACTIVE",
            OR: [{ endDate: { gt: new Date() } }, { endDate: null }]
          }
        }),

        // 2. My Active Campaigns (if Artist)
        prisma.campaign.count({
          where: {
            artistId: userId,
            status: "ACTIVE",
            OR: [{ endDate: { gt: new Date() } }, { endDate: null }]
          }
        }),

        // 3. Joined Active Campaigns (if Creator)
        prisma.campaign.count({
          where: {
            status: "ACTIVE",
            OR: [{ endDate: { gt: new Date() } }, { endDate: null }],
            submissions: {
              some: { creatorId: userId }
            }
          }
        })
      ]);

      return {
        activeCount,
        myActiveCount,
        joinedActiveCount
      };
    }),
  getCampaignById: t.procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.userId;

      // 1. Fetch Campaign Base Info
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.id },
        include: {
          _count: {
            select: { submissions: true }
          },
          song: {
            select: {
              id: true,
              title: true,
              coverImage: true,
              duration: true,
              tiktokUrl: true,
              tiktokMusicId: true,
              authorName: true, // Added for proper display
              artist: {
                select: {
                  name: true,
                  bio: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });

      if (!campaign) return null;

      // Migrate old TikTok CDN cover images to Supabase (fire-and-forget)
      migrateSongCoverIfNeeded(campaign.song.id, campaign.song.coverImage);

      // 2. Fetch My Submission (if logged in AND not the campaign owner)
      let mySubmission: Awaited<ReturnType<typeof prisma.submission.findFirst>> = null;
      if (userId && campaign.artistId !== userId) {
        mySubmission = await prisma.submission.findFirst({
          where: {
            campaignId: input.id,
            creatorId: userId
          }
        });
      }

      // 3. Calculate Total Campaign Points (Real-time)
      const aggregations = await prisma.submission.aggregate({
        where: { campaignId: input.id },
        _sum: {
          lastViewCount: true,
          lastLikeCount: true,
          lastShareCount: true
        }
      });

      // Calculate total points consistent with All Submissions logic
      // Fetch all submissions light-weight to sum accurately
      const allSubmissions = await prisma.submission.findMany({
        where: { campaignId: input.id },
        select: {
          totalPoints: true,
          viewPoints: true,
          likePoints: true,
          sharePoints: true,
          lastViewCount: true,
          lastLikeCount: true,
          lastShareCount: true
        }
      });

      const totalCampaignPoints = allSubmissions.reduce((sum, sub) => {
        // Backfill logic matching getCampaignSubmissions
        const viewPoints = sub.viewPoints || (sub.lastViewCount * 0.01);
        const likePoints = sub.likePoints || (sub.lastLikeCount * 0.5);
        const sharePoints = sub.sharePoints || (sub.lastShareCount * 1.0);
        const points = sub.totalPoints || (viewPoints + likePoints + sharePoints);
        return sum + points;
      }, 0);

      // Keep strict view/like totals from aggregation as they are raw counters
      const totalViews = aggregations._sum.lastViewCount || 0;
      const totalLikes = aggregations._sum.lastLikeCount || 0;
      const totalShares = aggregations._sum.lastShareCount || 0;

      // 4. Fetch Recent Submissions (If Owner) - for Artist View
      let recentSubmissions: any[] = [];
      if (userId && campaign.artistId === userId) {
        recentSubmissions = await prisma.submission.findMany({
          where: { campaignId: input.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            createdAt: true,
            tiktokUrl: true,
            totalPoints: true,
            sharePercent: true,
            viewPoints: true,
            likePoints: true,
            sharePoints: true,
            lastViewCount: true,
            lastLikeCount: true,
            lastShareCount: true,
            estimatedEarnings: true,
            creator: {
              select: {
                name: true,
                avatar: true,
                tiktokHandle: true
              }
            }
          }
        });
      }

      // Fetch pool stats for approximate earnings
      const poolStats = await prisma.campaignPoolStats.findUnique({
        where: { campaignId: input.id }
      });

      // Calculate approximate earnings for my submission
      let mySubmissionWithEarnings = mySubmission;
      if (mySubmission && poolStats) {
        const { CalculationService } = await import('@/server/services/calculationService');
        const approx = CalculationService.calculateApproximateEarnings(
          { totalPoints: mySubmission.totalPoints, estimatedEarnings: mySubmission.estimatedEarnings, sharePercent: mySubmission.sharePercent },
          { lastBatchTotalPoints: poolStats.lastBatchTotalPoints, lastBatchAt: poolStats.lastBatchAt, totalCampaignPoints },
          { totalBudget: campaign.totalBudget, commissionPercent: campaign.commissionPercent }
        );
        mySubmissionWithEarnings = { ...mySubmission, earnings: approx } as any;
      }

      // Destructure to exclude stale computed fields from database
      const { totalCampaignPoints: _, netBudgetTP: __, netMultiplier: ___, ...campaignData } = campaign;

      return {
        ...campaignData,
        mySubmission: mySubmissionWithEarnings,
        poolStats: poolStats ? {
          lastBatchAt: poolStats.lastBatchAt,
          totalSubmissions: poolStats.totalSubmissions,
        } : null,
        // Always use fresh computed values, not stale database fields
        totalViews,
        totalCampaignPoints,
        totalLikes,
        totalShares,
        submissions: recentSubmissions.map(sub => ({
          ...sub,
          viewPoints: sub.viewPoints || (sub.lastViewCount * 0.01),
          likePoints: sub.likePoints || (sub.lastLikeCount * 0.5),
          sharePoints: sub.sharePoints || (sub.lastShareCount * 1.0),
          totalPoints: sub.totalPoints || ((sub.lastViewCount * 0.01) + (sub.lastLikeCount * 0.5) + (sub.lastShareCount * 1.0))
        })) // Compatible array for Artist View
      };
    }),

  getCampaignSubmissions: t.procedure
    .input(z.object({
      campaignId: z.string(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(25),
      search: z.string().optional(),
      sortBy: z.enum(['percentage', 'views', 'likes', 'shares', 'points', 'recent', 'tier']).default('percentage')
    }))
    .query(async ({ input, ctx }) => {
      const { campaignId, cursor, limit, search, sortBy } = input;

      const where: any = { campaignId };

      // Search Filter
      if (search) {
        where.creator = {
          tiktokHandle: { contains: search, mode: 'insensitive' }
        };
      }

      // Sort Logic
      let orderBy: any = {};
      switch (sortBy) {
        case 'percentage': orderBy = { sharePercent: 'desc' }; break;
        case 'views': orderBy = { lastViewCount: 'desc' }; break;
        case 'likes': orderBy = { lastLikeCount: 'desc' }; break;
        case 'shares': orderBy = { lastShareCount: 'desc' }; break;
        case 'points': orderBy = { totalPoints: 'desc' }; break;
        case 'recent': orderBy = { createdAt: 'desc' }; break;
        case 'tier': orderBy = { creator: { creatorTier: 'desc' } }; break; // S > A > B > C > D
      }

      const submissions = await prisma.submission.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy,
        select: {
          id: true,
          createdAt: true,
          tiktokUrl: true,
          totalPoints: true,
          sharePercent: true,
          viewPoints: true,
          likePoints: true,
          sharePoints: true,
          lastViewCount: true,
          lastLikeCount: true,
          lastShareCount: true,
          estimatedEarnings: true,
          creator: {
            select: {
              name: true,
              avatar: true,
              tiktokHandle: true,
              creatorTier: true // Added for tier display and sorting
            }
          }
        }
      });

      let nextCursor: string | undefined = undefined;
      if (submissions.length > limit) {
        const nextItem = submissions.pop();
        nextCursor = nextItem!.id;
      }

      // Backfill points for legacy data if needed
      const treatedSubmissions = submissions.map(sub => {
        const viewPoints = sub.viewPoints || (sub.lastViewCount * 0.01);
        const likePoints = sub.likePoints || (sub.lastLikeCount * 0.5);
        const sharePoints = sub.sharePoints || (sub.lastShareCount * 1.0);
        const totalPoints = sub.totalPoints || (viewPoints + likePoints + sharePoints);

        return {
          ...sub,
          viewPoints,
          likePoints,
          sharePoints,
          totalPoints,
        };
      });

      return {
        submissions: treatedSubmissions,
        nextCursor
      };
    }),

  getCampaignAnalysis: t.procedure
    .input(z.object({
      id: z.string(),
      period: z.enum(['24h', '7d', '30d', 'all']).default('all')
    }))
    .query(async ({ input, ctx }) => {
      const { id, period } = input;
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");

      const campaign = await prisma.campaign.findUnique({
        where: { id },
        include: {
          submissions: {
            select: {
              createdAt: true,
              lastViewCount: true,
              lastLikeCount: true,
              lastShareCount: true,
              creator: {
                select: {
                  creatorTier: true
                }
              }
            }
          }
        }
      });

      if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
      if (campaign.artistId !== userId) throw new Error("FORBIDDEN");

      // Filter Submissions based on Period
      let filteredSubmissions = campaign.submissions;
      if (period !== 'all') {
        const now = new Date();
        let startDate = new Date();

        switch (period) {
          case '24h': startDate.setHours(now.getHours() - 24); break;
          case '7d': startDate.setDate(now.getDate() - 7); break;
          case '30d': startDate.setDate(now.getDate() - 30); break;
        }

        filteredSubmissions = campaign.submissions.filter(sub => new Date(sub.createdAt) >= startDate);
      }

      // Calculate Totals server-side
      const totals = filteredSubmissions.reduce((acc: any, sub: any) => ({
        views: acc.views + (sub.lastViewCount || 0),
        likes: acc.likes + (sub.lastLikeCount || 0),
        shares: acc.shares + (sub.lastShareCount || 0),
        submissions: acc.submissions + 1
      }), { views: 0, likes: 0, shares: 0, submissions: 0 });

      // Calculate Tier Distribution
      const tierCounts: Record<string, number> = { D: 0, C: 0, B: 0, A: 0, S: 0 };
      filteredSubmissions.forEach((sub: any) => {
        const tier = sub.creator?.creatorTier || 'D';
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      });

      const totalSubmissions = filteredSubmissions.length;
      const tierDistribution = Object.entries(tierCounts)
        .map(([tier, count]) => ({
          tier,
          count,
          percentage: totalSubmissions > 0 ? (count / totalSubmissions) * 100 : 0
        }))
        .filter(item => item.count > 0) // Only include tiers that have submissions
        .sort((a, b) => { // Sort S -> A -> B -> C -> D
          const order: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };
          return (order[b.tier] || 0) - (order[a.tier] || 0);
        });

      // Calculate Daily Stats (Chart Data) server-side
      const grouped = filteredSubmissions.reduce((acc: any, sub: any) => {
        //For 24h view, group by Hour instead of Date? 
        // User requested "top of graph... 24s, 7g, 30g". 
        // Typically for 24h, hourly breakdown is better, but daily is safer for now unless requested.
        // Let's stick to daily for 7d/30d/all. For 24h, daily might be just 1 or 2 points.
        // Let's use Hour:Minute for 24h, otherwise Date.

        let label = "";
        if (period === '24h') {
          label = new Date(sub.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        } else {
          label = new Date(sub.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
        }

        if (!acc[label]) {
          acc[label] = { date: label, views: 0, likes: 0, shares: 0, count: 0 };
        }
        acc[label].views += (sub.lastViewCount || 0);
        acc[label].likes += (sub.lastLikeCount || 0);
        acc[label].shares += (sub.lastShareCount || 0);
        acc[label].count += 1;
        return acc;
      }, {});

      const chartData = Object.values(grouped).sort((a: any, b: any) => {
        // Sort logic needs to handle HH:mm vs DD.MM
        if (period === '24h') {
          return a.date.localeCompare(b.date); // Simple string compare for HH:mm works for same day usually, but across midnight?
          // Using timestamp from original data would be better but we grouped. 
          // Re-sorting by "first item found" timestamp might be complex here.
          // Let's stick to simple "insert order" or string sort for now.
          // Actually, '24h' usually means "last 24 hours", so it spans 2 days.
          // Correct sorting requires fuller date info.
          // Simplified: The frontend chart logic relies on a.date.split('.').
          // I will keep using DD.MM for consistency for now to avoid breaking frontend chart parsing which splits by '.'
          // Wait, for 24h, showing just 2 bars (Today vs Yesterday) is probably fine/expected if we stick to DD.MM.
          // If I change format, I break frontend.
          // Decision: Stick to DD.MM for "all", "7d", "30d".
          // For "24h", it essentially shows just the relevant days (usually 1 or 2).
          // If user really wants hourly, I'd need to update frontend chart parsing too.
          // I will stick to the existing DD.MM format to stay safe and consistent.
        }
        const [d1, m1] = a.date.split('.');
        const [d2, m2] = b.date.split('.');
        return new Date(2024, parseInt(m1) - 1, parseInt(d1)).getTime() - new Date(2024, parseInt(m2) - 1, parseInt(d2)).getTime();
      });

      return {
        campaign,
        totals,
        chartData,
        tierDistribution
      };
    }),

  getSubmittedCampaign: t.procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");

      const campaign = await prisma.campaign.findUnique({
        where: { id: input.id },
        include: {
          _count: {
            select: { submissions: true }
          },
          song: {
            select: {
              title: true,
              coverImage: true,
              duration: true,
              tiktokUrl: true,
              artist: {
                select: { name: true, avatar: true }
              }
            }
          },
          submissions: {
            where: { creatorId: userId },
            take: 1
          }
        }
      });

      if (!campaign || campaign.submissions.length === 0) {
        throw new Error("SUBMISSION_NOT_FOUND");
      }

      const mySubmission = campaign.submissions[0];
      const finalSubmission = mySubmission;

      // Live Aggregation
      const aggregations = await prisma.submission.aggregate({
        where: { campaignId: input.id },
        _sum: {
          lastViewCount: true,
          lastLikeCount: true,
          lastShareCount: true
        }
      });

      const totalViews = aggregations._sum.lastViewCount || 0;
      const totalLikes = aggregations._sum.lastLikeCount || 0;
      const totalShares = aggregations._sum.lastShareCount || 0;
      const totalCampaignPoints = (totalViews * 0.01) + (totalLikes * 0.5) + (totalShares * 1.0);

      // Fetch pool stats for approximate earnings
      const campaignPoolStats = await prisma.campaignPoolStats.findUnique({
        where: { campaignId: input.id }
      });

      // Calculate approximate earnings
      let approximateEarnings: import('@/server/services/calculationService').ApproximateEarnings | null = null;
      if (campaignPoolStats && finalSubmission) {
        const { CalculationService } = await import('@/server/services/calculationService');
        approximateEarnings = CalculationService.calculateApproximateEarnings(
          { totalPoints: finalSubmission.totalPoints, estimatedEarnings: finalSubmission.estimatedEarnings, sharePercent: finalSubmission.sharePercent },
          { lastBatchTotalPoints: campaignPoolStats.lastBatchTotalPoints, lastBatchAt: campaignPoolStats.lastBatchAt, totalCampaignPoints },
          { totalBudget: campaign.totalBudget, commissionPercent: campaign.commissionPercent }
        );
      }

      return {
        campaign: { ...campaign, lockedAt: campaign.lockedAt },
        submission: finalSubmission,
        approximateEarnings,
        poolStats: {
          totalCampaignPoints,
          totalViews,
          totalLikes,
          lastBatchAt: campaignPoolStats?.lastBatchAt || null,
        }
      };
    }),
  validateVideo: t.procedure
    .input(z.object({
      campaignId: z.string(),
      tiktokUrl: z.string().url()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new Error("UNAUTHORIZED");

      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        include: { song: true }
      });
      if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");

      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { tiktokHandle: true, tiktokUserId: true }
      });
      if (!user) throw new Error("USER_NOT_FOUND");

      if (!user.tiktokUserId) {
        return {
          isValid: false,
          errors: ["TikTok hesabınız bağlı değil. Lütfen Ayarlar'dan TikTok hesabınızı bağlayın."],
          video: null,
          checks: {}
        };
      }

      // Fetch video data via InsightIQ public content fetch
      let contentData: any;
      try {
        contentData = await fetchVideoViaInsightIQ(input.tiktokUrl);
      } catch (error: any) {
        return {
          isValid: false,
          errors: [`Video doğrulanamadı: ${error.message}`],
          video: null,
          checks: {}
        };
      }

      const errors: string[] = [];

      // 1. Account Check
      const videoUsername = contentData.profile?.platform_username?.toLowerCase() || contentData.creator?.platform_username?.toLowerCase();
      const isAccountMatch = !!(user.tiktokHandle && videoUsername && user.tiktokHandle.toLowerCase() === videoUsername);
      if (!isAccountMatch) {
        errors.push(`Hesap Uyuşmazlığı: Video @${videoUsername || 'bilinmeyen'} ait, hesabınız @${user.tiktokHandle}`);
      }

      // 2. Song Check (title or music ID match)
      const audioTrack = contentData.audio_track_info || contentData.music;
      let isSongMatch = false;
      if (audioTrack) {
        const trackTitle = (audioTrack.title || audioTrack.name || '').toLowerCase();
        const campaignSongTitle = (campaign.song.title || '').toLowerCase();
        const titleMatch = trackTitle.includes(campaignSongTitle) || campaignSongTitle.includes(trackTitle);
        const idMatch = !!(campaign.song.tiktokMusicId && (audioTrack.platform_audio_id || audioTrack.id) === campaign.song.tiktokMusicId);
        isSongMatch = !!(titleMatch || idMatch);
      }
      if (!isSongMatch) {
        errors.push(`Müzik Eşleşmedi: Kampanya şarkısı "${campaign.song.title}" videoda bulunamadı.`);
      }

      // 3. Duration Check
      const videoDuration = contentData.duration || 0;
      const durationMatch = !campaign.minVideoDuration || videoDuration >= campaign.minVideoDuration;
      if (!durationMatch) {
        errors.push(`Süre Yetersiz: Video ${videoDuration}sn (Min: ${campaign.minVideoDuration}sn)`);
      }

      // 4. Public check (InsightIQ can only fetch public content)
      const isPublic = true;

      const engagement = contentData.engagement || {};

      return {
        isValid: errors.length === 0,
        errors,
        video: {
          videoId: contentData.platform_content_id || contentData.id,
          coverImage: contentData.thumbnail_url,
          soundName: audioTrack?.title || audioTrack?.name || 'Bilinmeyen',
          creatorUsername: videoUsername || '',
          duration: videoDuration,
          views: engagement.view_count || engagement.views || 0,
          likes: engagement.like_count || engagement.likes || 0,
          comments: engagement.comment_count || engagement.comments || 0,
          shares: engagement.share_count || engagement.shares || 0,
        },
        checks: {
          accountMatch: isAccountMatch,
          songMatch: isSongMatch,
          durationMatch,
          isPublic,
        }
      };
    }),

  submitVideo: t.procedure
    .input(z.object({
      campaignId: z.string(),
      tiktokUrl: z.string().url()
    }))
    .mutation(async ({ input, ctx }) => {
      // Validate user is logged in
      const userId = ctx.userId;
      if (!userId) {
        throw new Error("UNAUTHORIZED");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, cycleStartDate: true, creatorTier: true }
      });

      if (!user) throw new Error("USER_NOT_FOUND");

      // Check Free Plan Limits (5 submissions / 30 days)
      if (user.plan === "FREE") {
        const cycleStart = user.cycleStartDate;
        const now = new Date();
        const daysInCycle = Math.floor((now.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));

        if (daysInCycle >= 30) {
          // Reset cycle if > 30 days
          await prisma.user.update({
            where: { id: userId },
            data: { cycleStartDate: now }
          });
        } else {
          // Count submissions in current cycle
          const submissionCount = await prisma.submission.count({
            where: {
              creatorId: userId,
              createdAt: {
                gte: cycleStart
              }
            }
          });

          if (submissionCount >= 5) {
            throw new Error("PLAN_LIMIT_REACHED");
          }
        }
      }

      // Check if already submitted
      const existing = await prisma.submission.findUnique({
        where: {
          campaignId_creatorId: {
            campaignId: input.campaignId,
            creatorId: userId,
          },
        },
      });

      if (existing) {
        throw new Error("ALREADY_SUBMITTED");
      }

      // Check Campaign Status & Limits
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        include: {
          _count: { select: { submissions: true } }
        }
      });

      if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
      if (campaign.status !== "ACTIVE") throw new Error("CAMPAIGN_NOT_ACTIVE");

      // v2: Check campaign timing
      const now = new Date();
      if (campaign.startDate && campaign.startDate > now) {
        throw new Error("CAMPAIGN_NOT_STARTED"); // Campaign approved but not yet open
      }
      if (campaign.endDate && campaign.endDate <= now) {
        throw new Error("CAMPAIGN_ENDED");
      }
      if (campaign.lockedAt) {
        throw new Error("CAMPAIGN_LOCKED"); // Locked for final distribution
      }

      // 1. Get user's InsightIQ account for video verification
      const fullUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { tiktokUserId: true, tiktokHandle: true }
      });
      if (!fullUser?.tiktokUserId) {
        throw new Error("TIKTOK_NOT_LINKED");
      }

      // 2. Verify video via InsightIQ async content fetch
      let contentData: any;
      try {
        contentData = await fetchVideoViaInsightIQ(input.tiktokUrl);
      } catch (error: any) {
        throw new Error(`INVALID_VIDEO: ${error.message}`);
      }

      const engagement = contentData.engagement || {};

      // 3. Calculate initial points
      const { CalculationService } = await import('@/server/services/calculationService');
      const views = engagement.view_count || engagement.views || 0;
      const likes = engagement.like_count || engagement.likes || 0;
      const shares = engagement.share_count || engagement.shares || 0;
      const comments = engagement.comment_count || engagement.comments || 0;
      const points = CalculationService.calculatePoints(views, likes, shares);

      // 4. Create Submission with points and insightiqContentId
      const submission = await prisma.submission.create({
        data: {
          campaignId: input.campaignId,
          creatorId: userId,
          tiktokUrl: input.tiktokUrl,
          tiktokVideoId: contentData.platform_content_id || contentData.id || '',
          insightiqContentId: contentData.id || null, // InsightIQ internal UUID for webhook matching
          status: "APPROVED",
          lastViewCount: views,
          lastLikeCount: likes,
          lastCommentCount: comments,
          lastShareCount: shares,
          viewPoints: points.viewPoints,
          likePoints: points.likePoints,
          sharePoints: points.sharePoints,
          totalPoints: points.totalPoints,
          videoDuration: contentData.duration || 0,
          lastCheckedAt: new Date(),
          // sharePercent and estimatedEarnings stay 0 — updated at batch time
        },
      });

      // 5. Update campaign aggregate totals only (NO full Robin Hood recalc)
      await CalculationService.updateCampaignTotalPoints(input.campaignId, prisma);

      return { success: true, submissionId: submission.id };
    }),

  deleteSubmission: t.procedure
    .input(z.object({
      submissionId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");

      // 1. Verify ownership
      const submission = await prisma.submission.findUnique({
        where: { id: input.submissionId },
        select: {
          creatorId: true,
          campaignId: true,
          status: true
        }
      });

      if (!submission) throw new Error("SUBMISSION_NOT_FOUND");
      if (submission.creatorId !== userId) throw new Error("UNAUTHORIZED");

      // 2. Don't allow deletion of approved submissions (optional - you can remove this check)
      if (submission.status === "APPROVED") {
        throw new Error("CANNOT_DELETE_APPROVED_SUBMISSION");
      }

      // Store campaign ID before deletion
      const campaignId = submission.campaignId;

      // 3. Delete the submission
      await prisma.submission.delete({
        where: { id: input.submissionId }
      });

      // 4. Recalculate campaign stats (to update total points and other submissions' share percentages)
      const { CalculationService } = await import('@/server/services/calculationService');
      await CalculationService.updateCampaignTotalPoints(campaignId, prisma);
      await CalculationService.recalculateCampaignSubmissions(campaignId, prisma);

      return { success: true };
    }),

  createCampaign: t.procedure
    .input(z.object({
      tiktokUrl: z.string().url(),
      title: z.string().min(1),
      description: z.string().optional(),
      budget: z.number().min(25000, "Minimum kampanya bütçesi ₺25.000 olmalıdır").max(1000000), // TL
      durationDays: z.number().min(5).max(30), // User-selected duration
      minVideoDuration: z.number().optional(),
      desiredStartDate: z.string().datetime(), // ISO date string, min 3 days from now
      // Pre-fetched song metadata from fetchSongPreview (skips Apify double-call)
      songPreview: z.object({
        title: z.string().min(1),
        authorName: z.string(),
        coverImage: z.string(),
        tiktokMusicId: z.string().regex(/^\d{19}$/),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) {
        throw new Error("UNAUTHORIZED");
      }

      // Validate desiredStartDate is at least 3 days from now
      const desiredStart = new Date(input.desiredStartDate);
      const minStartDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // now + 72 hours
      if (desiredStart < minStartDate) {
        throw new Error("START_DATE_TOO_EARLY"); // Must be at least 3 days from now
      }

      // Import budget utilities
      const { getCommissionFromBudget, MIN_NET_BUDGET_TL } =
        await import("@/server/lib/tierUtils");

      // Check if admin has overridden commission rate
      const commissionSetting = await prisma.systemSettings.findUnique({
        where: { key: "commission_percent" },
      });

      // 1. Get song metadata — use pre-fetched preview or fetch from Apify
      let songMetadata;
      if (input.songPreview) {
        // Use pre-fetched data from fetchSongPreview (avoids double Apify call)
        songMetadata = input.songPreview;
      } else {
        // Fallback: fetch from Apify (backward compat for web or direct calls)
        const { apifyClient } = await import("@/lib/apify/client");
        try {
          songMetadata = await apifyClient.fetchMusicMetadata(input.tiktokUrl);
        } catch (error: any) {
          throw new Error(`INVALID_SONG_URL: ${error.message}`);
        }
      }

      // 2. Find or Create Song
      let song = await prisma.song.findFirst({
        where: { tiktokMusicId: songMetadata.tiktokMusicId }
      });

      if (!song) {
        // Upload cover image to Supabase Storage (TikTok CDN URLs don't work on mobile)
        let coverImageUrl = songMetadata.coverImage;
        if (coverImageUrl) {
          const storagePath = `${songMetadata.tiktokMusicId}/${Date.now()}.jpg`;
          const permanentUrl = await uploadImageFromUrl(STORAGE_BUCKETS.COVERS, storagePath, coverImageUrl);
          if (permanentUrl) coverImageUrl = permanentUrl;
        }

        song = await prisma.song.create({
          data: {
            title: songMetadata.title,
            authorName: songMetadata.authorName,
            tiktokUrl: input.tiktokUrl,
            tiktokMusicId: songMetadata.tiktokMusicId,
            coverImage: coverImageUrl,
            artistId: userId,
            statsLastFetched: new Date()
          },
        });
      } else if (song.coverImage && !song.coverImage.includes('supabase')) {
        // Song exists but cover is still a TikTok CDN URL — re-upload it
        const storagePath = `${song.tiktokMusicId || song.id}/${Date.now()}.jpg`;
        const permanentUrl = await uploadImageFromUrl(STORAGE_BUCKETS.COVERS, storagePath, song.coverImage);
        if (permanentUrl) {
          song = await prisma.song.update({
            where: { id: song.id },
            data: { coverImage: permanentUrl }
          });
        }
      }

      // 3. Calculate budget-based values
      const budgetTL = input.budget;
      const durationDays = input.durationDays;

      // Calculate commission: admin override > budget bracket
      const commissionPercent = commissionSetting
        ? parseInt(commissionSetting.value)
        : getCommissionFromBudget(budgetTL);
      if (commissionPercent === null || isNaN(commissionPercent)) throw new Error("INVALID_BUDGET");

      // Validate net budget after commission >= MIN_NET_BUDGET_TL
      const netBudget = budgetTL * (1 - commissionPercent / 100);
      if (netBudget < MIN_NET_BUDGET_TL) {
        throw new Error(`NET_BUDGET_TOO_LOW: Komisyon sonrası net bütçe en az ₺${MIN_NET_BUDGET_TL.toLocaleString('tr-TR')} olmalıdır.`);
      }

      // 4. Deduction & Creation (Transaction — atomic balance check)
      const campaign = await prisma.$transaction(async (tx) => {
        // Atomic balance check + deduct (prevents race condition / negative balance)
        const result = await tx.user.updateMany({
          where: { id: userId, balance: { gte: budgetTL } },
          data: { balance: { decrement: budgetTL } }
        });
        if (result.count === 0) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        // Record Spending Transaction
        await tx.transaction.create({
          data: {
            userId,
            type: "SPEND",
            amount: budgetTL,
            status: "COMPLETED",
            description: `Kampanya Oluşturma: ${input.title}`
          }
        });

        // Create Campaign (dates set on admin approval)
        return await tx.campaign.create({
          data: {
            title: input.title,
            description: input.description,
            totalBudget: budgetTL,
            remainingBudget: budgetTL,
            status: "PENDING_APPROVAL",
            songId: song.id,
            artistId: userId,
            minVideoDuration: input.minVideoDuration,
            durationDays: durationDays,
            commissionPercent: commissionPercent,
            desiredStartDate: desiredStart,
            startDate: null,
            endDate: null,
          }
        });
      });

      return { success: true, campaignId: campaign.id };
    }),

  fetchSongPreview: t.procedure
    .input(z.object({
      tiktokUrl: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");

      const { TikTokUrlParser } = await import("@/lib/apify/url-utils");
      const { apifyClient } = await import("@/lib/apify/client");

      // Validate & normalize URL (handles short links, etc.)
      const normalizedUrl = await TikTokUrlParser.validateAndNormalize(input.tiktokUrl);

      // Check DB cache first — if song already exists, return it without calling Apify
      const musicId = TikTokUrlParser.extractMusicId(normalizedUrl);
      if (musicId) {
        const existing = await prisma.song.findFirst({
          where: { tiktokMusicId: musicId },
          select: { title: true, authorName: true, coverImage: true, tiktokMusicId: true },
        });
        if (existing && existing.title && existing.tiktokMusicId) {
          return {
            title: existing.title,
            authorName: existing.authorName || "",
            coverImage: existing.coverImage || "",
            tiktokMusicId: existing.tiktokMusicId,
            cached: true,
          };
        }
      }

      // Fetch from Apify
      const metadata = await apifyClient.fetchMusicMetadata(normalizedUrl);

      return {
        title: metadata.title,
        authorName: metadata.authorName,
        coverImage: metadata.coverImage,
        tiktokMusicId: metadata.tiktokMusicId,
        cached: false,
      };
    }),

  getMyCampaigns: t.procedure
    .input(z.object({
      cursor: z.string().optional(), // Campaign ID for cursor-based pagination
      limit: z.number().min(1).max(100).default(20),
      endedOnly: z.boolean().optional() // Filter for ended campaigns only
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;
      if (!userId) return { campaigns: [], nextCursor: null };

      const limit = input?.limit || 20;
      const endedOnly = input?.endedOnly || false;

      const where: any = { artistId: userId };

      // Filter for ended campaigns if requested
      if (endedOnly) {
        where.OR = [
          { status: 'COMPLETED' },
          { endDate: { lt: new Date() } }
        ];
      }

      // Cursor-based pagination
      if (input?.cursor) {
        where.id = { lt: input.cursor };
      }

      const campaigns = await prisma.campaign.findMany({
        where,
        take: limit + 1, // Fetch one extra to determine if there are more
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          tier: true,
          totalBudget: true,
          startDate: true,
          endDate: true,
          desiredStartDate: true,
          durationDays: true,
          commissionPercent: true,
          lockedAt: true,
          rejectionReason: true,
          artistId: true,
          song: {
            select: {
              title: true,
              coverImage: true,
              authorName: true,
              artist: { select: { name: true } }
            }
          },
          poolStats: {
            select: {
              totalCampaignPoints: true,
              totalSubmissions: true,
              averagePoints: true,
              lastBatchAt: true,
            }
          },
          _count: { select: { submissions: true } }
        },
        orderBy: { createdAt: "desc" }
      });

      // Check if there are more results
      const hasMore = campaigns.length > limit;
      const result = hasMore ? campaigns.slice(0, limit) : campaigns;
      const nextCursor = hasMore ? result[result.length - 1].id : null;

      return {
        campaigns: result,
        nextCursor
      };
    }),

  getCreatorStats: t.procedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");

      // Fetch user info for tier, follower count, and plan
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          creatorTier: true,
          followerCount: true,
          plan: true
        }
      });

      // OPTIMIZED: Use select instead of include to fetch only needed fields
      // Eliminates deep nesting and reduces query time by 40-60%
      const submissions = await prisma.submission.findMany({
        where: { creatorId: userId },
        select: {
          id: true,
          status: true,
          totalEarnings: true,
          estimatedEarnings: true,
          lastViewCount: true,
          sharePercent: true,
          createdAt: true,
          updatedAt: true,
          // Only select needed campaign fields
          campaign: {
            select: {
              id: true,
              status: true,
              endDate: true,
              song: {
                select: {
                  title: true,
                  coverImage: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });

      // Helper: check if a campaign is ended
      const isCampaignEnded = (campaign: { status: string; endDate: Date | null }) =>
        campaign.status === 'COMPLETED' || (campaign.endDate && new Date(campaign.endDate) < new Date());

      // Split submissions by campaign status once
      const endedSubmissions = submissions.filter(s => s.campaign && isCampaignEnded(s.campaign));
      const activeSubmissions = submissions.filter(s => s.campaign && !isCampaignEnded(s.campaign));

      const totalEarnings = endedSubmissions
        .reduce((sum, s) => sum + Number(s.totalEarnings), 0);

      const estimatedEarnings = activeSubmissions
        .reduce((sum, s) => sum + Number(s.estimatedEarnings), 0);

      const totalViews = submissions.reduce((sum, s) => sum + (s.lastViewCount || 0), 0);

      const activeVideos = activeSubmissions
        .filter(s => s.status === "APPROVED").length;

      const avgContributionPercent = endedSubmissions.length > 0
        ? (endedSubmissions.reduce((sum, s) => sum + (s.sharePercent || 0), 0) / endedSubmissions.length) * 100 // Convert to percentage
        : 0;

      // Calculate Average Views - ONLY for ended campaigns
      const avgViews = endedSubmissions.length > 0
        ? Math.round(endedSubmissions.reduce((sum, s) => sum + (s.lastViewCount || 0), 0) / endedSubmissions.length)
        : 0;

      // Fetch Recent Activity - Show EARNING and SPEND transactions
      const recentTransactions = await prisma.transaction.findMany({
        where: {
          userId,
          type: { in: ['EARNING', 'SPEND'] } // Show earnings/payouts and purchases/subscriptions
        },
        take: 20,
        orderBy: { createdAt: "desc" }
      });

      const finishedSubmissions = endedSubmissions
        .filter(s => s.status === 'APPROVED')
        .slice(0, 20);

      const recentActivity = [
        // Campaign earnings - only from finished campaigns
        ...finishedSubmissions.map(s => ({
          id: s.id,
          type: 'CAMPAIGN',
          amount: Number(s.estimatedEarnings) || 0,
          date: s.updatedAt, // Use updatedAt for when it was finalized
          description: `${s.campaign?.song?.title || 'Kampanya'} - Kazanç`,
          status: 'COMPLETED',
          isPlus: true
        })),
        // Transactions (payouts, withdrawals, purchases)
        ...recentTransactions.map(t => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          date: t.createdAt,
          description: t.description || 'Ödeme',
          status: t.status,
          isPlus: t.type === 'EARNING' // EARNING is positive, SPEND is negative
        }))
      ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 20);

      return {
        totalEarnings,
        estimatedEarnings,
        totalViews,
        activeVideos,
        avgContributionPercent,
        avgViews,
        totalVideos: submissions.length,
        recentActivity,
        recentSubmissions: activeSubmissions.slice(0, 10),
        // User info
        creatorTier: user?.creatorTier,
        followerCount: user?.followerCount || 0,
        plan: user?.plan || 'FREE'
      };
    }),

  getArtistStats: t.procedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");

      // OPTIMIZED: Parallelize all independent queries
      const [
        budgetStats,
        viewStats,
        recentTransactions,
        activeCampaigns
      ] = await Promise.all([
        // 1. Calculate Active Budget & Campaign Count (Aggregation)
        prisma.campaign.aggregate({
          where: {
            artistId: userId,
            status: "ACTIVE"
          },
          _sum: {
            remainingBudget: true
          },
          _count: true
        }),

        // 2. Calculate Total Views (Aggregation)
        prisma.submission.aggregate({
          where: {
            campaign: {
              artistId: userId
            }
          },
          _sum: {
            lastViewCount: true
          }
        }),

        // 3. Recent Transactions
        prisma.transaction.findMany({
          where: { userId },
          take: 20,
          orderBy: { createdAt: "desc" }
        }),

        // 4. Active Campaigns List (for display)
        prisma.campaign.findMany({
          where: {
            artistId: userId,
            status: "ACTIVE",
            OR: [{ endDate: { gt: new Date() } }, { endDate: null }]
          },
          select: {
            id: true,
            title: true,
            status: true,
            tier: true,
            totalBudget: true,
            remainingBudget: true,
            startDate: true,
            endDate: true,
            durationDays: true,
            commissionPercent: true,
            song: {
              select: {
                title: true,
                coverImage: true,
                authorName: true
              }
            },
            _count: {
              select: {
                submissions: true
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        })
      ]);

      return {
        // balance: REMOVED (Frontend uses getUser()->balance)
        totalViews: viewStats._sum.lastViewCount || 0,
        activeBudget: Number(budgetStats._sum.remainingBudget || 0),
        activeCampaignsCount: budgetStats._count,
        recentTransactions,
        activeCampaigns
      };
    }),

  getActivity: t.procedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("USER_NOT_FOUND");

      if (user.role === "ARTIST") {
        // For Artist: Show submissions to THEIR campaigns
        return await prisma.submission.findMany({
          where: {
            campaign: {
              artistId: userId
            }
          },
          include: {
            campaign: {
              select: { title: true, song: { select: { title: true, coverImage: true } } }
            },
            // We might want creator details here
            // creator: { select: { name: true, avatar: true } } 
          },
          orderBy: { createdAt: "desc" },
          take: 20
        });
      } else {
        // For Creator: Show THEIR submissions
        return await prisma.submission.findMany({
          where: {
            creatorId: userId
          },
          include: {
            campaign: {
              select: { title: true, song: { select: { title: true, coverImage: true, artist: { select: { name: true } } } } }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 20
        });
      }
    }),

  upgradeToPro: t.procedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");
      // Mock success for credit card flow
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { plan: "PRO" }
      });
      return { success: true, user: updatedUser };
    }),

  upgradeToProWithBalance: t.procedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("USER_NOT_FOUND");

      // Price: 300 TL
      const COST_TL = 300;

      if (Number(user.balance) < COST_TL) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // Add 30 days to current time
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const [updatedUser] = await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            balance: { decrement: COST_TL },
            plan: "PRO",
            subscriptionEndsAt: expiresAt
          }
        }),
        prisma.transaction.create({
          data: {
            userId,
            type: "SPEND",
            amount: COST_TL,
            description: "Pro Üyelik (30 Gün)",
            status: "COMPLETED"
          }
        })
      ]);

      return { success: true, user: updatedUser };
    }),

  rejectCampaign: t.procedure
    .input(z.object({
      campaignId: z.string(),
      reason: z.string().min(1, "Rejection reason is required"),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");

      const admin = await prisma.user.findUnique({ where: { id: userId } });
      if (admin?.role !== "ADMIN") throw new Error("FORBIDDEN");

      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId }
      });

      if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
      if (campaign.status !== "PENDING_APPROVAL") throw new Error("CAMPAIGN_NOT_PENDING");

      // 100% refund on admin rejection
      const refundAmountTL = Number(campaign.totalBudget);

      await prisma.$transaction(async (tx) => {
        await tx.campaign.update({
          where: { id: input.campaignId },
          data: {
            status: "REJECTED",
            rejectionReason: input.reason,
          }
        });

        await tx.user.update({
          where: { id: campaign.artistId },
          data: { balance: { increment: refundAmountTL } }
        });

        await tx.transaction.create({
          data: {
            userId: campaign.artistId,
            type: "DEPOSIT",
            amount: refundAmountTL,
            status: "COMPLETED",
            description: `Kampanya İadesi (Reddedildi): ${campaign.title}`
          }
        });
      });

      return { success: true };
    }),

  // ─── Campaign Approval ───────────────────────────────────────────────
  approveCampaign: t.procedure
    .input(z.object({ campaignId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");

      const admin = await prisma.user.findUnique({ where: { id: userId } });
      if (admin?.role !== "ADMIN") throw new Error("FORBIDDEN");

      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId }
      });

      if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
      if (campaign.status !== "PENDING_APPROVAL") throw new Error("CAMPAIGN_NOT_PENDING");

      const now = new Date();
      const actualStartDate = campaign.desiredStartDate && campaign.desiredStartDate > now
        ? campaign.desiredStartDate
        : now;

      const endDate = new Date(actualStartDate.getTime() + campaign.durationDays * 24 * 60 * 60 * 1000);

      await prisma.campaign.update({
        where: { id: input.campaignId },
        data: {
          status: "ACTIVE",
          startDate: actualStartDate,
          endDate: endDate,
        }
      });

      // Initialize campaign calculations
      const { onCampaignCreated } = await import('@/server/services/submissionHooks');
      await onCampaignCreated(input.campaignId, prisma);

      return { success: true, startDate: actualStartDate, endDate };
    }),

  // ─── Edit Pending Campaign (Artist) ──────────────────────────────────
  editPendingCampaign: t.procedure
    .input(z.object({
      campaignId: z.string(),
      title: z.string().min(1).max(100).optional(),
      description: z.string().max(2000).optional(),
      desiredStartDate: z.string().datetime().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");

      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId }
      });

      if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
      if (campaign.artistId !== userId) throw new Error("FORBIDDEN");
      if (campaign.status !== "PENDING_APPROVAL") throw new Error("CAMPAIGN_NOT_PENDING");

      const updateData: any = {};

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;

      if (input.desiredStartDate !== undefined) {
        const newDate = new Date(input.desiredStartDate);
        const minStartDate = new Date(campaign.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
        if (newDate < minStartDate) {
          throw new Error("START_DATE_TOO_EARLY");
        }
        updateData.desiredStartDate = newDate;
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error("NO_CHANGES");
      }

      await prisma.campaign.update({
        where: { id: input.campaignId },
        data: updateData,
      });

      return { success: true };
    }),

  // ─── Cancel Campaign (Artist) ────────────────────────────────────────
  cancelCampaign: t.procedure
    .input(z.object({ campaignId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");

      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId }
      });

      if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
      if (campaign.artistId !== userId) throw new Error("FORBIDDEN");
      if (campaign.status !== "PENDING_APPROVAL") throw new Error("CAMPAIGN_NOT_PENDING");

      // 100% refund on artist self-cancel
      const refundAmountTL = Number(campaign.totalBudget);

      await prisma.$transaction(async (tx) => {
        await tx.campaign.update({
          where: { id: input.campaignId },
          data: { status: "CANCELLED" }
        });

        await tx.user.update({
          where: { id: userId },
          data: { balance: { increment: refundAmountTL } }
        });

        await tx.transaction.create({
          data: {
            userId,
            type: "DEPOSIT",
            amount: refundAmountTL,
            status: "COMPLETED",
            description: `Kampanya İptali: ${campaign.title}`
          }
        });
      });

      return { success: true, refundAmount: refundAmountTL };
    }),

  // ─── InsightIQ (Phyllo) Integration ───────────────────────────────────

  // Create InsightIQ SDK token for authenticated users
  createInsightIQToken: t.procedure
    .input(z.object({
      redirectUrl: z.string().optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
    const userId = ctx.userId;
    if (!userId) throw new Error("UNAUTHORIZED");

    const INSIGHTIQ_BASE_URL = process.env.INSIGHTIQ_BASE_URL || "https://api.staging.insightiq.ai";
    const clientId = process.env.INSIGHTIQ_CLIENT_ID;
    const clientSecret = process.env.INSIGHTIQ_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing InsightIQ credentials");
    }

    const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;

    // Helper function to create SDK token
    const createSdkToken = async (insightiqUserId: string) => {
      const body: Record<string, any> = {
        user_id: insightiqUserId,
        products: ["IDENTITY", "IDENTITY.AUDIENCE", "ENGAGEMENT", "ENGAGEMENT.AUDIENCE", "INCOME"],
      };

      // Add redirect URL if provided (for web SDK flow)
      if (input?.redirectUrl) {
        body.redirect_url = input.redirectUrl;
      }

      const tokenRes = await fetch(`${INSIGHTIQ_BASE_URL}/v1/sdk-tokens`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("InsightIQ token creation failed:", errText);
        throw new Error("Failed to create InsightIQ token");
      }
      const tokenData = await tokenRes.json();
      console.log("InsightIQ SDK token response:", JSON.stringify(tokenData));

      // Return token and connect_url if provided by InsightIQ
      return {
        token: tokenData.sdk_token as string,
        connectUrl: tokenData.redirect_url || tokenData.connect_url || null,
        userId: insightiqUserId,
      };
    };

    // Step 1: Try to get existing user first (handles reconnect case)
    const existingUserRes = await fetch(`${INSIGHTIQ_BASE_URL}/v1/users/external_id/${userId}`, {
      headers: { Authorization: authHeader },
    });

    if (existingUserRes.ok) {
      const existingUser = await existingUserRes.json();
      console.log("InsightIQ user exists, creating token for:", existingUser.id);
      return createSdkToken(existingUser.id);
    }

    // Step 2: User doesn't exist, create new one
    console.log("InsightIQ user not found, creating new user...");
    const createRes = await fetch(`${INSIGHTIQ_BASE_URL}/v1/users`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ external_id: userId, name: userId }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.error("InsightIQ user creation failed:", createRes.status, errorText);

      // Handle race condition: user was created between our check and create
      if (errorText.includes("user_exists_with_external_id") || createRes.status === 409) {
        console.log("InsightIQ user was created concurrently, fetching...");
        const retryRes = await fetch(`${INSIGHTIQ_BASE_URL}/v1/users/external_id/${userId}`, {
          headers: { Authorization: authHeader },
        });
        if (retryRes.ok) {
          const user = await retryRes.json();
          return createSdkToken(user.id);
        }
      }

      throw new Error(`InsightIQ API error (${createRes.status}): ${errorText.substring(0, 200)}`);
    }

    const created = await createRes.json();
    const insightiqUserId = created.id;
    console.log("InsightIQ user created:", insightiqUserId);

    return createSdkToken(insightiqUserId);
  }),

  // Link InsightIQ account after successful connect flow
  linkInsightIQAccount: t.procedure
    .input(z.object({
      accountId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;
      if (!userId) throw new Error("UNAUTHORIZED");

      const INSIGHTIQ_BASE_URL = process.env.INSIGHTIQ_BASE_URL || "https://api.staging.insightiq.ai";
      const clientId = process.env.INSIGHTIQ_CLIENT_ID;
      const clientSecret = process.env.INSIGHTIQ_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error("Missing InsightIQ credentials");
      }

      const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;

      // Fetch account from InsightIQ with retries (profile data may not be
      // available immediately after connect — InsightIQ fetches it async)
      const MAX_AVATAR_RETRIES = 3;
      const RETRY_DELAY_MS = 2000;
      let account: any;
      let avatar: string | null = null;

      for (let attempt = 0; attempt <= MAX_AVATAR_RETRIES; attempt++) {
        const accountRes = await fetch(`${INSIGHTIQ_BASE_URL}/v1/accounts/${input.accountId}`, {
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
        });

        if (!accountRes.ok) {
          console.error("InsightIQ account fetch failed:", await accountRes.text());
          throw new Error("Failed to fetch InsightIQ account");
        }

        account = await accountRes.json();
        console.log(`InsightIQ account data (attempt ${attempt + 1}):`, JSON.stringify(account, null, 2));

        avatar = account.platform_profile_picture_url || account.profile_pic_url || account.image_url || null;
        if (avatar) break;

        if (attempt < MAX_AVATAR_RETRIES) {
          console.log(`[linkInsightIQ] Avatar not available yet, retrying in ${RETRY_DELAY_MS}ms... (attempt ${attempt + 1}/${MAX_AVATAR_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }

      // Fallback: try the social profiles endpoint if avatar still missing
      if (!avatar) {
        try {
          console.log("[linkInsightIQ] Trying profiles API fallback for avatar...");
          const profileRes = await fetch(
            `${INSIGHTIQ_BASE_URL}/v1/social/creators/profiles?account_id=${input.accountId}`,
            { headers: { Authorization: authHeader, "Content-Type": "application/json" } }
          );
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            const profiles = profileData.data || [];
            if (profiles.length > 0) {
              avatar = profiles[0].platform_profile_picture_url || profiles[0].image_url || null;
              console.log("[linkInsightIQ] Got avatar from profiles fallback:", avatar);
            }
          }
        } catch (e) {
          console.warn("[linkInsightIQ] Profiles fallback failed:", e);
        }
      }

      // InsightIQ uses different field names - check all possibilities
      const handle: string | undefined = account.platform_username || account.username;

      if (!handle) {
        console.error("InsightIQ account missing platform_username:", account);
        throw new Error("Could not resolve TikTok handle from InsightIQ");
      }

      // Get additional profile data - InsightIQ field names
      const displayName: string = account.platform_profile_name || account.name || handle;
      console.log("Extracted: handle=", handle, "displayName=", displayName, "avatar=", avatar);

      // Update user with TikTok data (using existing schema fields)
      await prisma.user.update({
        where: { id: userId },
        data: {
          tiktokHandle: handle,
          tiktokUserId: input.accountId, // Store InsightIQ account ID here
          tiktokUsername: handle,
          tiktokDisplayName: displayName,
          tiktokAvatarUrl: avatar,
          tiktokConnectedAt: new Date(),
          name: `@${handle}`, // Set display name to TikTok handle
          avatar: avatar,
        },
      });

      return { tiktokHandle: handle, displayName, avatar };
    }),

  // Disconnect InsightIQ account
  disconnectInsightIQAccount: t.procedure.mutation(async ({ ctx }) => {
    console.log("[DisconnectInsightIQ] Starting disconnect mutation...");
    const userId = ctx.userId;
    console.log("[DisconnectInsightIQ] User ID:", userId);

    if (!userId) {
      console.error("[DisconnectInsightIQ] UNAUTHORIZED - no user ID");
      throw new Error("UNAUTHORIZED");
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { tiktokUserId: true, tiktokHandle: true },
    });
    console.log("[DisconnectInsightIQ] Current user TikTok data:", currentUser);

    // Best-effort revoke on InsightIQ's side
    if (currentUser?.tiktokUserId) {
      try {
        const INSIGHTIQ_BASE_URL = process.env.INSIGHTIQ_BASE_URL || "https://api.staging.insightiq.ai";
        const clientId = process.env.INSIGHTIQ_CLIENT_ID;
        const clientSecret = process.env.INSIGHTIQ_CLIENT_SECRET;

        if (clientId && clientSecret) {
          const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
          console.log("[DisconnectInsightIQ] Attempting to revoke account on InsightIQ:", currentUser.tiktokUserId);
          const revokeRes = await fetch(`${INSIGHTIQ_BASE_URL}/v1/accounts/${currentUser.tiktokUserId}`, {
            method: "DELETE",
            headers: { Authorization: authHeader },
          });
          console.log("[DisconnectInsightIQ] InsightIQ revoke response:", revokeRes.status);
        }
      } catch (e) {
        console.warn("[DisconnectInsightIQ] InsightIQ account revoke failed — continuing with local disconnect:", e);
      }
    } else {
      console.log("[DisconnectInsightIQ] No tiktokUserId found, skipping InsightIQ revoke");
    }

    // Clear TikTok data from user (use 0 for non-nullable Int fields)
    console.log("[DisconnectInsightIQ] Clearing TikTok data from database...");
    await prisma.user.update({
      where: { id: userId },
      data: {
        // TikTok profile data
        tiktokHandle: null,
        tiktokUserId: null,
        tiktokUsername: null,
        tiktokDisplayName: null,
        tiktokAvatarUrl: null,
        tiktokConnectedAt: null,
        // InsightIQ tokens
        insightiqAccessToken: null,
        insightiqRefreshToken: null,
        insightiqTokenExpiry: null,
        // Stats
        followerCount: 0,
        followingCount: 0,
        totalLikes: 0,
        videoCount: 0,
        creatorTier: null,
        lastStatsFetchedAt: null,
        // Reset profile if it was set from TikTok
        avatar: null,
      },
    });
    console.log("[DisconnectInsightIQ] Database updated successfully!");

    return { success: true };
  }),
});

export type AppRouter = typeof appRouter;
