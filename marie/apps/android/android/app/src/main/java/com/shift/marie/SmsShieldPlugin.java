package com.shift.marie;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONObject;
import java.util.ArrayList;

@CapacitorPlugin(
    name = "SmsShield",
    permissions = {
        @Permission(alias = "receiveSms", strings = { Manifest.permission.RECEIVE_SMS }),
        @Permission(alias = "postNotifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class SmsShieldPlugin extends Plugin {
    private BroadcastReceiver smsReceiver;

    @Override
    public void load() {
        SmsNotificationHelper.ensureChannel(getContext());
        registerSmsReceiver();
    }

    @Override
    protected void handleOnDestroy() {
        if (smsReceiver != null) {
            getContext().unregisterReceiver(smsReceiver);
            smsReceiver = null;
        }
    }

    /** Retourne permissions + dernier SMS en attente d'analyse. */
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        JSObject pending = SmsStorage.readLastAnalysis(getContext());
        result.put("permissions", buildPermissions());
        result.put("pendingSms", pending == null ? JSONObject.NULL : pending);
        result.put("overlayContext", overlayContextOrNull());
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (getPermissionState("receiveSms") != PermissionState.GRANTED) {
            requestPermissionForAlias("receiveSms", call, "receiveSmsPermissionCallback");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState("postNotifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("postNotifications", call, "postNotificationsPermissionCallback");
            return;
        }

        resolvePermissionState(call);
    }

    @PermissionCallback
    private void receiveSmsPermissionCallback(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState("postNotifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("postNotifications", call, "postNotificationsPermissionCallback");
            return;
        }
        resolvePermissionState(call);
    }

    @PermissionCallback
    private void postNotificationsPermissionCallback(PluginCall call) {
        resolvePermissionState(call);
    }

    @PluginMethod
    public void clearPendingSms(PluginCall call) {
        SmsStorage.clear(getContext());
        call.resolve();
    }

    @PluginMethod
    public void clearOverlayContext(PluginCall call) {
        OverlayContextStore.setLatestContext(null);
        call.resolve();
    }

    /** Simule la réception d'un SMS — pour les tests en dev. */
    @PluginMethod
    public void simulateSms(PluginCall call) {
        String address = call.getString("address", "+33612345678");
        String body = call.getString("body",
            "URGENT votre compte est bloqué, cliquez sur https://bit.ly/test et entrez votre code OTP");

        SmsAnalysisResult raw = new SmsAnalysisResult(
            address, body, false, 0, new ArrayList<>(), System.currentTimeMillis()
        );
        SmsStorage.saveLastAnalysis(getContext(), raw);
        SmsNotificationHelper.showIncomingSmsNotification(getContext(), address, body);
        emitSmsPending(address, body);

        JSObject result = new JSObject();
        result.put("address", address);
        result.put("body", body);
        call.resolve(result);
    }

    private void emitSmsPending(String address, String body) {
        JSObject payload = new JSObject();
        payload.put("address", address);
        payload.put("body", body);
        notifyListeners("smsPending", payload, true);
    }

    private void registerSmsReceiver() {
        smsReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject pending = SmsStorage.readLastAnalysis(context);
                if (pending == null) return;
                emitSmsPending(
                    pending.getString("address", ""),
                    pending.getString("body", "")
                );
            }
        };

        IntentFilter filter = new IntentFilter(SmsReceiver.ACTION_SMS_RECEIVED);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(smsReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(smsReceiver, filter);
        }
    }

    private JSObject buildPermissions() {
        JSObject permissions = new JSObject();
        permissions.put("receiveSms", permissionStateToString(getPermissionState("receiveSms")));
        permissions.put("postNotifications", notificationPermissionState());
        return permissions;
    }

    private Object overlayContextOrNull() {
        JSObject context = OverlayContextStore.getLatestContext();
        return context == null ? JSONObject.NULL : context;
    }

    private String notificationPermissionState() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return "granted";
        return permissionStateToString(getPermissionState("postNotifications"));
    }

    private String permissionStateToString(PermissionState state) {
        if (state == PermissionState.GRANTED) return "granted";
        if (state == PermissionState.DENIED) return "denied";
        return "prompt";
    }

    private void resolvePermissionState(PluginCall call) {
        call.resolve(buildPermissions());
    }
}
