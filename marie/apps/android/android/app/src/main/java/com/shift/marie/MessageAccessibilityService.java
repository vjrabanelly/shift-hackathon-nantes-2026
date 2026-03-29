package com.shift.marie;

import android.accessibilityservice.AccessibilityService;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MessageAccessibilityService extends AccessibilityService {
    private static final String TAG = "MessageOverlay";
    private static final String GOOGLE_MESSAGES_PACKAGE = "com.google.android.apps.messaging";
    private static final String KEYWORD = "shift";

    private WindowManager windowManager;
    private final List<View> overlays = new ArrayList<>();
    private OverlayHit currentHit;

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        windowManager = getSystemService(WindowManager.class);
        Log.d(TAG, "Accessibility service connected");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) {
            clearOverlays();
            return;
        }

        String packageName = event.getPackageName().toString();
        if (!GOOGLE_MESSAGES_PACKAGE.equals(packageName)) {
            clearOverlays();
            return;
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            clearOverlays();
            return;
        }

        List<Rect> matches = new ArrayList<>();
        OverlayHit hit = findBestHit(root);
        root.recycle();
        currentHit = hit;
        if (hit == null) {
            clearOverlays();
            return;
        }

        matches.add(hit.bounds);
        renderOverlays(matches);
    }

    @Override
    public void onInterrupt() {
        clearOverlays();
    }

    @Override
    public boolean onUnbind(android.content.Intent intent) {
        clearOverlays();
        return super.onUnbind(intent);
    }

    private OverlayHit findBestHit(AccessibilityNodeInfo root) {
        List<OverlayHit> hits = new ArrayList<>();
        String conversationTitle = findConversationTitle(root);
        collectHits(root, hits, conversationTitle);

        if (hits.isEmpty()) {
            return null;
        }

        return hits.get(0);
    }

    private void collectHits(AccessibilityNodeInfo node, List<OverlayHit> hits, String conversationTitle) {
        CharSequence text = node.getText();

        if (text != null && text.toString().toLowerCase(Locale.ROOT).contains(KEYWORD)) {
            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            if (!bounds.isEmpty()) {
                hits.add(
                    new OverlayHit(
                        new Rect(bounds),
                        text.toString(),
                        extractSender(node.getContentDescription(), conversationTitle),
                        extractTimestamp(node.getContentDescription()),
                        conversationTitle
                    )
                );
            }
        }

        for (int index = 0; index < node.getChildCount(); index++) {
            AccessibilityNodeInfo child = node.getChild(index);
            if (child == null) {
                continue;
            }

            collectHits(child, hits, conversationTitle);
            child.recycle();
        }
    }

    private void renderOverlays(List<Rect> matches) {
        clearOverlays();

        if (windowManager == null || matches.isEmpty()) {
            return;
        }

        for (Rect match : matches) {
            TextView badge = buildBadge();
            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            );

            params.gravity = Gravity.TOP | Gravity.START;
            params.x = Math.max(8, match.right - dpToPx(8));
            params.y = Math.max(8, match.top - dpToPx(4));

            try {
                windowManager.addView(badge, params);
                overlays.add(badge);
            } catch (Exception exception) {
                Log.w(TAG, "Unable to add overlay", exception);
            }
        }
    }

    private TextView buildBadge() {
        TextView badge = new TextView(this);
        badge.setText("!");
        badge.setTextColor(0xFFFFFFFF);
        badge.setTextSize(18);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        badge.setGravity(Gravity.CENTER);
        badge.setBackgroundColor(0xFFD32F2F);
        badge.setMinWidth(dpToPx(24));
        badge.setMinHeight(dpToPx(24));
        badge.setPadding(dpToPx(6), dpToPx(2), dpToPx(6), dpToPx(2));
        badge.setClickable(true);
        badge.setOnClickListener(view -> openMarieApp());
        return badge;
    }

    private void openMarieApp() {
        android.content.Intent intent = new android.content.Intent(this, MainActivity.class);
        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        if (currentHit != null) {
            intent.putExtra(OverlayContextStore.EXTRA_OVERLAY_MESSAGE, currentHit.message);
            intent.putExtra(OverlayContextStore.EXTRA_OVERLAY_SENDER, currentHit.sender);
            intent.putExtra(OverlayContextStore.EXTRA_OVERLAY_TIMESTAMP, currentHit.timestampLabel);
            intent.putExtra(OverlayContextStore.EXTRA_OVERLAY_CONVERSATION, currentHit.conversationTitle);
            intent.putExtra(OverlayContextStore.EXTRA_OVERLAY_SOURCE_APP, "Google Messages");
        }
        startActivity(intent);
    }

    private String findConversationTitle(AccessibilityNodeInfo root) {
        return findConversationTitleRecursive(root);
    }

    private String extractSender(CharSequence description, String conversationTitle) {
        String desc = safeText(description);
        if (desc.contains(" a dit ")) {
            return desc.substring(0, desc.indexOf(" a dit ")).trim();
        }
        if (!conversationTitle.isEmpty()) {
            return conversationTitle;
        }
        return "";
    }

    private String extractTimestamp(CharSequence description) {
        String desc = safeText(description);
        int lastSpace = desc.lastIndexOf(' ');
        if (lastSpace > 0 && desc.endsWith(".")) {
            return desc.substring(Math.max(0, lastSpace - 5), desc.length() - 1).trim();
        }
        return "";
    }

    private String safeText(CharSequence text) {
        return text == null ? "" : text.toString();
    }

    private String findConversationTitleRecursive(AccessibilityNodeInfo node) {
        Rect bounds = new Rect();
        node.getBoundsInScreen(bounds);
        String text = safeText(node.getText()).trim();

        if (!text.isEmpty()
            && bounds.top < dpToPx(220)
            && !text.equals("Messages")
            && !text.equals("Retour")
            && !text.equals("Appeler")
            && !text.equals("Plus")) {
            return text;
        }

        for (int index = 0; index < node.getChildCount(); index++) {
            AccessibilityNodeInfo child = node.getChild(index);
            if (child == null) {
                continue;
            }

            String candidate = findConversationTitleRecursive(child);
            child.recycle();

            if (!candidate.isEmpty()) {
                return candidate;
            }
        }

        return "";
    }

    private static class OverlayHit {
        final Rect bounds;
        final String message;
        final String sender;
        final String timestampLabel;
        final String conversationTitle;

        OverlayHit(Rect bounds, String message, String sender, String timestampLabel, String conversationTitle) {
            this.bounds = bounds;
            this.message = message;
            this.sender = sender;
            this.timestampLabel = timestampLabel;
            this.conversationTitle = conversationTitle;
        }
    }

    private void clearOverlays() {
        if (windowManager == null || overlays.isEmpty()) {
            return;
        }

        for (View overlay : overlays) {
            try {
                windowManager.removeView(overlay);
            } catch (Exception exception) {
                Log.w(TAG, "Unable to remove overlay", exception);
            }
        }

        overlays.clear();
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }
}
