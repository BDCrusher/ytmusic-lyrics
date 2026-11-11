/*
 * Copyright 2026 Morphe.
 * https://github.com/MorpheApp/morphe-patches/pull/2528
 * https://github.com/MorpheApp/morphe-patches/pull/4436
 *
 * See the included NOTICE file for GPLv3 Section 7 terms that apply to this code.
 */

package app.morphe.extension.music.patches.downloads;

import static app.morphe.extension.shared.StringRef.str;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Environment;

import androidx.annotation.Nullable;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;

import app.morphe.extension.music.patches.scrobbling.ScrobbleManager;
import app.morphe.extension.music.patches.spoof.SpoofVideoStreamsPatch;
import app.morphe.extension.music.settings.Settings;
import app.morphe.extension.music.shared.VideoInformation;
import app.morphe.extension.shared.Logger;
import app.morphe.extension.shared.Utils;
import app.morphe.extension.shared.innertube.PlayerResponseOuterClass.Format;
import app.morphe.extension.shared.innertube.PlayerResponseOuterClass.PlayerResponse;
import app.morphe.extension.shared.innertube.PlayerResponseOuterClass.ThumbnailEntry;
import app.morphe.extension.shared.innertube.PlayerResponseOuterClass.VideoDetails;
import app.morphe.extension.shared.requests.Requester;
import app.morphe.extension.shared.spoof.requests.StreamingDataRequest;

/** Downloads the already resolved InnerTube audio stream without leaving YouTube Music. */
public final class LocalDownloadManager {

    private static final String DOWNLOAD_CHANNEL = "morphe_audio_downloads";
    private static final String USER_AGENT =
            "com.google.android.youtube/19.47.53 (Linux; U; Android 14) gzip";

    /** Ranges are fetched in parallel, which is what makes a download finish in seconds. */
    private static final int SEGMENT_COUNT = 4;
    private static final int BUFFER_SIZE = 64 * 1024;

    /**
     * The system silently drops notifications posted faster than a few per second, which used to
     * leave stale progress on screen after the download had finished. Updates are spaced out.
     */
    private static final long NOTIFICATION_INTERVAL_MILLISECONDS = 1000;
    private static final AtomicLong lastNotificationTime = new AtomicLong();

    private static final int CONNECT_TIMEOUT_MILLISECONDS = 15_000;
    private static final int READ_TIMEOUT_MILLISECONDS = 30_000;

    /** A range that makes no progress this many times in a row is treated as stalled. */
    private static final int MAX_STALLED_ATTEMPTS = 4;

    private static final Pattern VIDEO_ID = Pattern.compile("[A-Za-z0-9_-]{1,20}");

    private static final String THUMBNAIL_URL = "https://i.ytimg.com/vi/";

    private static final Set<String> ACTIVE_DOWNLOADS = ConcurrentHashMap.newKeySet();

    private LocalDownloadManager() {
    }

    /** Must be called from the main thread. Resolution and downloading happen in background. */
    public static void enqueue(String videoId) {
        enqueue(videoId, null, null);
    }

    /** The sheet resolved these formats from the same recording immediately before enqueueing. */
    public static void enqueue(String videoId, MediaOptions options, Choice choice) {
        // Every file of a download is named after the id, so anything that is not a plain id
        // is refused rather than written under a different name than it is looked up by.
        if (!VIDEO_ID.matcher(videoId).matches()) {
            Logger.printDebug(() -> "Refusing to download an unusable id: " + videoId);
            Utils.showToastShort(str("morphe_music_downloads_unknown_track"));
            return;
        }

        // The scrobbler describes whatever the player is on, so it may only be used for that
        // track. Any other track is described by the video details of its own player response.
        final boolean isPlayingTrack = videoId.equals(VideoInformation.getVideoId());
        ScrobbleManager metadata = ScrobbleManager.getInstance();

        String title = isPlayingTrack ? metadata.getCurrentTitle() : null;
        String artist = isPlayingTrack ? metadata.getCurrentArtist() : null;
        String album = isPlayingTrack ? metadata.getCurrentAlbum() : null;
        int duration = isPlayingTrack ? metadata.getCurrentDurationSeconds() : 0;
        Bitmap artwork = isPlayingTrack ? metadata.getCurrentArtwork() : null;

        Utils.submitOnBackgroundThread(() -> {
            downloadBlocking(videoId, title, artist, album, duration, artwork, false, options, choice);
            return null;
        });
    }

