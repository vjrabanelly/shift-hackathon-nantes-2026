package com.shift.marie;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.JSObject;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmsShieldPlugin.class);
        super.onCreate(savedInstanceState);
        cacheOverlayContextFromIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        cacheOverlayContextFromIntent(intent);

        // L'app était déjà ouverte : notifier le plugin JS qu'un SMS est en attente.
        // Sans ça, le useEffect React a déjà tourné et ne re-vérifierait jamais le stockage.
        Intent broadcast = new Intent(SmsReceiver.ACTION_SMS_RECEIVED);
        broadcast.setPackage(getPackageName());
        sendBroadcast(broadcast);
    }

    private void cacheOverlayContextFromIntent(Intent intent) {
        if (intent == null) return;

        String message = intent.getStringExtra(OverlayContextStore.EXTRA_OVERLAY_MESSAGE);
        if (message == null || message.isEmpty()) return;

        JSObject context = new JSObject();
        context.put("message", message);
        context.put("sender", intent.getStringExtra(OverlayContextStore.EXTRA_OVERLAY_SENDER));
        context.put("timestampLabel", intent.getStringExtra(OverlayContextStore.EXTRA_OVERLAY_TIMESTAMP));
        context.put("conversationTitle", intent.getStringExtra(OverlayContextStore.EXTRA_OVERLAY_CONVERSATION));
        context.put("sourceApp", intent.getStringExtra(OverlayContextStore.EXTRA_OVERLAY_SOURCE_APP));
        OverlayContextStore.setLatestContext(context);
    }
}
