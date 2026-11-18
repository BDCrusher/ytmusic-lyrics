/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import app.morphe.extension.music.patches.lyrics.model.Lyrics;
import app.morphe.extension.music.shared.VideoInformation;
import app.morphe.extension.shared.Utils;
import java.util.HashMap;
import java.util.Map;

/** Current-recording results used by the native mini-player and lock-screen callbacks. */
public final class PersonalLyricsSession {
    private static final Map<String, Lyrics> sources = new HashMap<>();
    private static String recording = "";

    private PersonalLyricsSession() {}

    public static String nativeOrder() {
        return LyricsConfig.nativeSources(Utils.getContext());
    }

    static synchronized void offer(String id, String key, Lyrics lyrics) {
        if (!id.equals(VideoInformation.getVideoId())) return;
        if (!id.equals(recording)) {
            recording = id;
            sources.clear();
        }
        sources.put(key, lyrics);
    }

    public static synchronized Lyrics current(Lyrics fallback) {
        if (sources.isEmpty() || !recording.equals(VideoInformation.getVideoId())) return fallback;
        String key = LyricsConfig.sessionSource(Utils.getContext(), sources.keySet());
        return key == null ? fallback : sources.get(key);
    }
}