    /** Told each time a track has been saved. Only used on the main thread. */
    private static final Set<Runnable> savedListeners = new HashSet<>();

    /** Must be called on the main thread. */
    static void addSavedListener(Runnable listener) {
        Utils.verifyOnMainThread();
        savedListeners.add(listener);
    }

    /** Must be called on the main thread. */
    static void removeSavedListener(Runnable listener) {
        Utils.verifyOnMainThread();
        savedListeners.remove(listener);
    }

    static void notifyTrackSaved() {
        Utils.runOnMainThreadNowOrLater(() -> {
            for (Runnable listener : savedListeners) {
                listener.run();
            }
        });
    }

    /**
     * Downloads one track of a playlist. Must be called off the main thread.
     * Shows no toast or notification of its own, since the playlist download shows its progress.
     *
     * @return If the track is saved, including if it already was.
     */
    static boolean downloadPlaylistTrack(String videoId) {
        if (!VIDEO_ID.matcher(videoId).matches()) {
            Logger.printDebug(() -> "Skipping playlist entry with an unusable id: " + videoId);
            return false;
        }
        return downloadPlaylistTrack(videoId, null, null);
    }

    static boolean downloadPlaylistTrack(String videoId, MediaOptions options, Choice choice) {
        return downloadBlocking(videoId, null, null, null, 0, null, true, options, choice);
    }

    /** Compatibility for explicitly resumed legacy batches. */
    public static void enqueueMedia(String id, app.bdcrusher.ytmusic.playlists.MediaSelection selection) {
        Utils.submitOnBackgroundThread(() -> {
            MediaOptions options = mediaOptions(id, selection.kind() ==
                    app.bdcrusher.ytmusic.playlists.MediaSelection.Kind.VIDEO);
            Format audio = app.bdcrusher.ytmusic.playlists.AudioQuality.select(options.formats(), selection.audio());
            if (audio == null) audio = bestAudio(options);
            Format video = selection.kind() == app.bdcrusher.ytmusic.playlists.MediaSelection.Kind.VIDEO
                    ? selection.chooseVideo(options.formats(), app.bdcrusher.ytmusic.playlists.DownloadCatalog::videoSupported) : null;
            boolean success = downloadPlaylistTrack(id, options, audio == null ? null : new Choice(audio, video));
            var catalog = app.bdcrusher.ytmusic.playlists.DownloadCatalog.progress(id);
            if (success && catalog == null) app.bdcrusher.ytmusic.playlists.DownloadCatalog.complete(id, selection, video == null ? "Audio" : "Video + audio");
            app.bdcrusher.ytmusic.playlists.PlaylistRuntime.finished(id);
            return null;
        });
    }

    public record MediaOptions(String id, List<Format> formats, VideoDetails details) {
        public int seconds() { return details.getLengthSeconds(); }
    }

    public record Choice(Format audio, @Nullable Format video) {}

    public static Format bestAudio(MediaOptions options) {
        Format opus = app.bdcrusher.ytmusic.playlists.AudioQuality.select(options.formats(),
                app.bdcrusher.ytmusic.playlists.DownloadPrompt.selected(Utils.getContext()));
        return opus != null ? opus : options.formats().stream().filter(f -> f.getMimeType().startsWith("audio/"))
                .max(Comparator.comparingInt(Format::getBitrate)).orElse(null);
    }

    public static MediaOptions mediaOptions(String videoId, boolean includeVideo) {
        PlayerResponse response = resolveResponse(videoId);
        if (response == null) return new MediaOptions(videoId, List.of(), VideoDetails.getDefaultInstance());
        List<Format> formats = new ArrayList<>();
        for (Format format : response.getStreamingData().getAdaptiveFormatsList()) {
            if (format.getUrl().isBlank()) continue;
            if (format.getMimeType().startsWith("audio/") || includeVideo &&
                    app.bdcrusher.ytmusic.playlists.MediaSelection.video(format) &&
                    app.bdcrusher.ytmusic.playlists.DownloadCatalog.videoSupported(format)) formats.add(format);
        }
        return new MediaOptions(videoId, List.copyOf(formats), response.getVideoDetails());
    }

