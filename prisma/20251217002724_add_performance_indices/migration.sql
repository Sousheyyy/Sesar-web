-- CreateIndex
CREATE INDEX "Campaign_artistId_createdAt_idx" ON "Campaign"("artistId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Campaign_title_idx" ON "Campaign"("title");

-- CreateIndex
CREATE INDEX "Song_title_idx" ON "Song"("title");

-- CreateIndex
CREATE INDEX "Song_authorName_idx" ON "Song"("authorName");

-- CreateIndex
CREATE INDEX "Submission_campaignId_creatorId_idx" ON "Submission"("campaignId", "creatorId");

-- CreateIndex
CREATE INDEX "Submission_creatorId_createdAt_idx" ON "Submission"("creatorId", "createdAt" DESC);
