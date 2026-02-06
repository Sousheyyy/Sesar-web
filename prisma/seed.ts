import { PrismaClient, UserRole, UserPlan } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

// Initialize Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createSupabaseUser(email: string, password: string, name: string) {
  // 1. Check if user exists in Supabase Auth (by email) to avoid errors
  // specialized admin listUsers approach or just try create and catch error
  // safer to try create or getting by email if possible. 
  // admin.listUsers is strictly rate limited?
  // We'll try to delete first to ensure fresh start if we want, OR just create and ignore "already exists" if we want to update.
  // But we want to sync the ID. So we need the ID.

  // Best way for seeding: Delete if exists, then create.
  // Note: deleting from Supabase Auth might NOT cascade to Prisma if not configured, but our script clears Prisma first.

  // Find user by email first to get ID if exists
  const listUsersResponse = await supabase.auth.admin.listUsers();
  const users = listUsersResponse.data?.users || [];
  const existingUser = users.find((u: any) => u.email === email);

  if (existingUser) {
    console.log(`   ⚠️ User ${email} already exists in Supabase Auth. Deleting to recreate...`);
    await supabase.auth.admin.deleteUser(existingUser.id);
  }

  const { data: { user }, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error || !user) {
    throw new Error(`Failed to create Supabase user ${email}: ${error?.message}`);
  }

  return user.id; // UUID
}

async function main() {
  console.log("🌱 Starting database reset and seed (Synced with Supabase Auth)...");

  // 1. Clear Database
  console.log("🧹 Clearing all Prisma data...");

  // Delete in order to handle any non-cascading relations gracefully
  await prisma.submission.deleteMany();
  await prisma.campaignPoolStats.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.song.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.marketplaceUsage.deleteMany();
  await prisma.musicCache.deleteMany();
  await prisma.apiCallLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemSettings.deleteMany();

  console.log("✅ Prisma database cleared");

  // 2. Create Passwords (for Prisma local hash compatibility, though Auth handles login)
  const adminPassword = await hash("admin123", 10);
  const commonPassword = await hash("user123", 10);

  // 3. Create Admin User
  console.log("👤 Creating Admin...");
  const adminId = await createSupabaseUser("admin@tikpay.com", "admin123", "Admin User");

  await prisma.user.create({
    data: {
      id: adminId, // LINK WITH SUPABASE AUTH
      email: "admin@tikpay.com",
      password: adminPassword,
      name: "Admin User",
      role: UserRole.ADMIN,
      balance: 0,
      bio: "System Administrator",
    },
  });
  console.log(`   -> Created Admin: admin@tikpay.com (ID: ${adminId})`);

  // 4. Create Creators
  console.log("👤 Creating Creators...");
  for (let i = 2; i <= 3; i++) {
    const email = `creator${i}@tikpay.com`;
    const userId = await createSupabaseUser(email, "user123", `Creator ${i}`);

    await prisma.user.create({
      data: {
        id: userId, // LINK WITH SUPABASE AUTH
        email: email,
        password: commonPassword,
        name: `Creator ${i}`,
        role: UserRole.CREATOR,
        balance: 0,
        bio: `Test Creator account ${i}`,
        // No TikTok connected
      },
    });
    console.log(`   -> Created Creator: ${email}`);
  }

  // 5. Create Artists
  console.log("👤 Creating Artists...");
  for (let i = 1; i <= 3; i++) {
    const email = `artist${i}@tikpay.com`;
    const userId = await createSupabaseUser(email, "user123", `Artist ${i}`);

    await prisma.user.create({
      data: {
        id: userId, // LINK WITH SUPABASE AUTH
        email: email,
        password: commonPassword,
        name: `Artist ${i}`,
        role: UserRole.ARTIST,
        balance: 0,
        plan: UserPlan.ARTIST,
        bio: `Test Artist account ${i}`,
        // No TikTok connected
      },
    });
    console.log(`   -> Created Artist: ${email}`);
  }

  // 6. Create Default System Settings
  console.log("⚙️  Creating System Settings...");
  const settings = [
    { key: "min_campaign_budget", value: "50", description: "Minimum budget required to create a campaign (in USD)" },
    { key: "min_withdrawal_amount", value: "50", description: "Minimum amount required to request withdrawal (in USD)" },
    { key: "min_cpm", value: "5", description: "Minimum cost per 1000 views (in USD)" },
    { key: "max_cpm", value: "100", description: "Maximum cost per 1000 views (in USD)" },
    { key: "platform_fee_percentage", value: "10", description: "Platform fee percentage on transactions" },
  ];

  for (const setting of settings) {
    await prisma.systemSettings.create({ data: setting });
  }
  console.log("✅ System settings created");

  console.log("🎉 Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
