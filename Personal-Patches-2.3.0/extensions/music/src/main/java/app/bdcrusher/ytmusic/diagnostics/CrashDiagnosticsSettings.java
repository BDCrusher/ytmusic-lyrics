/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.diagnostics;

import android.content.Intent;
import android.preference.Preference;
import android.preference.PreferenceFragment;
import android.preference.SwitchPreference;

@SuppressWarnings("deprecation")
public final class CrashDiagnosticsSettings {
    private CrashDiagnosticsSettings() {}

    public static void install(PreferenceFragment fragment) {
        var activity = fragment.getActivity();
        var root = fragment.getPreferenceScreen();
        if (activity == null || root == null || root.findPreference("bdcrusher_crash_diagnostics") != null) return;
        // Settings can be the first activity on a cold start from a deep link.
        PlaybackCrashRecorder.install(activity);
        var page = fragment.getPreferenceManager().createPreferenceScreen(activity);
        page.setKey("bdcrusher_crash_diagnostics");
        page.setTitle("Crash diagnostics");

        var capture = new SwitchPreference(activity);
        capture.setPersistent(false);
        capture.setTitle("Record playback steps");
        capture.setSummary("Keep a short history on this device, even when debug logging is off");
        capture.setChecked(PlaybackCrashRecorder.captureEnabled());
        capture.setOnPreferenceChangeListener((pref, value) -> {
            PlaybackCrashRecorder.setCaptureEnabled((Boolean) value);
            return true;
        });
        page.addPreference(capture);

        var export = new Preference(activity);
        export.setTitle("Save crash report");
        export.setSummary("Export playback steps, the latest captured crash, and Android exit records");
        export.setOnPreferenceClickListener(pref -> {
            fragment.startActivity(new Intent(activity, CrashReportActivity.class));
            return true;
        });
        page.addPreference(export);
        root.addPreference(page);
    }
}
