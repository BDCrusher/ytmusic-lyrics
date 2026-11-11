/*
 * Copyright 2026 Morphe.
 * https://github.com/MorpheApp/morphe-patches/pull/4232
 *
 * See the included NOTICE file for GPLv3 Section 7 terms that apply to this code.
 */

package app.morphe.extension.music.patches.downloads;

import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import app.morphe.extension.shared.Logger;

/**
 * Stores each local playlist as a JSON file named after its id.
 * <p>
 * Tracks are saved by file name, because the absolute path of the app storage changes if the app
 * is moved to another storage volume. Tracks that no longer exist are skipped when loading, and
 * are dropped from the file the next time the playlist is saved.
 */
final class OfflinePlaylistManager {

    private static final String FILE_EXTENSION = ".json";
    private static final String KEY_NAME = "name";
    private static final String KEY_TRACKS = "tracks";

    private final File musicRoot;
    private final File playlistsDirectory;

    OfflinePlaylistManager(File musicRoot) {
        this.musicRoot = musicRoot;
        this.playlistsDirectory = new File(musicRoot, "playlists");
    }

    /**
     * @return All playlists that can be read, sorted by name.
     */
    List<OfflinePlaylist> loadPlaylists() {
        List<OfflinePlaylist> playlists = new ArrayList<>();
        File[] files = playlistsDirectory.listFiles(
                file -> file.isFile() && file.getName().endsWith(FILE_EXTENSION));
        if (files == null) return playlists;

        for (File file : files) {
            OfflinePlaylist playlist = read(file);
            if (playlist != null) playlists.add(playlist);
        }
        playlists.sort(Comparator.comparing(OfflinePlaylist::name, String.CASE_INSENSITIVE_ORDER));
        return playlists;
    }

    @Nullable
    OfflinePlaylist getPlaylist(String id) {
        File file = fileOf(id);
        return file.isFile() ? read(file) : null;
    }

    synchronized void saveSource(String browseId, PlaylistTracksRequest.Result result) throws IOException {
        if (!browseId.matches("(?:VL|MPRE)[A-Za-z0-9_-]{1,120}")) throw new IOException("Invalid source playlist");
        String id = "source_" + browseId;
        OfflinePlaylist previous = getPlaylist(id);
        if (!result.complete() && previous != null) return;
        String name = result.title().isBlank() ? previous == null ? browseId : previous.name() : result.title();
        String queueId = result.queueId();
        if (queueId.isEmpty() && browseId.startsWith("VL")) queueId = browseId.substring(2);
        save(new OfflinePlaylist(id, name, List.of(), browseId, queueId, result.entries()));
    }

    /**
     * Legacy personal batches use a separate store. Import each record once, preserving the
     * original files and positions, including partial batches.
     */
    synchronized void importLegacy(android.content.Context context) {
        File legacy = new File(context.getFilesDir(), "bdcrusher-offline-playlists");
        File[] sources = legacy.listFiles(file -> file.isFile()
                && (file.getName().endsWith(".json") || file.getName().endsWith(".json.bak")));
        if (sources == null) return;
        android.content.SharedPreferences imported =
                context.getSharedPreferences("bdcrusher_downloads_imports", android.content.Context.MODE_PRIVATE);
        for (File candidate : sources) {
            String name = candidate.getName();
            if (name.endsWith(".bak")) name = name.substring(0, name.length() - 4);
            if (imported.getBoolean(name, false) || candidate.length() > 8 * 1024 * 1024) continue;
            try {
                JSONObject source = new JSONObject(OfflineStorage.readText(new File(legacy, name)));
                String id = source.getString("id");
                String browseId = id.startsWith("VL") || id.startsWith("MPRE") ? id : "VL" + id;
                if (!browseId.matches("(?:VL|MPRE)[A-Za-z0-9_-]{1,120}")) continue;
                JSONArray rows = source.getJSONArray("entries");
                List<PlaylistTracksRequest.Entry> entries = new ArrayList<>(rows.length());
                for (int i = 0; i < rows.length(); i++) {
                    JSONObject row = rows.getJSONObject(i);
                    String recording = row.optString("id");
                    boolean valid = recording.matches("[A-Za-z0-9_-]{11}");
                    entries.add(new PlaylistTracksRequest.Entry(valid ? recording : "", row.optString("title"),
                            valid && !"unavailable".equals(row.optString("state"))));
                }
                if (!entries.isEmpty() && getPlaylist("source_" + browseId) == null) {
                    saveSource(browseId, new PlaylistTracksRequest.Result(
                            source.optString("title"), entries, source.optBoolean("enumerated")));
                }
                imported.edit().putBoolean(name, true).commit();
            } catch (Exception ex) {
                Logger.printException(() -> "Could not import legacy download playlist", ex);
            }
        }
    }

    @Nullable
    File savedAudio(String id) {
        if (!id.matches("[A-Za-z0-9_-]{11}")) return null;
        File webm = new File(musicRoot, id + ".webm");
        if (webm.isFile() && webm.length() > 0) return webm;
        File m4a = new File(musicRoot, id + ".m4a");
        return m4a.isFile() && m4a.length() > 0 ? m4a : null;
    }

