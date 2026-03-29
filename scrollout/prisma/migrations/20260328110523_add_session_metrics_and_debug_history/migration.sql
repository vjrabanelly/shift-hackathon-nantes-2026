-- CreateTable
CREATE TABLE "SessionMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "totalLines" INTEGER NOT NULL DEFAULT 0,
    "parsedEvents" INTEGER NOT NULL DEFAULT 0,
    "parseErrors" INTEGER NOT NULL DEFAULT 0,
    "parseRate" REAL NOT NULL DEFAULT 0,
    "chunkSuccess" INTEGER NOT NULL DEFAULT 0,
    "chunkFails" INTEGER NOT NULL DEFAULT 0,
    "bridgeEvents" INTEGER NOT NULL DEFAULT 0,
    "bridgeErrors" INTEGER NOT NULL DEFAULT 0,
    "mlkitResults" INTEGER NOT NULL DEFAULT 0,
    "enrichedPosts" INTEGER NOT NULL DEFAULT 0,
    "avgPoliticalScore" REAL NOT NULL DEFAULT 0,
    "avgPolarization" REAL NOT NULL DEFAULT 0,
    "avgConfidence" REAL NOT NULL DEFAULT 0,
    "errorLog" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SessionMetrics_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionMetrics_sessionId_key" ON "SessionMetrics"("sessionId");
