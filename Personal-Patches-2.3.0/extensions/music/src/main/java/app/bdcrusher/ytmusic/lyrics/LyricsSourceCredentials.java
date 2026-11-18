/* Copyright 2026 BDCrusher. Uses Morphe's provider validation and dialog components. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import static app.morphe.extension.shared.StringRef.str;

import android.app.Dialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.text.InputType;
import android.widget.LinearLayout;
import android.widget.TextView;
import app.morphe.extension.music.patches.lyrics.requests.AppleMusicProvider;
import app.morphe.extension.music.patches.lyrics.requests.CaptionsFetcher;
import app.morphe.extension.music.patches.lyrics.requests.DeezerProvider;
import app.morphe.extension.music.patches.lyrics.requests.MusixmatchProvider;
import app.morphe.extension.music.patches.lyrics.requests.SpotifyProvider;
import app.morphe.extension.music.settings.Settings;
import app.morphe.extension.music.settings.preference.ThemedInput;
import app.morphe.extension.shared.Utils;
import app.morphe.extension.shared.settings.StringSetting;
import app.morphe.extension.shared.theme.ThemeUtils;
import app.morphe.extension.shared.ui.CustomDialog;
import app.morphe.extension.shared.ui.Dim;
import java.util.function.Predicate;

enum LyricsSourceCredentials {
    CAPTIONS("yt-captions", "youtube_cookies", "https://youtube.com", Settings.LYRICS_CAPTION_COOKIES,
            CaptionsFetcher::validateYouTubeCookies, true, null),
    SPOTIFY("morphe-spotify", "spotify_token", "https://open.spotify.com", Settings.SPOTIFY_TOKEN,
            SpotifyProvider::validateToken, true, SpotifyProvider::invalidateToken),
    DEEZER("morphe-deezer", "deezer_arl", "https://www.deezer.com", Settings.DEEZER_ARL,
            DeezerProvider::validateArl, true, null),
    APPLE("morphe-apple", "apple_music_token", "https://music.apple.com", Settings.APPLE_MUSIC_TOKEN,
            AppleMusicProvider::validateToken, false, null),
    MUSIXMATCH("morphe-musixmatch", "musixmatch_token", "https://www.musixmatch.com", Settings.MUSIXMATCH_TOKEN,
            MusixmatchProvider::validateToken, false, MusixmatchProvider::invalidateToken);

    final String key;
    private final String resource, site;
    private final StringSetting setting;
    private final Predicate<String> validate;
    private final boolean required;
    private final Runnable invalidate;
    private static Dialog activeDialog;

    LyricsSourceCredentials(String key, String resource, String site, StringSetting setting,
                            Predicate<String> validate, boolean required, Runnable invalidate) {
        this.key = key;
        this.resource = "morphe_music_" + resource;
        this.site = site;
        this.setting = setting;
        this.validate = validate;
        this.required = required;
        this.invalidate = invalidate;
    }

    static LyricsSourceCredentials forSource(String key) {
        for (var credential : values()) if (credential.key.equals(key)) return credential;
        return null;
    }

    boolean missing() { return required && !configured(); }
    boolean configured() { return !setting.get().isBlank(); }
    String title() { return str(resource + "_title"); }
    String summary() { return configured() ? "Configured" : required ? "Required to enable this source" : "Optional provider credential"; }

    private void save(String value) {
        setting.save(value);
        if (invalidate != null) invalidate.run();
    }

    void show(Context context, Runnable accepted, Runnable cleared) {
        if (activeDialog != null) return;
        // Drafts are separate from confirmed provider settings and are never used in requests.
        SharedPreferences drafts = context.getSharedPreferences("bdcrusher_lyrics_credential_drafts", Context.MODE_PRIVATE);
        var content = new LinearLayout(context);
        content.setOrientation(LinearLayout.VERTICAL);
        var instruction = new TextView(context);
        instruction.setText(str(resource + "_dialog_instruction"));
        instruction.setTextColor(ThemeUtils.getAppForegroundColor());
        instruction.setPadding(0, 0, 0, Dim.dp12);
        content.addView(instruction);

        var input = ThemedInput.create(context);
        input.setHint(str(resource + "_dialog_hint"));
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        if (this == CAPTIONS) {
            input.setSingleLine(false);
            input.setMinLines(3);
            input.setMaxLines(6);
        }
        input.setText(drafts.getString(key, setting.get()));
        input.setSelection(input.length());
        content.addView(input, new LinearLayout.LayoutParams(-1, -2));
        content.addView(CustomDialog.createButton(context, null, str("morphe_music_token_dialog_get_token"),
                () -> ThemedInput.openInBrowser(context, site, "Provider credential help"), false, false));

        var dialog = CustomDialog.create(context, title(), null, null, str("morphe_settings_save"), () -> {
            String candidate = input.getText().toString().trim();
            if (candidate.isEmpty()) return;
            drafts.edit().putString(key, candidate).apply();
            Utils.runOnBackgroundThread(() -> {
                boolean valid;
                try { valid = validate.test(candidate); }
                catch (RuntimeException | LinkageError unavailable) { valid = false; }
                boolean confirmed = valid;
                Utils.runOnMainThread(() -> {
                    // An older validation must not overwrite a newer edit or a cleared draft.
                    if (!candidate.equals(drafts.getString(key, ""))) return;
                    if (confirmed) {
                        save(candidate);
                        drafts.edit().remove(key).apply();
                        Utils.showToastShort(str(resource + "_toast_saved"));
                        accepted.run();
                    } else {
                        Utils.showToastShort("Couldn’t verify the credential. Your entry was kept for retry.");
                    }
                });
            });
        }, null, str("morphe_music_scrobbling_log_out"), configured() ? () -> {
            save("");
            drafts.edit().remove(key).apply();
            cleared.run();
        } : null, true);
        dialog.second.addView(content, dialog.second.getChildCount()-1, new LinearLayout.LayoutParams(-1, -2));
        activeDialog = dialog.first;
        dialog.first.setOnDismissListener(d -> { if (activeDialog == d) activeDialog = null; });
        try { dialog.first.show(); }
        catch (android.view.WindowManager.BadTokenException ignored) { activeDialog = null; }
    }
}
