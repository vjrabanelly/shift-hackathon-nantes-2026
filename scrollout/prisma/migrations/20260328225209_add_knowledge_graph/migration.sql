-- CreateTable
CREATE TABLE "KnowledgeEntity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" DATETIME,
    "avgSentiment" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KnowledgeEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeEdge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeEntity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeEdge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "KnowledgeEntity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "stance" TEXT NOT NULL DEFAULT '',
    "intensity" REAL NOT NULL DEFAULT 0,
    "confidence" REAL NOT NULL DEFAULT 0,
    "evidence" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Observation_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Observation_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "KnowledgeEntity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEntity_canonicalName_key" ON "KnowledgeEntity"("canonicalName");

-- CreateIndex
CREATE INDEX "KnowledgeEntity_type_idx" ON "KnowledgeEntity"("type");

-- CreateIndex
CREATE INDEX "KnowledgeEntity_mentionCount_idx" ON "KnowledgeEntity"("mentionCount");

-- CreateIndex
CREATE INDEX "KnowledgeEdge_relation_idx" ON "KnowledgeEdge"("relation");

-- CreateIndex
CREATE INDEX "KnowledgeEdge_sourceId_idx" ON "KnowledgeEdge"("sourceId");

-- CreateIndex
CREATE INDEX "KnowledgeEdge_targetId_idx" ON "KnowledgeEdge"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEdge_sourceId_targetId_relation_key" ON "KnowledgeEdge"("sourceId", "targetId", "relation");

-- CreateIndex
CREATE INDEX "Observation_postId_idx" ON "Observation"("postId");

-- CreateIndex
CREATE INDEX "Observation_entityId_idx" ON "Observation"("entityId");

-- CreateIndex
CREATE INDEX "Observation_relation_idx" ON "Observation"("relation");
