/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import app.morphe.extension.music.patches.lyrics.model.TrackInfo;
import java.util.LinkedHashMap;

/** Media session metadata and playback IDs can arrive in either order. Main thread only. */
final class LyricsTrackBinding {
    private String recording = "";
    private final LinkedHashMap<String, TrackInfo> taggedTracks = new LinkedHashMap<>();
    private TrackInfo current;
    private TrackInfo previous;

    static boolean hasSong(TrackInfo track) {
        return track != null && !track.title().isBlank() && !track.artist().isBlank();
    }

    TrackInfo track(String id) {
        String next = isRecording(id) ? id : "";
        if (!recording.equals(next)) {
            if (current != null) previous = current;
            recording = next;
            current = taggedTracks.get(recording);
        }
        return current;
    }

    void metadata(String playing, String mediaId, TrackInfo track) {
        track(playing);
        if (!hasSong(track)) return;
        if (isRecording(mediaId)) {
            TrackInfo known = taggedTracks.remove(mediaId);
            TrackInfo tagged = refine(mediaId.equals(recording) ? current : known, track);
            if (taggedTracks.size() == 3) taggedTracks.remove(taggedTracks.keySet().iterator().next());
            taggedTracks.put(mediaId, tagged);
            if (mediaId.equals(recording)) current = tagged;
        } else if (!recording.isEmpty()) {
            if (track.equals(current)) current = refine(current, track);
            else if (current == null && !track.equals(previous)) current = track;
        }
    }

    private static boolean isRecording(String id) {
        return id != null && id.matches("[A-Za-z0-9_-]{11}");
    }

    private static TrackInfo refine(TrackInfo current, TrackInfo next) {
        if (!next.equals(current)) return next;
        return new TrackInfo(next.title(), next.artist(),
                next.album().isEmpty() ? current.album() : next.album(),
                next.durationSeconds() <= 0 ? current.durationSeconds() : next.durationSeconds());
    }
}
