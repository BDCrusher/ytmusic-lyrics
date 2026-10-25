/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import android.app.Activity;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import app.morphe.extension.music.patches.lyrics.LyricsManager;
import app.morphe.extension.music.patches.lyrics.model.Lyrics;
import app.morphe.extension.music.patches.lyrics.model.TrackInfo;
import app.morphe.extension.music.settings.Settings;
import app.morphe.extension.music.shared.VideoInformation;
import app.morphe.extension.shared.Utils;
import org.json.JSONObject;

/** Starts discovery from playback, never from a requirement to open the lyrics panel first. */
public final class LyricsEntryCoordinator implements LyricsManager.Listener {
    private static final LyricsEntryCoordinator instance = new LyricsEntryCoordinator();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final LyricsEntryButton entry = new LyricsEntryButton();
    private String identity = "";
    private boolean started, available,definitelyNotFound;
    private SharedPreferences preferences;
    private final SharedPreferences.OnSharedPreferenceChangeListener preferencesListener = (p, key) -> {
        if ("serviceJwt".equals(key)) main.post(LyricsRepository::connectionChanged);
    };
    private final LyricsCatalog.Sink sink = new LyricsCatalog.Sink() {
        public void result(JSONObject payload) {
            if (hasLyricsPayload(payload)) {
                available = true;
                sync(false);
            }
        }
        public void notice(String message, boolean finished) {}
        public void completion(boolean notFound){definitelyNotFound=notFound&&!available;updateEntry();}
    };
    private final Runnable tick = new Runnable() {
        public void run() {
            try { sync(false); } catch (Exception ex) {
                LyricsDiagnostics.record("Lyrics entry", "Update failed: " + ex.getClass().getSimpleName());
            }
            main.postDelayed(this, 750);
        }
    };

    private LyricsEntryCoordinator() {}

    /** Invoked after the native metadata/playback callback in both editions. */
    public static void onPlaybackEvent() {
        instance.main.post(() -> {
            if (!instance.started) {
                instance.started = true;
                LyricsManager.getInstance().addListener(instance);
                instance.main.post(instance.tick);
            }
            instance.sync(false);
        });
    }

    @Override public void onLyricsChanged(LyricsManager.State state, Lyrics lyrics) { sync(false); }

    private void sync(boolean refresh) {
        try { syncNow(refresh); } catch (Exception ex) {
            LyricsDiagnostics.record("Lyrics entry", "Update failed: " + ex.getClass().getSimpleName());
            entry.clear();
        }
    }

    private void syncNow(boolean refresh) {
        Activity activity = Utils.getActivity();
        LyricsManager manager = LyricsManager.getInstance();
        TrackInfo track = manager.getCurrentTrack();
        String id = VideoInformation.getVideoId();
        if (!Settings.LYRICS_ENABLED.get() || track == null || id == null || id.isEmpty()) {
            if (!identity.isEmpty()) LyricsRepository.clear();
            identity = ""; available = false; entry.clear(); ServiceConnection.cancel(); return;
        }
        if (!id.equals(manager.getCommittedVideoId())) {
            if (!identity.isEmpty()) LyricsRepository.clear();
            identity = ""; available = false; entry.trackChanged(""); return;
        }
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            entry.clear(); return;
        }
        if (preferences == null) {
            preferences = LyricsConfig.preferences(activity.getApplicationContext());
            preferences.registerOnSharedPreferenceChangeListener(preferencesListener);
        }
        ServiceConnection.ensure(activity);
        String next = LyricsRepository.identity(track, id);
        if (!next.equals(identity) || refresh) {
            identity = next; available = false;definitelyNotFound=false; entry.trackChanged(next);
            LyricsDiagnostics.record("Lyrics entry", "Discovering video=" + id + " before panel attachment");
        }
        LyricsRepository.ensure(activity, track, id, refresh);
        // A panel refresh can replace the session. Re-subscribe and replay without another request.
        LyricsRepository.subscribe(sink);
        updateEntry();
    }

    private void updateEntry() {
        Activity activity = Utils.getActivity();
        String id = VideoInformation.getVideoId();
        if ((available||LyricsManager.getInstance().hasLyrics()) && Settings.LYRICS_ENABLED.get() && activity != null
                && id != null && id.equals(LyricsManager.getInstance().getCommittedVideoId())) {
            entry.update(activity, identity);
        } else if(!definitelyNotFound&&Settings.LYRICS_ENABLED.get()&&activity!=null)entry.orderWhilePending(identity);
        else if(definitelyNotFound)entry.notFound(identity);
        else entry.hideButton();
    }

    static boolean hasLyricsPayload(JSONObject payload) {
        return LyricsCatalog.hasLyricsPayload(payload);
    }
}
