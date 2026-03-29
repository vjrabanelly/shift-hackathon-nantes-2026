package com.lab.echa.app;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

/**
 * EchaWebSocketClient — pushes real-time events to visualizer WS server.
 * Connects to ws://localhost:VISUALIZER_PORT (accessible via adb reverse).
 * Auto-reconnects on disconnect.
 */
public class EchaWebSocketClient {

    private static final String TAG = "EchaWS";
    private static final int RECONNECT_DELAY_MS = 3000;
    private static final int MAX_RECONNECT_DELAY_MS = 30000;

    private static EchaWebSocketClient instance;

    private final OkHttpClient httpClient;
    private final String serverUrl;
    private final EchaDatabase db;
    private final Handler mainHandler;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private WebSocket webSocket;
    private final AtomicBoolean connected = new AtomicBoolean(false);
    private final AtomicBoolean shouldReconnect = new AtomicBoolean(true);
    private int reconnectDelay = RECONNECT_DELAY_MS;

    // ── Singleton ───────────────────────────────────────────────

    public static synchronized EchaWebSocketClient getInstance(EchaDatabase db, int port) {
        if (instance == null) {
            instance = new EchaWebSocketClient(db, port);
        }
        return instance;
    }

    public static synchronized EchaWebSocketClient getInstance() {
        return instance;
    }

