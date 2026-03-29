package com.shift.marie;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public final class SmsNotificationHelper {
    public static final String CHANNEL_ID = "sms_shield_alerts";
    private static final int NOTIFICATION_ID = 4041;

    private SmsNotificationHelper() {}

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Analyse SMS",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Invitations à analyser les SMS reçus avec Marie.");

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    public static void showIncomingSmsNotification(Context context, String address, String body) {
        ensureChannel(context);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            return;
        }

        // Tap → ouvre MainActivity (le SMS est déjà stocké dans SmsStorage)
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String preview = body.length() > 80 ? body.substring(0, 80) + "…" : body;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("📱 SMS de " + (address.isEmpty() ? "inconnu" : address))
            .setContentText("Analyser ce message avec Marie ?")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(preview))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOngoing(true)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
    }
}
