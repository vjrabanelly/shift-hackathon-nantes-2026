package com.shift.marie;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import org.json.JSONArray;

public final class SmsStorage {
    private static final String PREFERENCES_NAME = "sms_shield_storage";
    private static final String KEY_ADDRESS = "address";
    private static final String KEY_BODY = "body";
    private static final String KEY_SUSPICIOUS = "suspicious";
    private static final String KEY_SCORE = "score";
    private static final String KEY_REASONS = "reasons";
    private static final String KEY_RECEIVED_AT = "receivedAt";

    private SmsStorage() {}

    public static void saveLastAnalysis(Context context, SmsAnalysisResult analysis) {
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
        JSONArray reasons = new JSONArray();

        for (String reason : analysis.getReasons()) {
            reasons.put(reason);
        }

        preferences
            .edit()
            .putString(KEY_ADDRESS, analysis.getAddress())
            .putString(KEY_BODY, analysis.getBody())
            .putBoolean(KEY_SUSPICIOUS, analysis.isSuspicious())
            .putInt(KEY_SCORE, analysis.getScore())
            .putString(KEY_REASONS, reasons.toString())
            .putLong(KEY_RECEIVED_AT, analysis.getReceivedAt())
            .apply();
    }

    public static JSObject readLastAnalysis(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
        long receivedAt = preferences.getLong(KEY_RECEIVED_AT, 0L);

        if (receivedAt == 0L) {
            return null;
        }

        JSObject result = new JSObject();
        JSArray reasons = new JSArray();

        try {
            String reasonsString = preferences.getString(KEY_REASONS, "[]");
            JSONArray reasonsJson = new JSONArray(reasonsString == null ? "[]" : reasonsString);

            for (int index = 0; index < reasonsJson.length(); index++) {
                reasons.put(reasonsJson.optString(index));
            }
        } catch (Exception exception) {
            reasons.put("Lecture partielle des raisons");
        }

        result.put("address", preferences.getString(KEY_ADDRESS, ""));
        result.put("body", preferences.getString(KEY_BODY, ""));
        result.put("suspicious", preferences.getBoolean(KEY_SUSPICIOUS, false));
        result.put("score", preferences.getInt(KEY_SCORE, 0));
        result.put("reasons", reasons);
        result.put("receivedAt", receivedAt);
        return result;
    }

    public static void clear(Context context) {
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE).edit().clear().apply();
    }
}
