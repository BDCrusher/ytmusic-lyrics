/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.playlists;

import android.app.AlertDialog;
import android.content.Context;
import android.preference.Preference;
import android.preference.PreferenceFragment;
import android.preference.PreferenceScreen;
import app.bdcrusher.ytmusic.common.FeaturePreferences;

/** Personal settings within the upstream Downloads page. */
@SuppressWarnings("deprecation")
public final class DownloadSettings {
    private DownloadSettings() {}

    public static void install(PreferenceFragment fragment) {
        Preference page = fragment.findPreference("morphe_external_downloader_screen");
        if (!(page instanceof PreferenceScreen screen) || screen.findPreference("bd_download_folder") != null) return;
        Context context = fragment.getActivity();
        Preference mode = screen.findPreference("morphe_download_mode");
        if (mode != null) {
            mode.setSummary("In-app uses YouTube Music’s account and Downloads. External opens your selected downloader.");
        }
        Preference savedFiles = FeaturePreferences.action(context);
        savedFiles.setTitle("Previous personal downloads");
        savedFiles.setSummary("Open songs and playlist groups saved by an earlier version");
        savedFiles.setOnPreferenceClickListener(ignored -> {
            app.morphe.extension.music.patches.downloads.LocalDownloadsView.showSavedFiles(fragment.getActivity());
            return true;
        });
        screen.addPreference(savedFiles);
        Preference folder = FeaturePreferences.action(context);
        folder.setKey("bd_download_folder");
        folder.setTitle("Choose YTDLnis download folder");
        folder.setSummary(ExternalFiles.status());
        folder.setOnPreferenceClickListener(ignored -> {
            ExternalFiles.choose(context);
            return true;
        });
        screen.addPreference(folder);
        PlaylistSettingsPage.trackFolder(folder);

        Preference disconnect = FeaturePreferences.action(context);
        disconnect.setTitle("Disconnect download folder");
        disconnect.setOnPreferenceClickListener(ignored -> {
            new AlertDialog.Builder(context)
                    .setTitle("Disconnect download folder?")
                    .setMessage("Your external files will be kept.")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Disconnect", (dialog, button) -> ExternalFiles.forget(context))
                    .show();
            return true;
        });
        screen.addPreference(disconnect);
        screen.addPreference(new AudioStoragePreference(context));
    }
}
