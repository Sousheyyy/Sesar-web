-- InsightIQ Integration Migration
-- Add InsightIQ OAuth fields and music metadata to existing tables

-- Add InsightIQ OAuth fields to User table
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "insightiqAccessToken" TEXT,
ADD COLUMN IF NOT EXISTS "insightiqRefreshToken" TEXT,
ADD COLUMN IF NOT EXISTS "insightiqTokenExpiry" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "tiktokUserId" TEXT,
ADD COLUMN IF NOT EXISTS "tiktokUsername" TEXT,
ADD COLUMN IF NOT EXISTS "tiktokDisplayName" TEXT,
ADD COLUMN IF NOT EXISTS "tiktokAvatarUrl" TEXT,
ADD COLUMN IF NOT EXISTS "tiktokConnectedAt" TIMESTAMP(3);

-- Add unique constraint for tiktokUserId
CREATE UNIQUE INDEX IF NOT EXISTS "User_tiktokUserId_key" ON "User"("tiktokUserId");

-- Add music metadata fields to Song table
ALTER TABLE "Song"
ADD COLUMN IF NOT EXISTS "musicCoverUrl" TEXT,
ADD COLUMN IF NOT EXISTS "musicUrl" TEXT;

-- Make tiktokMusicId unique in Song table (if not already)
DROP INDEX IF EXISTS "Song_tiktokMusicId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "Song_tiktokMusicId_key" ON "Song"("tiktokMusicId");
