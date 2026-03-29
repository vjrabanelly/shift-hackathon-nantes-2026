package com.shift.marie;

import com.getcapacitor.JSObject;

public final class OverlayContextStore {
    public static final String EXTRA_OVERLAY_MESSAGE = "overlay_message";
    public static final String EXTRA_OVERLAY_SENDER = "overlay_sender";
    public static final String EXTRA_OVERLAY_TIMESTAMP = "overlay_timestamp";
    public static final String EXTRA_OVERLAY_CONVERSATION = "overlay_conversation";
    public static final String EXTRA_OVERLAY_SOURCE_APP = "overlay_source_app";

    private static JSObject latestContext;

    private OverlayContextStore() {}

    public static synchronized void setLatestContext(JSObject context) {
        latestContext = context;
    }

    public static synchronized JSObject getLatestContext() {
        return latestContext;
    }
}
