import { PrismaClient, UserRole, UserPlan, CampaignStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create Admin User
  const adminPassword = await hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@tikpay.com" },
    update: {},
    create: {
      email: "admin@tikpay.com",
      password: adminPassword,
      name: "Admin User",
      role: UserRole.ADMIN,
      balance: 0,
    },
  });
  console.log("✅ Created admin user:", admin.email);

  // Create Test Artist
  const artistPassword = await hash("artist123", 10);
  const artist = await prisma.user.upsert({
    where: { email: "artist@tikpay.com" },
    update: {},
    create: {
      email: "artist@tikpay.com",
      password: artistPassword,
      name: "Test Artist",
      role: UserRole.ARTIST,
      balance: 10000,
      plan: UserPlan.ARTIST, // Artist subscription status
      bio: "I'm a music artist looking to promote my songs",
      tiktokHandle: "@testartist",
    },
  });
  console.log("✅ Created artist user:", artist.email);

  // Create Test Creator
  const creatorPassword = await hash("creator123", 10);
  const creator = await prisma.user.upsert({
    where: { email: "creator@tikpay.com" },
    update: {},
    create: {
      email: "creator@tikpay.com",
      password: creatorPassword,
      name: "Test Creator",
      role: UserRole.CREATOR,
      balance: 0,
      bio: "TikTok content creator",
      tiktokHandle: "@testcreator",
    },
  });
  console.log("✅ Created creator user:", creator.email);

  // Create System Settings
  const settings = [
    {
      key: "min_campaign_budget",
      value: "50",
      description: "Minimum budget required to create a campaign (in USD)",
    },
    {
      key: "min_withdrawal_amount",
      value: "50",
      description: "Minimum amount required to request withdrawal (in USD)",
    },
    {
      key: "min_cpm",
      value: "5",
      description: "Minimum cost per 1000 views (in USD)",
    },
    {
      key: "max_cpm",
      value: "100",
      description: "Maximum cost per 1000 views (in USD)",
    },
    {
      key: "platform_fee_percentage",
      value: "10",
      description: "Platform fee percentage on transactions",
    },
  ];

  for (const setting of settings) {
    await prisma.systemSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log("✅ Created system settings");

  // Create artist@sesar.com account with mock campaigns
  const sesarArtistPassword = await hash("artist123", 10);
  const sesarArtist = await prisma.user.upsert({
    where: { email: "artist@sesar.com" },
    update: {},
    create: {
      email: "artist@sesar.com",
      password: sesarArtistPassword,
      name: "Sesar Artist",
      role: UserRole.ARTIST,
      balance: 50000,
      plan: UserPlan.ARTIST,
      bio: "Professional music artist creating viral Turkish hits",
      tiktokHandle: "@sesarartist",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sesarartist",
    },
  });
  console.log("✅ Created/Updated artist@sesar.com");

  // Create mock songs for artist@sesar.com
  const songs = [
    {
      title: "Yalnızlık Paylaşılmaz",
      duration: 195,
      authorName: "Sesar Artist",
      description: "Romantik bir şarkı",
      tiktokUrl: "https://www.tiktok.com/music/yalnizlik-paylalimaz-7234567890",
      coverImage: "https://picsum.photos/seed/song1/400/400",
    },
    {
      title: "Gece Mavisi",
      duration: 210,
      authorName: "Sesar Artist",
      description: "Duygusal bir melodi",
      tiktokUrl: "https://www.tiktok.com/music/gece-mavisi-7234567891",
      coverImage: "https://picsum.photos/seed/song2/400/400",
    },
    {
      title: "Rüya Gibi",
      duration: 178,
      authorName: "Sesar Artist",
      description: "Dans edilebilir hit şarkı",
      tiktokUrl: "https://www.tiktok.com/music/ruya-gibi-7234567892",
      coverImage: "https://picsum.photos/seed/song3/400/400",
    },
    {
      title: "Aşkın Halleri",
      duration: 203,
      authorName: "Sesar Artist",
      description: "Pop tarzı aşk şarkısı",
      tiktokUrl: "https://www.tiktok.com/music/askin-halleri-7234567893",
      coverImage: "https://picsum.photos/seed/song4/400/400",
    },
  ];

  const createdSongs: any[] = [];

  for (const songData of songs) {
    // Check if song already exists
    let song = await prisma.song.findFirst({
      where: {
        artistId: sesarArtist.id,
        title: songData.title,
      },
    });

    if (!song) {
      song = await prisma.song.create({
        data: {
          ...songData,
          artistId: sesarArtist.id,
        },
      });
    }
    createdSongs.push(song);
  }
  console.log(`✅ Created ${createdSongs.length} songs for artist@sesar.com`);

  // Create mock campaigns
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
  const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

  const campaigns = [
    {
      songId: createdSongs[0].id,
      title: "Viral TikTok Challenge",
      description: "Şarkımla dans videosu çek ve kazanmaya başla! #YalnızlıkPaylaşılmaz challenge'ına katıl.",
      totalBudget: 25000,
      remainingBudget: 18500,
      status: CampaignStatus.ACTIVE,
      startDate: fifteenDaysAgo,
      endDate: thirtyDaysFromNow,
      minFollowers: 1000,
      minVideoDuration: 15,
      platformFeePercent: 20,
      safetyReservePercent: 5,
    },
    {
      songId: createdSongs[1].id,
      title: "Gece Temalı Videolar",
      description: "Gece çekimleriyle özel videolar oluştur. Atmosferik ve duygusal içerikler arıyoruz.",
      totalBudget: 35000,
      remainingBudget: 32000,
      status: CampaignStatus.ACTIVE,
      startDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),
      minFollowers: 500,
      minVideoDuration: 20,
      platformFeePercent: 20,
      safetyReservePercent: 5,
    },
    {
      songId: createdSongs[2].id,
      title: "Dans ve Koreografi",
      description: "Rüya Gibi şarkısına özgün dans koreografisi oluştur. En yaratıcı danslar ödüllendirilecek!",
      totalBudget: 18000,
      remainingBudget: 5200,
      status: CampaignStatus.COMPLETED,
      startDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      completedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      minFollowers: 0,
      minVideoDuration: 15,
      platformFeePercent: 20,
      safetyReservePercent: 5,
    },
    {
      songId: createdSongs[3].id,
      title: "Aşk Hikayeleri",
      description: "Sevgilinle veya arkadaşınla çek! Aşkın farklı hallerini göster.",
      totalBudget: 15000,
      remainingBudget: 15000,
      status: CampaignStatus.PENDING_APPROVAL,
      startDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 32 * 24 * 60 * 60 * 1000),
      minFollowers: 2000,
      minVideoDuration: 20,
      platformFeePercent: 20,
      safetyReservePercent: 5,
    },
  ];

  for (const campaignData of campaigns) {
    // Check if campaign already exists
    const existingCampaign = await prisma.campaign.findFirst({
      where: {
        artistId: sesarArtist.id,
        songId: campaignData.songId,
        title: campaignData.title,
      },
    });

    if (!existingCampaign) {
      await prisma.campaign.create({
        data: {
          ...campaignData,
          artistId: sesarArtist.id,
        },
      });
    }
  }
  console.log(`✅ Created ${campaigns.length} campaigns for artist@sesar.com`);

  console.log("🎉 Seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });













