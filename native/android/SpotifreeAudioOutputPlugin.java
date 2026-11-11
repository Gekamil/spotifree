package com.spotifree.music;

import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.MediaRouter;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * APK only: enumerates real connected audio output routes on Android (phone speaker, Bluetooth
 * headphones/speakers, wired headsets, USB-C audio, HDMI/TV) and lets the user switch or open
 * the Android Media Output / Bluetooth switcher directly from Spotifree's Connect sheet.
 * JS side: src/services/audioOutputService.ts (registerPlugin('SpotifreeAudioOutput')).
 */
@CapacitorPlugin(name = "SpotifreeAudioOutput")
public class SpotifreeAudioOutputPlugin extends Plugin {

    private AudioManager audioManager;
    private AudioDeviceCallback deviceCallback;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private String selectedRouteHint = "default";

    @Override
    public void load() {
        try {
            Context ctx = getContext();
            if (ctx == null) return;
            audioManager = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                deviceCallback = new AudioDeviceCallback() {
                    @Override
                    public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) {
                        emitSnapshot();
                    }

                    @Override
                    public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                        emitSnapshot();
                    }
                };
                audioManager.registerAudioDeviceCallback(deviceCallback, mainHandler);
            }
        } catch (Throwable ignored) {}
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // When user returns from Android's Media Output / Bluetooth dialog, push fresh state
        mainHandler.postDelayed(this::emitSnapshot, 180);
    }

    @Override
    protected void handleOnDestroy() {
        try {
            if (audioManager != null && deviceCallback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                audioManager.unregisterAudioDeviceCallback(deviceCallback);
            }
        } catch (Throwable ignored) {}
        deviceCallback = null;
        super.handleOnDestroy();
    }

    private void emitSnapshot() {
        try {
            if (getBridge() == null) return;
            notifyListeners("devicesChanged", buildSnapshot(), false);
        } catch (Throwable ignored) {}
    }

    private static String kindForType(int type) {
        switch (type) {
            case 2:  // TYPE_BUILTIN_SPEAKER
                return "speaker";
            case 3:  // TYPE_WIRED_HEADSET
            case 4:  // TYPE_WIRED_HEADPHONES
            case 5:  // TYPE_LINE_ANALOG
                return "wired";
            case 11: // TYPE_USB_DEVICE
            case 12: // TYPE_USB_ACCESSORY
            case 22: // TYPE_USB_HEADSET
                return "usb";
            case 7:  // TYPE_BLUETOOTH_SCO
            case 8:  // TYPE_BLUETOOTH_A2DP
            case 23: // TYPE_HEARING_AID
            case 26: // TYPE_BLE_HEADSET
            case 27: // TYPE_BLE_SPEAKER
            case 30: // TYPE_BLE_BROADCAST
                return "bluetooth";
            case 6:  // TYPE_LINE_DIGITAL
            case 9:  // TYPE_HDMI
            case 10: // TYPE_HDMI_ARC
            case 29: // TYPE_HDMI_EARC
                return "tv";
            default:
                return null;
        }
    }

    private static String defaultLabelForKind(String kind) {
        switch (kind) {
            case "speaker":
                return "Altavoz del teléfono";
            case "wired":
                return "Auriculares con cable";
            case "usb":
                return "Audio USB";
            case "bluetooth":
                return "Dispositivo Bluetooth";
            case "tv":
                return "Salida HDMI / TV";
            default:
                return "Salida de audio";
        }
    }

    private String cleanProductName(AudioDeviceInfo info, String kind) {
        if ("speaker".equals(kind)) return "Altavoz del teléfono";
        CharSequence raw = null;
        try {
            raw = info.getProductName();
        } catch (Throwable ignored) {}
        String name = raw != null ? raw.toString().trim() : "";
        String model = Build.MODEL != null ? Build.MODEL.trim() : "";
        if (name.isEmpty() || (!model.isEmpty() && name.equalsIgnoreCase(model))) {
            return defaultLabelForKind(kind);
        }
        return name;
    }

    @SuppressWarnings("deprecation")
    private Set<Integer> resolveActiveMediaDeviceIds(AudioManager am) {
        Set<Integer> ids = new HashSet<>();
        if (am == null) return ids;

        // Android 13+ gives the exact active AudioDeviceInfo for USAGE_MEDIA
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build();
                List<AudioDeviceInfo> active = am.getAudioDevicesForAttributes(attrs);
                if (active != null) {
                    for (AudioDeviceInfo d : active) {
                        ids.add(d.getId());
                    }
                    if (!ids.isEmpty()) return ids;
                }
            } catch (Throwable ignored) {}
        }

        // Fallback on Android 6-12 using AudioManager routing flags & connected devices
        try {
            boolean btOn = am.isBluetoothA2dpOn();
            boolean wiredOn = am.isWiredHeadsetOn();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                AudioDeviceInfo[] all = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
                if (all != null) {
                    for (AudioDeviceInfo d : all) {
                        String kind = kindForType(d.getType());
                        if (btOn && "bluetooth".equals(kind)) {
                            ids.add(d.getId());
                        } else if (!btOn && wiredOn && ("wired".equals(kind) || "usb".equals(kind))) {
                            ids.add(d.getId());
                        }
                    }
                    if (ids.isEmpty()) {
                        for (AudioDeviceInfo d : all) {
                            if ("speaker".equals(kindForType(d.getType()))) {
                                ids.add(d.getId());
                                break;
                            }
                        }
                    }
                }
            }
        } catch (Throwable ignored) {}

        return ids;
    }

    private JSObject buildSnapshot() {
        JSObject ret = new JSObject();
        JSArray arr = new JSArray();

        Context ctx = getContext();
        if (audioManager == null && ctx != null) {
            audioManager = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        }

        Set<Integer> activeIds = resolveActiveMediaDeviceIds(audioManager);
        Set<String> seenKeys = new HashSet<>();

        String activeKind = "speaker";
        String activeLabel = "Altavoz del teléfono";
        String activeId = "default";

        if (audioManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            AudioDeviceInfo[] devs = new AudioDeviceInfo[0];
            try {
                devs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
            } catch (Throwable ignored) {}

            // Pass 1: External & specialized routes first (Bluetooth, Wired, USB, HDMI), then Speaker
            for (int pass = 0; pass < 2; pass++) {
                for (AudioDeviceInfo info : devs) {
                    String kind = kindForType(info.getType());
                    if (kind == null) continue;
                    boolean isSpeaker = "speaker".equals(kind);
                    if ((pass == 0 && isSpeaker) || (pass == 1 && !isSpeaker)) continue;

                    String label = cleanProductName(info, kind);
                    String dedupeKey = kind + ":" + label.toLowerCase(Locale.ROOT);
                    if (seenKeys.contains(dedupeKey)) continue;
                    seenKeys.add(dedupeKey);

                    String devId = "android-" + info.getId();
                    boolean isActive = activeIds.contains(info.getId()) || devId.equals(selectedRouteHint);
                    if (isActive) {
                        activeKind = kind;
                        activeLabel = label;
                        activeId = devId;
                    }

                    JSObject item = new JSObject();
                    item.put("id", devId);
                    item.put("label", label);
                    item.put("kind", kind);
                    item.put("active", isActive);
                    item.put("nativeId", info.getId());
                    arr.put(item);
                }
            }
        }

        // Fallback MediaRouter name if external route is active via MediaRouter
        try {
            if (ctx != null) {
                MediaRouter mr = (MediaRouter) ctx.getSystemService(Context.MEDIA_ROUTER_SERVICE);
                if (mr != null) {
                    MediaRouter.RouteInfo route = mr.getSelectedRoute(MediaRouter.ROUTE_TYPE_LIVE_AUDIO);
                    if (route != null && route != mr.getDefaultRoute()) {
                        CharSequence rn = route.getName(ctx);
                        if (rn != null && rn.length() > 0 && "speaker".equals(activeKind)) {
                            activeLabel = rn.toString();
                        }
                    }
                }
            }
        } catch (Throwable ignored) {}

        JSObject activeObj = new JSObject();
        activeObj.put("id", activeId);
        activeObj.put("label", activeLabel);
        activeObj.put("kind", activeKind);

        ret.put("devices", arr);
        ret.put("activeDevice", activeObj);
        ret.put("isApk", true);
        ret.put("supportsSystemMediaOutput", Build.VERSION.SDK_INT >= 29);
        return ret;
    }

    @PluginMethod
    public void getOutputDevices(PluginCall call) {
        call.resolve(buildSnapshot());
    }

    @PluginMethod
    @SuppressWarnings("deprecation")
    public void setOutputDevice(PluginCall call) {
        String deviceId = call.getString("deviceId", "default");
        if (deviceId == null || deviceId.isEmpty()) deviceId = "default";

        Context ctx = getContext();
        if (audioManager == null && ctx != null) {
            audioManager = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        }

        boolean switched = false;
        boolean needsSystemPicker = false;

        try {
            if ("default".equals(deviceId)) {
                selectedRouteHint = "default";
                if (audioManager != null) {
                    if (Build.VERSION.SDK_INT >= 31) {
                        try { audioManager.clearCommunicationDevice(); } catch (Throwable ignored) {}
                    }
                    audioManager.setSpeakerphoneOn(false);
                    if (audioManager.getMode() != AudioManager.MODE_NORMAL) {
                        audioManager.setMode(AudioManager.MODE_NORMAL);
                    }
                }
                if (ctx != null) {
                    try {
                        MediaRouter mr = (MediaRouter) ctx.getSystemService(Context.MEDIA_ROUTER_SERVICE);
                        if (mr != null && mr.getDefaultRoute() != null) {
                            mr.selectRoute(MediaRouter.ROUTE_TYPE_LIVE_AUDIO, mr.getDefaultRoute());
                        }
                    } catch (Throwable ignored) {}
                }
                switched = true;
            } else if (deviceId.startsWith("android-")) {
                int targetId = -1;
                try {
                    targetId = Integer.parseInt(deviceId.replace("android-", ""));
                } catch (NumberFormatException ignored) {}

                AudioDeviceInfo targetInfo = null;
                String targetKind = null;
                String targetLabel = "";

                if (audioManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && targetId >= 0) {
                    AudioDeviceInfo[] devs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
                    for (AudioDeviceInfo d : devs) {
                        if (d.getId() == targetId) {
                            targetInfo = d;
                            targetKind = kindForType(d.getType());
                            targetLabel = cleanProductName(d, targetKind != null ? targetKind : "speaker");
                            break;
                        }
                    }
                }

                // 1. Try MediaRouter live audio route selection matching device name/type
                if (ctx != null && targetInfo != null) {
                    try {
                        MediaRouter mr = (MediaRouter) ctx.getSystemService(Context.MEDIA_ROUTER_SERVICE);
                        if (mr != null) {
                            if ("speaker".equals(targetKind) && mr.getDefaultRoute() != null) {
                                mr.selectRoute(MediaRouter.ROUTE_TYPE_LIVE_AUDIO, mr.getDefaultRoute());
                            } else {
                                int routeCount = mr.getRouteCount();
                                for (int i = 0; i < routeCount; i++) {
                                    MediaRouter.RouteInfo route = mr.getRouteAt(i);
                                    CharSequence rn = route != null ? route.getName(ctx) : null;
                                    String rName = rn != null ? rn.toString().toLowerCase(Locale.ROOT) : "";
                                    if (!rName.isEmpty() && (!targetLabel.isEmpty() && rName.contains(targetLabel.toLowerCase(Locale.ROOT)))) {
                                        mr.selectRoute(MediaRouter.ROUTE_TYPE_LIVE_AUDIO, route);
                                        switched = true;
                                        break;
                                    }
                                }
                            }
                        }
                    } catch (Throwable ignored) {}
                }

                // Check if requested device is already the active media sink
                Set<Integer> activeNow = resolveActiveMediaDeviceIds(audioManager);
                if (activeNow.contains(targetId)) {
                    selectedRouteHint = deviceId;
                    switched = true;
                } else {
                    // Android 11+ restricts silent background switching of A2DP media sinks by apps,
                    // so we let JS offer/invoke Android's native Media Output / Bluetooth switcher.
                    needsSystemPicker = true;
                }
            }
        } catch (Throwable ignored) {}

        JSObject res = buildSnapshot();
        res.put("switched", switched);
        res.put("needsSystemPicker", needsSystemPicker);
        call.resolve(res);
    }

    @PluginMethod
    public void openSystemMediaOutput(PluginCall call) {
        boolean opened = false;
        Context ctx = getContext();
        if (ctx != null) {
            String pkg = ctx.getPackageName();

            Intent[] candidates = new Intent[] {
                // 1. Android 11-15 Media Output Switcher Panel (Pixel, AOSP, OneUI, MIUI, etc.)
                new Intent("com.android.settings.panel.action.MEDIA_OUTPUT")
                        .putExtra("com.android.settings.panel.extra.PACKAGE_NAME", pkg),
                // 2. Android System Volume & Output Panel (API 29+ public SDK)
                new Intent("android.settings.panel.action.VOLUME"),
                // 3. Bluetooth Settings fallback (all Android versions)
                new Intent(Settings.ACTION_BLUETOOTH_SETTINGS),
            };

            for (Intent candidate : candidates) {
                try {
                    if (getActivity() != null) {
                        getActivity().startActivity(candidate);
                    } else {
                        candidate.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        ctx.startActivity(candidate);
                    }
                    opened = true;
                    break;
                } catch (Throwable ignored) {}
            }
        }

        JSObject res = new JSObject();
        res.put("opened", opened);
        call.resolve(res);
    }
}
