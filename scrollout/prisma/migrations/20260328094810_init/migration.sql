-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capturedAt" DATETIME NOT NULL,
    "durationSec" REAL NOT NULL,
    "totalEvents" INTEGER NOT NULL,
    "totalPosts" INTEGER NOT NULL,
    "captureMode" TEXT NOT NULL DEFAULT 'accessibility',
    "device" TEXT,
    "sourceFile" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Post" (
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
    "dwellTimeMs" INTEGER NOT NULL DEFAULT 0,
    "attentionLevel" TEXT NOT NULL DEFAULT 'skipped',
    "category" TEXT NOT NULL DEFAULT 'non classifié',
    "firstSeenAt" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" INTEGER NOT NULL DEFAULT 0,
    "seenCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Post_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostSemantic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "topics" TEXT NOT NULL DEFAULT '[]',
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "confidence" REAL NOT NULL DEFAULT 0,
    "embedding" BLOB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostSemantic_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Post_sessionId_idx" ON "Post"("sessionId");

-- CreateIndex
CREATE INDEX "Post_username_idx" ON "Post"("username");

-- CreateIndex
CREATE INDEX "Post_category_idx" ON "Post"("category");

-- CreateIndex
CREATE INDEX "Post_attentionLevel_idx" ON "Post"("attentionLevel");

-- CreateIndex
CREATE INDEX "Post_isSponsored_idx" ON "Post"("isSponsored");

-- CreateIndex
CREATE INDEX "Post_isSuggested_idx" ON "Post"("isSuggested");

-- CreateIndex
CREATE INDEX "PostSemantic_postId_idx" ON "PostSemantic"("postId");

-- CreateIndex
CREATE INDEX "PostSemantic_provider_idx" ON "PostSemantic"("provider");
