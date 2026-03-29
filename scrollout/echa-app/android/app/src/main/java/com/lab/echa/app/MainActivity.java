package com.lab.echa.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private EchaHttpServer httpServer;
    private EchaWebSocketClient wsClient;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(InstaWebViewPlugin.class);
        registerPlugin(ImageAnalyzerPlugin.class);
        super.onCreate(savedInstanceState);

        // Start embedded HTTP server for PC sync (fallback)
        httpServer = new EchaHttpServer(this, 8765);
        httpServer.startServer();

        // Start WebSocket client for real-time push to visualizer
        int visualizerPort = 3000;
        EchaDatabase db = EchaDatabase.getInstance(this);
        wsClient = EchaWebSocketClient.getInstance(db, visualizerPort);
        wsClient.connect();

        // Force opaque dark status bar — no transparency, no edge-to-edge
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#0a0a0a"));
        window.setNavigationBarColor(Color.parseColor("#141414"));
        // Light status bar icons = false → white icons on dark background
        View decorView = window.getDecorView();
        decorView.setSystemUiVisibility(
            decorView.getSystemUiVisibility() & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        );

        // Disable edge-to-edge: apply system bar insets as padding so content
        // does NOT render behind the status bar or navigation bar.
        View rootView = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, windowInsets) -> {
            Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }

    @Override
    public void onBackPressed() {
        // Let the plugin handle back navigation in Instagram WebView
        InstaWebViewPlugin plugin = (InstaWebViewPlugin) bridge.getPlugin("InstaWebView").getInstance();
        if (plugin != null && plugin.handleBack()) {
            return;
        }
        super.onBackPressed();
    }
}
