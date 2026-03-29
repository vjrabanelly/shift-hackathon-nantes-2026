-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "hashtags" TEXT NOT NULL DEFAULT '[]',
    "imageDesc" TEXT NOT NULL DEFAULT '',
    "imageUrls" TEXT NOT NULL DEFAULT '[]',
    "mediaType" TEXT NOT NULL DEFAULT 'photo',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" TEXT NOT NULL DEFAULT '',
    "saveCount" TEXT NOT NULL DEFAULT '',
    "dateLabel" TEXT NOT NULL DEFAULT '',
    "isSponsored" BOOLEAN NOT NULL DEFAULT false,
    "isSuggested" BOOLEAN NOT NULL DEFAULT false,
    "audioTrack" TEXT NOT NULL DEFAULT '',
    "mentioned" TEXT NOT NULL DEFAULT '[]',
    "allText" TEXT NOT NULL DEFAULT '',
    "ocrText" TEXT NOT NULL DEFAULT '',
    "subtitles" TEXT NOT NULL DEFAULT '',
    "videoUrl" TEXT NOT NULL DEFAULT '',
    "dwellTimeMs" INTEGER NOT NULL DEFAULT 0,
    "attentionLevel" TEXT NOT NULL DEFAULT 'skipped',
    "category" TEXT NOT NULL DEFAULT 'non classifié',
    "firstSeenAt" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" INTEGER NOT NULL DEFAULT 0,
    "seenCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Post_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("allText", "attentionLevel", "audioTrack", "caption", "category", "commentCount", "createdAt", "dateLabel", "displayName", "dwellTimeMs", "firstSeenAt", "hashtags", "id", "imageDesc", "imageUrls", "isSponsored", "isSuggested", "lastSeenAt", "likeCount", "mediaType", "mentioned", "saveCount", "seenCount", "sessionId", "shareCount", "username") SELECT "allText", "attentionLevel", "audioTrack", "caption", "category", "commentCount", "createdAt", "dateLabel", "displayName", "dwellTimeMs", "firstSeenAt", "hashtags", "id", "imageDesc", "imageUrls", "isSponsored", "isSuggested", "lastSeenAt", "likeCount", "mediaType", "mentioned", "saveCount", "seenCount", "sessionId", "shareCount", "username" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE INDEX "Post_sessionId_idx" ON "Post"("sessionId");
CREATE INDEX "Post_username_idx" ON "Post"("username");
CREATE INDEX "Post_category_idx" ON "Post"("category");
CREATE INDEX "Post_attentionLevel_idx" ON "Post"("attentionLevel");
CREATE INDEX "Post_isSponsored_idx" ON "Post"("isSponsored");
CREATE INDEX "Post_isSuggested_idx" ON "Post"("isSuggested");
CREATE TABLE "new_PostEnriched" (
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
    "axisEconomic" REAL NOT NULL DEFAULT 0,
    "axisSocietal" REAL NOT NULL DEFAULT 0,
    "axisAuthority" REAL NOT NULL DEFAULT 0,
    "axisSystem" REAL NOT NULL DEFAULT 0,
    "dominantAxis" TEXT NOT NULL DEFAULT '',
    "mediaCategory" TEXT NOT NULL DEFAULT '',
    "mediaQuality" TEXT NOT NULL DEFAULT '',
    "narrativeFrame" TEXT NOT NULL DEFAULT '',
    "callToActionType" TEXT NOT NULL DEFAULT 'aucun',
    "problemSolutionPattern" TEXT NOT NULL DEFAULT '',
    "confidenceScore" REAL NOT NULL DEFAULT 0,
    "reviewFlag" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT NOT NULL DEFAULT '',
    "audioTranscription" TEXT NOT NULL DEFAULT '',
    "mediaMessage" TEXT NOT NULL DEFAULT '',
    "mediaIntent" TEXT NOT NULL DEFAULT '',
    "embedding" BLOB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PostEnriched_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PostEnriched" ("activismSignal", "audienceTarget", "axisAuthority", "axisEconomic", "axisSocietal", "axisSystem", "callToActionType", "confidenceScore", "conflictSignal", "contentDomain", "countries", "createdAt", "dominantAxis", "embedding", "emotionIntensity", "enemyDesignationSignal", "id", "ingroupOutgroupSignal", "institutionalReferenceScore", "institutions", "keywordTerms", "locations", "mainTopics", "mediaCategory", "mediaQuality", "model", "moralAbsoluteSignal", "narrativeFrame", "normalizedText", "organizations", "persons", "polarizationScore", "politicalActors", "politicalExplicitnessScore", "politicalIssueTags", "postId", "primaryEmotion", "problemSolutionPattern", "provider", "publicPolicyTags", "reviewFlag", "reviewReason", "secondaryTopics", "semanticSummary", "tone", "updatedAt", "version") SELECT "activismSignal", "audienceTarget", "axisAuthority", "axisEconomic", "axisSocietal", "axisSystem", "callToActionType", "confidenceScore", "conflictSignal", "contentDomain", "countries", "createdAt", "dominantAxis", "embedding", "emotionIntensity", "enemyDesignationSignal", "id", "ingroupOutgroupSignal", "institutionalReferenceScore", "institutions", "keywordTerms", "locations", "mainTopics", "mediaCategory", "mediaQuality", "model", "moralAbsoluteSignal", "narrativeFrame", "normalizedText", "organizations", "persons", "polarizationScore", "politicalActors", "politicalExplicitnessScore", "politicalIssueTags", "postId", "primaryEmotion", "problemSolutionPattern", "provider", "publicPolicyTags", "reviewFlag", "reviewReason", "secondaryTopics", "semanticSummary", "tone", "updatedAt", "version" FROM "PostEnriched";
DROP TABLE "PostEnriched";
ALTER TABLE "new_PostEnriched" RENAME TO "PostEnriched";
CREATE UNIQUE INDEX "PostEnriched_postId_key" ON "PostEnriched"("postId");
CREATE INDEX "PostEnriched_postId_idx" ON "PostEnriched"("postId");
CREATE INDEX "PostEnriched_provider_idx" ON "PostEnriched"("provider");
CREATE INDEX "PostEnriched_politicalExplicitnessScore_idx" ON "PostEnriched"("politicalExplicitnessScore");
CREATE INDEX "PostEnriched_polarizationScore_idx" ON "PostEnriched"("polarizationScore");
CREATE INDEX "PostEnriched_narrativeFrame_idx" ON "PostEnriched"("narrativeFrame");
CREATE INDEX "PostEnriched_confidenceScore_idx" ON "PostEnriched"("confidenceScore");
CREATE INDEX "PostEnriched_reviewFlag_idx" ON "PostEnriched"("reviewFlag");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
