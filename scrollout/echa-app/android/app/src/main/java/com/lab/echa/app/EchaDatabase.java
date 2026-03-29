package com.lab.echa.app;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * EchaDatabase — SQLite mobile, source de vérité.
 * Stocke sessions, posts, enrichissements.
 * Thread-safe via single-thread executor.
 */
public class EchaDatabase extends SQLiteOpenHelper {

    private static final String TAG = "EchaDB";
    private static final String DB_NAME = "echa.db";
    private static final int DB_VERSION = 6;

    private static EchaDatabase instance;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    // ── Singleton ───────────────────────────────────────────────

    public static synchronized EchaDatabase getInstance(Context context) {
        if (instance == null) {
            instance = new EchaDatabase(context.getApplicationContext());
        }
        return instance;
    }

    private EchaDatabase(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
    }

    // ── Schema ──────────────────────────────────────────────────

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE sessions (" +
                "id TEXT PRIMARY KEY," +
                "capturedAt INTEGER NOT NULL," +
                "durationSec REAL DEFAULT 0," +
                "totalPosts INTEGER DEFAULT 0," +
                "totalEvents INTEGER DEFAULT 0," +
                "captureMode TEXT DEFAULT 'webview'," +
                "createdAt INTEGER NOT NULL" +
                ")");

        db.execSQL("CREATE TABLE posts (" +
                "id TEXT PRIMARY KEY," +
                "sessionId TEXT NOT NULL," +
                "postId TEXT NOT NULL," +
                "username TEXT NOT NULL DEFAULT ''," +
                "displayName TEXT DEFAULT ''," +
                "caption TEXT DEFAULT ''," +
                "fullCaption TEXT DEFAULT ''," +
                "hashtags TEXT DEFAULT '[]'," +
                "imageAlts TEXT DEFAULT '[]'," +
                "imageUrls TEXT DEFAULT '[]'," +
                "videoUrl TEXT DEFAULT ''," +
                "mediaType TEXT DEFAULT 'photo'," +
                "likeCount INTEGER DEFAULT 0," +
                "commentCount INTEGER DEFAULT 0," +
                "isSponsored INTEGER DEFAULT 0," +
                "isSuggested INTEGER DEFAULT 0," +
                "dwellTimeMs INTEGER DEFAULT 0," +
                "attentionLevel TEXT DEFAULT 'skipped'," +
                "allText TEXT DEFAULT ''," +
                "ocrText TEXT DEFAULT ''," +
                "mlkitLabels TEXT DEFAULT '[]'," +
                "dateLabel TEXT DEFAULT ''," +
                "location TEXT DEFAULT ''," +
                "audioTrack TEXT DEFAULT ''," +
                "firstSeenAt INTEGER DEFAULT 0," +
                "lastSeenAt INTEGER DEFAULT 0," +
                "seenCount INTEGER DEFAULT 1," +
                "createdAt INTEGER NOT NULL," +
                "FOREIGN KEY (sessionId) REFERENCES sessions(id)" +
                ")");

        db.execSQL("CREATE TABLE post_enriched (" +
                "id TEXT PRIMARY KEY," +
                "postId TEXT UNIQUE NOT NULL," +
                "provider TEXT DEFAULT 'rules'," +
                "model TEXT DEFAULT 'rules-v1'," +
                "normalizedText TEXT DEFAULT ''," +
                "mainTopics TEXT DEFAULT '[]'," +
                "secondaryTopics TEXT DEFAULT '[]'," +
                "politicalActors TEXT DEFAULT '[]'," +
                "institutions TEXT DEFAULT '[]'," +
                "politicalExplicitnessScore INTEGER DEFAULT 0," +
                "politicalIssueTags TEXT DEFAULT '[]'," +
                "polarizationScore REAL DEFAULT 0," +
                "ingroupOutgroupSignal INTEGER DEFAULT 0," +
                "conflictSignal INTEGER DEFAULT 0," +
                "moralAbsoluteSignal INTEGER DEFAULT 0," +
                "enemyDesignationSignal INTEGER DEFAULT 0," +
                "activismSignal INTEGER DEFAULT 0," +
                "axisEconomic REAL DEFAULT 0," +
                "axisSocietal REAL DEFAULT 0," +
                "axisAuthority REAL DEFAULT 0," +
                "axisSystem REAL DEFAULT 0," +
                "dominantAxis TEXT DEFAULT ''," +
                "mediaCategory TEXT DEFAULT ''," +
                "mediaQuality TEXT DEFAULT ''," +
                "confidenceScore REAL DEFAULT 0," +
                "tone TEXT DEFAULT ''," +
                "semanticSummary TEXT DEFAULT ''," +
                "primaryEmotion TEXT DEFAULT ''," +
                "narrativeFrame TEXT DEFAULT ''," +
                "domains TEXT DEFAULT '[]'," +
                "subjects TEXT DEFAULT '[]'," +
                "preciseSubjects TEXT DEFAULT '[]'," +
                "createdAt INTEGER NOT NULL," +
                "updatedAt INTEGER NOT NULL," +
                "FOREIGN KEY (postId) REFERENCES posts(id)" +
                ")");

        // ── Knowledge Graph tables ───────────────────────────────
        db.execSQL("CREATE TABLE knowledge_entities (" +
                "id TEXT PRIMARY KEY," +
                "canonicalName TEXT UNIQUE NOT NULL," +
                "type TEXT NOT NULL," +     // Person | Organization | Institution | Theme | Subject | PreciseSubject | Narrative | Emotion | Country | Audience
                "aliases TEXT DEFAULT '[]'," +
                "metadata TEXT DEFAULT '{}'," +
                "mentionCount INTEGER DEFAULT 0," +
                "lastSeenAt INTEGER," +
                "avgSentiment REAL DEFAULT 0," +
                "createdAt INTEGER NOT NULL," +
                "updatedAt INTEGER NOT NULL" +
                ")");

        db.execSQL("CREATE TABLE knowledge_edges (" +
                "id TEXT PRIMARY KEY," +
                "sourceId TEXT NOT NULL," +
                "targetId TEXT NOT NULL," +
                "relation TEXT NOT NULL," +  // belongsTo | affiliatedWith | opposedTo | relatedTo | subTopicOf
                "weight REAL DEFAULT 1," +
                "metadata TEXT DEFAULT '{}'," +
                "createdAt INTEGER NOT NULL," +
                "FOREIGN KEY (sourceId) REFERENCES knowledge_entities(id)," +
                "FOREIGN KEY (targetId) REFERENCES knowledge_entities(id)," +
                "UNIQUE(sourceId, targetId, relation)" +
                ")");

        db.execSQL("CREATE TABLE observations (" +
                "id TEXT PRIMARY KEY," +
                "postId TEXT NOT NULL," +
                "entityId TEXT NOT NULL," +
                "relation TEXT NOT NULL," +  // mentions | isAbout | takesPosition | evokes | uses | targets
                "stance TEXT DEFAULT ''," +  // pour | contre | neutre | ambigu
                "intensity REAL DEFAULT 0," +
                "confidence REAL DEFAULT 0," +
                "evidence TEXT DEFAULT ''," +
                "source TEXT NOT NULL," +    // rules | llm | manual
                "createdAt INTEGER NOT NULL," +
                "FOREIGN KEY (postId) REFERENCES posts(id)," +
                "FOREIGN KEY (entityId) REFERENCES knowledge_entities(id)" +
                ")");

        // Indexes
        db.execSQL("CREATE INDEX idx_posts_sessionId ON posts(sessionId)");
        db.execSQL("CREATE INDEX idx_posts_username ON posts(username)");
        db.execSQL("CREATE INDEX idx_posts_attentionLevel ON posts(attentionLevel)");
        db.execSQL("CREATE INDEX idx_posts_isSponsored ON posts(isSponsored)");
        db.execSQL("CREATE INDEX idx_enriched_postId ON post_enriched(postId)");
        db.execSQL("CREATE INDEX idx_enriched_politicalScore ON post_enriched(politicalExplicitnessScore)");
        db.execSQL("CREATE INDEX idx_enriched_polarization ON post_enriched(polarizationScore)");
        db.execSQL("CREATE INDEX idx_enriched_confidence ON post_enriched(confidenceScore)");
        db.execSQL("CREATE INDEX idx_enriched_provider ON post_enriched(provider)");
        db.execSQL("CREATE INDEX idx_ke_type ON knowledge_entities(type)");
        db.execSQL("CREATE INDEX idx_ke_mentions ON knowledge_entities(mentionCount)");
        db.execSQL("CREATE INDEX idx_kedge_source ON knowledge_edges(sourceId)");
        db.execSQL("CREATE INDEX idx_kedge_target ON knowledge_edges(targetId)");
        db.execSQL("CREATE INDEX idx_kedge_relation ON knowledge_edges(relation)");
        db.execSQL("CREATE INDEX idx_obs_postId ON observations(postId)");
        db.execSQL("CREATE INDEX idx_obs_entityId ON observations(entityId)");
        db.execSQL("CREATE INDEX idx_obs_relation ON observations(relation)");

