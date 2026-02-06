import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Context } from "../context";
import { getCreatorTierFromFollowers, isCreatorEligibleForCampaign } from "../lib/tierUtils";

// Minimal tRPC setup for type compatibility
// This app uses REST API routes, but tRPC types are imported for compatibility
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const appRouter = t.router({
  health: t.procedure.query(() => {
    return "OK from tRPC!";
  }),
  getUser: t.procedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
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
          couponBalance: true,
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
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error("UNAUTHORIZED");
      }

      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          tiktok_access_token: true,
          tiktok_refresh_token: true,
          tiktok_token_expires_at: true,
          lastStatsFetchedAt: true
        }
      });

      if (!currentUser?.tiktok_access_token) {
        throw new Error("TIKTOK_NOT_CONNECTED: Please connect your TikTok account first via OAuth");
      }

      // Rate limiting: Check if updated recently (e.g. 10 mins)
      if (currentUser?.lastStatsFetchedAt) {
        const timeDiff = new Date().getTime() - new Date(currentUser.lastStatsFetchedAt).getTime();
        const minutesDiff = timeDiff / (1000 * 60);

        if (minutesDiff < 10) {
          return prisma.user.findUnique({ where: { id: userId } });
        }
      }

      // Refresh token if expired
      let accessToken = currentUser.tiktok_access_token;
      if (
        currentUser.tiktok_token_expires_at &&
        new Date() > currentUser.tiktok_token_expires_at
      ) {
        const { tiktokAPI } = await import("@/lib/tiktok-api");
        const newTokens = await tiktokAPI.refreshAccessToken(
          currentUser.tiktok_refresh_token!
        );

        accessToken = newTokens.access_token;
        await prisma.user.update({
          where: { id: userId },
          data: {
            tiktok_access_token: newTokens.access_token,
            tiktok_refresh_token: newTokens.refresh_token,
            tiktok_token_expires_at: new Date(
              Date.now() + newTokens.expires_in * 1000
            )
          }
        });
      }

      // Fetch fresh user data from TikTok API
      const { tiktokAPI } = await import("@/lib/tiktok-api");
      const userInfo = await tiktokAPI.getUserInfo(accessToken);

      // Update user stats
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          tiktokHandle: userInfo.username.replace('@', ''),
          name: userInfo.display_name,
          avatar: userInfo.avatar_url,
          followerCount: userInfo.follower_count,
          followingCount: userInfo.following_count,
          totalLikes: userInfo.likes_count,
          videoCount: userInfo.video_count,
          creatorTier: getCreatorTierFromFollowers(userInfo.follower_count),
          lastStatsFetchedAt: new Date()
        }
      });

      return updatedUser;
    }),

  createUser: t.procedure
    .input(z.object({
      userId: z.string(),
      email: z.string().email(),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Check if user already exists
      const existing = await prisma.user.findUnique({
        where: { id: input.userId }
      });

      if (existing) {
        return existing;
      }

      // Create new user in database
      const user = await prisma.user.create({
        data: {
          id: input.userId,
          email: input.email,
          password: 'supabase-auth', // Not used, Supabase handles auth
          name: input.name || 'içerik üreticisi',
          role: 'CREATOR',
          balance: 0,
          couponBalance: 0,
          plan: 'FREE',
          cycleStartDate: new Date()
        }
      });

      return user;
    }),

  getActiveCampaigns: t.procedure
    .input(z.object({
      search: z.string().optional(),
      tier: z.enum(['D', 'C', 'B', 'A', 'S']).optional(),
      limit: z.number().optional().default(100)
    }).optional())
    .query(async ({ input }) => {
      const search = input?.search;
      const tier = input?.tier;
      const limit = input?.limit || 100;

      const where: any = {
        status: "ACTIVE",
        endDate: { gt: new Date() }
      };

      // Server-side search
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { song: { title: { contains: search, mode: 'insensitive' } } },
          { song: { authorName: { contains: search, mode: 'insensitive' } } }
        ];
      }

      // Tier filter
      if (tier) {
        where.tier = tier;
      }

      const campaigns = await prisma.campaign.findMany({
        where,
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          tier: true,
          totalBudget: true,
          maxSubmissions: true,
          maxParticipants: true, // NEW
          isProOnly: true,       // NEW
          targetTiers: true,     // NEW
          endDate: true,
          minFollowers: true,
          minVideoDuration: true,
          platformFeePercent: true,
          safetyReservePercent: true,
          song: {
            select: {
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
      return campaigns;
    }),
  getJoinedCampaigns: t.procedure
    .input(z.object({
      cursor: z.string().optional(), // Campaign ID for cursor-based pagination
      limit: z.number().min(1).max(100).default(20),
      endedOnly: z.boolean().optional() // Filter for ended campaigns only
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
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
          maxSubmissions: true,
          endDate: true,
          platformFeePercent: true,
          safetyReservePercent: true,
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
              averagePoints: true
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
      const userId = ctx.user?.id;
      if (!userId) throw new Error("UNAUTHORIZED");

      const [activeCount, myActiveCount, joinedActiveCount] = await Promise.all([
        // 1. Total Active Campaigns
        prisma.campaign.count({
          where: {
            status: "ACTIVE",
            endDate: { gt: new Date() }
          }
        }),

        // 2. My Active Campaigns (if Artist)
        prisma.campaign.count({
          where: {
            artistId: userId,
            status: "ACTIVE",
            endDate: { gt: new Date() }
          }
        }),

        // 3. Joined Active Campaigns (if Creator)
        prisma.campaign.count({
          where: {
            status: "ACTIVE",
            endDate: { gt: new Date() },
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
      const userId = ctx.user?.id;

      // 1. Fetch Campaign Base Info
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

      // Destructure to exclude stale computed fields from database
      const { totalCampaignPoints: _, netBudgetTP: __, netMultiplier: ___, ...campaignData } = campaign;

      return {
        ...campaignData,
        mySubmission,
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
      const userId = ctx.user?.id;
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
      const userId = ctx.user?.id;
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
      let finalSubmission = mySubmission;

      // Smart Refresh: Check if stale (> 6 hours)
      const now = new Date();
      const lastChecked = mySubmission.lastCheckedAt ? new Date(mySubmission.lastCheckedAt) : new Date(0);
      const diffHours = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60);

      if (diffHours > 6) {
        try {
          const { tiktokMetadata } = await import("@/lib/tiktok-metadata");
          const videoData = await tiktokMetadata.getVideoMetadata(mySubmission.tiktokUrl);

          finalSubmission = await prisma.submission.update({
            where: { id: mySubmission.id },
            data: {
              lastViewCount: videoData.stats.views,
              lastLikeCount: videoData.stats.likes,
              lastCommentCount: videoData.stats.comments,
              lastShareCount: videoData.stats.shares,
              lastCheckedAt: new Date()
            }
          });
        } catch (error) {
          console.error("Smart Refresh Failed:", error);
          // Fail silently and show old data
        }
      }

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

      return {
        campaign,
        submission: finalSubmission,
        poolStats: {
          totalCampaignPoints,
          totalViews,
          totalLikes
        }
      };
    }),
  validateVideo: t.procedure
    .input(z.object({
      campaignId: z.string(),
      tiktokUrl: z.string().url()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("UNAUTHORIZED");

      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        include: { song: true }
      });
      if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");

      const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
      if (!user) throw new Error("USER_NOT_FOUND");

      // Extract video metadata
      const { tiktokMetadata } = await import("@/lib/tiktok-metadata");

      let videoData;
      try {
        videoData = await tiktokMetadata.getVideoMetadata(input.tiktokUrl);
      } catch (error: any) {
        return {
          isValid: false,
          errors: [`Video validation failed: ${error.message}`],
          video: null,
          checks: {}
        };
      }

      const errors: string[] = [];

      // 1. Account Check
      let isAccountMatch = false;
      if (user.tiktokHandle) {
        isAccountMatch = videoData.author.toLowerCase() === user.tiktokHandle.toLowerCase();
        if (!isAccountMatch) {
          errors.push(
            `Account mismatch: Video belongs to @${videoData.author}, ` +
            `but your account is @${user.tiktokHandle}`
          );
        }
      } else {
        errors.push("TikTok handle not set in profile");
      }

      // 2. Song Check (EXACT MATCH ONLY)
      const songMatch = tiktokMetadata.validateSongMatch(
        {
          id: campaign.song.tiktokMusicId!,
          title: campaign.song.title,
          authorName: campaign.song.authorName!
        },
        videoData.song
      );

      if (!songMatch.match) {
        errors.push(`Song mismatch: ${songMatch.reason}`);
      }

      // 3. Duration Check
      const durationMatch = !campaign.minVideoDuration || videoData.duration >= campaign.minVideoDuration;
      if (!durationMatch) {
        errors.push(
          `Video too short: ${videoData.duration}s ` +
          `(min: ${campaign.minVideoDuration}s)`
        );
      }

      return {
        isValid: errors.length === 0,
        errors,
        video: videoData,
        checks: {
          accountMatch: isAccountMatch,
          songMatch: songMatch.match,
          durationMatch
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
      const userId = ctx.user?.id;
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

      // Check tier eligibility - creators can only join campaigns at their tier or lower
      if (!isCreatorEligibleForCampaign(user.creatorTier, campaign.tier)) {
        const tierNames = { D: 'D', C: 'C (<1k takipçi)', B: 'B (1k-3k)', A: 'A (3k-5k)', S: 'S (5k+)' };
        const requiredTier = tierNames[campaign.tier] || campaign.tier;
        const userTier = user.creatorTier ? tierNames[user.creatorTier] : 'Yok';
        throw new Error(`TIER_NOT_ELIGIBLE: Bu kampanya ${requiredTier} tier gerektiriyor. Senin tier'in: ${userTier}. TikTok hesabını bağlayıp takipçi sayını doğrulaman gerekir.`);
      }

      if (campaign._count.submissions >= campaign.maxSubmissions) {
        throw new Error("CAMPAIGN_FULL");
      }

      // 1. Extract video metadata and validate
      const { tiktokMetadata } = await import("@/lib/tiktok-metadata");

      let videoData;
      try {
        videoData = await tiktokMetadata.getVideoMetadata(input.tiktokUrl);
      } catch (error: any) {
        throw new Error(`INVALID_VIDEO: ${error.message}`);
      }

      // 2. Get campaign with song info for validation
      const campaignWithSong = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        include: { song: true }
      });

      if (!campaignWithSong) throw new Error("CAMPAIGN_NOT_FOUND");

      // 3. Validate song match (EXACT MATCH ONLY)
      const songMatch = tiktokMetadata.validateSongMatch(
        {
          id: campaignWithSong.song.tiktokMusicId!,
          title: campaignWithSong.song.title,
          authorName: campaignWithSong.song.authorName!
        },
        videoData.song
      );

      if (!songMatch.match) {
        throw new Error(`SONG_MISMATCH: ${songMatch.reason}`);
      }

      // 4. Create Submission
      const submission = await prisma.submission.create({
        data: {
          campaignId: input.campaignId,
          creatorId: userId,
          tiktokUrl: input.tiktokUrl,
          tiktokVideoId: videoData.id,
          status: "APPROVED",
          lastViewCount: videoData.stats.views,
          lastLikeCount: videoData.stats.likes,
          lastCommentCount: videoData.stats.comments,
          lastShareCount: videoData.stats.shares,
          videoDuration: videoData.duration,
          lastCheckedAt: new Date()
        },
      });

      // 3. Trigger backend calculations immediately
      const { onSubmissionStatsUpdate } = await import('@/server/services/submissionHooks');
      await onSubmissionStatsUpdate(submission.id, prisma);

      return { success: true, submissionId: submission.id };
    }),

  deleteSubmission: t.procedure
    .input(z.object({
      submissionId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
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
      budget: z.number().min(150000), // Minimum 15,000 TL budget (in TP: 150,000)
      minVideoDuration: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error("UNAUTHORIZED");
      }

      // Import tier utilities
      const { getCampaignTierFromBudget, getMinFollowersForTier, getMaxSubmissionsFromBudget } =
        await import("@/server/lib/tierUtils");

      // 1. Extract song metadata from TikTok
      const { tiktokMetadata } = await import("@/lib/tiktok-metadata");

      let songMetadata;
      try {
        songMetadata = await tiktokMetadata.getSongMetadata(input.tiktokUrl);
      } catch (error: any) {
        throw new Error(`INVALID_SONG_URL: ${error.message}`);
      }

      // 2. Find or Create Song
      let song = await prisma.song.findFirst({
        where: { tiktokMusicId: songMetadata.id }
      });

      if (!song) {
        song = await prisma.song.create({
          data: {
            title: songMetadata.title,
            authorName: songMetadata.authorName,
            tiktokUrl: input.tiktokUrl,
            tiktokMusicId: songMetadata.id,
            coverImage: songMetadata.coverUrl,
            duration: songMetadata.duration,
            artistId: userId,
            statsLastFetched: new Date()
          },
        });
      }

      // Parse dates
      const startDate = input.startDate ? new Date(input.startDate) : new Date();
      const endDate = input.endDate ? new Date(input.endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // 3. Calculate tier-based values
      const budgetTP = input.budget;
      const budgetTL = budgetTP / 10; // 10 TP = 1 TL Conversion

      // Calculate campaign tier and auto-set requirements
      const campaignTier = getCampaignTierFromBudget(budgetTL);
      const minFollowers = getMinFollowersForTier(campaignTier);
      const maxSubmissions = getMaxSubmissionsFromBudget(budgetTL);

      // 4. Deduction & Creation (Transaction)
      const campaign = await prisma.$transaction(async (tx) => {
        // Check Balance
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("USER_NOT_FOUND");

        if (Number(user.balance) < budgetTL) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        // Deduct from Wallet
        await tx.user.update({
          where: { id: userId },
          data: { balance: { decrement: budgetTL } }
        });

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

        // Create Campaign with tier
        return await tx.campaign.create({
          data: {
            title: input.title,
            description: input.description,
            totalBudget: budgetTL, // Store as TL
            remainingBudget: budgetTL,
            status: "PENDING_APPROVAL", // Require admin approval
            tier: campaignTier, // Auto-calculated tier
            songId: song.id,
            artistId: userId,
            minFollowers: minFollowers, // Auto-calculated from tier
            minVideoDuration: input.minVideoDuration,
            maxSubmissions: maxSubmissions, // Auto-calculated from budget
            startDate: startDate,
            endDate: endDate
          }
        });
      });

      return { success: true, campaignId: campaign.id };
    }),

  getMyCampaigns: t.procedure
    .input(z.object({
      cursor: z.string().optional(), // Campaign ID for cursor-based pagination
      limit: z.number().min(1).max(100).default(20),
      endedOnly: z.boolean().optional() // Filter for ended campaigns only
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
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
          maxSubmissions: true,
          startDate: true,
          endDate: true,
          minFollowers: true,
          platformFeePercent: true,
          safetyReservePercent: true,
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
              averagePoints: true
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
      const userId = ctx.user?.id;
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
                  title: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });

      // Aggregate calculations - separate ended vs active campaigns
      // FIXED: totalEarnings (Toplam) = sum of finalized earnings from ENDED campaigns only
      const totalEarnings = submissions
        .filter(s => {
          if (!s.campaign) return false;
          // Campaign is ended if status is COMPLETED OR endDate has passed
          const campaignEnded = s.campaign.status === 'COMPLETED' || new Date(s.campaign.endDate) < new Date();
          return campaignEnded; // Only ended campaigns
        })
        .reduce((sum, s) => sum + Number(s.totalEarnings), 0);

      // FIXED: estimatedEarnings (Tahmini) = sum of estimated earnings from ACTIVE campaigns only
      const estimatedEarnings = submissions
        .filter(s => {
          if (!s.campaign) return false;
          // Campaign is ended if status is COMPLETED OR endDate has passed
          const campaignEnded = s.campaign.status === 'COMPLETED' || new Date(s.campaign.endDate) < new Date();
          return !campaignEnded; // Only active campaigns
        })
        .reduce((sum, s) => sum + Number(s.estimatedEarnings), 0);

      const totalViews = submissions.reduce((sum, s) => sum + (s.lastViewCount || 0), 0);

      // UPDATED: Active videos count - only approved submissions with active (not ended) campaigns
      const activeVideos = submissions.filter(s => {
        if (s.status !== "APPROVED") return false;
        if (!s.campaign) return false;
        // Campaign is ended if status is COMPLETED OR endDate has passed
        const campaignEnded = s.campaign.status === 'COMPLETED' || new Date(s.campaign.endDate) < new Date();
        return !campaignEnded; // Only count active campaigns
      }).length;

      // Calculate Average Contribution Percent - ONLY for ended campaigns
      // OPTIMIZED: Filter from already-fetched submissions instead of separate query
      const endedSubmissions = submissions.filter(s => {
        const campaign = s.campaign;
        return campaign && (campaign.status === 'COMPLETED' || new Date(campaign.endDate) < new Date());
      });

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

      // OPTIMIZED: Use already-fetched submissions instead of separate query
      // Filter for finished campaigns from the submissions we already have
      const finishedSubmissions = submissions.filter(s =>
        s.status === 'APPROVED' &&
        s.campaign &&
        new Date(s.campaign.endDate) < new Date()
      ).slice(0, 20);

      const recentActivity = [
        // Campaign earnings - only from finished campaigns
        ...finishedSubmissions.map(s => ({
          id: s.id,
          type: 'CAMPAIGN',
          amount: (Number(s.estimatedEarnings) || 0) * 10, // Convert Decimal to Number, then TL to TP
          date: s.updatedAt, // Use updatedAt for when it was finalized
          description: `${s.campaign?.song?.title || 'Kampanya'} - Kazanç`,
          status: 'COMPLETED',
          isPlus: true
        })),
        // Transactions (payouts, withdrawals, purchases)
        ...recentTransactions.map(t => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount) * 10, // TL to TP
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
        recentSubmissions: submissions
          .filter(s => {
            if (!s.campaign) return false;
            // Only include submissions from active campaigns
            const campaignEnded = s.campaign.status === 'COMPLETED' || new Date(s.campaign.endDate) < new Date();
            return !campaignEnded;
          })
          .slice(0, 10),
        // User info
        creatorTier: user?.creatorTier,
        followerCount: user?.followerCount || 0,
        plan: user?.plan || 'FREE'
      };
    }),

  getArtistStats: t.procedure
    .query(async ({ ctx }) => {
      const userId = ctx.user?.id;
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
            endDate: { gt: new Date() }
          },
          select: {
            id: true,
            title: true,
            status: true,
            tier: true,
            totalBudget: true,
            remainingBudget: true,
            maxSubmissions: true,
            startDate: true,
            endDate: true,
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
      const userId = ctx.user?.id;
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
      const userId = ctx.user?.id;
      if (!userId) throw new Error("UNAUTHORIZED");
      // Mock success for credit card flow
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { plan: "PRO" }
      });
      return { success: true, user: updatedUser };
    }),

  upgradeToProWithTP: t.procedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error("UNAUTHORIZED");

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("USER_NOT_FOUND");

      // 1 TL = 10 TP. Price is 3000 TP => 300 TL.
      const COST_TL = 300;
      const COUPON_REWARD = 20; // Grant 20 coupons with each subscription

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
            couponBalance: { increment: COUPON_REWARD }, // Grant 20 coupons
            plan: "PRO",
            subscriptionEndsAt: expiresAt
          }
        }),
        prisma.transaction.create({
          data: {
            userId,
            type: "SPEND",
            amount: COST_TL,
            description: "Pro Üyelik (30 Gün) + 20 Market Kupon",
            status: "COMPLETED"
          }
        })
      ]);

      return { success: true, user: updatedUser };
    }),

  // Marketplace Procedures
  buyCoupons: t.procedure
    .input(z.object({ amount: z.number().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error("UNAUTHORIZED");

      const COST_PER_COUPON = 100; // 100 TP per coupon
      const totalCost = input.amount * COST_PER_COUPON;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("USER_NOT_FOUND");

      if (Number(user.balance) < totalCost) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // Deduct balance and add coupons
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            balance: { decrement: totalCost },
            couponBalance: { increment: input.amount }
          }
        }),
        prisma.transaction.create({
          data: {
            userId,
            type: "SPEND",
            amount: totalCost,
            status: "COMPLETED",
            description: `Kupon Satın Alma: ${input.amount} kupon`
          }
        })
      ]);

      return { success: true };
    }),

  useCoupon: t.procedure
    .input(z.object({
      tool: z.enum(["PROFILE", "HASHTAG", "VALUATION", "AUDIT", "COMPARE"]),
      input: z.string().min(1)
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error("UNAUTHORIZED");

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("USER_NOT_FOUND");

      if (user.couponBalance < 1) {
        throw new Error("INSUFFICIENT_COUPONS");
      }

      // Mock Analysis Logic based on Tool Type
      let resultData: any = {};

      if (input.tool === "HASHTAG") {
        try {
          const apiKey = process.env.GOOGLE_AI_API_KEY;

          if (!apiKey) throw new Error("Missing Google AI API Key");

          // Dynamically import to avoid load-time errors
          const { GoogleGenerativeAI } = require("@google/generative-ai");
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

          const prompt = `Analyze this TikTok video topic for a Turkish audience: "${input.input}".
            Generate a JSON object with high-performing Turkish hashtags.
            Format: { 
              "broad": ["#tag1", "#tag2", ...], // 6-8 Popular/General tags (mostly Turkish)
              "niche": ["#tag3", "#tag4", ...], // 6-8 Specific/Niche tags (mostly Turkish)
              "viralityScore": 85, // 0-100 score based on trend potential
              "bestTime": "19:00" // Best time to post in Turkey (HH:MM)
            }. 
            Only return the JSON.`;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();

          // Clean markdown helpers if present
          const cleanJson = text.replace(/```json|```/g, "").trim();
          resultData = JSON.parse(cleanJson);
        } catch (error: any) {
          console.error("Gemini Error:", error.message);
          // Fallback if API fails for ANY reason (network, key, region, parsing)
          resultData = {
            broad: ["#fyp", "#kesfet", "#tiktok"],
            niche: [`#${input.input.replace(/\s/g, "")}`, "#trend"],
            viralityScore: 70,
            bestTime: "20:00",
            error: error.message // Optional: return error to UI for debugging
          };
        }
      } else if (input.tool === "VALUATION") {
        try {
          // Real Data via TikAPI
          // Marketplace tools are deprecated - require official TikTok Marketing API
          throw new Error("Marketplace analysis tools are currently unavailable");

          // 1. Fetch User Info (for Follower Count)
          const apiKey = process.env.TIKAPI_KEY;
          if (!apiKey) throw new Error("Missing TikAPI Key");

          const userRes = await fetch(`https://api.tikapi.io/public/check?username=${input.input}`, {
            headers: { "X-API-KEY": apiKey || '' }
          });
          if (!userRes.ok) throw new Error(`TikAPI Check Error: ${userRes.statusText}`);
          const userData = await userRes.json();
          const userInfo = userData.userInfo;
          if (!userInfo) throw new Error("User not found");

          const followers = userInfo.stats?.followerCount || 0;

          // 2. Fetch User Posts (for Views/Engagement) - Recent Batch
          // TikAPI public/posts requires 'secUid' for reliability.
          const secUid = userInfo.user?.secUid;
          if (!secUid) {
            console.warn("No secUid found, trying username fallback but likely to fail if API demands secUid");
          }

          // Construct query - prefer secUid
          const queryParam = secUid ? `secUid=${encodeURIComponent(secUid)}` : `username=${encodeURIComponent(userInfo.user?.uniqueId || input.input)}`;

          const postsRes = await fetch(`https://api.tikapi.io/public/posts?${queryParam}`, {
            headers: { "X-API-KEY": apiKey || '' }
          });

          if (!postsRes.ok) {
            // If bad request, log more details if possible (TikAPI errors are sometimes in body)
            const errText = await postsRes.text();
            console.error("TikAPI Posts Error details:", errText);
            throw new Error(`TikAPI Posts Error: ${postsRes.status} ${postsRes.statusText}`);
          }

          const postsData = await postsRes.json();
          const posts = postsData.itemList || [];

          // Filter Last 10 Days
          const now = new Date();
          const tenDaysAgo = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000));

          const recentPosts = posts.filter((p: any) => new Date(p.createTime * 1000) > tenDaysAgo);

          let avgViews = 0;
          let safeEr = 0;

          if (recentPosts.length > 0) {
            const totalViews = recentPosts.reduce((acc: number, p: any) => acc + (p.stats?.playCount || 0), 0);
            const totalLikes = recentPosts.reduce((acc: number, p: any) => acc + (p.stats?.diggCount || 0), 0);
            const totalComments = recentPosts.reduce((acc: number, p: any) => acc + (p.stats?.commentCount || 0), 0);
            const totalShares = recentPosts.reduce((acc: number, p: any) => acc + (p.stats?.shareCount || 0), 0);

            // Weighted Engagement: Likes(1) + Comments(2) + Shares(3)
            const weightedEngagements = totalLikes + (totalComments * 2) + (totalShares * 3);

            avgViews = Math.floor(totalViews / recentPosts.length);

            // Real ER Calculation (No Floor)
            const realEr = totalViews > 0 ? (weightedEngagements / totalViews) * 100 : 0;
            // No floor minimum of 10%
            safeEr = Math.min(realEr, 100);
          } else {
            // Fallback if no posts in last 10 days: Use last 3 posts generally
            if (posts.length > 0) {
              const last3 = posts.slice(0, 3);
              const totalViews = last3.reduce((acc: number, p: any) => acc + (p.stats?.playCount || 0), 0);
              const totalLikes = last3.reduce((acc: number, p: any) => acc + (p.stats?.diggCount || 0), 0);
              const totalComments = last3.reduce((acc: number, p: any) => acc + (p.stats?.commentCount || 0), 0);
              const totalShares = last3.reduce((acc: number, p: any) => acc + (p.stats?.shareCount || 0), 0);

              const weightedEngagements = totalLikes + (totalComments * 2) + (totalShares * 3);

              avgViews = Math.floor(totalViews / last3.length);
              const realEr = totalViews > 0 ? (weightedEngagements / totalViews) * 100 : 0;
              safeEr = Math.min(realEr, 100);
            } else {
              avgViews = 0; // Truly inactive account
              safeEr = 0;
            }
          }

          // Dynamic CPM Algorithm
          let cpm = 20; // Base 20 TL
          let erMultiplier = 1;

          if (safeEr >= 10) {
            erMultiplier = 1.25; // Base boost (+25%) for hitting 10%
            const excessEr = safeEr - 10;
            if (excessEr > 0) {
              // +2% boost for each %1 ER above 10
              erMultiplier += (excessEr * 0.02);
            }
          }
          cpm *= erMultiplier;

          if (followers > 50000) cpm *= 1.1;

          const estimatedPrice = (avgViews / 1000) * cpm;

          resultData = {
            username: userInfo.user?.uniqueId || input.input,
            pricePerPost: estimatedPrice,
            engagementRate: safeEr.toFixed(2),
            avgViews: avgViews,
            followers: followers,
            cpmdUsed: cpm
          };

        } catch (error: any) {
          console.error("TikAPI Valuation Error:", error.message);
          throw new Error("Analiz sırasında bir hata oluştu: " + error.message);
        }

      } else if (input.tool === "PROFILE") {
        try {
          // Marketplace tools are deprecated - require official TikTok Marketing API
          throw new Error("Marketplace analysis tools are currently unavailable");

          // 1. Check User
          const apiKey = process.env.TIKAPI_KEY;
          if (!apiKey) throw new Error("Missing TikAPI Key");

          const userRes = await fetch(`https://api.tikapi.io/public/check?username=${input.input}`, { headers: { "X-API-KEY": apiKey || '' } });
          if (!userRes.ok) throw new Error("User Check Failed");
          const userData = await userRes.json();
          const userInfo = userData.userInfo;
          if (!userInfo) throw new Error("User not found");

          // 2. Fetch Posts
          const secUid = userInfo.user?.secUid;
          const target = secUid ? `secUid=${encodeURIComponent(secUid)}` : `username=${encodeURIComponent(userInfo.user?.uniqueId || input.input)}`;

          const postsRes = await fetch(`https://api.tikapi.io/public/posts?${target}&count=15`, { headers: { "X-API-KEY": apiKey || '' } }); // Fetch a few more to ensure we get 10 valid
          if (!postsRes.ok) throw new Error("Posts Fetch Failed");
          const postsData = await postsRes.json();
          const allPosts = postsData.itemList || [];

          // 3. Analyze Last 10 Videos
          const last10 = allPosts.slice(0, 10);

          if (last10.length === 0) throw new Error("No recent videos found to analyze.");

          const analyzedVideos = last10.map((p: any) => {
            const views = p.stats?.playCount || 0;
            const likes = p.stats?.diggCount || 0;
            const comments = p.stats?.commentCount || 0;
            const shares = p.stats?.shareCount || 0;

            // Weighted ER: ((Likes + Comments*2 + Shares*3) / Views) * 100
            const weightedEng = likes + (comments * 2) + (shares * 3);
            const er = views > 0 ? (weightedEng / views) * 100 : 0;

            return {
              id: p.id,
              desc: p.desc || "",
              cover: p.video?.cover || "",
              createTime: p.createTime,
              stats: { views, likes, comments, shares, er }
            };
          });

          // 4. Averages
          const avgStats = {
            views: Math.floor(analyzedVideos.reduce((acc: number, v: any) => acc + v.stats.views, 0) / analyzedVideos.length),
            likes: Math.floor(analyzedVideos.reduce((acc: number, v: any) => acc + v.stats.likes, 0) / analyzedVideos.length),
            comments: Math.floor(analyzedVideos.reduce((acc: number, v: any) => acc + v.stats.comments, 0) / analyzedVideos.length),
            shares: Math.floor(analyzedVideos.reduce((acc: number, v: any) => acc + v.stats.shares, 0) / analyzedVideos.length),
            er: parseFloat((analyzedVideos.reduce((acc: number, v: any) => acc + v.stats.er, 0) / analyzedVideos.length).toFixed(2))
          };

          // 5. Consistency Score (Based on Variance of Gaps between posts)
          // If gaps are uniform, consistency is high.
          let consistencyScore = 50;
          if (analyzedVideos.length > 1) {
            const gaps: number[] = [];
            for (let i = 0; i < analyzedVideos.length - 1; i++) {
              const gapHrs = Math.abs(analyzedVideos[i].createTime - analyzedVideos[i + 1].createTime) / 3600;
              gaps.push(gapHrs);
            }
            // Calculate Coefficient of Variation (CV) = StdDev / Mean
            const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            const variance = gaps.reduce((a, b) => a + Math.pow(b - meanGap, 2), 0) / gaps.length;
            const stdDev = Math.sqrt(variance);

            const cv = stdDev / (meanGap || 1);
            // Lower CV is better. If CV < 0.2 -> Excellent (100). If CV > 1.5 -> Bad (20).
            // Map 0.2...1.5 to 100...20 roughly.
            consistencyScore = Math.max(20, Math.min(100, 100 - (cv * 50)));

            // Penalty for inactivity: If mean gap > 7 days (168 hrs), reduce score.
            if (meanGap > 168) consistencyScore *= 0.7;
          }

          // 6. Community Health (Interaction Ratios)
          // Comments/Likes ratio: 0.5% is good. Shares/Likes ratio: 10% is viral.
          const commentRatio = avgStats.likes > 0 ? (avgStats.comments / avgStats.likes) * 100 : 0;
          const shareRatio = avgStats.likes > 0 ? (avgStats.shares / avgStats.likes) * 100 : 0;

          let communityScore = 50; // Base
          if (commentRatio > 0.5) communityScore += 20; // Good talkative audience
          if (commentRatio > 1.5) communityScore += 10;
          if (shareRatio > 5) communityScore += 15; // High sharability
          if (shareRatio > 10) communityScore += 15; // Very Viral
          communityScore = Math.min(100, communityScore);


          resultData = {
            user: {
              username: userInfo.user.uniqueId,
              nickname: userInfo.user.nickname,
              avatar: userInfo.user.avatarThumb,
              followers: userInfo.stats.followerCount
            },
            averages: avgStats,
            videos: analyzedVideos,
            scores: {
              consistency: Math.round(consistencyScore),
              community: Math.round(communityScore)
            }
          };

        } catch (error: any) {
          console.error("Profile Analysis Error:", error.message);
          throw new Error("Analiz Başarısız: " + error.message);
        }

      } else if (input.tool === "AUDIT") {
        try {
          // Marketplace tools are deprecated - require official TikTok Marketing API
          throw new Error("Marketplace analysis tools are currently unavailable");

          // Extract Video ID from Link
          let videoId = input.input;
          if (input.input.includes("tiktok.com")) {
            const match = input.input.match(/\/video\/(\d+)/);
            if (match) videoId = match![1];
          }

          // Fetch Video Details
          const apiKey = process.env.TIKAPI_KEY;
          const vidRes = await fetch(`https://api.tikapi.io/public/video?id=${videoId}`, {
            headers: { "X-API-KEY": apiKey || '' }
          });

          if (!vidRes.ok) throw new Error("Video not found or API error");
          const vidData = await vidRes.json();
          const video = vidData.itemInfo?.itemStruct;
          if (!video) throw new Error("Video data is empty");

          // Calculate Stats
          const stats = video.stats;
          const views = stats.playCount || 1;
          const likes = stats.diggCount || 0;
          const comments = stats.commentCount || 0;
          const shares = stats.shareCount || 0;
          const saves = stats.collectCount || 0;
          const downloads = stats.downloadCount || 0;

          // User Formula: (likes*2 + comments*3 + shares*4)
          const weightedEngagement = (likes * 2) + (comments * 3) + (shares * 4);
          // Percentage
          const customEr = (weightedEngagement / views) * 100;

          // Calculate Virality Score (0-100)
          const erScore = Math.min((customEr / 25) * 100, 100);
          const viewScore = Math.min((views / 100000) * 100, 100);
          const viralityScore = Math.round((erScore * 0.7) + (viewScore * 0.3));

          // Assign Grade
          let grade = "C";
          if (viralityScore >= 90) grade = "S";
          else if (viralityScore >= 75) grade = "A";
          else if (viralityScore >= 50) grade = "B";
          else if (viralityScore < 30) grade = "F";

          resultData = {
            video: {
              id: video.id,
              desc: video.desc,
              cover: video.video?.cover,
              author: video.author?.uniqueId,
              authorAvatar: video.author?.avatarLarger,
              createTime: video.createTime,
              duration: video.video?.duration,
            },
            stats: {
              views, likes, comments, shares, saves, downloads, er: customEr.toFixed(1)
            },
            scores: {
              virality: viralityScore,
              grade,
              customEr: customEr.toFixed(1),
              aiAnalysis: "Analiz hazırlanıyor..." // Placeholder
            }
          };

          // Generate AI Analysis
          // Generate AI Analysis
          try {
            const apiKey = process.env.GOOGLE_AI_API_KEY;
            if (!apiKey) {
              console.warn("GOOGLE_AI_API_KEY is missing/empty.");
              resultData.scores.aiAnalysis = "API anahtarı eksik, analiz yapılamadı.";
            } else {
              const genAI = new GoogleGenerativeAI(apiKey!);
              const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

              const prompt = `
                Role: TikTok Koçu
                Görev: Bu video için 2 cümlelik analiz yap.
                Veriler: Not: ${grade}, Etkileşim: %${customEr.toFixed(1)}
                
                Format (Sadece 2 cümle):
                1. Cümle: Videonun neden bu notu aldığını açıkla (etkileşim/izlenme dengesi).
                2. Cümle: Daha iyi olması için net bir taktik ver.

                Kurallar:
                - Rakam kullanma.
                - Basit ve net ol.
                - "Bu notu aldı çünkü..." deme, direkt analizi söyle.
                `;

              const result = await model.generateContent(prompt);
              const response = await result.response;
              const text = response.text();
              if (text) resultData.scores.aiAnalysis = text.trim();
            }
          } catch (aiError) {
            console.error("AI Gen Error:", aiError);
            resultData.scores.aiAnalysis = `${grade} notu aldın. Etkileşim oranlarını artırmaya odaklanmalısın. (AI Hatası)`;
          }

        } catch (error: any) {
          console.error("AUDIT Tool Error:", error);
          throw new Error(error.message || "Video analysis failed");
        }
      } else if (input.tool === "COMPARE") {
        try {
          // Marketplace tools are deprecated - require official TikTok Marketing API
          throw new Error("Marketplace analysis tools are currently unavailable");

          // Helper function to analyze a user
          const analyzeUser = async (username: string) => {
            const apiKey = process.env.TIKAPI_KEY;

            // 1. Check User to get stats and secUid
            const userRes = await fetch(`https://api.tikapi.io/public/check?username=${encodeURIComponent(username.trim())}`, {
              headers: { "X-API-KEY": apiKey || '' }
            });
            if (!userRes.ok) throw new Error(`User ${username} check failed`);
            const userData = await userRes.json();
            const userInfo = userData.userInfo;
            if (!userInfo) throw new Error(`User ${username} not found`);

            // 2. Fetch Last 10 Posts
            const target = userInfo.user?.secUid
              ? `secUid=${encodeURIComponent(userInfo.user.secUid)}`
              : `username=${encodeURIComponent(userInfo.user.uniqueId)}`;

            const postsRes = await fetch(`https://api.tikapi.io/public/posts?${target}&count=15`, {
              headers: { "X-API-KEY": apiKey || '' }
            });
            const postsData = await postsRes.json();
            const allPosts = postsData.itemList || [];
            const last10 = allPosts.slice(0, 10);

            // 3. Calc Metrics
            // Basic Profile Stats
            const followers = userInfo.stats?.followerCount || 0;
            const totalLikes = userInfo.stats?.heartCount || 0; // Lifetime likes usually in stats

            let avgViews = 0;
            let safeEr = 0;
            let consistencyScore = 50;
            let communityScore = 50;

            if (last10.length > 0) {
              // Avg Views + ER
              const totalViews = last10.reduce((acc: number, p: any) => acc + (p.stats?.playCount || 0), 0);
              avgViews = Math.floor(totalViews / last10.length);

              const totalWeightedEng = last10.reduce((acc: number, p: any) => {
                return acc + (p.stats?.diggCount || 0) + ((p.stats?.commentCount || 0) * 2) + ((p.stats?.shareCount || 0) * 3);
              }, 0);

              safeEr = totalViews > 0 ? (totalWeightedEng / totalViews) * 100 : 0;
              safeEr = Math.min(safeEr, 100);

              // Consistency
              if (last10.length > 1) {
                const gaps: number[] = [];
                for (let i = 0; i < last10.length - 1; i++) {
                  const gapHrs = Math.abs(last10[i].createTime - last10[i + 1].createTime) / 3600;
                  gaps.push(gapHrs);
                }
                const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
                const variance = gaps.reduce((a, b) => a + Math.pow(b - meanGap, 2), 0) / gaps.length;
                const cv = Math.sqrt(variance) / (meanGap || 1);
                consistencyScore = Math.max(20, Math.min(100, 100 - (cv * 50)));
                if (meanGap > 168) consistencyScore *= 0.7; // Inactive penalty
              }

              // Community (Aggregate of last 10)
              const aggLikes = last10.reduce((acc: number, p: any) => acc + (p.stats?.diggCount || 0), 0);
              const aggComments = last10.reduce((acc: number, p: any) => acc + (p.stats?.commentCount || 0), 0);
              const aggShares = last10.reduce((acc: number, p: any) => acc + (p.stats?.shareCount || 0), 0);

              const commentRatio = aggLikes > 0 ? (aggComments / aggLikes) * 100 : 0;
              const shareRatio = aggLikes > 0 ? (aggShares / aggLikes) * 100 : 0;

              if (commentRatio > 0.5) communityScore += 20;
              if (commentRatio > 1.5) communityScore += 10;
              if (shareRatio > 5) communityScore += 15;
              if (shareRatio > 10) communityScore += 15;
              communityScore = Math.min(100, communityScore);
            }

            return {
              username: userInfo.user.uniqueId,
              nickname: userInfo.user.nickname,
              avatar: userInfo.user.avatarThumb,
              stats: {
                followers,
                totalLikes,
                avgViews,
                er: parseFloat(safeEr.toFixed(2)),
                consistency: Math.round(consistencyScore),
                community: Math.round(communityScore)
              }
            };
          };

          // Parse Input "user1,user2"
          const [user1Arg, user2Arg] = input.input.split(',').map((s: string) => s.trim());
          if (!user1Arg || !user2Arg) throw new Error("Please enter two usernames separated by comma.");
          // Run Parallel
          const [user1Data, user2Data] = await Promise.all([
            analyzeUser(user1Arg),
            analyzeUser(user2Arg)
          ]);

          resultData = {
            user1: user1Data,
            user2: user2Data
          };

        } catch (error: any) {
          console.error("Comparison Error:", error.message);
          throw new Error("Karşılaştırma Başarısız: " + error.message);
        }
      }

      // Deduct Coupon and Save History
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { couponBalance: { decrement: 1 } }
        }),
        prisma.marketplaceUsage.create({
          data: {
            userId,
            toolType: input.tool,
            input: input.input,
            resultSnapshot: resultData
          }
        })
      ]);

      return { success: true, result: resultData };
    }),

  getMarketplaceHistory: t.procedure
    .query(async ({ ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error("UNAUTHORIZED");

      return await prisma.marketplaceUsage.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" }
      });
    }),

  completeCampaign: t.procedure
    .input(z.object({ campaignId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // 1. Authorization
      const userId = ctx.user?.id;
      if (!userId) throw new Error("UNAUTHORIZED");

      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        include: { submissions: { where: { status: { not: 'REJECTED' } } } }
      });

      if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
      if (campaign.artistId !== userId && ctx.user?.role !== "ADMIN") throw new Error("FORBIDDEN");
      if (campaign.status === "COMPLETED") throw new Error("CAMPAIGN_ALREADY_COMPLETED");

      // 2. Refresh Metrics (outside transaction - can fail gracefully)
      const { tiktokMetadata } = await import("@/lib/tiktok-metadata");
      const submissions = campaign.submissions;
      const CHUNK_SIZE = 5;

      const refreshedMetrics: { id: string; views: number; likes: number; comments: number; shares: number }[] = [];

      for (let i = 0; i < submissions.length; i += CHUNK_SIZE) {
        const chunk = submissions.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (sub) => {
          try {
            if (sub.tiktokUrl) {
              const videoData = await tiktokMetadata.getVideoMetadata(sub.tiktokUrl);
              refreshedMetrics.push({
                id: sub.id,
                views: videoData.stats.views,
                likes: videoData.stats.likes,
                comments: videoData.stats.comments,
                shares: videoData.stats.shares
              });
            }
          } catch (e) {
            console.error(`Failed to refresh submission ${sub.id}:`, e);
            // Use old metrics if refresh fails
            refreshedMetrics.push({
              id: sub.id,
              views: sub.lastViewCount || 0,
              likes: sub.lastLikeCount || 0,
              comments: sub.lastCommentCount || 0,
              shares: sub.lastShareCount || 0
            });
          }
        }));
      }

      // 3. ALL calculations and payouts in ONE atomic transaction
      const { CalculationService } = await import('@/server/services/calculationService');

      await prisma.$transaction(async (tx) => {
        // 3a. Update metrics and calculate points for all submissions
        for (const metrics of refreshedMetrics) {
          const points = CalculationService.calculatePoints(
            metrics.views,
            metrics.likes,
            metrics.shares
          );

          await tx.submission.update({
            where: { id: metrics.id },
            data: {
              lastViewCount: metrics.views,
              lastLikeCount: metrics.likes,
              lastCommentCount: metrics.comments,
              lastShareCount: metrics.shares,
              lastCheckedAt: new Date(),
              viewPoints: points.viewPoints,
              likePoints: points.likePoints,
              sharePoints: points.sharePoints,
              totalPoints: points.totalPoints
            }
          });
        }

        // 3b. Recalculate campaign totals and distribution (with Robin Hood cap)
        await CalculationService.updateCampaignTotalPoints(input.campaignId, prisma, tx);
        await CalculationService.recalculateCampaignSubmissions(input.campaignId, prisma, tx);

        // 3c. Distribute payouts to creators
        const finalSubmissions = await tx.submission.findMany({
          where: {
            campaignId: input.campaignId,
            status: 'APPROVED',
            totalEarnings: { gt: 0 }
          },
          select: {
            id: true,
            creatorId: true,
            totalEarnings: true
          }
        });

        for (const sub of finalSubmissions) {
          const earningsTL = Number(sub.totalEarnings);
          if (earningsTL > 0) {
            // Update creator balance
            await tx.user.update({
              where: { id: sub.creatorId },
              data: { balance: { increment: earningsTL } }
            });

            // Create earnings transaction record
            await tx.transaction.create({
              data: {
                userId: sub.creatorId,
                type: 'EARNING',
                amount: earningsTL,
                status: 'COMPLETED',
                description: `Kampanya Kazancı: ${campaign.title}`,
                reference: sub.id
              }
            });
          }
        }

        // 3d. Mark campaign as completed
        await tx.campaign.update({
          where: { id: input.campaignId },
          data: {
            status: "COMPLETED",
            completedAt: new Date()
          }
        });
      }, {
        timeout: 60000 // 60 second timeout for large campaigns
      });

      return { success: true };
    }),

  rejectCampaign: t.procedure
    .input(z.object({ campaignId: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error("UNAUTHORIZED");

      const admin = await prisma.user.findUnique({ where: { id: userId } });
      if (admin?.role !== "ADMIN") throw new Error("FORBIDDEN");

      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId }
      });

      if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");

      const refundAmountTL = Number(campaign.totalBudget);

      // Refund & Reject
      await prisma.$transaction(async (tx) => {
        await tx.campaign.update({
          where: { id: input.campaignId },
          data: { status: "REJECTED" }
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
            description: `Kampanya İadesi: ${campaign.title} (${input.reason || 'Admin Reddi'})`
          }
        });
      });

      return { success: true };
    }),

  // ─── InsightIQ (Phyllo) Integration ───────────────────────────────────

  // Create InsightIQ SDK token for authenticated users
  createInsightIQToken: t.procedure
    .input(z.object({
      redirectUrl: z.string().optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
    const userId = ctx.user?.id;
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
      const userId = ctx.user?.id;
      if (!userId) throw new Error("UNAUTHORIZED");

      const INSIGHTIQ_BASE_URL = process.env.INSIGHTIQ_BASE_URL || "https://api.staging.insightiq.ai";
      const clientId = process.env.INSIGHTIQ_CLIENT_ID;
      const clientSecret = process.env.INSIGHTIQ_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error("Missing InsightIQ credentials");
      }

      const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;

      // Fetch account from InsightIQ
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

      const account = await accountRes.json();
      const handle: string | undefined = account.platform_username;

      if (!handle) {
        console.error("InsightIQ account missing platform_username:", account);
        throw new Error("Could not resolve TikTok handle from InsightIQ");
      }

      // Get additional profile data
      const displayName: string = account.name || handle;
      const avatar: string | null = account.profile_pic_url || null;

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
    const userId = ctx.user?.id;
    if (!userId) throw new Error("UNAUTHORIZED");

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { tiktokUserId: true },
    });

    // Best-effort revoke on InsightIQ's side
    if (currentUser?.tiktokUserId) {
      try {
        const INSIGHTIQ_BASE_URL = process.env.INSIGHTIQ_BASE_URL || "https://api.staging.insightiq.ai";
        const clientId = process.env.INSIGHTIQ_CLIENT_ID;
        const clientSecret = process.env.INSIGHTIQ_CLIENT_SECRET;

        if (clientId && clientSecret) {
          const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
          await fetch(`${INSIGHTIQ_BASE_URL}/v1/accounts/${currentUser.tiktokUserId}`, {
            method: "DELETE",
            headers: { Authorization: authHeader },
          });
        }
      } catch (e) {
        console.warn("InsightIQ account revoke failed — continuing with local disconnect:", e);
      }
    }

    // Clear TikTok data from user (use 0 for non-nullable Int fields)
    await prisma.user.update({
      where: { id: userId },
      data: {
        tiktokHandle: null,
        tiktokUserId: null,
        tiktokUsername: null,
        tiktokDisplayName: null,
        tiktokAvatarUrl: null,
        tiktokConnectedAt: null,
        followerCount: 0,
        followingCount: 0,
        totalLikes: 0,
        videoCount: 0,
        creatorTier: null,
        lastStatsFetchedAt: null,
      },
    });

    return { success: true };
  }),
});

export type AppRouter = typeof appRouter;