    private EchaWebSocketClient(EchaDatabase db, int port) {
        this.db = db;
        this.serverUrl = "ws://localhost:" + port;
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS) // No timeout for WS
                .build();
    }

    // ── Connection lifecycle ────────────────────────────────────

    public void connect() {
        shouldReconnect.set(true);
        reconnectDelay = RECONNECT_DELAY_MS;
        doConnect();
    }

    public void disconnect() {
        shouldReconnect.set(false);
        if (webSocket != null) {
            webSocket.close(1000, "App closing");
            webSocket = null;
        }
        connected.set(false);
    }

    public boolean isConnected() {
        return connected.get();
    }

    private void doConnect() {
        executor.execute(() -> {
            try {
                Request request = new Request.Builder()
                        .url(serverUrl)
                        .addHeader("X-Echa-Source", "mobile")
                        .build();

                webSocket = httpClient.newWebSocket(request, new WebSocketListener() {
                    @Override
                    public void onOpen(WebSocket ws, Response response) {
                        connected.set(true);
                        reconnectDelay = RECONNECT_DELAY_MS;
                        Log.i(TAG, "Connected to visualizer at " + serverUrl);
                        sendHello();
                    }

                    @Override
                    public void onMessage(WebSocket ws, String text) {
                        handleMessage(text);
                    }

                    @Override
                    public void onClosing(WebSocket ws, int code, String reason) {
                        ws.close(1000, null);
                        connected.set(false);
                        Log.i(TAG, "Server closing: " + reason);
                        scheduleReconnect();
                    }

                    @Override
                    public void onFailure(WebSocket ws, Throwable t, Response response) {
                        connected.set(false);
                        Log.w(TAG, "Connection failed: " + t.getMessage());
                        scheduleReconnect();
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Connect error: " + e.getMessage());
                scheduleReconnect();
            }
        });
    }

    private void scheduleReconnect() {
        if (!shouldReconnect.get()) return;
        Log.d(TAG, "Reconnecting in " + reconnectDelay + "ms...");
        mainHandler.postDelayed(this::doConnect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    }

    // ── Send methods ────────────────────────────────────────────

    private boolean send(JSONObject message) {
        if (!connected.get() || webSocket == null) return false;
        try {
            return webSocket.send(message.toString());
        } catch (Exception e) {
            Log.w(TAG, "Send failed: " + e.getMessage());
            return false;
        }
    }

    private void sendHello() {
        try {
            JSONObject stats = db.getStats();
            JSONObject msg = new JSONObject();
            msg.put("type", "mobile:hello");
            msg.put("data", stats);
            send(msg);
        } catch (JSONException e) {
            Log.w(TAG, "Failed to send hello: " + e.getMessage());
        }
    }

    /**
     * Push a new post event to the visualizer.
     */
    public void sendPost(String sessionId, JSONObject postData) {
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "mobile:post");
            JSONObject data = new JSONObject();
            data.put("sessionId", sessionId);
            data.put("post", postData);
            msg.put("data", data);
            send(msg);
        } catch (JSONException e) {
            Log.w(TAG, "sendPost failed: " + e.getMessage());
        }
    }

    /**
     * Push a dwell time update.
     */
    public void sendDwell(String sessionId, String postId, String username, int dwellTimeMs) {
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "mobile:dwell");
            JSONObject data = new JSONObject();
            data.put("sessionId", sessionId);
            data.put("postId", postId);
            data.put("username", username);
            data.put("dwellTimeMs", dwellTimeMs);
            msg.put("data", data);
            send(msg);
        } catch (JSONException e) {
            Log.w(TAG, "sendDwell failed: " + e.getMessage());
        }
    }

    /**
     * Push session start event.
     */
    public void sendSessionStart(String sessionId, String captureMode) {
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "mobile:session-start");
            JSONObject data = new JSONObject();
            data.put("sessionId", sessionId);
            data.put("captureMode", captureMode);
            data.put("timestamp", System.currentTimeMillis());
            msg.put("data", data);
            send(msg);
        } catch (JSONException e) {
            Log.w(TAG, "sendSessionStart failed: " + e.getMessage());
        }
    }

    /**
     * Push session end event with stats.
     */
    public void sendSessionEnd(String sessionId, double durationSec, int totalPosts, int totalEvents) {
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "mobile:session-end");
            JSONObject data = new JSONObject();
            data.put("sessionId", sessionId);
            data.put("durationSec", durationSec);
            data.put("totalPosts", totalPosts);
            data.put("totalEvents", totalEvents);
            msg.put("data", data);
            send(msg);
        } catch (JSONException e) {
            Log.w(TAG, "sendSessionEnd failed: " + e.getMessage());
        }
    }

    /**
     * Push ML Kit results (labels + OCR).
     */
    public void sendMLKit(String postId, String labelsJson, String ocrText) {
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "mobile:mlkit");
            JSONObject data = new JSONObject();
            data.put("postId", postId);
            data.put("labels", labelsJson);
            data.put("ocrText", ocrText);
            msg.put("data", data);
            send(msg);
        } catch (JSONException e) {
            Log.w(TAG, "sendMLKit failed: " + e.getMessage());
        }
    }

    /**
     * Push enrichment result.
     */
    public void sendEnrichment(String postId, JSONObject enrichment) {
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "mobile:enrichment");
            JSONObject data = new JSONObject();
            data.put("postId", postId);
            data.put("enrichment", enrichment);
            msg.put("data", data);
            send(msg);
        } catch (JSONException e) {
            Log.w(TAG, "sendEnrichment failed: " + e.getMessage());
        }
    }

    // ── Handle incoming messages from visualizer ────────────────

    private void handleMessage(String text) {
        try {
            JSONObject msg = new JSONObject(text);
            String type = msg.optString("type", "");

            switch (type) {
                case "command":
                    handleCommand(msg);
                    break;
                case "ping":
                    sendPong();
                    break;
                default:
                    // Ignore other messages (status, quality, etc from broadcast)
                    break;
            }
        } catch (JSONException e) {
            Log.w(TAG, "Invalid message: " + e.getMessage());
        }
    }

    private void handleCommand(JSONObject msg) {
        String action = msg.optString("action", "");
        Log.i(TAG, "Command received: " + action);
        // Future: handle sync-full, export, etc.
    }

    private void sendPong() {
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "mobile:pong");
            msg.put("timestamp", System.currentTimeMillis());
            send(msg);
        } catch (JSONException e) {
            // ignore
        }
    }
}
