package com.spotifree.music;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Switches the launcher icon of the Spotifree APK.
 * Each icon is an <activity-alias> (".Icon<Suffix>") declared in AndroidManifest.xml by
 * scripts/setup-android-app-icons.mjs; only the chosen alias stays enabled.
 * JS side: src/utils/appIcon.ts (registerPlugin('SpotifreeAppIcon')).
 */
@CapacitorPlugin(name = "SpotifreeAppIcon")
public class SpotifreeAppIconPlugin extends Plugin {

    // Keep in sync with APP_ICON_OPTIONS in src/utils/appIcon.ts
    private static final String[] ICON_IDS = {
        "default", "disco-2026", "anniversary-20", "black-2024", "classic-2015", "retro-2013", "original-2008"
    };

    static String aliasSuffix(String id) {
        StringBuilder sb = new StringBuilder();
        for (String part : id.split("-")) {
            if (part.isEmpty()) continue;
            sb.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return sb.toString();
    }

    private ComponentName aliasFor(Context ctx, String id) {
        return new ComponentName(ctx.getPackageName(), ctx.getPackageName() + ".Icon" + aliasSuffix(id));
    }

    @PluginMethod
    public void setIcon(PluginCall call) {
        String name = call.getString("name", "default");
        boolean known = false;
        for (String id : ICON_IDS) if (id.equals(name)) known = true;
        if (!known) {
            call.reject("Unknown icon: " + name);
            return;
        }
        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        // Enable the new alias first so the app never has zero launcher entries
        pm.setComponentEnabledSetting(aliasFor(ctx, name),
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        for (String id : ICON_IDS) {
            if (id.equals(name)) continue;
            pm.setComponentEnabledSetting(aliasFor(ctx, id),
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
        }
        // Android Auto shows the media service's icon: switch it too
        try {
            SpotifreeMediaService.useIcon(ctx, name);
        } catch (Throwable ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void getIcon(PluginCall call) {
        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        String current = "default";
        for (String id : ICON_IDS) {
            int state = pm.getComponentEnabledSetting(aliasFor(ctx, id));
            boolean enabled = state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                || (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && id.equals("default"));
            if (enabled) {
                current = id;
                if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) break;
            }
        }
        JSObject ret = new JSObject();
        ret.put("name", current);
        call.resolve(ret);
    }
}
