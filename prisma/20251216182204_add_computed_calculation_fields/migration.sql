-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "MarketplaceToolType" AS ENUM ('PROFILE', 'HASHTAG', 'VALUATION', 'AUDIT', 'COMPARE');

-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "maxSubmissions" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "netBudgetTP" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "netMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalCampaignPoints" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "likePoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sharePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sharePoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "viewPoints" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "couponBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cycleStartDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "plan" "UserPlan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "subscriptionEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CampaignPoolStats" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "totalCampaignPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSubmissions" INTEGER NOT NULL DEFAULT 0,
    "averagePoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignPoolStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolType" "MarketplaceToolType" NOT NULL,
    "input" TEXT NOT NULL,
    "resultSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignPoolStats_campaignId_key" ON "CampaignPoolStats"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignPoolStats_campaignId_idx" ON "CampaignPoolStats"("campaignId");

-- CreateIndex
CREATE INDEX "MarketplaceUsage_userId_idx" ON "MarketplaceUsage"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceUsage_toolType_idx" ON "MarketplaceUsage"("toolType");

-- CreateIndex
CREATE INDEX "Campaign_status_endDate_idx" ON "Campaign"("status", "endDate");

-- CreateIndex
CREATE INDEX "Submission_campaignId_status_idx" ON "Submission"("campaignId", "status");

-- AddForeignKey
ALTER TABLE "CampaignPoolStats" ADD CONSTRAINT "CampaignPoolStats_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceUsage" ADD CONSTRAINT "MarketplaceUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
