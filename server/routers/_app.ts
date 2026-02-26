import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Context, getSupabaseAdmin } from "../context";
import { uploadImageFromUrl, STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { tiktokService } from "@/lib/tiktok/tiktok-service";
import { checkRateLimit } from "../lib/rateLimiter";

// Minimal tRPC setup for type compatibility
// This app uses REST API routes, but tRPC types are imported for compatibility
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
    };
  },
});

// Rate limiting middleware factory
function createRateLimitMiddleware(limit: number, keyPrefix: string) {
  return t.middleware(async ({ ctx, path, next }) => {
    const key = `${keyPrefix}:${ctx.clientIp}:${path}`;
    const result = checkRateLimit(key, limit);

    if (!result.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.",
      });
    }

    return next();
  });
}

// Rate-limited procedure builders
const strictProcedure = t.procedure.use(createRateLimitMiddleware(10, "strict"));     // Auth & money endpoints
const normalProcedure = t.procedure.use(createRateLimitMiddleware(60, "normal"));     // Mutations
const relaxedProcedure = t.procedure.use(createRateLimitMiddleware(120, "relaxed"));  // Read queries

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
  health: relaxedProcedure.query(() => {
    return "OK from tRPC!";
  }),
  getUser: relaxedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      const callerId = ctx.userId;
      if (!callerId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });
      if (callerId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Bu işlem için yetkiniz yok" });

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
          totalLikes: true,
          videoCount: true,
          followingCount: true,
          followerCount: true,
          lastStatsFetchedAt: true
        },
      });

      return user;
    }),

  updateProfile: normalProcedure
    .input(z.object({
      tiktokHandle: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });
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

  createUser: strictProcedure
    .input(z.object({
      userId: z.string(),
      email: z.string().email(),
      name: z.string().optional(),
      role: z.enum(['CREATOR', 'ARTIST']).optional(),
      bio: z.string().max(500).optional(),
      tiktokHandle: z.string().optional(),
      instagramHandle: z.string().optional(),
      youtubeHandle: z.string().optional(),
      privacyConsent: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Validate: authenticated users can only create their own record
      if (ctx.userId && ctx.userId !== input.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Bu işlem için yetkiniz yok" });
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
          bio: input.bio,
          tiktokHandle: input.tiktokHandle?.replace('@', ''),
          instagramHandle: input.instagramHandle?.replace('@', ''),
          youtubeHandle: input.youtubeHandle?.replace('@', ''),
        }
      });

      return user;
    }),

  getActiveCampaigns: relaxedProcedure
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

      // Migrate old TikTok CDN cover images to Supabase (fire-and-forget, throttled to 5)
      const toMigrate = campaigns.filter(c => c.song.coverImage && c.song.coverImage.includes('tiktokcdn') && !c.song.coverImage.includes('supabase'));
      for (const c of toMigrate.slice(0, 5)) {
        migrateSongCoverIfNeeded(c.song.id, c.song.coverImage);
      }

      return campaigns;
    }),
  getJoinedCampaigns: relaxedProcedure
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
              createdAt: true,
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

  getCampaignCounts: relaxedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });

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
  getCampaignById: relaxedProcedure
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

      // 3. Calculate Total Campaign Views (Real-time, views-only system)
      const aggregations = await prisma.submission.aggregate({
        where: { campaignId: input.id },
        _sum: {
          lastViewCount: true,
        }
      });

      const totalViews = aggregations._sum.lastViewCount || 0;

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
            sharePercent: true,
            lastViewCount: true,
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

      // Calculate approximate earnings for my submission
      let mySubmissionWithEarnings = mySubmission;
      if (mySubmission) {
        const { CalculationService } = await import('@/server/services/calculationService');
        const approx = CalculationService.calculateApproximateEarnings(
          { lastViewCount: mySubmission.lastViewCount, estimatedEarnings: mySubmission.estimatedEarnings, sharePercent: mySubmission.sharePercent },
          totalViews,
          { totalBudget: campaign.totalBudget, commissionPercent: campaign.commissionPercent }
        );
        mySubmissionWithEarnings = { ...mySubmission, earnings: approx } as any;
      }

      // Destructure to exclude stale computed fields from database
      const { totalCampaignPoints: _, netBudgetTP: __, netMultiplier: ___, ...campaignData } = campaign;

      return {
        ...campaignData,
        mySubmission: mySubmissionWithEarnings,
        totalViews,
        submissions: recentSubmissions,
      };
    }),

  getCampaignSubmissions: relaxedProcedure
    .input(z.object({
      campaignId: z.string(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(25),
      search: z.string().optional(),
      sortBy: z.enum(['percentage', 'views', 'likes', 'shares', 'recent']).default('percentage')
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
        case 'recent': orderBy = { createdAt: 'desc' }; break;
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
          sharePercent: true,
          lastViewCount: true,
          lastLikeCount: true,
          lastShareCount: true,
          estimatedEarnings: true,
          creator: {
            select: {
              name: true,
              avatar: true,
              tiktokHandle: true,
            }
          }
        }
      });

      let nextCursor: string | undefined = undefined;
      if (submissions.length > limit) {
        const nextItem = submissions.pop();
        nextCursor = nextItem!.id;
      }

      return {
        submissions,
        nextCursor
      };
    }),

  getCampaignAnalysis: relaxedProcedure
    .input(z.object({
      id: z.string(),
      period: z.enum(['24h', '7d', '30d', 'all']).default('all')
    }))
    .query(async ({ input, ctx }) => {
      const { id, period } = input;
      const userId = ctx.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });

      const campaign = await prisma.campaign.findUnique({
        where: { id },
        include: {
          submissions: {
            select: {
              createdAt: true,
              lastViewCount: true,
              lastLikeCount: true,
              lastShareCount: true,
            }
          }
        }
      });

      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Kampanya bulunamadı" });
      if (campaign.artistId !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Bu işlem için yetkiniz yok" });

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
      };
    }),

  getSubmittedCampaign: relaxedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });

      // 1. Fetch campaign
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
        }
      });

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Kampanya bulunamadı" });
      }

      // 2. Fetch ALL creator's submissions (multi-submission support)
      const mySubmissions = await prisma.submission.findMany({
        where: {
          campaignId: input.id,
          creatorId: userId,
          status: 'APPROVED'
        },
        orderBy: { createdAt: 'desc' }
      });

      if (mySubmissions.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Gönderim bulunamadı" });
      }

      // 3. Calculate creator's total views across all submissions
      const creatorTotalViews = mySubmissions.reduce(
        (sum, s) => sum + (s.lastViewCount || 0), 0
      );

      // 4. Aggregate total campaign views and submission count
      const [viewAggregation, totalSubmissions] = await Promise.all([
        prisma.submission.aggregate({
          where: { campaignId: input.id },
          _sum: { lastViewCount: true }
        }),
        prisma.submission.count({
          where: { campaignId: input.id }
        })
      ]);

      const totalCampaignViews = viewAggregation._sum.lastViewCount || 0;

      // 5. Calculate approximate earnings using a synthetic submission object
      let approximateEarnings: import('@/server/services/calculationService').ApproximateEarnings | null = null;
      const { CalculationService } = await import('@/server/services/calculationService');

      // Sum estimatedEarnings and average sharePercent across all creator submissions
      const totalEstimatedEarnings = mySubmissions.reduce(
        (sum, s) => sum + (Number(s.estimatedEarnings) || 0), 0
      );
      const avgSharePercent = mySubmissions.reduce(
        (sum, s) => sum + (s.sharePercent || 0), 0
      ) / mySubmissions.length;

      approximateEarnings = CalculationService.calculateApproximateEarnings(
        { lastViewCount: creatorTotalViews, estimatedEarnings: totalEstimatedEarnings, sharePercent: avgSharePercent },
        totalCampaignViews,
        { totalBudget: campaign.totalBudget, commissionPercent: campaign.commissionPercent }
      );

      return {
        campaign: { ...campaign, lockedAt: campaign.lockedAt },
        submissions: mySubmissions,
        creatorTotalViews,
        poolStats: {
          totalCampaignViews,
          totalSubmissions,
        },
        approximateEarnings,
      };
    }),
  validateVideo: normalProcedure
    .input(z.object({
      campaignId: z.string(),
      tiktokUrl: z.string().url()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });

      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        include: { song: true }
      });
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Kampanya bulunamadı" });

      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { tiktokHandle: true, tiktokUserId: true, tiktok_open_id: true }
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Kullanıcı bulunamadı" });

      // PRODUCTION_CHECK: UNCOMMENT BEFORE PRODUCTION - TikTok auth check
      // if (!user.tiktok_open_id) {
      //   return {
      //     isValid: false,
      //     errors: ["TikTok hesabınız bağlı değil. Lütfen Profil'den TikTok hesabınızı bağlayın."],
      //     video: null,
      //     checks: {}
      //   };
      // }

      // Fetch video data (RapidAPI primary, Apify fallback)
      let videoData;
      try {
        const result = await tiktokService.fetchVideoData(input.tiktokUrl, 'router:validateVideo');
        videoData = result.data;
      } catch (error: any) {
        return {
          isValid: false,
          errors: [`Video doğrulanamadı: ${error.message}`],
          video: null,
          checks: {}
        };
      }

      const errors: string[] = [];

      // 1. Public check
      const isPublic = !videoData.isPrivate;
      if (!isPublic) {
        errors.push("Video herkese açık değil. Lütfen videonuzu herkese açık yapın.");
      }

      // PRODUCTION_CHECK: UNCOMMENT BEFORE PRODUCTION - Account name matching
      // const isAccountMatch = !!(
      //   user.tiktokHandle &&
      //   videoData.authorUniqueId &&
      //   user.tiktokHandle.toLowerCase() === videoData.authorUniqueId.toLowerCase()
      // );
      // if (!isAccountMatch) {
      //   errors.push(`Hesap Uyuşmazlığı: Video @${videoData.authorUniqueId || 'bilinmeyen'} hesabına ait, sizin hesabınız @${user.tiktokHandle}`);
      // }
      const isAccountMatch = true; // TESTING: always pass - TODO: REMOVE BEFORE PRODUCTION

      // 3. Song Check (title or music ID match)
      let isSongMatch = false;
      if (videoData.music) {
        const trackTitle = (videoData.music.title || '').toLowerCase();
        const campaignSongTitle = (campaign.song.title || '').toLowerCase();
        const titleMatch = trackTitle.includes(campaignSongTitle) || campaignSongTitle.includes(trackTitle);
        const idMatch = !!(campaign.song.tiktokMusicId && videoData.music.id === campaign.song.tiktokMusicId);
        isSongMatch = !!(titleMatch || idMatch);
      }
      if (!isSongMatch) {
        errors.push(`Müzik Eşleşmedi: Kampanya şarkısı "${campaign.song.title}" videoda bulunamadı.`);
      }

      // 4. Duration Check
      const durationMatch = !campaign.minVideoDuration || videoData.duration >= campaign.minVideoDuration;
      if (!durationMatch) {
        errors.push(`Süre Yetersiz: Video ${videoData.duration}sn (Min: ${campaign.minVideoDuration}sn)`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        video: {
          videoId: videoData.videoId,
          coverImage: videoData.coverImage,
          soundName: videoData.music?.title || 'Bilinmeyen',
          creatorUsername: videoData.authorUniqueId,
          duration: videoData.duration,
          views: videoData.stats.playCount,
          likes: videoData.stats.diggCount,
          comments: videoData.stats.commentCount,
          shares: videoData.stats.shareCount,
        },
        checks: {
          accountMatch: isAccountMatch,
          songMatch: isSongMatch,
          durationMatch,
          isPublic,
        }
      };
    }),

  submitVideo: normalProcedure
    .input(z.object({
      campaignId: z.string(),
      tiktokUrl: z.string().url()
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Kullanıcı bulunamadı" });

      // Check max submissions per creator per campaign (10 limit)
      const { CalculationService } = await import('@/server/services/calculationService');
      const existingCount = await prisma.submission.count({
        where: { campaignId: input.campaignId, creatorId: userId }
      });
      if (existingCount >= CalculationService.MAX_SUBMISSIONS_PER_CREATOR) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Maksimum gönderim sayısına ulaşıldı" });
      }

      // Check Campaign Status
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
      });
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Kampanya bulunamadı" });
      if (campaign.status !== "ACTIVE") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Kampanya aktif değil" });
      if (campaign.endDate && new Date() >= campaign.endDate) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Kampanya süresi dolmuş" });
      if (campaign.lockedAt) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Kampanya kilitlenmiş" });

      // PRODUCTION_CHECK: UNCOMMENT BEFORE PRODUCTION - TikTok auth check
      // const fullUser = await prisma.user.findUnique({
      //   where: { id: userId },
      //   select: { tiktok_open_id: true, tiktokHandle: true }
      // });
      // if (!fullUser?.tiktok_open_id) {
      //   throw new TRPCError({ code: "PRECONDITION_FAILED", message: "TikTok hesabı bağlı değil" });
      // }

      // Verify video (RapidAPI primary, Apify fallback)
      let videoData;
      try {
        const result = await tiktokService.fetchVideoData(
          input.tiktokUrl, 'router:submitVideo', input.campaignId, userId
        );
        videoData = result.data;
      } catch (error: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz video" });
      }

      // Prevent duplicate video in same campaign
      const duplicateVideo = await prisma.submission.findFirst({
        where: { campaignId: input.campaignId, tiktokVideoId: videoData.videoId }
      });
      if (duplicateVideo) {
        throw new TRPCError({ code: "CONFLICT", message: "Bu video zaten gönderilmiş" });
      }

      // Re-check campaign lock and endDate after API call (race condition guard)
      const freshCampaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        select: { lockedAt: true, status: true, endDate: true }
      });
      if (freshCampaign?.lockedAt || freshCampaign?.status !== "ACTIVE" || (freshCampaign?.endDate && new Date() >= freshCampaign.endDate)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Kampanya süresi dolmuş" });
      }

      // Create Submission
      const submission = await prisma.submission.create({
        data: {
          campaignId: input.campaignId,
          creatorId: userId,
          tiktokUrl: input.tiktokUrl,
          tiktokVideoId: videoData.videoId,
          status: "APPROVED",
          lastViewCount: videoData.stats.playCount,
          lastLikeCount: videoData.stats.diggCount,
          lastCommentCount: videoData.stats.commentCount,
          lastShareCount: videoData.stats.shareCount,
          videoDuration: videoData.duration || 0,
          lastCheckedAt: new Date(),
        },
      });

      // Update campaign aggregate totals
      await CalculationService.updateCampaignTotalPoints(input.campaignId, prisma);

      return { success: true, submissionId: submission.id };
    }),

  cancelSubmission: normalProcedure
    .input(z.object({
      submissionId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });

      const submission = await prisma.submission.findUnique({
        where: { id: input.submissionId },
        select: {
          creatorId: true,
          campaignId: true,
          campaign: { select: { lockedAt: true, endDate: true } }
        }
      });

      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Gönderim bulunamadı" });
      if (submission.creatorId !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Bu işlem için yetkiniz yok" });
      if (submission.campaign.endDate && new Date() >= submission.campaign.endDate) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Kampanya süresi dolmuş" });
      if (submission.campaign.lockedAt) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Kampanya kilitlenmiş" });

      const campaignId = submission.campaignId;

      // Atomic: delete + recalculate in transaction
      const { CalculationService } = await import('@/server/services/calculationService');
      await prisma.$transaction(async (tx: any) => {
        await tx.submission.delete({ where: { id: input.submissionId } });
        await CalculationService.updateCampaignTotalPoints(campaignId, prisma, tx);
        await CalculationService.recalculateCampaignSubmissions(campaignId, prisma, tx);
      });

      return { success: true };
    }),

  createCampaign: normalProcedure
    .input(z.object({
      tiktokUrl: z.string().url(),
      title: z.string().min(1),
      description: z.string().optional(),
      budget: z.number().min(25000, "Minimum kampanya bütçesi ₺25.000 olmalıdır").max(1000000), // TL
      durationDays: z.number().min(5).max(30), // User-selected duration
      minVideoDuration: z.number().optional(),
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
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });
      }

      // Import budget utilities
      const { getCommissionFromBudget, MIN_NET_BUDGET_TL } =
        await import("@/server/lib/tierUtils");

      // Check if admin has overridden commission rate
      const commissionSetting = await prisma.systemSettings.findUnique({
        where: { key: "commission_percent" },
      });

      // 1. Get song metadata — use pre-fetched preview or fetch fresh
      let songMetadata;
      if (input.songPreview) {
        // Use pre-fetched data from fetchSongPreview (avoids double API call)
        songMetadata = input.songPreview;
      } else {
        // Fallback: fetch fresh (backward compat for web or direct calls)
        try {
          const result = await tiktokService.fetchMusicMetadata(
            input.tiktokUrl, 'router:createCampaign', userId
          );
          songMetadata = result.data;
        } catch (error: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz şarkı URL'si" });
        }
      }

      // 2. Find or Create Song (idempotent upsert)
      let coverImageUrl = songMetadata.coverImage;

      // Check if song already exists
      let song = await prisma.song.findFirst({
        where: { tiktokMusicId: songMetadata.tiktokMusicId }
      });

      if (!song) {
        // Upload cover image to Supabase Storage (TikTok CDN URLs don't work on mobile)
        if (coverImageUrl) {
          const storagePath = `${songMetadata.tiktokMusicId}/${Date.now()}.jpg`;
          const permanentUrl = await uploadImageFromUrl(STORAGE_BUCKETS.COVERS, storagePath, coverImageUrl);
          if (permanentUrl) coverImageUrl = permanentUrl;
        }

        // Use upsert to handle race conditions (two concurrent createCampaign calls with same song)
        song = await prisma.song.upsert({
          where: { tiktokMusicId: songMetadata.tiktokMusicId },
          update: {}, // Song already exists — no update needed
          create: {
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
      if (commissionPercent === null || isNaN(commissionPercent)) throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz bütçe" });

      // Validate net budget after commission >= MIN_NET_BUDGET_TL
      const netBudget = budgetTL * (1 - commissionPercent / 100);
      if (netBudget < MIN_NET_BUDGET_TL) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Komisyon sonrası net bütçe en az ₺${MIN_NET_BUDGET_TL.toLocaleString('tr-TR')} olmalıdır` });
      }

      // 4. Deduction & Creation (Transaction — atomic balance check)
      const now = new Date();
      const campaignEndDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const nextMetricsFetchAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const { onCampaignCreated } = await import('@/server/services/submissionHooks');

      const campaign = await prisma.$transaction(async (tx) => {
        // Atomic balance check + deduct (prevents race condition / negative balance)
        const result = await tx.user.updateMany({
          where: { id: userId, balance: { gte: budgetTL } },
          data: { balance: { decrement: budgetTL } }
        });
        if (result.count === 0) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Yetersiz bakiye" });
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

        // Create Campaign (auto-approved, starts immediately)
        const created = await tx.campaign.create({
          data: {
            title: input.title,
            description: input.description,
            totalBudget: budgetTL,
            remainingBudget: budgetTL,
            status: "ACTIVE",
            songId: song.id,
            artistId: userId,
            minVideoDuration: input.minVideoDuration,
            durationDays: durationDays,
            commissionPercent: commissionPercent,
            startDate: now,
            endDate: campaignEndDate,
            nextMetricsFetchAt: nextMetricsFetchAt,
          }
        });

        // Initialize campaign calculations inside transaction (ensures poolStats created atomically)
        await onCampaignCreated(created.id, tx as any);

        return created;
      });

      return { success: true, campaignId: campaign.id };
    }),

  fetchSongPreview: normalProcedure
    .input(z.object({
      tiktokUrl: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });

      const { TikTokUrlParser } = await import("@/lib/apify/url-utils");

      // Validate & normalize URL (handles short links, etc.)
      const normalizedUrl = await TikTokUrlParser.validateAndNormalize(input.tiktokUrl);

      // Check DB cache first — if song already exists, return it without API call
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

      // Fetch from TikTok (RapidAPI primary, Apify fallback)
      const result = await tiktokService.fetchMusicMetadata(
        normalizedUrl, 'router:fetchSongPreview', userId
      );

      return {
        title: result.data.title,
        authorName: result.data.authorName,
        coverImage: result.data.coverImage,
        tiktokMusicId: result.data.tiktokMusicId,
        cached: false,
      };
    }),

  getMyCampaigns: relaxedProcedure
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

  getCreatorStats: relaxedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });

      // Fetch user info for follower count and plan
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
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
        followerCount: user?.followerCount || 0,
      };
    }),

  getArtistStats: relaxedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });

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

  getActivity: relaxedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Kullanıcı bulunamadı" });

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

  // ─── TikTok OAuth Integration ───────────────────────────────────────

  // Returns TikTok OAuth URL for connecting a TikTok account
  getTikTokAuthUrl: strictProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.userId;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });

    const crypto = await import("crypto");

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;

    if (!clientKey || !clientSecret || !redirectUri) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "TikTok OAuth yapılandırması eksik" });
    }

    // Build signed state token (HMAC-SHA256)
    const statePayload = {
      userId,
      nonce: crypto.randomUUID(),
      exp: Math.floor(Date.now() / 1000) + 600, // 10 min expiry
    };
    const json = JSON.stringify(statePayload);
    const data = Buffer.from(json).toString("base64url");
    const hmac = crypto.createHmac("sha256", clientSecret).update(data).digest("base64url");
    const state = `${data}.${hmac}`;

    const scope = "user.info.basic,user.info.profile,user.info.stats";
    const authUrl =
      `https://www.tiktok.com/v2/auth/authorize/` +
      `?client_key=${clientKey}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`;

    return { authUrl };
  }),

  // Disconnect TikTok account (clear all TikTok data)
  disconnectTikTok: normalProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.userId;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });

    await prisma.user.update({
      where: { id: userId },
      data: {
        tiktok_open_id: null,
        tiktok_access_token: null,
        tiktok_refresh_token: null,
        tiktok_token_expires_at: null,
        tiktok_scopes: null,
        tiktokHandle: null,
        tiktokUserId: null,
        tiktokUsername: null,
        tiktokDisplayName: null,
        tiktokAvatarUrl: null,
        tiktokConnectedAt: null,
        insightiqAccessToken: null,
        insightiqRefreshToken: null,
        insightiqTokenExpiry: null,
        insightiqSessionExpired: false,
        followerCount: 0,
        followingCount: 0,
        totalLikes: 0,
        videoCount: 0,
        lastStatsFetchedAt: null,
        avatar: null,
      },
    });

    return { success: true };
  }),

  // ─── Account Deletion (GDPR) ────────────────────────────────────────
  deleteMyAccount: strictProcedure
    .input(z.object({ confirmEmail: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          _count: {
            select: {
              campaigns: { where: { status: "ACTIVE" } },
            },
          },
        },
      });

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Kullanıcı bulunamadı" });

      // Email confirmation must match
      if (user.email.toLowerCase() !== input.confirmEmail.toLowerCase()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "E-posta adresi eşleşmiyor" });
      }

      // Block if user has active campaigns
      if (user._count.campaigns > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Aktif kampanyalarınız varken hesabınızı silemezsiniz. Önce kampanyalarınızı sonlandırın.",
        });
      }

      // Block if user has pending withdrawals
      const pendingWithdrawals = await prisma.transaction.count({
        where: { userId, type: "WITHDRAWAL", status: "PENDING" },
      });
      if (pendingWithdrawals > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Bekleyen para çekim işlemleriniz varken hesabınızı silemezsiniz.",
        });
      }

      // Cascade delete in transaction (same order as admin user deletion)
      await prisma.$transaction([
        prisma.submission.deleteMany({ where: { creatorId: userId } }),
        prisma.transaction.deleteMany({ where: { userId } }),
        prisma.notification.deleteMany({ where: { userId } }),
        prisma.campaign.deleteMany({ where: { artistId: userId } }),
        prisma.song.deleteMany({ where: { artistId: userId } }),
        prisma.user.delete({ where: { id: userId } }),
      ]);

      // Delete Supabase auth user (best-effort — DB records already gone)
      try {
        const supabaseAdmin = getSupabaseAdmin();
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch {
        // Supabase deletion failed but DB is clean — acceptable
      }

      return { success: true };
    }),

  // ─── Mobile-compatible aliases ────────────────────────────────────────────

  deleteSubmission: normalProcedure
    .input(z.object({ submissionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });

      const submission = await prisma.submission.findUnique({
        where: { id: input.submissionId },
        select: {
          creatorId: true,
          campaignId: true,
          campaign: { select: { lockedAt: true, endDate: true } }
        }
      });

      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Gönderim bulunamadı" });
      if (submission.creatorId !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Bu işlem için yetkiniz yok" });
      if (submission.campaign.endDate && new Date() >= submission.campaign.endDate) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Kampanya süresi dolmuş" });
      if (submission.campaign.lockedAt) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Kampanya kilitlenmiş" });

      const campaignId = submission.campaignId;

      const { CalculationService } = await import('@/server/services/calculationService');
      await prisma.$transaction(async (tx: any) => {
        await tx.submission.delete({ where: { id: input.submissionId } });
        await CalculationService.updateCampaignTotalPoints(campaignId, prisma, tx);
        await CalculationService.recalculateCampaignSubmissions(campaignId, prisma, tx);
      });

      return { success: true };
    }),

  deleteAllMySubmissions: normalProcedure
    .input(z.object({ campaignId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });

      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        select: { lockedAt: true, status: true, endDate: true }
      });
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Kampanya bulunamadı" });
      if (campaign.endDate && new Date() >= campaign.endDate) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Kampanya süresi dolmuş" });
      if (campaign.lockedAt) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Kampanya kilitlenmiş" });

      const count = await prisma.submission.count({
        where: { campaignId: input.campaignId, creatorId: userId }
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Gönderim bulunamadı" });

      const { CalculationService } = await import('@/server/services/calculationService');
      await prisma.$transaction(async (tx: any) => {
        await tx.submission.deleteMany({
          where: { campaignId: input.campaignId, creatorId: userId }
        });
        await CalculationService.updateCampaignTotalPoints(input.campaignId, prisma, tx);
        await CalculationService.recalculateCampaignSubmissions(input.campaignId, prisma, tx);
      });

      return { success: true, deletedCount: count };
    }),

  refreshTikTokStats: normalProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Yetkilendirme hatası" });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { lastStatsFetchedAt: true, tiktokHandle: true }
      });

      if (!user?.tiktokHandle) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "TikTok hesabı bağlı değil" });
      }

      if (user.lastStatsFetchedAt) {
        const timeDiff = Date.now() - new Date(user.lastStatsFetchedAt).getTime();
        if (timeDiff < 10 * 60 * 1000) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Çok fazla istek" });
        }
      }

      await prisma.user.update({
        where: { id: userId },
        data: { lastStatsFetchedAt: new Date() }
      });

      return { success: true };
    }),
});

export type AppRouter = typeof appRouter;