    /** Cancels a notification of {@link #showDownloadNotification}. */
    static void cancelDownloadNotification(String key) {
        Utils.runOnMainThread(() -> {
            NotificationManager manager = (NotificationManager)
                    Utils.getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) manager.cancel(key.hashCode());
        });
    }

    public static boolean active(String videoId) {
        return ACTIVE_DOWNLOADS.contains(videoId);
    }

    static boolean isDownloaded(String videoId) {
        File directory = getDownloadDirectory();
        return new File(directory, videoId + ".webm").isFile()
                || new File(directory, videoId + ".m4a").isFile();
    }

    static File getDownloadDirectory() {
        return new File(Utils.getContext().getExternalFilesDir(Environment.DIRECTORY_MUSIC), "Morphe");
    }

    /**
     * @param quiet If no toast or notification is shown, for the tracks of a playlist download.
     * @return If the track is saved, including if it already was.
     */
    private static boolean downloadBlocking(String videoId, String title, String artist, String album,
                                            int duration, Bitmap artwork, boolean quiet,
                                            @Nullable MediaOptions options, @Nullable Choice choice) {
        if (!ACTIVE_DOWNLOADS.add(videoId)) {
            if (!quiet) Utils.showToastShort(str("morphe_music_downloads_already_running"));
            return false;
        }

        try {
            File directory = getDownloadDirectory();

            if (isDownloaded(videoId) && (choice == null ||
                    choice.video() == null || savedVideoMatches(videoId, choice.video()))) {
                Logger.printDebug(() -> "Already downloaded: " + videoId);
                if (!quiet) Utils.showToastShort(str("morphe_music_downloads_already_saved"));
                return true;
            }

            if (options == null) options = mediaOptions(videoId, false);
            if (!videoId.equals(options.id())) throw new IllegalStateException("Download recording changed");
            Format format = choice == null ? bestAudio(options) : choice.audio();
            Format video = choice == null ? null : choice.video();
            if (format == null || !options.formats().contains(format) || !format.getMimeType().startsWith("audio/")
                    || video != null && (!options.formats().contains(video)
                    || !app.bdcrusher.ytmusic.playlists.MediaSelection.video(video))) {
                throw new IllegalStateException("Selected stream unavailable");
            }
            Logger.printDebug(() -> "Downloading " + videoId + " as itag " + format.getItag()
                    + " (" + format.getMimeType() + ")");

            VideoDetails details = options.details();

            // Anything the caller already knows wins, the player response only fills the blanks.
            title = firstNotBlank(title, details.getTitle(), videoId);
            artist = firstNotBlank(artist, stripTopic(details.getOwnerChannelName()), "");
            if (duration <= 0) duration = details.getLengthSeconds();
            if (artwork == null) artwork = resolveArtwork(videoId, details);
            if (!directory.isDirectory() && !directory.mkdirs()) {
                throw new IllegalStateException("Could not create download directory");
            }

            String extension = format.getMimeType().contains("mp4") ? ".m4a" : ".webm";
            File destination = new File(directory, videoId + extension);
            File temporary = new File(directory, destination.getName() + ".part");

            if (temporary.exists() && !temporary.delete()) {
                throw new IllegalStateException("Could not reset partial audio file");
            }

            downloadWithResume(videoId, title, format.getUrl(), temporary,
                    format.getContentLength(), quiet || video != null);
            requireMediaTrack(temporary, "audio/");

            // Before the audio file gets its final name, since the downloads screen reads each
            // track once and would otherwise keep listing it without its title and cover.
            OfflineTrack.save(directory, videoId, title, artist, album, duration, artwork);

            if (destination.exists() && !destination.delete()) {
                throw new IllegalStateException("Could not replace audio file");
            }
            if (!temporary.renameTo(destination)) {
                throw new IllegalStateException("Could not finish audio file");
            }
            Logger.printDebug(() -> "Saved " + destination + " (" + destination.length() + " bytes)");

            app.bdcrusher.ytmusic.playlists.LocalPlayback.savedFile(videoId, format, details, destination);
            OfflineCatalogue.added(videoId);
            notifyTrackSaved();
            if (video != null) {
                try {
                    saveVideo(videoId, title, details, video, directory, quiet);
                } catch (Exception ex) {
                    Logger.printInfo(() -> "Video download failed; saved audio retained: " + videoId, ex);
                    if (!quiet) Utils.showToastShort("Video unavailable. Audio was saved.");
                    return false;
                }
            }
            app.bdcrusher.ytmusic.lyrics.LyricsPrefetch.enqueue(Utils.getContext(), videoId,
                    title, artist, duration, ignored -> {});
            if (!quiet) Utils.showToastShort(str("morphe_music_downloads_complete"));
            return true;
        } catch (Exception ex) {
            if (quiet) {
                // A playlist can have many unavailable tracks, and an exception would show a
                // toast for each.
                Logger.printInfo(() -> "Playlist track download failed: " + videoId, ex);
                return false;
            }
            Logger.printException(() -> "Local audio download failed: " + videoId, ex);
            awaitNotificationSlot();
            showDownloadNotification(videoId, title, 0, false, str("morphe_music_downloads_failed"));
            Utils.showToastShort(str("morphe_music_downloads_failed"));
            return false;
        } finally {
            ACTIVE_DOWNLOADS.remove(videoId);
        }
    }

    private static boolean savedVideoMatches(String id, Format video) {
        byte[] metadata = app.bdcrusher.ytmusic.playlists.LocalPlayback.response(id);
        if (metadata == null) return false;
        try {
            return PlayerResponse.parseFrom(metadata).getStreamingData().getAdaptiveFormatsList().stream()
                    .anyMatch(saved -> saved.getMimeType().startsWith("video/") && saved.getItag() == video.getItag());
        } catch (Exception malformed) {
            return false;
        }
    }

    private static void requireMediaTrack(File file, String type) throws IOException {
        android.media.MediaExtractor extractor = new android.media.MediaExtractor();
        try {
            extractor.setDataSource(file.getAbsolutePath());
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                String mime = extractor.getTrackFormat(i).getString(android.media.MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith(type)) return;
            }
            throw new IOException("Downloaded file has no " + type + " track");
        } finally {
            extractor.release();
        }
    }

    private static void saveVideo(String id, String title, VideoDetails details, Format video,
                                  File directory, boolean quiet) throws Exception {
        String extension = video.getMimeType().contains("webm") ? ".webm" : ".mp4";
        File destination = new File(directory, id + ".video" + extension);
        File temporary = new File(directory, destination.getName() + ".part");
        if (temporary.exists() && !temporary.delete()) throw new IOException("Could not reset video part");
        downloadWithResume(id, title, video.getUrl(), temporary, video.getContentLength(), quiet);
        requireMediaTrack(temporary, "video/");
        if (!temporary.renameTo(destination)) throw new IOException("Could not publish video file");
        app.bdcrusher.ytmusic.playlists.LocalPlayback.savedVideo(id, video, details, destination);
    }

    private static String firstNotBlank(@Nullable String value, String fallback, String lastResort) {
        if (value != null && !value.isBlank()) return value;
        if (!fallback.isBlank()) return fallback;
        return lastResort;
    }

    /** Music uploads are owned by an "Artist - Topic" channel, which is not the artist name. */
    private static String stripTopic(String channelName) {
        return channelName.endsWith(" - Topic")
                ? channelName.substring(0, channelName.length() - " - Topic".length())
                : channelName;
    }

    /** @return Whether a progress update may be posted without the system dropping it. */
    static boolean canPostProgress() {
        long now = System.currentTimeMillis();
        long previous = lastNotificationTime.get();
        return now - previous >= NOTIFICATION_INTERVAL_MILLISECONDS
                && lastNotificationTime.compareAndSet(previous, now);
    }

    /**
     * Waits for the next slot, so a notification that matters is never the one being dropped.
     * The loop sleeps exactly as long as the slot is away, and repeats only if another thread
     * took the slot first. Must be called off the main thread.
     */
    static void awaitNotificationSlot() {
        while (true) {
            long now = System.currentTimeMillis();
            long previous = lastNotificationTime.get();
            long remaining = NOTIFICATION_INTERVAL_MILLISECONDS - (now - previous);

            if (remaining <= 0) {
                if (lastNotificationTime.compareAndSet(previous, now)) return;
                continue;
            }

            try {
                //noinspection BusyWait
                Thread.sleep(remaining);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    /**
     * Some videos come back without any video details, so the thumbnail of the id is used as a
     * fallback. It exists for every video, while the largest size does not.
     */
    @Nullable
    private static Bitmap resolveArtwork(String videoId, VideoDetails details) {
        Bitmap artwork = downloadArtwork(largestThumbnail(details));
        if (artwork != null) return artwork;

        artwork = downloadArtwork(THUMBNAIL_URL + videoId + "/maxresdefault.jpg");
        return artwork != null ? artwork : downloadArtwork(THUMBNAIL_URL + videoId + "/hqdefault.jpg");
    }

    @Nullable
    private static String largestThumbnail(VideoDetails details) {
        String url = null;
        int widest = 0;
        for (ThumbnailEntry entry : details.getThumbnail().getThumbnailsList()) {
            if (entry.getWidth() >= widest && !entry.getUrl().isBlank()) {
                widest = entry.getWidth();
                url = entry.getUrl();
            }
        }
        return url;
    }

    @Nullable
    private static Bitmap downloadArtwork(@Nullable String url) {
        if (url == null || url.isBlank()) return null;
        try (InputStream input = Requester.openConnection(url).getInputStream()) {
            return BitmapFactory.decodeStream(input);
        } catch (Exception ex) {
            Logger.printDebug(() -> "Could not fetch artwork: " + url, ex);
            return null;
        }
    }

    private static void downloadWithResume(String videoId, String title, String url,
                                           File temporary, long expectedLength,
                                           boolean quiet) throws Exception {
        if (!quiet) {
            Utils.showToastShort(str("morphe_music_downloads_started"));
            awaitNotificationSlot();
            showDownloadNotification(videoId, title, 0, true, str("morphe_music_downloads_starting"));
        }

        if (expectedLength <= 0) expectedLength = probeContentLength(url);
        final long totalLength = expectedLength;

        if (totalLength <= 0) {
            downloadUnknownLength(url, temporary);
        } else {
            downloadInParallel(videoId, title, url, temporary, totalLength, quiet);
        }

        if (totalLength > 0 && temporary.length() != totalLength) {
            throw new IllegalStateException(
                    "Incomplete audio file: " + temporary.length() + "/" + totalLength);
        }
        if (!quiet) {
            awaitNotificationSlot();
            showDownloadNotification(videoId, title, 100, false, str("morphe_music_downloads_complete"));
        }
    }

    private static void downloadInParallel(String videoId, String title, String url,
                                           File temporary, long totalLength,
                                           boolean quiet) throws Exception {
        try (RandomAccessFile file = new RandomAccessFile(temporary, "rw")) {
            file.setLength(totalLength);
        }

        AtomicLong downloaded = new AtomicLong();
        long segmentSize = (totalLength + SEGMENT_COUNT - 1) / SEGMENT_COUNT;

        // Android's ExecutorService is not AutoCloseable, so it is shut down in the finally below.
        //noinspection resource
        ExecutorService executor = Executors.newFixedThreadPool(SEGMENT_COUNT);
        List<Future<?>> futures = new ArrayList<>();

        try {
            for (int index = 0; index < SEGMENT_COUNT; index++) {
                long start = index * segmentSize;
                long end = Math.min(totalLength - 1, start + segmentSize - 1);
                if (start > end) continue;

                futures.add(executor.submit(() -> {
                    downloadRange(url, temporary, start, end, downloaded, bytes -> {
                        if (quiet || !canPostProgress()) return;
                        int progress = (int) Math.min(99, bytes * 100 / totalLength);
                        showDownloadNotification(videoId, title, progress, true,
                                str("morphe_music_downloads_progress", progress));
                    });
                    return null;
                }));
            }

            for (Future<?> future : futures) {
                future.get();
            }
        } finally {
            executor.shutdownNow();
        }
    }

    private interface ProgressCallback {
        void update(long bytes);
    }

    private static void downloadRange(String url, File destination, long start, long end,
                                      AtomicLong downloaded, ProgressCallback progress) throws Exception {
        long position = start;
        int failures = 0;

        while (position <= end) {
            long before = position;
            HttpURLConnection connection = openAudioConnection(url, position, end);

            try {
                if (connection.getResponseCode() != HttpURLConnection.HTTP_PARTIAL) {
                    throw new IllegalStateException(
                            "Range request returned HTTP " + connection.getResponseCode());
                }

                try (InputStream input = connection.getInputStream();
                     RandomAccessFile output = new RandomAccessFile(destination, "rw")) {
                    output.seek(position);
                    byte[] buffer = new byte[BUFFER_SIZE];

                    while (position <= end) {
                        int read = input.read(buffer, 0,
                                (int) Math.min(buffer.length, end - position + 1));
                        if (read < 0) break;

                        output.write(buffer, 0, read);
                        position += read;
                        progress.update(downloaded.addAndGet(read));
                    }
                }
            } catch (IOException ex) {
                Logger.printDebug(() -> "Audio range interrupted; retrying", ex);
            } finally {
                connection.disconnect();
            }

            failures = position > before ? 0 : failures + 1;
            if (failures >= MAX_STALLED_ATTEMPTS) {
                throw new IllegalStateException("Download range stalled at " + position);
            }
        }
    }

    private static long probeContentLength(String url) {
        HttpURLConnection connection = null;
        try {
            connection = openAudioConnection(url, 0, 0);
            if (connection.getResponseCode() != HttpURLConnection.HTTP_PARTIAL) return -1;

            String contentRange = connection.getHeaderField("Content-Range");
            if (contentRange == null) return -1;

            int slash = contentRange.lastIndexOf('/');
            return slash < 0 ? -1 : Long.parseLong(contentRange.substring(slash + 1));
        } catch (Exception ex) {
            Logger.printDebug(() -> "Could not probe audio length", ex);
            return -1;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static HttpURLConnection openAudioConnection(String url, long start, long end) throws Exception {
        HttpURLConnection connection = Requester.openConnection(url);
        connection.setConnectTimeout(CONNECT_TIMEOUT_MILLISECONDS);
        connection.setReadTimeout(READ_TIMEOUT_MILLISECONDS);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("User-Agent", USER_AGENT);
        connection.setRequestProperty("Referer", "https://music.youtube.com/");
        connection.setRequestProperty("Range", "bytes=" + start + "-" + end);
        return connection;
    }

    private static void downloadUnknownLength(String url, File destination) throws Exception {
        HttpURLConnection connection = Requester.openConnection(url);
        connection.setConnectTimeout(CONNECT_TIMEOUT_MILLISECONDS);
        connection.setReadTimeout(READ_TIMEOUT_MILLISECONDS);
        connection.setRequestProperty("User-Agent", USER_AGENT);

        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IllegalStateException("HTTP " + connection.getResponseCode());
            }

            try (InputStream input = connection.getInputStream();
                 FileOutputStream output = new FileOutputStream(destination)) {
                byte[] buffer = new byte[BUFFER_SIZE];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                }
            }
        } finally {
            connection.disconnect();
        }
    }

    /**
     * Segments report progress from their own threads, and {@code notify} is a oneway binder
     * call whose order only holds per sending thread. Posting every update from the main thread
     * stops late progress from replacing the completed state on screen.
     */
    static void showDownloadNotification(String key, String title, int progress,
                                         boolean ongoing, String text) {
        Utils.runOnMainThread(() -> postDownloadNotification(key, title, progress, ongoing, text));
    }

    @SuppressLint("NotificationPermission") // The patch declares POST_NOTIFICATIONS.
    private static void postDownloadNotification(String key, String title, int progress,
                                                 boolean ongoing, String text) {
        NotificationManager manager = (NotificationManager)
                Utils.getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        manager.notify(key.hashCode(), downloadNotification(manager, title, progress, ongoing, text));
    }

    /** The channel is created on the way, which does nothing once it exists. */
    static Notification downloadNotification(NotificationManager manager, String title,
                                             int progress, boolean ongoing, String text) {
        manager.createNotificationChannel(new NotificationChannel(DOWNLOAD_CHANNEL,
                str("morphe_music_downloads_notification_channel"),
                NotificationManager.IMPORTANCE_LOW));

        Notification.Builder builder = new Notification.Builder(Utils.getContext(), DOWNLOAD_CHANNEL);
        builder.setSmallIcon(ongoing
                        ? android.R.drawable.stat_sys_download
                        : android.R.drawable.stat_sys_download_done)
                .setContentTitle(title == null || title.isBlank() ? "YouTube Music" : title)
                .setContentText(text)
                .setOngoing(ongoing)
                .setOnlyAlertOnce(true);

        if (ongoing) builder.setProgress(100, Math.max(0, progress), progress < 0);
        return builder.build();
    }

    @Nullable
    private static PlayerResponse resolveResponse(String videoId) {
        Logger.printDebug(() -> "Resolving stream and metadata for download: " + videoId);
        // Cached playback responses omit videoDetails, so fetch streams and song details together.
        StreamingDataRequest request = StreamingDataRequest.fetchRequestForDownload(videoId,
                SpoofVideoStreamsPatch.getAvailableClients(),
                Settings.SPOOF_VIDEO_STREAMS_CLIENT_TYPE.get());

        StreamingDataRequest.StreamData stream = request.getStream();
        if (stream == null) {
            Logger.printDebug(() -> "No stream data resolved for " + videoId);
            return null;
        }

        try {
            PlayerResponse response = PlayerResponse.parseFrom(stream.streamingData());
            if (!videoId.equals(response.getVideoDetails().getVideoId())
                    || response.hasPlayabilityStatus() && response.getPlayabilityStatus().getStatus().getNumber() != 0) {
                return null;
            }
            return response;
        } catch (Exception ex) {
            Logger.printException(() -> "Could not parse audio formats: " + videoId, ex);
            return null;
        }
    }
}
