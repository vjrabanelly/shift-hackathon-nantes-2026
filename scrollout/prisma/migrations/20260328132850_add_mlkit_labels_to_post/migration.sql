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
    "mlkitLabels" TEXT NOT NULL DEFAULT '[]',
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
INSERT INTO "new_Post" ("allText", "attentionLevel", "audioTrack", "caption", "category", "commentCount", "createdAt", "dateLabel", "displayName", "dwellTimeMs", "firstSeenAt", "hashtags", "id", "imageDesc", "imageUrls", "isSponsored", "isSuggested", "lastSeenAt", "likeCount", "mediaType", "mentioned", "ocrText", "saveCount", "seenCount", "sessionId", "shareCount", "subtitles", "username", "videoUrl") SELECT "allText", "attentionLevel", "audioTrack", "caption", "category", "commentCount", "createdAt", "dateLabel", "displayName", "dwellTimeMs", "firstSeenAt", "hashtags", "id", "imageDesc", "imageUrls", "isSponsored", "isSuggested", "lastSeenAt", "likeCount", "mediaType", "mentioned", "ocrText", "saveCount", "seenCount", "sessionId", "shareCount", "subtitles", "username", "videoUrl" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE INDEX "Post_sessionId_idx" ON "Post"("sessionId");
CREATE INDEX "Post_username_idx" ON "Post"("username");
CREATE INDEX "Post_category_idx" ON "Post"("category");
CREATE INDEX "Post_attentionLevel_idx" ON "Post"("attentionLevel");
CREATE INDEX "Post_isSponsored_idx" ON "Post"("isSponsored");
CREATE INDEX "Post_isSuggested_idx" ON "Post"("isSuggested");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