    void createPlaylist(String name, List<String> trackPaths) throws IOException {
        String id = "playlist_" + System.currentTimeMillis();
        save(new OfflinePlaylist(id, name, new ArrayList<>(new LinkedHashSet<>(trackPaths))));
    }

    /**
     * Tracks that are already in the playlist keep their position.
     */
    void addTracks(String id, List<String> trackPaths) throws IOException {
        OfflinePlaylist playlist = require(id);
        Set<String> updated = new LinkedHashSet<>(playlist.trackPaths());
        updated.addAll(trackPaths);
        setTracks(playlist, new ArrayList<>(updated));
    }

    /**
     * Only changes the playlist. The downloaded file is kept.
     */
    void removeTrack(String id, String trackPath) throws IOException {
        OfflinePlaylist playlist = require(id);
        List<String> updated = new ArrayList<>(playlist.trackPaths());
        updated.remove(trackPath);
        setTracks(playlist, updated);
    }

    void setTrackOrder(String id, List<String> trackPaths) throws IOException {
        setTracks(require(id), trackPaths);
    }

    void renamePlaylist(String id, String name) throws IOException {
        OfflinePlaylist playlist = require(id);
        save(new OfflinePlaylist(playlist.id(), name, playlist.trackPaths(), playlist.browseId(), playlist.queueId(), playlist.sourceEntries()));
    }

    /**
     * Only removes the playlist. The downloaded files are kept.
     */
    void deletePlaylist(String id) {
        OfflineStorage.delete(fileOf(id));
    }

    private File fileOf(String id) {
        return new File(playlistsDirectory, id + FILE_EXTENSION);
    }

    private OfflinePlaylist require(String id) throws IOException {
        OfflinePlaylist playlist = getPlaylist(id);
        if (playlist == null) throw new IOException("Playlist not found: " + id);
        return playlist;
    }

    private void setTracks(OfflinePlaylist playlist, List<String> trackPaths) throws IOException {
        if (playlist.fromSource()) throw new IOException("Downloaded source order is fixed");
        save(new OfflinePlaylist(playlist.id(), playlist.name(), trackPaths));
    }

    @Nullable
    private OfflinePlaylist read(File file) {
        try {
            JSONObject json = new JSONObject(OfflineStorage.readText(file));

            List<String> trackPaths = new ArrayList<>();
            JSONArray tracks = json.getJSONArray(KEY_TRACKS);
            for (int i = 0; i < tracks.length(); i++) {
                File track = new File(musicRoot, tracks.getString(i));
                if (track.isFile()) trackPaths.add(track.getAbsolutePath());
            }

            String fileName = file.getName();
            String id = fileName.substring(0, fileName.length() - FILE_EXTENSION.length());
            String browseId = json.optString("sourceBrowseId");
            if (!browseId.isEmpty() && !id.equals("source_" + browseId)) return null;
            List<PlaylistTracksRequest.Entry> source = new ArrayList<>();
            JSONArray entries = json.optJSONArray("sourceEntries");
            if (!browseId.isEmpty() && entries != null) {
                trackPaths.clear();
                for (int i = 0; i < entries.length(); i++) {
                    JSONObject row = entries.getJSONObject(i);
                    String recording = row.getString("id");
                    boolean available = row.getBoolean("available");
                    source.add(new PlaylistTracksRequest.Entry(recording, row.optString("title"), available));
                    File saved = available ? savedAudio(recording) : null;
                    if (saved != null) trackPaths.add(saved.getAbsolutePath());
                }
            }
            String queueId = json.optString("sourceQueueId", browseId.startsWith("VL") ? browseId.substring(2) : "");
            return new OfflinePlaylist(id, json.getString(KEY_NAME), trackPaths, browseId, queueId, source);
        } catch (IOException | JSONException ex) {
            Logger.printException(() -> "Could not read playlist: " + file, ex);
            return null;
        }
    }

    private void save(OfflinePlaylist playlist) throws IOException {
        if (!playlistsDirectory.isDirectory() && !playlistsDirectory.mkdirs()) {
            throw new IOException("Could not create " + playlistsDirectory);
        }

        JSONArray tracks = new JSONArray();
        for (String trackPath : playlist.trackPaths()) {
            tracks.put(new File(trackPath).getName());
        }

        try {
            JSONObject json = new JSONObject()
                    .put(KEY_NAME, playlist.name())
                    .put(KEY_TRACKS, tracks);
            if (playlist.fromSource()) {
                JSONArray entries = new JSONArray();
                for (PlaylistTracksRequest.Entry row : playlist.sourceEntries()) {
                    entries.put(new JSONObject().put("id", row.id()).put("title", row.title())
                            .put("available", row.available()));
                }
                json.put("sourceBrowseId", playlist.browseId()).put("sourceQueueId", playlist.queueId()).put("sourceEntries", entries);
            }
            OfflineStorage.writeText(fileOf(playlist.id()), json.toString());
        } catch (JSONException ex) {
            throw new IOException("Could not serialize playlist: " + playlist.id(), ex);
        }
    }
}
