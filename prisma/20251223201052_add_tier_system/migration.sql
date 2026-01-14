/*
  Warnings:

  - Made the column `minFollowers` on table `Campaign` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('D', 'C', 'B', 'A', 'S');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "tier" "Tier" NOT NULL DEFAULT 'C',
ALTER COLUMN "minFollowers" SET NOT NULL,
ALTER COLUMN "minFollowers" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "creatorTier" "Tier",
ADD COLUMN     "followerCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Campaign_tier_idx" ON "Campaign"("tier");

-- CreateIndex
CREATE INDEX "User_creatorTier_idx" ON "User"("creatorTier");
