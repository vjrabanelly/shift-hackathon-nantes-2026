package com.shift.marie;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;
import java.util.ArrayList;

public class SmsReceiver extends BroadcastReceiver {
    public static final String ACTION_SMS_RECEIVED = "com.shift.marie.SMS_RECEIVED";
    private static final String TAG = "SmsShield";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "SmsReceiver triggered with action=" + (intent == null ? "null" : intent.getAction()));

        if (intent == null || !android.provider.Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            return;
        }

        Bundle extras = intent.getExtras();
        if (extras == null) return;

        Object[] pdus = (Object[]) extras.get("pdus");
        String format = extras.getString("format");

        if (pdus == null || pdus.length == 0) {
            Log.d(TAG, "SmsReceiver ignored empty pdus");
            return;
        }

        StringBuilder bodyBuilder = new StringBuilder();
        String address = "";

        for (Object pdu : pdus) {
            SmsMessage message = SmsMessage.createFromPdu((byte[]) pdu, format);
            if (message == null) continue;

            if (address.isEmpty() && message.getDisplayOriginatingAddress() != null) {
                address = message.getDisplayOriginatingAddress();
            }
            bodyBuilder.append(message.getDisplayMessageBody());
        }

        String body = bodyBuilder.toString();
        Log.d(TAG, "SMS captured from=" + address);

        // Stocker le SMS brut — l'analyse complète est faite par le backend NestJS
        SmsAnalysisResult raw = new SmsAnalysisResult(
            address, body, false, 0, new ArrayList<>(), System.currentTimeMillis()
        );
        SmsStorage.saveLastAnalysis(context, raw);

        // Notification : invite l'utilisateur à analyser
        SmsNotificationHelper.showIncomingSmsNotification(context, address, body);

        // Réveiller le plugin si l'app est ouverte
        Intent broadcastIntent = new Intent(ACTION_SMS_RECEIVED);
        broadcastIntent.setPackage(context.getPackageName());
        context.sendBroadcast(broadcastIntent);
    }
}