        Log.i(TAG, "Database created (v" + DB_VERSION + ")");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        Log.i(TAG, "Database upgrade " + oldVersion + " → " + newVersion);
        if (oldVersion < 2) {
            // Add LLM enrichment fields
            safeAddColumn(db, "post_enriched", "tone", "TEXT DEFAULT ''");
            safeAddColumn(db, "post_enriched", "semanticSummary", "TEXT DEFAULT ''");
            safeAddColumn(db, "post_enriched", "primaryEmotion", "TEXT DEFAULT ''");
            safeAddColumn(db, "post_enriched", "narrativeFrame", "TEXT DEFAULT ''");
        }
        if (oldVersion < 3) {
            // Add confidence + provider indexes for smart enrichment cascade
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_enriched_confidence ON post_enriched(confidenceScore)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_enriched_provider ON post_enriched(provider)");
            // Add audioTranscription + reviewFlag if missing
            safeAddColumn(db, "post_enriched", "audioTranscription", "TEXT DEFAULT ''");
            safeAddColumn(db, "post_enriched", "reviewFlag", "INTEGER DEFAULT 0");
            safeAddColumn(db, "post_enriched", "reviewReason", "TEXT DEFAULT ''");
        }
        if (oldVersion < 4) {
            // Add deeper taxonomy columns (domains, subjects, preciseSubjects)
            safeAddColumn(db, "post_enriched", "domains", "TEXT DEFAULT '[]'");
            safeAddColumn(db, "post_enriched", "subjects", "TEXT DEFAULT '[]'");
            safeAddColumn(db, "post_enriched", "preciseSubjects", "TEXT DEFAULT '[]'");
        }
        if (oldVersion < 5) {
            // Add missing videoUrl column used by mobile enrichment pipeline
            safeAddColumn(db, "posts", "videoUrl", "TEXT DEFAULT ''");
            // Knowledge graph tables
            safeExecSQL(db, "CREATE TABLE IF NOT EXISTS knowledge_entities (" +
                    "id TEXT PRIMARY KEY," +
                    "canonicalName TEXT UNIQUE NOT NULL," +
                    "type TEXT NOT NULL," +
                    "aliases TEXT DEFAULT '[]'," +
                    "metadata TEXT DEFAULT '{}'," +
                    "mentionCount INTEGER DEFAULT 0," +
                    "lastSeenAt INTEGER," +
                    "avgSentiment REAL DEFAULT 0," +
                    "createdAt INTEGER NOT NULL," +
                    "updatedAt INTEGER NOT NULL)");
            safeExecSQL(db, "CREATE TABLE IF NOT EXISTS knowledge_edges (" +
                    "id TEXT PRIMARY KEY," +
                    "sourceId TEXT NOT NULL," +
                    "targetId TEXT NOT NULL," +
                    "relation TEXT NOT NULL," +
                    "weight REAL DEFAULT 1," +
                    "metadata TEXT DEFAULT '{}'," +
                    "createdAt INTEGER NOT NULL," +
                    "UNIQUE(sourceId, targetId, relation))");
            safeExecSQL(db, "CREATE TABLE IF NOT EXISTS observations (" +
                    "id TEXT PRIMARY KEY," +
                    "postId TEXT NOT NULL," +
                    "entityId TEXT NOT NULL," +
                    "relation TEXT NOT NULL," +
                    "stance TEXT DEFAULT ''," +
                    "intensity REAL DEFAULT 0," +
                    "confidence REAL DEFAULT 0," +
                    "evidence TEXT DEFAULT ''," +
                    "source TEXT NOT NULL," +
                    "createdAt INTEGER NOT NULL)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_ke_type ON knowledge_entities(type)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_ke_mentions ON knowledge_entities(mentionCount)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_kedge_source ON knowledge_edges(sourceId)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_kedge_target ON knowledge_edges(targetId)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_obs_postId ON observations(postId)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_obs_entityId ON observations(entityId)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_obs_relation ON observations(relation)");
        }
        if (oldVersion < 6) {
            // Ensure knowledge graph tables exist (may already exist from v5 fresh install)
            safeAddColumn(db, "posts", "videoUrl", "TEXT DEFAULT ''");
            safeExecSQL(db, "CREATE TABLE IF NOT EXISTS knowledge_entities (" +
                    "id TEXT PRIMARY KEY," +
                    "canonicalName TEXT UNIQUE NOT NULL," +
                    "type TEXT NOT NULL," +
                    "aliases TEXT DEFAULT '[]'," +
                    "metadata TEXT DEFAULT '{}'," +
                    "mentionCount INTEGER DEFAULT 0," +
                    "lastSeenAt INTEGER," +
                    "avgSentiment REAL DEFAULT 0," +
                    "createdAt INTEGER NOT NULL," +
                    "updatedAt INTEGER NOT NULL)");
            safeExecSQL(db, "CREATE TABLE IF NOT EXISTS knowledge_edges (" +
                    "id TEXT PRIMARY KEY," +
                    "sourceId TEXT NOT NULL," +
                    "targetId TEXT NOT NULL," +
                    "relation TEXT NOT NULL," +
                    "weight REAL DEFAULT 1," +
                    "metadata TEXT DEFAULT '{}'," +
                    "createdAt INTEGER NOT NULL," +
                    "UNIQUE(sourceId, targetId, relation))");
            safeExecSQL(db, "CREATE TABLE IF NOT EXISTS observations (" +
                    "id TEXT PRIMARY KEY," +
                    "postId TEXT NOT NULL," +
                    "entityId TEXT NOT NULL," +
                    "relation TEXT NOT NULL," +
                    "stance TEXT DEFAULT ''," +
                    "intensity REAL DEFAULT 0," +
                    "confidence REAL DEFAULT 0," +
                    "evidence TEXT DEFAULT ''," +
                    "source TEXT NOT NULL," +
                    "createdAt INTEGER NOT NULL)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_ke_type ON knowledge_entities(type)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_ke_mentions ON knowledge_entities(mentionCount)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_kedge_source ON knowledge_edges(sourceId)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_kedge_target ON knowledge_edges(targetId)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_obs_postId ON observations(postId)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_obs_entityId ON observations(entityId)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_obs_relation ON observations(relation)");
        }
    }

    private void safeExecSQL(SQLiteDatabase db, String sql) {
        try { db.execSQL(sql); } catch (Exception e) { /* already exists */ }
    }

    private void safeAddColumn(SQLiteDatabase db, String table, String column, String type) {
        try {
            db.execSQL("ALTER TABLE " + table + " ADD COLUMN " + column + " " + type);
        } catch (Exception e) {
            // Column already exists
        }
    }

    // ── Session CRUD ────────────────────────────────────────────

    public String insertSession(String captureMode) {
        long now = System.currentTimeMillis();
        String id = String.valueOf(now);
        ContentValues cv = new ContentValues();
        cv.put("id", id);
        cv.put("capturedAt", now);
        cv.put("captureMode", captureMode);
        cv.put("createdAt", now);
        getWritableDatabase().insertWithOnConflict("sessions", null, cv, SQLiteDatabase.CONFLICT_IGNORE);
        Log.i(TAG, "Session created: " + id);

        // Push to visualizer via WebSocket
        EchaWebSocketClient ws = EchaWebSocketClient.getInstance();
        if (ws != null) ws.sendSessionStart(id, captureMode);

        return id;
    }

    public void updateSession(String sessionId, double durationSec, int totalPosts, int totalEvents) {
        ContentValues cv = new ContentValues();
        cv.put("durationSec", durationSec);
        cv.put("totalPosts", totalPosts);
        cv.put("totalEvents", totalEvents);
        getWritableDatabase().update("sessions", cv, "id = ?", new String[]{sessionId});
    }

    // ── Post CRUD ───────────────────────────────────────────────

    public void insertPost(String sessionId, JSONObject post) {
        long now = System.currentTimeMillis();
        String postId = post.optString("postId", "unknown");
        String username = post.optString("username", "");
        String caption = post.optString("caption", "");
        boolean isSponsored = post.optBoolean("isSponsored", false);
        int dwellTimeMs = post.optInt("dwellTimeMs", 0);

        // ── Dedup: merge if same post already exists (including sponsored) ──
        String allText = post.optString("allText", "");
        if (username.length() > 0) {
            Cursor existing = null;
            // Strategy 1: match by postId (Instagram native ID) if available
            if (!postId.equals("unknown") && postId.length() > 3) {
                existing = getReadableDatabase().rawQuery(
                        "SELECT id, seenCount, dwellTimeMs FROM posts WHERE username = ? AND postId = ? LIMIT 1",
                        new String[]{username, postId});
                if (!existing.moveToFirst()) {
                    existing.close();
                    existing = null;
                }
            }
            // Strategy 2: fallback to text-based matching
            if (existing == null && allText.length() > 10) {
                existing = getReadableDatabase().rawQuery(
                        "SELECT id, seenCount, dwellTimeMs FROM posts WHERE username = ? AND substr(allText,1,100) = substr(?,1,100) LIMIT 1",
                        new String[]{username, allText});
                if (!existing.moveToFirst()) {
                    existing.close();
                    existing = null;
                }
            }
            if (existing != null) {
                // Post already seen — update seenCount + aggregate dwell
                String existingId = existing.getString(0);
                int prevSeen = existing.getInt(1);
                int prevDwell = existing.getInt(2);
                existing.close();
                ContentValues upd = new ContentValues();
                upd.put("seenCount", prevSeen + 1);
                upd.put("dwellTimeMs", Math.max(prevDwell, dwellTimeMs));
                upd.put("attentionLevel", classifyAttention(Math.max(prevDwell, dwellTimeMs)));
                upd.put("lastSeenAt", now);
                getWritableDatabase().update("posts", upd, "id = ?", new String[]{existingId});
                Log.d(TAG, "Dedup: merged @" + username + " (seen " + (prevSeen + 1) + "x)");

                EchaWebSocketClient ws = EchaWebSocketClient.getInstance();
                if (ws != null) ws.sendPost(sessionId, post);
                return;
            }
        }

        String id = sessionId + ":" + username + ":" + postId;

        ContentValues cv = new ContentValues();
        cv.put("id", id);
        cv.put("sessionId", sessionId);
        cv.put("postId", postId);
        cv.put("username", username);
        cv.put("displayName", post.optString("displayName", ""));
        cv.put("caption", caption);
        cv.put("fullCaption", post.optString("fullCaption", ""));
        cv.put("hashtags", post.optString("hashtags", "[]"));
        cv.put("imageAlts", post.optString("imageAlts", "[]"));
        cv.put("imageUrls", post.optString("imageUrls", "[]"));
        cv.put("videoUrl", post.optString("videoUrl", ""));
        cv.put("mediaType", post.optString("mediaType", "photo"));
        cv.put("likeCount", parseLikeCount(post.optString("likeCount", "0")));
        cv.put("commentCount", parseLikeCount(post.optString("commentCount", "0")));
        cv.put("isSponsored", isSponsored ? 1 : 0);
        cv.put("isSuggested", post.optBoolean("isSuggested", false) ? 1 : 0);
        cv.put("dwellTimeMs", dwellTimeMs);
        cv.put("attentionLevel", classifyAttention(dwellTimeMs));
        cv.put("allText", post.optString("allText", ""));
        cv.put("dateLabel", post.optString("date", ""));
        cv.put("location", post.optString("location", ""));
        cv.put("audioTrack", post.optString("audioTrack", ""));
        cv.put("firstSeenAt", post.optLong("firstSeen", now));
        cv.put("lastSeenAt", post.optLong("lastSeen", now));
        cv.put("seenCount", post.optInt("seenCount", 1));
        cv.put("createdAt", now);

        getWritableDatabase().insertWithOnConflict("posts", null, cv, SQLiteDatabase.CONFLICT_REPLACE);

        // Push to visualizer via WebSocket
        EchaWebSocketClient ws = EchaWebSocketClient.getInstance();
        if (ws != null) ws.sendPost(sessionId, post);
    }

    public void updateDwell(String sessionId, String postId, String username, int dwellTimeMs) {
        String id = sessionId + ":" + username + ":" + postId;
        String attention = classifyAttention(dwellTimeMs);
        ContentValues cv = new ContentValues();
        cv.put("dwellTimeMs", dwellTimeMs);
        cv.put("attentionLevel", attention);
        cv.put("lastSeenAt", System.currentTimeMillis());
        int rows = getWritableDatabase().update("posts", cv, "id = ?", new String[]{id});
        if (rows == 0) {
            // Post might not exist yet — try with just postId match
            getWritableDatabase().update("posts", cv, "sessionId = ? AND postId = ?",
                    new String[]{sessionId, postId});
        }

        // Push to visualizer via WebSocket
        EchaWebSocketClient ws = EchaWebSocketClient.getInstance();
        if (ws != null) ws.sendDwell(sessionId, postId, username, dwellTimeMs);
    }

    // ── Enrichment CRUD ─────────────────────────────────────────

    public void insertEnrichment(String postId, JSONObject enrichment) {
        long now = System.currentTimeMillis();
        String id = "e_" + now + "_" + postId.hashCode();

        // Find the actual DB post id from postId
        String dbPostId = findPostDbId(postId);
        if (dbPostId == null) {
            Log.w(TAG, "insertEnrichment: post not found for " + postId);
            return;
        }

        ContentValues cv = new ContentValues();
        cv.put("id", id);
        cv.put("postId", dbPostId);
        cv.put("provider", enrichment.optString("provider", "rules"));
        cv.put("model", enrichment.optString("model", "rules-v1"));
        cv.put("normalizedText", enrichment.optString("normalizedText", ""));
        cv.put("mainTopics", jsonArrayToString(enrichment, "mainTopics"));
        cv.put("secondaryTopics", jsonArrayToString(enrichment, "secondaryTopics"));
        cv.put("politicalActors", jsonArrayToString(enrichment, "politicalActors"));
        cv.put("institutions", jsonArrayToString(enrichment, "institutions"));
        cv.put("politicalExplicitnessScore", enrichment.optInt("politicalExplicitnessScore", 0));
        cv.put("politicalIssueTags", jsonArrayToString(enrichment, "politicalIssueTags"));
        cv.put("polarizationScore", enrichment.optDouble("polarizationScore", 0));
        cv.put("ingroupOutgroupSignal", enrichment.optBoolean("ingroupOutgroupSignal", false) ? 1 : 0);
        cv.put("conflictSignal", enrichment.optBoolean("conflictSignal", false) ? 1 : 0);
        cv.put("moralAbsoluteSignal", enrichment.optBoolean("moralAbsoluteSignal", false) ? 1 : 0);
        cv.put("enemyDesignationSignal", enrichment.optBoolean("enemyDesignationSignal", false) ? 1 : 0);
        cv.put("activismSignal", enrichment.optBoolean("activismSignal", false) ? 1 : 0);
        cv.put("axisEconomic", enrichment.optDouble("axisEconomic", 0));
        cv.put("axisSocietal", enrichment.optDouble("axisSocietal", 0));
        cv.put("axisAuthority", enrichment.optDouble("axisAuthority", 0));
        cv.put("axisSystem", enrichment.optDouble("axisSystem", 0));
        cv.put("dominantAxis", enrichment.optString("dominantAxis", ""));
        cv.put("mediaCategory", enrichment.optString("mediaCategory", ""));
        cv.put("mediaQuality", enrichment.optString("mediaQuality", ""));
        cv.put("confidenceScore", enrichment.optDouble("confidenceScore", 0));
        cv.put("tone", enrichment.optString("tone", ""));
        cv.put("semanticSummary", enrichment.optString("semanticSummary", ""));
        cv.put("primaryEmotion", enrichment.optString("primaryEmotion", ""));
        cv.put("narrativeFrame", enrichment.optString("narrativeFrame", ""));
        cv.put("domains", jsonArrayToString(enrichment, "domains"));
        cv.put("subjects", jsonArrayToString(enrichment, "subjects"));
        cv.put("preciseSubjects", jsonArrayToString(enrichment, "preciseSubjects"));
        cv.put("createdAt", now);
        cv.put("updatedAt", now);

        getWritableDatabase().insertWithOnConflict("post_enriched", null, cv, SQLiteDatabase.CONFLICT_REPLACE);

        // Push to visualizer via WebSocket
        EchaWebSocketClient ws = EchaWebSocketClient.getInstance();
        if (ws != null) ws.sendEnrichment(postId, enrichment);
    }

    public void updatePostML(String postId, String labelsJson, String ocrText) {
        ContentValues cv = new ContentValues();
        cv.put("mlkitLabels", labelsJson);
        cv.put("ocrText", ocrText);
        // Try matching by postId column
        getWritableDatabase().update("posts", cv, "postId = ?", new String[]{postId});

        // Push to visualizer via WebSocket
        EchaWebSocketClient ws = EchaWebSocketClient.getInstance();
        if (ws != null) ws.sendMLKit(postId, labelsJson, ocrText);
    }

    // ── Query methods ───────────────────────────────────────────

    public JSONArray getSessions() throws JSONException {
        JSONArray result = new JSONArray();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT s.*, COUNT(p.id) as postCount FROM sessions s " +
                "LEFT JOIN posts p ON p.sessionId = s.id " +
                "GROUP BY s.id ORDER BY s.capturedAt DESC LIMIT 50", null);
        while (c.moveToNext()) {
            JSONObject session = new JSONObject();
            session.put("id", c.getString(c.getColumnIndexOrThrow("id")));
            session.put("capturedAt", c.getLong(c.getColumnIndexOrThrow("capturedAt")));
            session.put("durationSec", c.getDouble(c.getColumnIndexOrThrow("durationSec")));
            session.put("totalPosts", c.getInt(c.getColumnIndexOrThrow("totalPosts")));
            session.put("captureMode", c.getString(c.getColumnIndexOrThrow("captureMode")));
            session.put("postCount", c.getInt(c.getColumnIndexOrThrow("postCount")));
            result.put(session);
        }
        c.close();
        return result;
    }

    public JSONArray getPostsBySession(String sessionId, int offset, int limit) throws JSONException {
        JSONArray result = new JSONArray();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT p.*, e.politicalExplicitnessScore, e.polarizationScore, " +
                "e.mainTopics as enrichTopics, e.secondaryTopics as enrichSecondaryTopics, " +
                "e.confidenceScore, e.axisEconomic, " +
                "e.axisSocietal, e.axisAuthority, e.axisSystem, e.dominantAxis, " +
                "e.mediaCategory, e.mediaQuality, e.tone as enrichTone, " +
                "e.semanticSummary, e.primaryEmotion, e.narrativeFrame, " +
                "e.politicalActors as enrichActors, e.activismSignal as enrichActivism, " +
                "e.conflictSignal as enrichConflict " +
                "FROM posts p LEFT JOIN post_enriched e ON e.postId = p.id " +
                "WHERE p.sessionId = ? ORDER BY p.dwellTimeMs DESC LIMIT ? OFFSET ?",
                new String[]{sessionId, String.valueOf(limit), String.valueOf(offset)});
        while (c.moveToNext()) {
            result.put(cursorToPostJson(c));
        }
        c.close();
        return result;
    }

    public JSONArray getAllPosts(int offset, int limit) throws JSONException {
        JSONArray result = new JSONArray();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT p.*, e.politicalExplicitnessScore, e.polarizationScore, " +
                "e.mainTopics as enrichTopics, e.secondaryTopics as enrichSecondaryTopics, " +
                "e.confidenceScore, e.axisEconomic, " +
                "e.axisSocietal, e.axisAuthority, e.axisSystem, e.dominantAxis, " +
                "e.mediaCategory, e.mediaQuality, e.tone as enrichTone, " +
                "e.semanticSummary, e.primaryEmotion, e.narrativeFrame, " +
                "e.politicalActors as enrichActors, e.activismSignal as enrichActivism, " +
                "e.conflictSignal as enrichConflict " +
                "FROM posts p LEFT JOIN post_enriched e ON e.postId = p.id " +
                "ORDER BY p.dwellTimeMs DESC LIMIT ? OFFSET ?",
                new String[]{String.valueOf(limit), String.valueOf(offset)});
        while (c.moveToNext()) {
            result.put(cursorToPostJson(c));
        }
        c.close();
        return result;
    }

    public JSONObject getCognitiveThemesBySession(String sessionId) throws JSONException {
        JSONObject result = new JSONObject();
        JSONArray themes = new JSONArray();
        int totalPosts = 0;
        boolean allSessions = sessionId == null || sessionId.trim().isEmpty();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT p.id, p.postId, p.username, p.dwellTimeMs, p.attentionLevel, " +
                "e.politicalExplicitnessScore, e.polarizationScore, e.confidenceScore, " +
                "e.mainTopics as enrichTopics, e.mediaCategory " +
                "FROM posts p LEFT JOIN post_enriched e ON e.postId = p.id " +
                (allSessions ? "" : "WHERE p.sessionId = ? ") +
                "ORDER BY p.dwellTimeMs DESC",
                allSessions ? new String[]{} : new String[]{sessionId});

        Map<String, ThemeBucket> buckets = new LinkedHashMap<>();
        while (c.moveToNext()) {
            totalPosts += 1;

            String themeLabel = "non classifié";
            String source = "fallback";

            int topicsIdx = c.getColumnIndex("enrichTopics");
            if (topicsIdx >= 0 && !c.isNull(topicsIdx)) {
                String firstTopic = firstTopicFromJson(c.getString(topicsIdx));
                if (!firstTopic.isEmpty()) {
                    themeLabel = firstTopic;
                    source = "mainTopics";
                }
            }

            int mediaCategoryIdx = c.getColumnIndex("mediaCategory");
            if ("fallback".equals(source) && mediaCategoryIdx >= 0 && !c.isNull(mediaCategoryIdx)) {
                String mediaCategory = c.getString(mediaCategoryIdx);
                if (mediaCategory != null && !mediaCategory.trim().isEmpty()) {
                    themeLabel = mediaCategory.trim();
                    source = "mediaCategory";
                }
            }

            String themeId = normalizeThemeId(themeLabel);
            ThemeBucket bucket = buckets.get(themeId);
            if (bucket == null) {
                bucket = new ThemeBucket(themeId, themeLabel, source);
                buckets.put(themeId, bucket);
            }

            int dwellTimeMs = c.getInt(c.getColumnIndexOrThrow("dwellTimeMs"));
            String attentionLevel = c.getString(c.getColumnIndexOrThrow("attentionLevel"));
            bucket.postCount += 1;
            bucket.totalDwellTimeMs += Math.max(0, dwellTimeMs);
            int attentionScore = resolveAttentionScore(attentionLevel, dwellTimeMs);
            bucket.attentionSum += attentionScore;
            if (attentionScore >= 66) bucket.engagedCount += 1;

            int politicalIdx = c.getColumnIndex("politicalExplicitnessScore");
            if (politicalIdx >= 0 && !c.isNull(politicalIdx)) {
                bucket.enrichedPostCount += 1;
                bucket.politicalSum += c.getDouble(politicalIdx);
                bucket.politicalCount += 1;
                bucket.polarizationSum += clamp(c.getDouble(c.getColumnIndexOrThrow("polarizationScore")), 0, 1);
                bucket.polarizationCount += 1;
                bucket.confidenceSum += clamp(c.getDouble(c.getColumnIndexOrThrow("confidenceScore")), 0, 1);
                bucket.confidenceCount += 1;
            }

            String postId = c.getString(c.getColumnIndexOrThrow("postId"));
            if (postId != null && !postId.isEmpty() && bucket.samplePostIds.size() < 5) {
                bucket.samplePostIds.add(postId);
            }
            String username = c.getString(c.getColumnIndexOrThrow("username"));
            if (username != null && !username.isEmpty()) {
                bucket.sampleUsers.add(username);
            }
        }
        c.close();

        List<ThemeBucket> orderedBuckets = new ArrayList<>(buckets.values());
        orderedBuckets.sort((a, b) -> {
            if (b.totalDwellTimeMs != a.totalDwellTimeMs) {
                return Long.compare(b.totalDwellTimeMs, a.totalDwellTimeMs);
            }
            if (b.postCount != a.postCount) {
                return Integer.compare(b.postCount, a.postCount);
            }
            return a.themeLabel.compareToIgnoreCase(b.themeLabel);
        });

        for (ThemeBucket bucket : orderedBuckets) {
            JSONObject theme = new JSONObject();
            double averageDwellTimeMs = bucket.postCount > 0 ? (double) bucket.totalDwellTimeMs / bucket.postCount : 0;
            double engagementScore = bucket.postCount > 0 ? bucket.attentionSum / bucket.postCount : 0;
            double engagedShare = bucket.postCount > 0 ? (bucket.engagedCount * 100.0) / bucket.postCount : 0;
            double politicalScoreAverage = bucket.politicalCount > 0 ? bucket.politicalSum / bucket.politicalCount : 0;
            double polarizationAverage = bucket.polarizationCount > 0 ? bucket.polarizationSum / bucket.polarizationCount : 0;
            double confidenceAverage = bucket.confidenceCount > 0 ? bucket.confidenceSum / bucket.confidenceCount : 0;

            theme.put("themeId", bucket.themeId);
            theme.put("themeLabel", bucket.themeLabel);
            theme.put("source", bucket.source);
            theme.put("postCount", bucket.postCount);
            theme.put("totalDwellTimeMs", bucket.totalDwellTimeMs);
            theme.put("averageDwellTimeMs", averageDwellTimeMs);
            theme.put("engagementScore", engagementScore);
            theme.put("engagedShare", engagedShare);
            theme.put("politicalScoreAverage", politicalScoreAverage);
            theme.put("polarizationAverage", polarizationAverage);
            theme.put("confidenceAverage", confidenceAverage);
            theme.put("enrichedPostCount", bucket.enrichedPostCount);
            theme.put("samplePostIds", new JSONArray(bucket.samplePostIds));
            theme.put("sampleUsers", new JSONArray(new ArrayList<>(bucket.sampleUsers)));
            themes.put(theme);
        }

        result.put("themes", themes);
        result.put("totalPosts", totalPosts);
        return result;
    }

    public JSONObject getStats() throws JSONException {
        JSONObject stats = new JSONObject();
        SQLiteDatabase db = getReadableDatabase();

        // Total counts
        Cursor c1 = db.rawQuery("SELECT COUNT(*) FROM sessions", null);
        c1.moveToFirst(); stats.put("totalSessions", c1.getInt(0)); c1.close();

        Cursor c2 = db.rawQuery("SELECT COUNT(*) FROM posts", null);
        c2.moveToFirst(); stats.put("totalPosts", c2.getInt(0)); c2.close();

        Cursor c3 = db.rawQuery("SELECT COUNT(*) FROM post_enriched", null);
        c3.moveToFirst(); stats.put("totalEnriched", c3.getInt(0)); c3.close();

        // Attention distribution
        JSONObject attention = new JSONObject();
        Cursor c4 = db.rawQuery("SELECT attentionLevel, COUNT(*) as cnt FROM posts GROUP BY attentionLevel", null);
        while (c4.moveToNext()) {
            attention.put(c4.getString(0), c4.getInt(1));
        }
        c4.close();
        stats.put("attention", attention);

        // Top categories
        JSONArray topCategories = new JSONArray();
        Cursor c5 = db.rawQuery(
                "SELECT mediaCategory, COUNT(*) as cnt FROM post_enriched " +
                "WHERE mediaCategory != '' GROUP BY mediaCategory ORDER BY cnt DESC LIMIT 10", null);
        while (c5.moveToNext()) {
            JSONObject cat = new JSONObject();
            cat.put("category", c5.getString(0));
            cat.put("count", c5.getInt(1));
            topCategories.put(cat);
        }
        c5.close();
        stats.put("topCategories", topCategories);

        // Political score distribution
        JSONObject political = new JSONObject();
        Cursor c6 = db.rawQuery(
                "SELECT politicalExplicitnessScore, COUNT(*) as cnt FROM post_enriched " +
                "GROUP BY politicalExplicitnessScore ORDER BY politicalExplicitnessScore", null);
        while (c6.moveToNext()) {
            political.put(String.valueOf(c6.getInt(0)), c6.getInt(1));
        }
        c6.close();
        stats.put("political", political);

        // Average polarization & confidence (all enriched posts)
        Cursor cAvg = db.rawQuery(
                "SELECT AVG(polarizationScore), AVG(confidenceScore) FROM post_enriched", null);
        if (cAvg.moveToFirst()) {
            stats.put("avgPolarization", Math.round(cAvg.getDouble(0) * 100.0) / 100.0);
            stats.put("avgConfidence", Math.round(cAvg.getDouble(1) * 100.0) / 100.0);
        }
        cAvg.close();

        // Average axes (only posts with political content)
        Cursor c7 = db.rawQuery(
                "SELECT AVG(axisEconomic), AVG(axisSocietal), AVG(axisAuthority), AVG(axisSystem) " +
                "FROM post_enriched WHERE axisEconomic != 0 OR axisSocietal != 0 OR axisAuthority != 0 OR axisSystem != 0", null);
        if (c7.moveToFirst() && !c7.isNull(0)) {
            JSONObject axes = new JSONObject();
            axes.put("economic", Math.round(c7.getDouble(0) * 100.0) / 100.0);
            axes.put("societal", Math.round(c7.getDouble(1) * 100.0) / 100.0);
            axes.put("authority", Math.round(c7.getDouble(2) * 100.0) / 100.0);
            axes.put("system", Math.round(c7.getDouble(3) * 100.0) / 100.0);
            stats.put("axes", axes);
        }
        c7.close();

        // Total dwell time
        Cursor cDwell = db.rawQuery("SELECT COALESCE(SUM(dwellTimeMs),0) FROM posts", null);
        cDwell.moveToFirst(); stats.put("totalDwellMs", cDwell.getLong(0)); cDwell.close();

        // Top topics (parse JSON arrays from mainTopics column)
        stats.put("topTopics", aggregateJsonArrayField(db, "mainTopics", 15));

        // Top domains (from secondaryTopics or mainTopics as domain proxy)
        // Use mainTopics as "domains" since domains field is often empty
        stats.put("topDomains", aggregateJsonArrayField(db, "mainTopics", 10));

        // Top tones
        JSONArray topTones = new JSONArray();
        Cursor cTones = db.rawQuery(
                "SELECT tone, COUNT(*) as cnt FROM post_enriched " +
                "WHERE tone != '' AND tone IS NOT NULL GROUP BY tone ORDER BY cnt DESC LIMIT 10", null);
        while (cTones.moveToNext()) {
            JSONObject t = new JSONObject();
            t.put("tone", cTones.getString(0));
            t.put("count", cTones.getInt(1));
            topTones.put(t);
        }
        cTones.close();
        stats.put("topTones", topTones);

        // Top narratives
        JSONArray topNarratives = new JSONArray();
        Cursor cNarr = db.rawQuery(
                "SELECT narrativeFrame, COUNT(*) as cnt FROM post_enriched " +
                "WHERE narrativeFrame != '' AND narrativeFrame IS NOT NULL GROUP BY narrativeFrame ORDER BY cnt DESC LIMIT 10", null);
        while (cNarr.moveToNext()) {
            JSONObject n = new JSONObject();
            n.put("narrative", cNarr.getString(0));
            n.put("count", cNarr.getInt(1));
            topNarratives.put(n);
        }
        cNarr.close();
        stats.put("topNarratives", topNarratives);

        // Top political actors
        stats.put("topActors", aggregateJsonArrayField(db, "politicalActors", 10));

        // Top subjects & precise subjects (deeper taxonomy)
        stats.put("topSubjects", aggregateJsonArrayField(db, "subjects", 15));
        stats.put("topPreciseSubjects", aggregateJsonArrayField(db, "preciseSubjects", 15));

        // Top domains (from domains field)
        stats.put("topDomainsReal", aggregateJsonArrayField(db, "domains", 10));

        // ── Subject Insights (rich detail per subject) ──────────────
        // Use mainTopics as primary (always populated by enrichment)
        stats.put("subjectInsights", buildSubjectInsights(db, "mainTopics", 12));
        // For precise: try subjects, fallback to secondaryTopics
        JSONArray preciseIns = buildSubjectInsights(db, "subjects", 10);
        if (preciseIns.length() == 0) {
            preciseIns = buildSubjectInsights(db, "secondaryTopics", 10);
        }
        stats.put("preciseSubjectInsights", preciseIns);

        // ── Cross-analyses avancées ──────────────────────────────

        // Attention × Politique: est-ce que tu t'arrêtes plus sur le contenu politique ?
        JSONObject attentionPolitical = new JSONObject();
        Cursor cAP = db.rawQuery(
                "SELECT p.attentionLevel, AVG(e.politicalExplicitnessScore) as avgPol, " +
                "AVG(e.polarizationScore) as avgPolar, COUNT(*) as cnt " +
                "FROM posts p JOIN post_enriched e ON e.postId = p.id " +
                "GROUP BY p.attentionLevel", null);
        while (cAP.moveToNext()) {
            JSONObject row = new JSONObject();
            row.put("avgPolitical", Math.round(cAP.getDouble(1) * 100.0) / 100.0);
            row.put("avgPolarization", Math.round(cAP.getDouble(2) * 100.0) / 100.0);
            row.put("count", cAP.getInt(3));
            attentionPolitical.put(cAP.getString(0), row);
        }
        cAP.close();
        stats.put("attentionPolitical", attentionPolitical);

        // Top comptes par polarisation moyenne (qui te polarise le plus)
        JSONArray polarizingAccounts = new JSONArray();
        Cursor cPA = db.rawQuery(
                "SELECT p.username, AVG(e.polarizationScore) as avgPolar, " +
                "AVG(e.politicalExplicitnessScore) as avgPol, COUNT(*) as cnt, " +
                "SUM(p.dwellTimeMs) as totalDwell " +
                "FROM posts p JOIN post_enriched e ON e.postId = p.id " +
                "WHERE p.username != '' " +
                "GROUP BY p.username HAVING cnt >= 1 " +
                "ORDER BY avgPolar DESC LIMIT 10", null);
        while (cPA.moveToNext()) {
            JSONObject acc = new JSONObject();
            acc.put("username", cPA.getString(0));
            acc.put("avgPolarization", Math.round(cPA.getDouble(1) * 100.0) / 100.0);
            acc.put("avgPolitical", Math.round(cPA.getDouble(2) * 100.0) / 100.0);
            acc.put("count", cPA.getInt(3));
            acc.put("totalDwellMs", cPA.getLong(4));
            polarizingAccounts.put(acc);
        }
        cPA.close();
        stats.put("polarizingAccounts", polarizingAccounts);

        // Sponsored vs organic
        JSONObject sponsoredStats = new JSONObject();
        Cursor cSp = db.rawQuery(
                "SELECT p.isSponsored, COUNT(*) as cnt, AVG(p.dwellTimeMs) as avgDwell, " +
                "AVG(e.politicalExplicitnessScore) as avgPol " +
                "FROM posts p LEFT JOIN post_enriched e ON e.postId = p.id " +
                "GROUP BY p.isSponsored", null);
        while (cSp.moveToNext()) {
            String key = cSp.getInt(0) == 1 ? "sponsored" : "organic";
            JSONObject row = new JSONObject();
            row.put("count", cSp.getInt(1));
            row.put("avgDwellMs", Math.round(cSp.getDouble(2)));
            row.put("avgPolitical", Math.round(cSp.getDouble(3) * 100.0) / 100.0);
            sponsoredStats.put(key, row);
        }
        cSp.close();
        stats.put("sponsoredStats", sponsoredStats);

        // Signaux d'alerte (conflict, activism, enemy designation, moral absolutes)
        JSONObject signals = new JSONObject();
        Cursor cSig = db.rawQuery(
                "SELECT " +
                "SUM(CASE WHEN activismSignal = 1 THEN 1 ELSE 0 END) as activism, " +
                "SUM(CASE WHEN conflictSignal = 1 THEN 1 ELSE 0 END) as conflict, " +
                "SUM(CASE WHEN moralAbsoluteSignal = 1 THEN 1 ELSE 0 END) as moralAbsolute, " +
                "SUM(CASE WHEN enemyDesignationSignal = 1 THEN 1 ELSE 0 END) as enemyDesignation, " +
                "SUM(CASE WHEN ingroupOutgroupSignal = 1 THEN 1 ELSE 0 END) as ingroupOutgroup, " +
                "COUNT(*) as total " +
                "FROM post_enriched", null);
        if (cSig.moveToFirst()) {
            signals.put("activism", cSig.getInt(0));
            signals.put("conflict", cSig.getInt(1));
            signals.put("moralAbsolute", cSig.getInt(2));
            signals.put("enemyDesignation", cSig.getInt(3));
            signals.put("ingroupOutgroup", cSig.getInt(4));
            signals.put("total", cSig.getInt(5));
        }
        cSig.close();
        stats.put("signals", signals);

        // Emotions
        JSONArray topEmotions = new JSONArray();
        Cursor cEmo = db.rawQuery(
                "SELECT primaryEmotion, COUNT(*) as cnt FROM post_enriched " +
                "WHERE primaryEmotion != '' AND primaryEmotion IS NOT NULL " +
                "GROUP BY primaryEmotion ORDER BY cnt DESC LIMIT 8", null);
        while (cEmo.moveToNext()) {
            JSONObject e = new JSONObject();
            e.put("emotion", cEmo.getString(0));
            e.put("count", cEmo.getInt(1));
            topEmotions.put(e);
        }
        cEmo.close();
        stats.put("topEmotions", topEmotions);

        // Dwell time moyen par topic (sur quoi tu passes le plus de temps)
        // Parse mainTopics JSON per post, aggregate dwell time
        JSONArray dwellByTopic = new JSONArray();
        java.util.Map<String, long[]> topicDwell = new java.util.LinkedHashMap<>();
        Cursor cDT = db.rawQuery(
                "SELECT e.mainTopics, p.dwellTimeMs FROM posts p " +
                "JOIN post_enriched e ON e.postId = p.id " +
                "WHERE e.mainTopics IS NOT NULL AND e.mainTopics != '[]'", null);
        while (cDT.moveToNext()) {
            String topicsJson = cDT.getString(0);
            long dwell = cDT.getLong(1);
            try {
                JSONArray topics = new JSONArray(topicsJson);
                for (int ti = 0; ti < topics.length(); ti++) {
                    String topic = topics.getString(ti).trim().toLowerCase();
                    if (!topic.isEmpty()) {
                        long[] vals = topicDwell.getOrDefault(topic, new long[]{0, 0});
                        vals[0] += dwell; // total dwell
                        vals[1]++;        // count
                        topicDwell.put(topic, vals);
                    }
                }
            } catch (Exception ignored) {}
        }
        cDT.close();
        java.util.List<java.util.Map.Entry<String, long[]>> sortedDwell = new java.util.ArrayList<>(topicDwell.entrySet());
        sortedDwell.sort((a1, b1) -> Long.compare(b1.getValue()[0], a1.getValue()[0]));
        for (int di = 0; di < Math.min(sortedDwell.size(), 10); di++) {
            java.util.Map.Entry<String, long[]> entry = sortedDwell.get(di);
            JSONObject item = new JSONObject();
            item.put("topic", entry.getKey());
            item.put("totalDwellMs", entry.getValue()[0]);
            item.put("avgDwellMs", entry.getValue()[1] > 0 ? entry.getValue()[0] / entry.getValue()[1] : 0);
            item.put("count", entry.getValue()[1]);
            dwellByTopic.put(item);
        }
        stats.put("dwellByTopic", dwellByTopic);

        // Top usernames
        JSONArray topUsers = new JSONArray();
        Cursor c8 = db.rawQuery(
                "SELECT username, COUNT(*) as cnt, SUM(dwellTimeMs) as totalDwell " +
                "FROM posts WHERE username != '' GROUP BY username ORDER BY cnt DESC LIMIT 20", null);
        while (c8.moveToNext()) {
            JSONObject user = new JSONObject();
            user.put("username", c8.getString(0));
            user.put("count", c8.getInt(1));
            user.put("totalDwellMs", c8.getLong(2));
            topUsers.put(user);
        }
        c8.close();
        stats.put("topUsers", topUsers);

        // ── Media type distribution (photo, video, carousel, reel, story) ──
        JSONArray mediaTypes = new JSONArray();
        Cursor cmt = getReadableDatabase().rawQuery(
                "SELECT mediaType, COUNT(*) as cnt, SUM(dwellTimeMs) as totalDwell " +
                "FROM posts GROUP BY mediaType ORDER BY cnt DESC", null);
        while (cmt.moveToNext()) {
            JSONObject mt = new JSONObject();
            mt.put("type", cmt.getString(0));
            mt.put("count", cmt.getInt(1));
            mt.put("totalDwellMs", cmt.getLong(2));
            mediaTypes.put(mt);
        }
        cmt.close();
        stats.put("mediaTypes", mediaTypes);

        return stats;
    }

    public JSONObject exportSessionAsJson(String sessionId) throws JSONException {
        JSONObject result = new JSONObject();

        // Session info
        Cursor sc = getReadableDatabase().rawQuery("SELECT * FROM sessions WHERE id = ?", new String[]{sessionId});
        if (sc.moveToFirst()) {
            result.put("id", sc.getString(sc.getColumnIndexOrThrow("id")));
            result.put("capturedAt", sc.getLong(sc.getColumnIndexOrThrow("capturedAt")));
            result.put("durationSec", sc.getDouble(sc.getColumnIndexOrThrow("durationSec")));
            result.put("totalPosts", sc.getInt(sc.getColumnIndexOrThrow("totalPosts")));
        }
        sc.close();

        // Posts + enrichment
        result.put("posts", getPostsBySession(sessionId, 0, 1000));

        return result;
    }

    // ── Taxonomy extract (full enrichment for all posts) ───────────

    public JSONObject getTaxonomyExtract() throws JSONException {
        JSONObject result = new JSONObject();
        SQLiteDatabase db = getReadableDatabase();

        // Total counts
        Cursor cTotal = db.rawQuery("SELECT COUNT(*) FROM posts", null);
        cTotal.moveToFirst(); result.put("totalPosts", cTotal.getInt(0)); cTotal.close();

        Cursor cEnriched = db.rawQuery("SELECT COUNT(*) FROM post_enriched", null);
        cEnriched.moveToFirst(); result.put("totalEnriched", cEnriched.getInt(0)); cEnriched.close();

        // ── Level 1: Domains ──
        JSONArray domainStats = new JSONArray();
        Cursor cDom = db.rawQuery(
                "SELECT domains FROM post_enriched WHERE domains != '[]' AND domains != ''", null);
        Map<String, Integer> domainCounts = new LinkedHashMap<>();
        while (cDom.moveToNext()) {
            try {
                JSONArray doms = new JSONArray(cDom.getString(0));
                for (int i = 0; i < doms.length(); i++) {
                    String d = doms.getString(i).trim();
                    if (!d.isEmpty()) domainCounts.merge(d, 1, Integer::sum);
                }
            } catch (Exception ignored) {}
        }
        cDom.close();
        for (Map.Entry<String, Integer> e : domainCounts.entrySet()) {
            JSONObject o = new JSONObject();
            o.put("name", e.getKey()); o.put("count", e.getValue());
            domainStats.put(o);
        }
        result.put("domains", domainStats);

        // ── Level 2: Themes (mainTopics + secondaryTopics) ──
        JSONArray themeStats = new JSONArray();
        Cursor cThemes = db.rawQuery(
                "SELECT mainTopics, secondaryTopics FROM post_enriched", null);
        Map<String, int[]> themeCounts = new LinkedHashMap<>(); // [main, secondary]
        while (cThemes.moveToNext()) {
            try {
                JSONArray main = new JSONArray(cThemes.getString(0));
                for (int i = 0; i < main.length(); i++) {
                    String t = main.getString(i).trim();
                    if (!t.isEmpty()) themeCounts.computeIfAbsent(t, k -> new int[2])[0]++;
                }
            } catch (Exception ignored) {}
            try {
                JSONArray sec = new JSONArray(cThemes.getString(1));
                for (int i = 0; i < sec.length(); i++) {
                    String t = sec.getString(i).trim();
                    if (!t.isEmpty()) themeCounts.computeIfAbsent(t, k -> new int[2])[1]++;
                }
            } catch (Exception ignored) {}
        }
        cThemes.close();
        for (Map.Entry<String, int[]> e : themeCounts.entrySet()) {
            JSONObject o = new JSONObject();
            o.put("name", e.getKey());
            o.put("mainCount", e.getValue()[0]);
            o.put("secondaryCount", e.getValue()[1]);
            o.put("total", e.getValue()[0] + e.getValue()[1]);
            themeStats.put(o);
        }
        result.put("themes", themeStats);

        // ── Level 3: Subjects ──
        JSONArray subjectStats = new JSONArray();
        Cursor cSubj = db.rawQuery(
                "SELECT subjects FROM post_enriched WHERE subjects != '[]' AND subjects != ''", null);
        Map<String, Integer> subjectCounts = new LinkedHashMap<>();
        while (cSubj.moveToNext()) {
            try {
                JSONArray subjs = new JSONArray(cSubj.getString(0));
                for (int i = 0; i < subjs.length(); i++) {
                    JSONObject s = subjs.getJSONObject(i);
                    String label = s.optString("label", "").trim();
                    if (!label.isEmpty()) subjectCounts.merge(label, 1, Integer::sum);
                }
            } catch (Exception ignored) {}
        }
        cSubj.close();
        for (Map.Entry<String, Integer> e : subjectCounts.entrySet()) {
            JSONObject o = new JSONObject();
            o.put("label", e.getKey()); o.put("count", e.getValue());
            subjectStats.put(o);
        }
        result.put("subjects", subjectStats);

        // ── Level 4: Precise subjects ──
        JSONArray preciseStats = new JSONArray();
        Cursor cPs = db.rawQuery(
                "SELECT preciseSubjects FROM post_enriched WHERE preciseSubjects != '[]' AND preciseSubjects != ''", null);
        Map<String, JSONObject> preciseMap = new LinkedHashMap<>();
        while (cPs.moveToNext()) {
            try {
                JSONArray pss = new JSONArray(cPs.getString(0));
                for (int i = 0; i < pss.length(); i++) {
                    JSONObject ps = pss.getJSONObject(i);
                    String id = ps.optString("id", "");
                    String statement = ps.optString("statement", id);
                    String position = ps.optString("position", "neutre");
                    if (id.isEmpty()) continue;
                    JSONObject entry = preciseMap.get(id);
                    if (entry == null) {
                        entry = new JSONObject();
                        entry.put("id", id);
                        entry.put("statement", statement);
                        entry.put("count", 0);
                        entry.put("positions", new JSONObject());
                        preciseMap.put(id, entry);
                    }
                    entry.put("count", entry.getInt("count") + 1);
                    JSONObject positions = entry.getJSONObject("positions");
                    positions.put(position, positions.optInt(position, 0) + 1);
                }
            } catch (Exception ignored) {}
        }
        cPs.close();
        for (JSONObject e : preciseMap.values()) preciseStats.put(e);
        result.put("preciseSubjects", preciseStats);

        // ── Level 5: Entities (persons, organizations, institutions, countries, politicalActors) ──
        JSONArray entityStats = new JSONArray();
        Cursor cEnt = db.rawQuery(
                "SELECT politicalActors, institutions FROM post_enriched", null);
        Map<String, int[]> entityCounts = new LinkedHashMap<>(); // [politicalActor, institution]
        while (cEnt.moveToNext()) {
            try {
                JSONArray actors = new JSONArray(cEnt.getString(0));
                for (int i = 0; i < actors.length(); i++) {
                    String a = actors.getString(i).trim();
                    if (!a.isEmpty()) entityCounts.computeIfAbsent(a, k -> new int[]{0, 0})[0]++;
                }
            } catch (Exception ignored) {}
            try {
                JSONArray insts = new JSONArray(cEnt.getString(1));
                for (int i = 0; i < insts.length(); i++) {
                    String inst = insts.getString(i).trim();
                    if (!inst.isEmpty()) entityCounts.computeIfAbsent(inst, k -> new int[]{0, 0})[1]++;
                }
            } catch (Exception ignored) {}
        }
        cEnt.close();
        for (Map.Entry<String, int[]> e : entityCounts.entrySet()) {
            JSONObject o = new JSONObject();
            o.put("name", e.getKey());
            o.put("type", e.getValue()[0] > 0 ? "politicalActor" : "institution");
            o.put("count", e.getValue()[0] + e.getValue()[1]);
            entityStats.put(o);
        }
        // Also get entities from knowledge_entities table
        Cursor cKe = db.rawQuery(
                "SELECT canonicalName, type, mentionCount FROM knowledge_entities " +
                "WHERE mentionCount > 0 ORDER BY mentionCount DESC LIMIT 50", null);
        JSONArray knowledgeEntities = new JSONArray();
        while (cKe.moveToNext()) {
            JSONObject o = new JSONObject();
            o.put("name", cKe.getString(0));
            o.put("type", cKe.getString(1));
            o.put("mentions", cKe.getInt(2));
            knowledgeEntities.put(o);
        }
        cKe.close();
        result.put("entities", entityStats);
        result.put("knowledgeEntities", knowledgeEntities);

        // ── Sample posts with full taxonomy (last 30 enriched) ──
        JSONArray samplePosts = new JSONArray();
        Cursor cSample = db.rawQuery(
                "SELECT p.postId, p.username, p.caption, p.dwellTimeMs, p.attentionLevel, " +
                "e.domains, e.mainTopics, e.secondaryTopics, e.subjects, e.preciseSubjects, " +
                "e.politicalActors, e.institutions, e.tone, e.primaryEmotion, e.narrativeFrame, " +
                "e.semanticSummary, e.politicalExplicitnessScore, e.polarizationScore, " +
                "e.confidenceScore, e.mediaCategory " +
                "FROM posts p INNER JOIN post_enriched e ON e.postId = p.id " +
                "WHERE e.confidenceScore > 0 " +
                "ORDER BY e.updatedAt DESC LIMIT 30", null);
        while (cSample.moveToNext()) {
            JSONObject post = new JSONObject();
            post.put("postId", cSample.getString(0));
            post.put("username", cSample.getString(1));
            post.put("caption", cSample.getString(2));
            post.put("dwellTimeMs", cSample.getInt(3));
            post.put("attentionLevel", cSample.getString(4));
            post.put("domains", cSample.getString(5));
            post.put("mainTopics", cSample.getString(6));
            post.put("secondaryTopics", cSample.getString(7));
            post.put("subjects", cSample.getString(8));
            post.put("preciseSubjects", cSample.getString(9));
            post.put("politicalActors", cSample.getString(10));
            post.put("institutions", cSample.getString(11));
            post.put("tone", cSample.getString(12));
            post.put("primaryEmotion", cSample.getString(13));
            post.put("narrativeFrame", cSample.getString(14));
            post.put("semanticSummary", cSample.getString(15));
            post.put("politicalScore", cSample.getInt(16));
            post.put("polarizationScore", cSample.getDouble(17));
            post.put("confidenceScore", cSample.getDouble(18));
            post.put("mediaCategory", cSample.getString(19));
            samplePosts.put(post);
        }
        cSample.close();
        result.put("samplePosts", samplePosts);

        // ── Tone/Emotion/Narrative distributions ──
        JSONArray toneStats = new JSONArray();
        Cursor cTone = db.rawQuery(
                "SELECT tone, COUNT(*) as cnt FROM post_enriched WHERE tone != '' GROUP BY tone ORDER BY cnt DESC", null);
        while (cTone.moveToNext()) {
            JSONObject o = new JSONObject(); o.put("value", cTone.getString(0)); o.put("count", cTone.getInt(1)); toneStats.put(o);
        }
        cTone.close();
        result.put("tones", toneStats);

        JSONArray emotionStats = new JSONArray();
        Cursor cEmo = db.rawQuery(
                "SELECT primaryEmotion, COUNT(*) as cnt FROM post_enriched WHERE primaryEmotion != '' GROUP BY primaryEmotion ORDER BY cnt DESC", null);
        while (cEmo.moveToNext()) {
            JSONObject o = new JSONObject(); o.put("value", cEmo.getString(0)); o.put("count", cEmo.getInt(1)); emotionStats.put(o);
        }
        cEmo.close();
        result.put("emotions", emotionStats);

        JSONArray narrativeStats = new JSONArray();
        Cursor cNarr = db.rawQuery(
                "SELECT narrativeFrame, COUNT(*) as cnt FROM post_enriched WHERE narrativeFrame != '' AND narrativeFrame != 'aucun' GROUP BY narrativeFrame ORDER BY cnt DESC", null);
        while (cNarr.moveToNext()) {
            JSONObject o = new JSONObject(); o.put("value", cNarr.getString(0)); o.put("count", cNarr.getInt(1)); narrativeStats.put(o);
        }
        cNarr.close();
        result.put("narratives", narrativeStats);

        return result;
    }

    // ── Unenriched posts query ────────────────────────────────────

    public JSONArray getUnenrichedPosts(int limit) throws JSONException {
        JSONArray result = new JSONArray();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT p.id, p.postId, p.username, p.caption, p.fullCaption, " +
                "p.hashtags, p.imageAlts, p.allText, p.ocrText, p.mlkitLabels, " +
                "p.mediaType, p.isSponsored, p.isSuggested, p.imageUrls " +
                "FROM posts p LEFT JOIN post_enriched e ON e.postId = p.id " +
                "WHERE e.id IS NULL AND length(p.allText) > 10 " +
                "ORDER BY p.createdAt DESC LIMIT ?",
                new String[]{String.valueOf(limit)});
        while (c.moveToNext()) {
            JSONObject post = new JSONObject();
            post.put("id", c.getString(c.getColumnIndexOrThrow("id")));
            post.put("postId", c.getString(c.getColumnIndexOrThrow("postId")));
            post.put("username", c.getString(c.getColumnIndexOrThrow("username")));
            post.put("caption", c.getString(c.getColumnIndexOrThrow("caption")));
            post.put("fullCaption", c.getString(c.getColumnIndexOrThrow("fullCaption")));
            post.put("hashtags", c.getString(c.getColumnIndexOrThrow("hashtags")));
            post.put("imageAlts", c.getString(c.getColumnIndexOrThrow("imageAlts")));
            post.put("allText", c.getString(c.getColumnIndexOrThrow("allText")));
            post.put("ocrText", c.getString(c.getColumnIndexOrThrow("ocrText")));
            post.put("mlkitLabels", c.getString(c.getColumnIndexOrThrow("mlkitLabels")));
            post.put("mediaType", c.getString(c.getColumnIndexOrThrow("mediaType")));
            post.put("isSponsored", c.getInt(c.getColumnIndexOrThrow("isSponsored")) == 1);
            post.put("isSuggested", c.getInt(c.getColumnIndexOrThrow("isSuggested")) == 1);
            post.put("imageUrls", c.getString(c.getColumnIndexOrThrow("imageUrls")));
            result.put(post);
        }
        c.close();
        return result;
    }

    public JSONArray getRulesOnlyPosts(int limit) throws JSONException {
        JSONArray result = new JSONArray();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT p.id, p.postId, p.username, p.caption, p.fullCaption, " +
                "p.hashtags, p.imageAlts, p.allText, p.ocrText, p.mlkitLabels, " +
                "p.mediaType, p.isSponsored, p.isSuggested, p.imageUrls, p.videoUrl " +
                "FROM posts p INNER JOIN post_enriched e ON e.postId = p.id " +
                "WHERE (e.provider = 'rules' OR e.provider = 'skipped') " +
                "AND length(p.allText) > 10 " +
                "ORDER BY p.createdAt DESC LIMIT ?",
                new String[]{String.valueOf(limit)});
        while (c.moveToNext()) {
            JSONObject post = new JSONObject();
            post.put("id", c.getString(c.getColumnIndexOrThrow("id")));
            post.put("postId", c.getString(c.getColumnIndexOrThrow("postId")));
            post.put("username", c.getString(c.getColumnIndexOrThrow("username")));
            post.put("caption", c.getString(c.getColumnIndexOrThrow("caption")));
            post.put("fullCaption", c.getString(c.getColumnIndexOrThrow("fullCaption")));
            post.put("hashtags", c.getString(c.getColumnIndexOrThrow("hashtags")));
            post.put("imageAlts", c.getString(c.getColumnIndexOrThrow("imageAlts")));
            post.put("allText", c.getString(c.getColumnIndexOrThrow("allText")));
            post.put("ocrText", c.getString(c.getColumnIndexOrThrow("ocrText")));
            post.put("mlkitLabels", c.getString(c.getColumnIndexOrThrow("mlkitLabels")));
            post.put("mediaType", c.getString(c.getColumnIndexOrThrow("mediaType")));
            post.put("isSponsored", c.getInt(c.getColumnIndexOrThrow("isSponsored")) == 1);
            post.put("isSuggested", c.getInt(c.getColumnIndexOrThrow("isSuggested")) == 1);
            post.put("imageUrls", c.getString(c.getColumnIndexOrThrow("imageUrls")));
            result.put(post);
        }
        c.close();
        return result;
    }

    /**
     * Deduplicate existing posts: keep the one with highest dwellTimeMs,
     * aggregate seenCount, delete the rest. Sponsored posts are not deduped.
     * Returns number of duplicates removed.
     */
    public int deduplicatePosts() {
        SQLiteDatabase db = getWritableDatabase();
        // Find groups of duplicates (same username + first 100 chars of allText)
        Cursor groups = db.rawQuery(
                "SELECT username, substr(allText,1,100) as txtKey, COUNT(*) as cnt " +
                "FROM posts WHERE isSponsored = 0 AND length(allText) > 10 " +
                "GROUP BY username, substr(allText,1,100) HAVING cnt > 1", null);
        int totalRemoved = 0;
        while (groups.moveToNext()) {
            String user = groups.getString(0);
            String txtKey = groups.getString(1);
            // Get all dupes, ordered by dwellTimeMs DESC (keep the best)
            Cursor dupes = db.rawQuery(
                    "SELECT id, seenCount, dwellTimeMs FROM posts " +
                    "WHERE username = ? AND substr(allText,1,100) = ? AND isSponsored = 0 " +
                    "ORDER BY dwellTimeMs DESC",
                    new String[]{user, txtKey});
            boolean first = true;
            String keepId = null;
            int totalSeen = 0;
            int maxDwell = 0;
            List<String> deleteIds = new ArrayList<>();
            while (dupes.moveToNext()) {
                String id = dupes.getString(0);
                int seen = dupes.getInt(1);
                int dwell = dupes.getInt(2);
                totalSeen += seen;
                maxDwell = Math.max(maxDwell, dwell);
                if (first) { keepId = id; first = false; }
                else deleteIds.add(id);
            }
            dupes.close();
            if (keepId != null && !deleteIds.isEmpty()) {
                // Update keeper with aggregated stats
                ContentValues upd = new ContentValues();
                upd.put("seenCount", totalSeen);
                upd.put("dwellTimeMs", maxDwell);
                upd.put("attentionLevel", classifyAttention(maxDwell));
                db.update("posts", upd, "id = ?", new String[]{keepId});
                // Delete duplicates + their enrichments/observations
                for (String delId : deleteIds) {
                    db.delete("post_enriched", "postId = ?", new String[]{delId});
                    db.delete("observations", "postId = ?", new String[]{delId});
                    db.delete("posts", "id = ?", new String[]{delId});
                    totalRemoved++;
                }
            }
        }
        groups.close();
        Log.i(TAG, "Dedup: removed " + totalRemoved + " duplicate posts");
        return totalRemoved;
    }

    public int countUnenrichedPosts() {
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT COUNT(*) FROM posts p LEFT JOIN post_enriched e ON e.postId = p.id " +
                "WHERE e.id IS NULL AND length(p.allText) > 10", null);
        c.moveToFirst();
        int count = c.getInt(0);
        c.close();
        return count;
    }

    /**
     * Insert or update enrichment with extended LLM fields.
     * Supports both rules-only and LLM-enriched data.
     */
    public void upsertEnrichment(String dbPostId, JSONObject enrichment) {
        long now = System.currentTimeMillis();

        ContentValues cv = new ContentValues();
        cv.put("postId", dbPostId);
        cv.put("provider", enrichment.optString("provider", "rules"));
        cv.put("model", enrichment.optString("model", "rules-v1"));
        cv.put("normalizedText", enrichment.optString("normalizedText", ""));
        cv.put("mainTopics", jsonArrayToString(enrichment, "mainTopics"));
        cv.put("secondaryTopics", jsonArrayToString(enrichment, "secondaryTopics"));
        cv.put("politicalActors", jsonArrayToString(enrichment, "politicalActors"));
        cv.put("institutions", jsonArrayToString(enrichment, "institutions"));
        cv.put("politicalExplicitnessScore", enrichment.optInt("politicalExplicitnessScore", 0));
        cv.put("politicalIssueTags", jsonArrayToString(enrichment, "politicalIssueTags"));
        cv.put("polarizationScore", enrichment.optDouble("polarizationScore", 0));
        cv.put("ingroupOutgroupSignal", enrichment.optBoolean("ingroupOutgroupSignal", false) ? 1 : 0);
        cv.put("conflictSignal", enrichment.optBoolean("conflictSignal", false) ? 1 : 0);
        cv.put("moralAbsoluteSignal", enrichment.optBoolean("moralAbsoluteSignal", false) ? 1 : 0);
        cv.put("enemyDesignationSignal", enrichment.optBoolean("enemyDesignationSignal", false) ? 1 : 0);
        cv.put("activismSignal", enrichment.optBoolean("activismSignal", false) ? 1 : 0);
        cv.put("axisEconomic", enrichment.optDouble("axisEconomic", 0));
        cv.put("axisSocietal", enrichment.optDouble("axisSocietal", 0));
        cv.put("axisAuthority", enrichment.optDouble("axisAuthority", 0));
        cv.put("axisSystem", enrichment.optDouble("axisSystem", 0));
        cv.put("dominantAxis", enrichment.optString("dominantAxis", ""));
        cv.put("mediaCategory", enrichment.optString("mediaCategory", ""));
        cv.put("mediaQuality", enrichment.optString("mediaQuality", ""));
        cv.put("confidenceScore", enrichment.optDouble("confidenceScore", 0));
        // LLM-specific fields
        cv.put("tone", enrichment.optString("tone", ""));
        cv.put("semanticSummary", enrichment.optString("semanticSummary", ""));
        cv.put("primaryEmotion", enrichment.optString("primaryEmotion", ""));
        cv.put("narrativeFrame", enrichment.optString("narrativeFrame", ""));
        cv.put("domains", jsonArrayToString(enrichment, "domains"));
        cv.put("subjects", jsonArrayToString(enrichment, "subjects"));
        cv.put("preciseSubjects", jsonArrayToString(enrichment, "preciseSubjects"));
        cv.put("updatedAt", now);

        // Try update first, insert if not found
        int rows = getWritableDatabase().update("post_enriched", cv,
                "postId = ?", new String[]{dbPostId});
        if (rows == 0) {
            String id = "e_" + now + "_" + dbPostId.hashCode();
            cv.put("id", id);
            cv.put("createdAt", now);
            getWritableDatabase().insertWithOnConflict("post_enriched", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
        }
    }

    /**
     * Delete enrichments with empty mainTopics (broken by imageAlts bug).
     * Returns number of rows deleted.
     */
    public int purgeEmptyEnrichments() {
        // Purge enrichments missing LLM data (no tone = never processed by LLM)
        int deleted = getWritableDatabase().delete("post_enriched",
                "tone IS NULL OR tone = '' OR mainTopics IS NULL OR mainTopics = '[]' OR mainTopics = ''", null);
        Log.i(TAG, "Purged " + deleted + " enrichments (no LLM data)");
        return deleted;
    }

    /**
     * Delete ALL enrichments to force re-enrichment with updated rules.
     * Returns number of rows deleted.
     */
    public int resetAllEnrichments() {
        int deleted = getWritableDatabase().delete("post_enriched", null, null);
        Log.i(TAG, "Reset ALL enrichments: " + deleted + " rows deleted");
        return deleted;
    }

    // ── Knowledge Graph CRUD ────────────────────────────────────

    /**
     * Resolve an entity: find by canonicalName or alias, or create.
     * Returns the entity ID.
     */
    public String resolveEntity(String name, String type) {
        String canonical = canonicalize(name);
        if (canonical.isEmpty()) return null;

        SQLiteDatabase rdb = getReadableDatabase();

        // 1. Exact match
        Cursor c1 = rdb.rawQuery("SELECT id FROM knowledge_entities WHERE canonicalName = ?",
                new String[]{canonical});
        if (c1.moveToFirst()) {
            String id = c1.getString(0);
            c1.close();
            return id;
        }
        c1.close();

        // 2. Alias match
        Cursor c2 = rdb.rawQuery("SELECT id FROM knowledge_entities WHERE type = ? AND aliases LIKE ?",
                new String[]{type, "%\"" + canonical + "\"%"});
        if (c2.moveToFirst()) {
            String id = c2.getString(0);
            c2.close();
            return id;
        }
        c2.close();

        // 3. Create
        long now = System.currentTimeMillis();
        String id = "ke_" + now + "_" + canonical.hashCode();
        ContentValues cv = new ContentValues();
        cv.put("id", id);
        cv.put("canonicalName", canonical);
        cv.put("type", type);
        cv.put("aliases", "[\"" + name.trim().toLowerCase() + "\"]");
        cv.put("createdAt", now);
        cv.put("updatedAt", now);
        getWritableDatabase().insertWithOnConflict("knowledge_entities", null, cv, SQLiteDatabase.CONFLICT_IGNORE);
        return id;
    }

    /**
     * Save a batch of observations for a post and update entity mention counts.
     */
    public void saveObservations(String postId, JSONArray observations) throws JSONException {
        SQLiteDatabase wdb = getWritableDatabase();
        long now = System.currentTimeMillis();
        Set<String> entityIds = new LinkedHashSet<>();

        wdb.beginTransaction();
        try {
            for (int i = 0; i < observations.length(); i++) {
                JSONObject obs = observations.getJSONObject(i);
                String entityName = obs.optString("entityName", "");
                String entityType = obs.optString("entityType", "");
                if (entityName.isEmpty() || entityType.isEmpty()) continue;

                String entityId = resolveEntity(entityName, entityType);
                if (entityId == null) continue;
                entityIds.add(entityId);

                String id = "obs_" + now + "_" + i + "_" + postId.hashCode();
                ContentValues cv = new ContentValues();
                cv.put("id", id);
                cv.put("postId", postId);
                cv.put("entityId", entityId);
                cv.put("relation", obs.optString("relation", "mentions"));
                cv.put("stance", obs.optString("stance", ""));
                cv.put("intensity", obs.optDouble("intensity", 0));
                cv.put("confidence", obs.optDouble("confidence", 0));
                cv.put("evidence", obs.optString("evidence", ""));
                cv.put("source", obs.optString("source", "rules"));
                cv.put("createdAt", now);
                wdb.insertWithOnConflict("observations", null, cv, SQLiteDatabase.CONFLICT_IGNORE);
            }

            // Update mention counts
            for (String entityId : entityIds) {
                wdb.execSQL("UPDATE knowledge_entities SET mentionCount = mentionCount + 1, " +
                        "lastSeenAt = ?, updatedAt = ? WHERE id = ?",
                        new Object[]{now, now, entityId});
            }

            wdb.setTransactionSuccessful();
        } finally {
            wdb.endTransaction();
        }
    }

    /**
     * Get enriched posts that have no observations yet (for backfill).
     */
    public JSONArray getEnrichedPostsWithoutGraph(int limit) throws JSONException {
        JSONArray result = new JSONArray();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT e.postId, e.mainTopics, e.secondaryTopics, e.subjects, " +
                "e.preciseSubjects, e.politicalActors, e.institutions, " +
                "e.narrativeFrame, e.primaryEmotion, e.tone, e.confidenceScore, " +
                "e.provider, e.domains " +
                "FROM post_enriched e " +
                "LEFT JOIN observations o ON o.postId = e.postId " +
                "WHERE o.id IS NULL " +
                "LIMIT ?",
                new String[]{String.valueOf(limit)});
        while (c.moveToNext()) {
            JSONObject row = new JSONObject();
            row.put("postId", c.getString(0));
            row.put("mainTopics", c.getString(1));
            row.put("secondaryTopics", c.getString(2));
            row.put("subjects", c.getString(3));
            row.put("preciseSubjects", c.getString(4));
            row.put("politicalActors", c.getString(5));
            row.put("institutions", c.getString(6));
            row.put("narrativeFrame", c.getString(7));
            row.put("primaryEmotion", c.getString(8));
            row.put("tone", c.getString(9));
            row.put("confidenceScore", c.getDouble(10));
            row.put("provider", c.getString(11));
            row.put("domains", c.getString(12));
            result.put(row);
        }
        c.close();
        return result;
    }

    /**
     * Check if a post already has observations in the graph.
     */
    public boolean hasObservations(String postId) {
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT 1 FROM observations WHERE postId = ? LIMIT 1", new String[]{postId});
        boolean has = c.moveToFirst();
        c.close();
        return has;
    }

    /**
     * Get knowledge graph stats for the UI.
     */
    public JSONObject getGraphStats() throws JSONException {
        JSONObject stats = new JSONObject();
        SQLiteDatabase db = getReadableDatabase();

        // Total counts
        Cursor c1 = db.rawQuery("SELECT COUNT(*) FROM knowledge_entities", null);
        c1.moveToFirst(); stats.put("totalEntities", c1.getInt(0)); c1.close();

        Cursor c2 = db.rawQuery("SELECT COUNT(*) FROM observations", null);
        c2.moveToFirst(); stats.put("totalObservations", c2.getInt(0)); c2.close();

        Cursor c3 = db.rawQuery("SELECT COUNT(DISTINCT postId) FROM observations", null);
        c3.moveToFirst(); stats.put("postsInGraph", c3.getInt(0)); c3.close();

        // Entity type distribution
        JSONArray typeDistrib = new JSONArray();
        Cursor ct = db.rawQuery("SELECT type, COUNT(*) as c FROM knowledge_entities GROUP BY type ORDER BY c DESC", null);
        while (ct.moveToNext()) {
            JSONObject item = new JSONObject();
            item.put("type", ct.getString(0));
            item.put("count", ct.getInt(1));
            typeDistrib.put(item);
        }
        ct.close();
        stats.put("entityTypes", typeDistrib);

        // Relation distribution
        JSONArray relDistrib = new JSONArray();
        Cursor cr = db.rawQuery("SELECT relation, COUNT(*) as c FROM observations GROUP BY relation ORDER BY c DESC", null);
        while (cr.moveToNext()) {
            JSONObject item = new JSONObject();
            item.put("relation", cr.getString(0));
            item.put("count", cr.getInt(1));
            relDistrib.put(item);
        }
        cr.close();
        stats.put("relationTypes", relDistrib);

        // Top entities by mentions
        JSONArray topEntities = new JSONArray();
        Cursor cTop = db.rawQuery(
                "SELECT canonicalName, type, mentionCount FROM knowledge_entities " +
                "ORDER BY mentionCount DESC LIMIT 20", null);
        while (cTop.moveToNext()) {
            JSONObject item = new JSONObject();
            item.put("name", cTop.getString(0));
            item.put("type", cTop.getString(1));
            item.put("mentions", cTop.getInt(2));
            topEntities.put(item);
        }
        cTop.close();
        stats.put("topEntities", topEntities);

        // Co-occurrences (entities seen together in the same post, ≥2 times)
        JSONArray coOccurrences = new JSONArray();
        Cursor cCo = db.rawQuery(
                "SELECT ke1.canonicalName as e1, ke1.type as t1, " +
                "ke2.canonicalName as e2, ke2.type as t2, COUNT(*) as co " +
                "FROM observations o1 " +
                "JOIN observations o2 ON o1.postId = o2.postId AND o1.entityId < o2.entityId " +
                "JOIN knowledge_entities ke1 ON o1.entityId = ke1.id " +
                "JOIN knowledge_entities ke2 ON o2.entityId = ke2.id " +
                "WHERE ke1.type NOT IN ('Audience', 'Emotion') " +
                "AND ke2.type NOT IN ('Audience', 'Emotion') " +
                "GROUP BY o1.entityId, o2.entityId " +
                "HAVING co >= 2 " +
                "ORDER BY co DESC LIMIT 20", null);
        while (cCo.moveToNext()) {
            JSONObject item = new JSONObject();
            item.put("entity1", cCo.getString(0));
            item.put("type1", cCo.getString(1));
            item.put("entity2", cCo.getString(2));
            item.put("type2", cCo.getString(3));
            item.put("count", cCo.getInt(4));
            coOccurrences.put(item);
        }
        cCo.close();
        stats.put("coOccurrences", coOccurrences);

        // Entities by type with top members
        JSONArray entityGroups = new JSONArray();
        Cursor cGroups = db.rawQuery(
                "SELECT type FROM knowledge_entities GROUP BY type ORDER BY COUNT(*) DESC", null);
        while (cGroups.moveToNext()) {
            String type = cGroups.getString(0);
            JSONObject group = new JSONObject();
            group.put("type", type);
            JSONArray members = new JSONArray();
            Cursor cMembers = db.rawQuery(
                    "SELECT canonicalName, mentionCount FROM knowledge_entities " +
                    "WHERE type = ? ORDER BY mentionCount DESC LIMIT 10",
                    new String[]{type});
            while (cMembers.moveToNext()) {
                JSONObject m = new JSONObject();
                m.put("name", cMembers.getString(0));
                m.put("mentions", cMembers.getInt(1));
                members.put(m);
            }
            cMembers.close();
            group.put("members", members);
            entityGroups.put(group);
        }
        cGroups.close();
        stats.put("entityGroups", entityGroups);

        // Stance distribution (for takesPosition observations)
        JSONArray stanceDistrib = new JSONArray();
        Cursor cStance = db.rawQuery(
                "SELECT stance, COUNT(*) as c FROM observations " +
                "WHERE relation = 'takesPosition' AND stance != '' " +
                "GROUP BY stance ORDER BY c DESC", null);
        while (cStance.moveToNext()) {
            JSONObject item = new JSONObject();
            item.put("stance", cStance.getString(0));
            item.put("count", cStance.getInt(1));
            stanceDistrib.put(item);
        }
        cStance.close();
        stats.put("stanceDistribution", stanceDistrib);

        // Total edges
        Cursor cEdges = db.rawQuery("SELECT COUNT(*) FROM knowledge_edges", null);
        cEdges.moveToFirst(); stats.put("totalEdges", cEdges.getInt(0)); cEdges.close();

        // ── Graph nodes + edges for force-directed visualization ──
        // Nodes: top 40 entities by mentions (exclude Audience)
        JSONArray graphNodes = new JSONArray();
        Cursor cNodes = db.rawQuery(
                "SELECT id, canonicalName, type, mentionCount FROM knowledge_entities " +
                "WHERE type != 'Audience' AND mentionCount > 0 " +
                "ORDER BY mentionCount DESC LIMIT 40", null);
        Set<String> nodeIds = new LinkedHashSet<>();
        while (cNodes.moveToNext()) {
            JSONObject n = new JSONObject();
            n.put("id", cNodes.getString(0));
            n.put("name", cNodes.getString(1));
            n.put("type", cNodes.getString(2));
            n.put("mentions", cNodes.getInt(3));
            graphNodes.put(n);
            nodeIds.add(cNodes.getString(0));
        }
        cNodes.close();
        stats.put("graphNodes", graphNodes);

        // Edges: structural edges between visible nodes + co-occurrence edges
        JSONArray graphEdges = new JSONArray();
        // Structural edges from knowledge_edges
        if (!nodeIds.isEmpty()) {
            Cursor cGE = db.rawQuery(
                    "SELECT ke.sourceId, ke.targetId, ke.relation, ke.weight " +
                    "FROM knowledge_edges ke " +
                    "WHERE ke.sourceId IN (SELECT id FROM knowledge_entities WHERE mentionCount > 0) " +
                    "AND ke.targetId IN (SELECT id FROM knowledge_entities WHERE mentionCount > 0)", null);
            while (cGE.moveToNext()) {
                String src = cGE.getString(0);
                String tgt = cGE.getString(1);
                if (nodeIds.contains(src) && nodeIds.contains(tgt)) {
                    JSONObject e = new JSONObject();
                    e.put("source", src);
                    e.put("target", tgt);
                    e.put("relation", cGE.getString(2));
                    e.put("weight", cGE.getDouble(3));
                    graphEdges.put(e);
                }
            }
            cGE.close();
        }
        // Co-occurrence edges (entities seen in same posts ≥2 times)
        Cursor cCoEdge = db.rawQuery(
                "SELECT o1.entityId, o2.entityId, COUNT(*) as co " +
                "FROM observations o1 " +
                "JOIN observations o2 ON o1.postId = o2.postId AND o1.entityId < o2.entityId " +
                "JOIN knowledge_entities ke1 ON o1.entityId = ke1.id " +
                "JOIN knowledge_entities ke2 ON o2.entityId = ke2.id " +
                "WHERE ke1.type NOT IN ('Audience', 'Emotion') " +
                "AND ke2.type NOT IN ('Audience', 'Emotion') " +
                "GROUP BY o1.entityId, o2.entityId HAVING co >= 2 " +
                "ORDER BY co DESC LIMIT 60", null);
        while (cCoEdge.moveToNext()) {
            String src = cCoEdge.getString(0);
            String tgt = cCoEdge.getString(1);
            if (nodeIds.contains(src) && nodeIds.contains(tgt)) {
                JSONObject e = new JSONObject();
                e.put("source", src);
                e.put("target", tgt);
                e.put("relation", "coOccurrence");
                e.put("weight", cCoEdge.getInt(2));
                graphEdges.put(e);
            }
        }
        cCoEdge.close();
        stats.put("graphEdges", graphEdges);

        // ── Timeline: entity mentions grouped by week ──
        JSONArray timeline = new JSONArray();
        Cursor cTL = db.rawQuery(
                "SELECT strftime('%Y-W%W', o.createdAt / 1000, 'unixepoch') as week, " +
                "ke.canonicalName, COUNT(*) as cnt " +
                "FROM observations o " +
                "JOIN knowledge_entities ke ON o.entityId = ke.id " +
                "WHERE ke.type NOT IN ('Audience', 'Emotion') " +
                "GROUP BY week, ke.canonicalName " +
                "ORDER BY week DESC, cnt DESC", null);
        // Pivot: group by week
        Map<String, JSONArray> weekMap = new LinkedHashMap<>();
        while (cTL.moveToNext()) {
            String week = cTL.getString(0);
            JSONArray ents = weekMap.get(week);
            if (ents == null) { ents = new JSONArray(); weekMap.put(week, ents); }
            if (ents.length() < 8) { // top 8 per week
                JSONObject item = new JSONObject();
                item.put("name", cTL.getString(1));
                item.put("count", cTL.getInt(2));
                ents.put(item);
            }
        }
        cTL.close();
        for (Map.Entry<String, JSONArray> entry : weekMap.entrySet()) {
            JSONObject weekObj = new JSONObject();
            weekObj.put("week", entry.getKey());
            weekObj.put("entities", entry.getValue());
            timeline.put(weekObj);
        }
        stats.put("timeline", timeline);

        return stats;
    }

    /**
     * Save structural edges from the ontology (Person→Org, Theme→Domain, etc.)
     */
    public void saveStructuralEdges(JSONArray edges) throws JSONException {
        SQLiteDatabase wdb = getWritableDatabase();
        long now = System.currentTimeMillis();
        int saved = 0;

        wdb.beginTransaction();
        try {
            for (int i = 0; i < edges.length(); i++) {
                JSONObject edge = edges.getJSONObject(i);
                String srcName = edge.optString("sourceCanonical", "");
                String srcType = edge.optString("sourceType", "");
                String tgtName = edge.optString("targetCanonical", "");
                String tgtType = edge.optString("targetType", "");
                String relation = edge.optString("relation", "");
                double weight = edge.optDouble("weight", 1.0);

                if (srcName.isEmpty() || tgtName.isEmpty() || relation.isEmpty()) continue;

                // Resolve or create source entity
                String srcId = resolveEntity(srcName, srcType);
                String tgtId = resolveEntity(tgtName, tgtType);
                if (srcId == null || tgtId == null) continue;

                // Insert edge (IGNORE conflict = skip duplicates)
                String edgeId = "se_" + now + "_" + i;
                ContentValues cv = new ContentValues();
                cv.put("id", edgeId);
                cv.put("sourceId", srcId);
                cv.put("targetId", tgtId);
                cv.put("relation", relation);
                cv.put("weight", weight);
                cv.put("createdAt", now);
                wdb.insertWithOnConflict("knowledge_edges", null, cv, SQLiteDatabase.CONFLICT_IGNORE);
                saved++;
            }
            wdb.setTransactionSuccessful();
        } finally {
            wdb.endTransaction();
        }
        Log.i(TAG, "Saved " + saved + " structural edges");
    }

    private static String canonicalize(String name) {
        if (name == null) return "";
        String normalized = Normalizer.normalize(name.trim().toLowerCase(), Normalizer.Form.NFD);
        return normalized.replaceAll("\\p{M}", "").replaceAll("\\s+", " ");
    }

    // ── Helpers ──────────────────────────────────────────────────

    private String findPostDbId(String postId) {
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT id FROM posts WHERE postId = ? ORDER BY createdAt DESC LIMIT 1",
                new String[]{postId});
        String result = null;
        if (c.moveToFirst()) result = c.getString(0);
        c.close();
        return result;
    }

    private static final class ThemeBucket {
        final String themeId;
        final String themeLabel;
        final String source;
        int postCount = 0;
        long totalDwellTimeMs = 0;
        double attentionSum = 0;
        int engagedCount = 0;
        double politicalSum = 0;
        int politicalCount = 0;
        double polarizationSum = 0;
        int polarizationCount = 0;
        double confidenceSum = 0;
        int confidenceCount = 0;
        int enrichedPostCount = 0;
        final List<String> samplePostIds = new ArrayList<>();
        final Set<String> sampleUsers = new LinkedHashSet<>();

        ThemeBucket(String themeId, String themeLabel, String source) {
            this.themeId = themeId;
            this.themeLabel = themeLabel;
            this.source = source;
        }
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private static int resolveAttentionScore(String attentionLevel, int dwellTimeMs) {
        if ("skipped".equals(attentionLevel)) return 0;
        if ("glanced".equals(attentionLevel)) return 33;
        if ("viewed".equals(attentionLevel)) return 66;
        if ("engaged".equals(attentionLevel)) return 100;
        return attentionScoreFromDwell(dwellTimeMs);
    }

    private static int attentionScoreFromDwell(int dwellTimeMs) {
        if (dwellTimeMs < 500) return 0;
        if (dwellTimeMs < 2000) return 33;
        if (dwellTimeMs < 5000) return 66;
        return 100;
    }

    private static String firstTopicFromJson(String json) {
        if (json == null || json.trim().isEmpty()) return "";
        try {
            JSONArray arr = new JSONArray(json);
            if (arr.length() == 0) return "";
            String first = arr.optString(0, "");
            return first == null ? "" : first.trim();
        } catch (Exception ignored) {
            return "";
        }
    }

    private static String normalizeThemeId(String label) {
        String normalized = Normalizer.normalize(label == null ? "" : label.trim().toLowerCase(), Normalizer.Form.NFKD)
                .replaceAll("\\p{M}", "")
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return normalized.isEmpty() ? "non-classe" : normalized;
    }

    private JSONObject cursorToPostJson(Cursor c) throws JSONException {
        JSONObject post = new JSONObject();
        post.put("id", c.getString(c.getColumnIndexOrThrow("id")));
        post.put("sessionId", c.getString(c.getColumnIndexOrThrow("sessionId")));
        post.put("postId", c.getString(c.getColumnIndexOrThrow("postId")));
        post.put("username", c.getString(c.getColumnIndexOrThrow("username")));
        post.put("caption", c.getString(c.getColumnIndexOrThrow("caption")));
        post.put("mediaType", c.getString(c.getColumnIndexOrThrow("mediaType")));
        post.put("likeCount", c.getInt(c.getColumnIndexOrThrow("likeCount")));
        post.put("isSponsored", c.getInt(c.getColumnIndexOrThrow("isSponsored")) == 1);
        post.put("isSuggested", c.getInt(c.getColumnIndexOrThrow("isSuggested")) == 1);
        post.put("dwellTimeMs", c.getInt(c.getColumnIndexOrThrow("dwellTimeMs")));
        post.put("attentionLevel", c.getString(c.getColumnIndexOrThrow("attentionLevel")));
        post.put("allText", c.getString(c.getColumnIndexOrThrow("allText")));
        post.put("seenCount", c.getInt(c.getColumnIndexOrThrow("seenCount")));

        // Enrichment fields (may be null if LEFT JOIN)
        int polIdx = c.getColumnIndex("politicalExplicitnessScore");
        if (polIdx >= 0 && !c.isNull(polIdx)) {
            JSONObject enrichment = new JSONObject();
            enrichment.put("politicalScore", c.getInt(polIdx));
            enrichment.put("polarizationScore", c.getDouble(c.getColumnIndex("polarizationScore")));
            enrichment.put("confidenceScore", c.getDouble(c.getColumnIndex("confidenceScore")));
            enrichment.put("mainTopics", c.getString(c.getColumnIndex("enrichTopics")));
            enrichment.put("axisEconomic", c.getDouble(c.getColumnIndex("axisEconomic")));
            enrichment.put("axisSocietal", c.getDouble(c.getColumnIndex("axisSocietal")));
            enrichment.put("axisAuthority", c.getDouble(c.getColumnIndex("axisAuthority")));
            enrichment.put("axisSystem", c.getDouble(c.getColumnIndex("axisSystem")));
            enrichment.put("dominantAxis", c.getString(c.getColumnIndex("dominantAxis")));
            enrichment.put("mediaCategory", c.getString(c.getColumnIndex("mediaCategory")));
            enrichment.put("mediaQuality", c.getString(c.getColumnIndex("mediaQuality")));
            // Extended LLM fields
            int toneIdx = c.getColumnIndex("enrichTone");
            if (toneIdx >= 0 && !c.isNull(toneIdx)) enrichment.put("tone", c.getString(toneIdx));
            int summaryIdx = c.getColumnIndex("semanticSummary");
            if (summaryIdx >= 0 && !c.isNull(summaryIdx)) enrichment.put("semanticSummary", c.getString(summaryIdx));
            int emotionIdx = c.getColumnIndex("primaryEmotion");
            if (emotionIdx >= 0 && !c.isNull(emotionIdx)) enrichment.put("primaryEmotion", c.getString(emotionIdx));
            int narrIdx = c.getColumnIndex("narrativeFrame");
            if (narrIdx >= 0 && !c.isNull(narrIdx)) enrichment.put("narrativeFrame", c.getString(narrIdx));
            int actorsIdx = c.getColumnIndex("enrichActors");
            if (actorsIdx >= 0 && !c.isNull(actorsIdx)) enrichment.put("politicalActors", c.getString(actorsIdx));
            int secTopicsIdx = c.getColumnIndex("enrichSecondaryTopics");
            if (secTopicsIdx >= 0 && !c.isNull(secTopicsIdx)) enrichment.put("secondaryTopics", c.getString(secTopicsIdx));
            int activismIdx = c.getColumnIndex("enrichActivism");
            if (activismIdx >= 0 && !c.isNull(activismIdx)) enrichment.put("activismSignal", c.getInt(activismIdx) == 1);
            int conflictIdx = c.getColumnIndex("enrichConflict");
            if (conflictIdx >= 0 && !c.isNull(conflictIdx)) enrichment.put("conflictSignal", c.getInt(conflictIdx) == 1);
            post.put("enrichment", enrichment);
        }

        return post;
    }

    private static String classifyAttention(int ms) {
        if (ms < 500) return "skipped";
        if (ms < 2000) return "glanced";
        if (ms < 5000) return "viewed";
        return "engaged";
    }

    private static int parseLikeCount(String raw) {
        if (raw == null || raw.isEmpty()) return 0;
        try {
            String cleaned = raw.replaceAll("[^\\d]", "");
            return cleaned.isEmpty() ? 0 : Integer.parseInt(cleaned);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /**
     * Parse JSON array strings from a column, aggregate counts, return top N.
     * E.g. mainTopics: '["culture","humour"]' → {topic: "culture", count: 15}
     */
    private JSONArray aggregateJsonArrayField(SQLiteDatabase db, String column, int limit) throws JSONException {
        java.util.Map<String, Integer> counts = new java.util.LinkedHashMap<>();
        Cursor c = db.rawQuery(
                "SELECT " + column + " FROM post_enriched WHERE " + column + " IS NOT NULL AND " + column + " != '[]'", null);
        while (c.moveToNext()) {
            String jsonStr = c.getString(0);
            try {
                JSONArray arr = new JSONArray(jsonStr);
                for (int i = 0; i < arr.length(); i++) {
                    String val = arr.getString(i).trim().toLowerCase();
                    if (!val.isEmpty()) {
                        counts.put(val, counts.getOrDefault(val, 0) + 1);
                    }
                }
            } catch (Exception ignored) {}
        }
        c.close();

        // Sort by count desc
        java.util.List<java.util.Map.Entry<String, Integer>> sorted = new java.util.ArrayList<>(counts.entrySet());
        sorted.sort((a, b) -> b.getValue() - a.getValue());

        JSONArray result = new JSONArray();
        int i = 0;
        // Use "topic" as generic key name for compat with frontend
        for (java.util.Map.Entry<String, Integer> entry : sorted) {
            if (i++ >= limit) break;
            JSONObject item = new JSONObject();
            item.put("topic", entry.getKey());
            item.put("count", entry.getValue());
            // Also add domain alias for topDomains compat
            item.put("domain", entry.getKey());
            result.put(item);
        }
        return result;
    }

    /**
     * Build rich subject insights: for each subject in a JSON-array column,
     * aggregate dwell time, attention breakdown, top accounts, dominant emotion/tone,
     * parent domains, and a sample caption snippet.
     */
    private JSONArray buildSubjectInsights(SQLiteDatabase db, String column, int limit) throws JSONException {
        // Step 1: collect per-subject data from all enriched posts
        java.util.Map<String, long[]> dwellMap = new java.util.LinkedHashMap<>(); // [totalDwell, count]
        java.util.Map<String, java.util.Map<String, Integer>> attentionMap = new java.util.LinkedHashMap<>();
        java.util.Map<String, java.util.Map<String, Integer>> accountMap = new java.util.LinkedHashMap<>();
        java.util.Map<String, java.util.Map<String, Integer>> emotionMap = new java.util.LinkedHashMap<>();
        java.util.Map<String, java.util.Map<String, Integer>> toneMap = new java.util.LinkedHashMap<>();
        java.util.Map<String, java.util.Map<String, Integer>> domainMap = new java.util.LinkedHashMap<>();
        java.util.Map<String, String> sampleCaption = new java.util.LinkedHashMap<>();
        java.util.Map<String, double[]> polMap = new java.util.LinkedHashMap<>(); // [sumPolitical, sumPolarization, count]
        java.util.Map<String, String> sampleSummary = new java.util.LinkedHashMap<>();

        Cursor c = db.rawQuery(
                "SELECT e." + column + ", p.dwellTimeMs, p.attentionLevel, p.username, " +
                "e.primaryEmotion, e.tone, e.domains, e.normalizedText, " +
                "e.politicalExplicitnessScore, e.polarizationScore, e.semanticSummary " +
                "FROM posts p JOIN post_enriched e ON e.postId = p.id " +
                "WHERE e." + column + " IS NOT NULL AND e." + column + " != '[]'", null);

        while (c.moveToNext()) {
            String jsonStr = c.getString(0);
            long dwell = c.getLong(1);
            String attention = c.getString(2) != null ? c.getString(2) : "";
            String username = c.getString(3) != null ? c.getString(3) : "";
            String emotion = c.getString(4) != null ? c.getString(4) : "";
            String tone = c.getString(5) != null ? c.getString(5) : "";
            String domainsJson = c.getString(6) != null ? c.getString(6) : "[]";
            String normalizedText = c.getString(7) != null ? c.getString(7) : "";
            double polScore = c.getDouble(8);
            double polarScore = c.getDouble(9);
            String summary = c.getString(10) != null ? c.getString(10) : "";

            try {
                JSONArray subjects = new JSONArray(jsonStr);
                for (int i = 0; i < subjects.length(); i++) {
                    String subj = subjects.getString(i).trim().toLowerCase();
                    if (subj.isEmpty()) continue;

                    // Dwell
                    long[] dv = dwellMap.getOrDefault(subj, new long[]{0, 0});
                    dv[0] += dwell;
                    dv[1]++;
                    dwellMap.put(subj, dv);

                    // Attention
                    java.util.Map<String, Integer> attMap = attentionMap.computeIfAbsent(subj, k -> new java.util.LinkedHashMap<>());
                    attMap.put(attention, attMap.getOrDefault(attention, 0) + 1);

                    // Accounts
                    if (!username.isEmpty()) {
                        java.util.Map<String, Integer> accMap = accountMap.computeIfAbsent(subj, k -> new java.util.LinkedHashMap<>());
                        accMap.put(username, accMap.getOrDefault(username, 0) + 1);
                    }

                    // Emotion
                    if (!emotion.isEmpty()) {
                        java.util.Map<String, Integer> emoMap = emotionMap.computeIfAbsent(subj, k -> new java.util.LinkedHashMap<>());
                        emoMap.put(emotion, emoMap.getOrDefault(emotion, 0) + 1);
                    }

                    // Tone
                    if (!tone.isEmpty()) {
                        java.util.Map<String, Integer> tnMap = toneMap.computeIfAbsent(subj, k -> new java.util.LinkedHashMap<>());
                        tnMap.put(tone, tnMap.getOrDefault(tone, 0) + 1);
                    }

                    // Domains
                    try {
                        JSONArray doms = new JSONArray(domainsJson);
                        java.util.Map<String, Integer> dmMap = domainMap.computeIfAbsent(subj, k -> new java.util.LinkedHashMap<>());
                        for (int d = 0; d < doms.length(); d++) {
                            String dom = doms.getString(d).trim().toLowerCase();
                            if (!dom.isEmpty()) dmMap.put(dom, dmMap.getOrDefault(dom, 0) + 1);
                        }
                    } catch (Exception ignored) {}

                    // Political scores
                    double[] pv = polMap.getOrDefault(subj, new double[]{0, 0, 0});
                    pv[0] += polScore;
                    pv[1] += polarScore;
                    pv[2]++;
                    polMap.put(subj, pv);

                    // Sample caption — use ONLY semanticSummary (normalizedText contains raw UI noise)
                    if (!summary.isEmpty() && summary.length() > (sampleCaption.getOrDefault(subj, "")).length()) {
                        sampleCaption.put(subj, summary.length() > 150 ? summary.substring(0, 150) + "..." : summary);
                    }

                    // Sample summary (keep first non-empty)
                    if (!summary.isEmpty() && !sampleSummary.containsKey(subj)) {
                        sampleSummary.put(subj, summary.length() > 150 ? summary.substring(0, 150) + "..." : summary);
                    }
                }
            } catch (Exception ignored) {}
        }
        c.close();

        // Step 2: sort by total dwell time desc
        java.util.List<java.util.Map.Entry<String, long[]>> sorted = new java.util.ArrayList<>(dwellMap.entrySet());
        sorted.sort((a, b) -> Long.compare(b.getValue()[0], a.getValue()[0]));

        // Step 3: build result array
        JSONArray result = new JSONArray();
        int idx = 0;
        for (java.util.Map.Entry<String, long[]> entry : sorted) {
            if (idx++ >= limit) break;
            String subj = entry.getKey();
            long totalDwell = entry.getValue()[0];
            long count = entry.getValue()[1];

            JSONObject item = new JSONObject();
            item.put("subject", subj);
            item.put("count", count);
            item.put("totalDwellMs", totalDwell);
            item.put("avgDwellMs", count > 0 ? totalDwell / count : 0);

            // Attention breakdown
            JSONObject attObj = new JSONObject();
            java.util.Map<String, Integer> att = attentionMap.getOrDefault(subj, java.util.Collections.emptyMap());
            for (java.util.Map.Entry<String, Integer> ae : att.entrySet()) {
                attObj.put(ae.getKey(), ae.getValue());
            }
            item.put("attention", attObj);

            // Top 3 accounts
            JSONArray topAccounts = new JSONArray();
            java.util.Map<String, Integer> accs = accountMap.getOrDefault(subj, java.util.Collections.emptyMap());
            accs.entrySet().stream()
                .sorted((a, b) -> b.getValue() - a.getValue())
                .limit(3)
                .forEach(ae -> {
                    try {
                        JSONObject ao = new JSONObject();
                        ao.put("username", ae.getKey());
                        ao.put("count", ae.getValue());
                        topAccounts.put(ao);
                    } catch (Exception ignored) {}
                });
            item.put("topAccounts", topAccounts);

            // Dominant emotion
            String domEmotion = emotionMap.getOrDefault(subj, java.util.Collections.emptyMap())
                .entrySet().stream().max(java.util.Map.Entry.comparingByValue())
                .map(java.util.Map.Entry::getKey).orElse("");
            item.put("dominantEmotion", domEmotion);

            // Dominant tone
            String domTone = toneMap.getOrDefault(subj, java.util.Collections.emptyMap())
                .entrySet().stream().max(java.util.Map.Entry.comparingByValue())
                .map(java.util.Map.Entry::getKey).orElse("");
            item.put("dominantTone", domTone);

            // Parent domains
            JSONArray domsArr = new JSONArray();
            domainMap.getOrDefault(subj, java.util.Collections.emptyMap())
                .entrySet().stream().sorted((a, b) -> b.getValue() - a.getValue()).limit(2)
                .forEach(de -> domsArr.put(de.getKey()));
            item.put("domains", domsArr);

            // Political averages
            double[] pv = polMap.getOrDefault(subj, new double[]{0, 0, 0});
            if (pv[2] > 0) {
                item.put("avgPoliticalScore", Math.round(pv[0] / pv[2] * 100.0) / 100.0);
                item.put("avgPolarization", Math.round(pv[1] / pv[2] * 100.0) / 100.0);
            }

            // Sample caption & summary
            item.put("sampleCaption", sampleCaption.getOrDefault(subj, ""));
            item.put("sampleSummary", sampleSummary.getOrDefault(subj, ""));

            result.put(item);
        }
        return result;
    }

    /**
     * Extract a JSON array field as string.
     * Handles both JSONArray and pre-stringified JSON array values.
     */
    private static String jsonArrayToString(JSONObject obj, String key) {
        // Try as JSONArray first
        JSONArray arr = obj.optJSONArray(key);
        if (arr != null) return arr.toString();
        // Might be a pre-stringified JSON array (e.g. "[\"culture\"]")
        String str = obj.optString(key, "[]");
        if (str.startsWith("[")) return str;
        return "[]";
    }

    /**
     * Execute a DB operation on the background executor.
     */
    public void runAsync(Runnable task) {
        executor.execute(() -> {
            try {
                task.run();
            } catch (Exception e) {
                Log.e(TAG, "Async DB error: " + e.getMessage(), e);
            }
        });
    }
}
