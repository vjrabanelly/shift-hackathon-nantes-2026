package com.shift.marie;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.util.List;

public class SmsAnalysisResult {
    private final String address;
    private final String body;
    private final boolean suspicious;
    private final int score;
    private final List<String> reasons;
    private final long receivedAt;

    public SmsAnalysisResult(
        String address,
        String body,
        boolean suspicious,
        int score,
        List<String> reasons,
        long receivedAt
    ) {
        this.address = address;
        this.body = body;
        this.suspicious = suspicious;
        this.score = score;
        this.reasons = reasons;
        this.receivedAt = receivedAt;
    }

    public String getAddress() {
        return address;
    }

    public String getBody() {
        return body;
    }

    public boolean isSuspicious() {
        return suspicious;
    }

    public int getScore() {
        return score;
    }

    public List<String> getReasons() {
        return reasons;
    }

    public long getReceivedAt() {
        return receivedAt;
    }

    public JSObject toJsObject() {
        JSObject result = new JSObject();
        JSArray array = new JSArray();

        for (String reason : reasons) {
            array.put(reason);
        }

        result.put("address", address);
        result.put("body", body);
        result.put("suspicious", suspicious);
        result.put("score", score);
        result.put("reasons", array);
        result.put("receivedAt", receivedAt);
        return result;
    }
}
