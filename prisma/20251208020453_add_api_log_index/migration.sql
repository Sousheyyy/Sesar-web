/*
  Warnings:

  - You are about to drop the column `costPer1kViews` on the `Campaign` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "costPer1kViews";

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "contributionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "estimatedEarnings" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ApiCallLog" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER,
    "userId" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiCallLog_endpoint_idx" ON "ApiCallLog"("endpoint");

-- CreateIndex
CREATE INDEX "ApiCallLog_userId_idx" ON "ApiCallLog"("userId");

-- CreateIndex
CREATE INDEX "ApiCallLog_createdAt_idx" ON "ApiCallLog"("createdAt");

-- CreateIndex
CREATE INDEX "ApiCallLog_method_idx" ON "ApiCallLog"("method");
