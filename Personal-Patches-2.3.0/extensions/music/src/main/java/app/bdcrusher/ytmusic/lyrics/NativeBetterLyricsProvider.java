/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import org.json.JSONObject;

import app.morphe.extension.music.patches.lyrics.model.Lyrics;
import app.morphe.extension.music.patches.lyrics.model.TrackInfo;
import app.morphe.extension.music.patches.lyrics.parsers.TTMLParser;
import app.morphe.extension.music.patches.lyrics.requests.LyricsProvider;

/** Better Lyrics' public TTML lookup as a provider for Morphe's native panel. */
public final class NativeBetterLyricsProvider implements LyricsProvider {
    @Override public String name() { return "bLyrics"; }

    @Override public FetchResult fetch(TrackInfo track) throws Exception {
        if (track.title().isBlank() || track.artist().isBlank()) return null;

        String metadata = "s=" + LyricsNetwork.encode(track.title()) + "&a=" + LyricsNetwork.encode(track.artist());
        String exact = metadata;
        if (!track.album().isEmpty()) exact += "&al=" + LyricsNetwork.encode(track.album());
        if (track.durationSeconds() > 0) exact += "&d=" + track.durationSeconds();

        try (LyricsNetwork network = new LyricsNetwork()) {
            String ttml = fetchTtml(network, exact);
            boolean relaxed = ttml.isEmpty() && !metadata.equals(exact);
            if (relaxed) ttml = fetchTtml(network, metadata);
            if (ttml.isEmpty()) return null;
            Lyrics parsed = TTMLParser.ttmlToLyrics(ttml, name(), null);
            return relaxed ? FetchResult.blind(parsed) : FetchResult.of(parsed, track);
        }
    }

    private static String fetchTtml(LyricsNetwork network, String query) throws Exception {
        try {
            return new JSONObject(network.request("https://api.betterlyrics.org/getLyrics?" + query,
                    "GET", null, null)).optString("ttml");
        } catch (LyricsNetwork.HttpFailure failure) {
            if (failure.status == 404) return "";
            throw failure;
        }
    }
}
