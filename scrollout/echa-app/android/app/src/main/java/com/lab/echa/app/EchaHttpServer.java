package com.lab.echa.app;

import android.content.Context;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Map;

import fi.iki.elonen.NanoHTTPD;

/**
 * EchaHttpServer — HTTP REST API embarqué pour sync PC.
 * Expose les données SQLite via endpoints REST.
 * Port par défaut : 8765
 */
public class EchaHttpServer extends NanoHTTPD {

    private static final String TAG = "EchaHTTP";
    private final EchaDatabase db;

    public EchaHttpServer(Context context, int port) {
        super(port);
        this.db = EchaDatabase.getInstance(context);
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        Method method = session.getMethod();
        Map<String, String> params = session.getParms();

        // CORS headers
        Response response;
        try {
            response = route(uri, method, params);
        } catch (Exception e) {
            Log.e(TAG, "Error handling " + uri + ": " + e.getMessage());
            response = jsonResponse(Response.Status.INTERNAL_ERROR,
                    "{\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}");
        }

        response.addHeader("Access-Control-Allow-Origin", "*");
        response.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response.addHeader("Access-Control-Allow-Headers", "Content-Type");

        if (method == Method.OPTIONS) {
            return newFixedLengthResponse(Response.Status.OK, "text/plain", "");
        }

        return response;
    }

    private Response route(String uri, Method method, Map<String, String> params) throws Exception {
        // Health check
        if (uri.equals("/api/health")) {
            return jsonResponse(Response.Status.OK, "{\"status\":\"ok\",\"source\":\"mobile\"}");
        }

        // Sessions list
        if (uri.equals("/api/sessions")) {
            JSONArray sessions = db.getSessions();
            return jsonResponse(Response.Status.OK, sessions.toString());
        }

        // Posts by session
        if (uri.matches("/api/sessions/[^/]+/posts")) {
            String sessionId = uri.split("/")[3];
            int offset = parseInt(params.get("offset"), 0);
            int limit = parseInt(params.get("limit"), 50);
            JSONArray posts = db.getPostsBySession(sessionId, offset, limit);
            return jsonResponse(Response.Status.OK, posts.toString());
        }

        // Global stats
        if (uri.equals("/api/stats")) {
            JSONObject stats = db.getStats();
            return jsonResponse(Response.Status.OK, stats.toString());
        }

        // Export full session
        if (uri.matches("/api/export/[^/]+")) {
            String sessionId = uri.split("/")[3];
            JSONObject export_ = db.exportSessionAsJson(sessionId);
            return jsonResponse(Response.Status.OK, export_.toString());
        }

        // All posts (across sessions) — for enrichment sync
        if (uri.equals("/api/posts")) {
            int offset = parseInt(params.get("offset"), 0);
            int limit = parseInt(params.get("limit"), 100);
            // Get all sessions and aggregate posts
            JSONArray allPosts = new JSONArray();
            JSONArray sessions = db.getSessions();
            int remaining = limit;
            for (int i = 0; i < sessions.length() && remaining > 0; i++) {
                String sid = sessions.getJSONObject(i).getString("id");
                JSONArray posts = db.getPostsBySession(sid, 0, remaining);
                for (int j = 0; j < posts.length(); j++) {
                    allPosts.put(posts.getJSONObject(j));
                    remaining--;
                }
            }
            return jsonResponse(Response.Status.OK, allPosts.toString());
        }

        // 404
        return jsonResponse(Response.Status.NOT_FOUND, "{\"error\":\"Not found: " + uri + "\"}");
    }

    private Response jsonResponse(Response.Status status, String json) {
        return newFixedLengthResponse(status, "application/json", json);
    }

    private static int parseInt(String value, int defaultValue) {
        if (value == null) return defaultValue;
        try { return Integer.parseInt(value); } catch (NumberFormatException e) { return defaultValue; }
    }

    public void startServer() {
        try {
            start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
            Log.i(TAG, "HTTP server started on port " + getListeningPort());
        } catch (Exception e) {
            Log.e(TAG, "Failed to start HTTP server: " + e.getMessage());
        }
    }

    public void stopServer() {
        stop();
        Log.i(TAG, "HTTP server stopped");
    }
}
