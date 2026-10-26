/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.common;
import android.preference.PreferenceFragment;
/** Common settings entry; feature pages are registered only for applied patches. */
@SuppressWarnings("deprecation")
public final class PersonalSettings {
    private PersonalSettings(){}
    public static void install(PreferenceFragment fragment){
        app.bdcrusher.ytmusic.lyrics.LyricsSettingsPage.install(fragment);
        app.bdcrusher.ytmusic.shaders.ShaderSettingsPage.install(fragment);
        app.bdcrusher.ytmusic.playlists.PlaylistSettingsPage.install(fragment);
    }
}
