import { PrismaClient, UserRole, UserPlan } from "@prisma/client";
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













