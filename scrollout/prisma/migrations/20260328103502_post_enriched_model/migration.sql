/*
  Warnings:

  - You are about to drop the `PostSemantic` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PostSemantic";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "PostEnriched" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1',
    "normalizedText" TEXT NOT NULL DEFAULT '',
    "semanticSummary" TEXT NOT NULL DEFAULT '',
    "keywordTerms" TEXT NOT NULL DEFAULT '[]',
    "mainTopics" TEXT NOT NULL DEFAULT '[]',
    "secondaryTopics" TEXT NOT NULL DEFAULT '[]',
    "contentDomain" TEXT NOT NULL DEFAULT '',
    "audienceTarget" TEXT NOT NULL DEFAULT '',
    "persons" TEXT NOT NULL DEFAULT '[]',
    "organizations" TEXT NOT NULL DEFAULT '[]',
    "institutions" TEXT NOT NULL DEFAULT '[]',
    "countries" TEXT NOT NULL DEFAULT '[]',
    "locations" TEXT NOT NULL DEFAULT '[]',
    "politicalActors" TEXT NOT NULL DEFAULT '[]',
    "tone" TEXT NOT NULL DEFAULT 'neutral',
    "primaryEmotion" TEXT NOT NULL DEFAULT '',
    "emotionIntensity" REAL NOT NULL DEFAULT 0,
    "politicalExplicitnessScore" INTEGER NOT NULL DEFAULT 0,
    "politicalIssueTags" TEXT NOT NULL DEFAULT '[]',
    "publicPolicyTags" TEXT NOT NULL DEFAULT '[]',
    "institutionalReferenceScore" REAL NOT NULL DEFAULT 0,
    "activismSignal" BOOLEAN NOT NULL DEFAULT false,
    "polarizationScore" REAL NOT NULL DEFAULT 0,
    "ingroupOutgroupSignal" BOOLEAN NOT NULL DEFAULT false,
    "conflictSignal" BOOLEAN NOT NULL DEFAULT false,
    "moralAbsoluteSignal" BOOLEAN NOT NULL DEFAULT false,
    "enemyDesignationSignal" BOOLEAN NOT NULL DEFAULT false,
    "narrativeFrame" TEXT NOT NULL DEFAULT '',
    "callToActionType" TEXT NOT NULL DEFAULT 'aucun',
    "problemSolutionPattern" TEXT NOT NULL DEFAULT '',
    "confidenceScore" REAL NOT NULL DEFAULT 0,
    "reviewFlag" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT NOT NULL DEFAULT '',
    "embedding" BLOB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PostEnriched_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PostEnriched_postId_key" ON "PostEnriched"("postId");

-- CreateIndex
CREATE INDEX "PostEnriched_postId_idx" ON "PostEnriched"("postId");

-- CreateIndex
CREATE INDEX "PostEnriched_provider_idx" ON "PostEnriched"("provider");

-- CreateIndex
CREATE INDEX "PostEnriched_politicalExplicitnessScore_idx" ON "PostEnriched"("politicalExplicitnessScore");

-- CreateIndex
CREATE INDEX "PostEnriched_polarizationScore_idx" ON "PostEnriched"("polarizationScore");

-- CreateIndex
CREATE INDEX "PostEnriched_narrativeFrame_idx" ON "PostEnriched"("narrativeFrame");

-- CreateIndex
CREATE INDEX "PostEnriched_confidenceScore_idx" ON "PostEnriched"("confidenceScore");

-- CreateIndex
CREATE INDEX "PostEnriched_reviewFlag_idx" ON "PostEnriched"("reviewFlag");
