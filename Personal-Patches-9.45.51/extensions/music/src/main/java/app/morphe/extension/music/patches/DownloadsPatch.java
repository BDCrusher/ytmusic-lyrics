/*
 * Copyright 2026 Morphe.
 * https://github.com/MorpheApp/morphe-patches/pull/1881
 * https://github.com/MorpheApp/morphe-patches/pull/4698
 *
 * See the included NOTICE file for GPLv3 Section 7 terms that apply to Morphe contributions.
 */

package app.morphe.extension.music.patches;

import android.app.Activity;
import android.net.Uri;
import android.util.Base64;
import android.view.View;
import android.os.SystemClock;

import androidx.annotation.Nullable;

import com.google.protobuf.MessageLite;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

import app.morphe.extension.music.patches.components.PlaylistPageFilter;
import app.morphe.extension.music.patches.components.SongMenuFilter;
import app.morphe.extension.music.settings.Settings;
import app.morphe.extension.music.shared.VideoInformation;
import app.morphe.extension.shared.Logger;
import app.morphe.extension.shared.ResourceUtils;
import app.morphe.extension.shared.Utils;
import app.morphe.extension.shared.innertube.Offline.OfflineCommand;
import app.morphe.extension.shared.innertube.Offline.OfflinePlaylistAction;
import app.morphe.extension.shared.innertube.Offline.OfflinePlaylistEndpoint;
import app.morphe.extension.shared.innertube.Offline.OfflinePlayerResponse;
import app.morphe.extension.shared.innertube.SavedVideo.OfflineStateAction;
import app.morphe.extension.shared.innertube.Offline.OfflineVideoAction;
import app.morphe.extension.shared.innertube.Offline.OfflineVideoEndpoint;
import app.morphe.extension.shared.patches.DownloadMode;
import app.morphe.extension.shared.patches.components.ByteArrayFilterGroup;
import app.morphe.extension.shared.patches.components.ContextInterface;
import app.morphe.extension.shared.settings.preference.ExternalDownloaderPreference;

@SuppressWarnings("unused")
public final class DownloadsPatch {

    private static final String ELEMENTS_SENDER_VIEW =
            "com.google.android.libraries.youtube.rendering.elements.sender_view";
    private static final int IGNORE_DOUBLE_CLICK_DURATION_MS = 1000;

    private static volatile String downloadButtonLabel = "";

    /**
     * Fields of the encoded parameters of the offline upsell. The parameters of a song hold its video ID,
     * and the parameters of an album or a playlist hold its id in a nested message.
     */
    private static final int UPSELL_PARAMETERS_VIDEO_ID = 4;
    private static final int UPSELL_PARAMETERS_PLAYLIST = 5;
    private static final int UPSELL_PLAYLIST_ITEM = 10;
    private static final int UPSELL_PLAYLIST_ID = 3;

    /**
     * Liked music, user and editorial playlists, mixes, album playlists and album pages,
     * with or without the 'VL' prefix of a playlist page.
     */
    public static final Pattern PLAYLIST_ID = Pattern.compile(
            "(VL)?(LM|PL(?:[A-Za-z0-9_-]{11}|[A-Za-z0-9_-]{16,})"
                    + "|OLAK5uy_[A-Za-z0-9_-]{11,}|RD[A-Za-z0-9_-]{10,})|MPRE[A-Za-z0-9_-]{8,}");

    private record Handoff(String target, boolean flyout, long time) {}
    private static Handoff lastHandoff;

    /**
     * Menu Download action of accounts offered Premium, which opens the Premium sheet
     * and has no video ID.
     */
    private static final ByteArrayFilterGroup PREMIUM_UPSELL_COMMAND =
            new ByteArrayFilterGroup(null, "premium_upsell");

    /**
     * Opening the menu of an item resolves a command that holds the whole menu, so it also
     * holds the Download action of the menu without being that action.
     */
    private static final ByteArrayFilterGroup MENU_COMMAND =
            new ByteArrayFilterGroup(null, "panel_header.", "tile_button_carousel.");

    /**
     * Injection point.
     * Usually is called off the main thread, when a litho text is created and its style runs
     * are applied.
     */
    public static CharSequence onLithoTextLoaded(ContextInterface conversionContext, CharSequence original) {
        try {
            // Such as the text of an icon only button.
            //noinspection SizeReplaceableByIsEmpty
            if (original.length() == 0) return original;

            StringBuilder path = conversionContext.patch_getPathBuilder();
            if (isFlyoutMenuOverridden()
                    && downloadButtonLabel.isEmpty()
                    && Utils.contains(path, "music_download_button.")) {
                downloadButtonLabel = original.toString();
                Logger.printDebug(() -> "Found download button label: " + downloadButtonLabel);
            }
        } catch (Exception ex) {
            Logger.printException(() -> "onLithoTextLoaded failure", ex);
        }
        return original;
    }

    public static boolean isFlyoutMenuOverridden() {
        return Settings.DOWNLOAD_MODE.get() == DownloadMode.EXTERNAL
                || Settings.EXTERNAL_DOWNLOADER_MENU.get();
    }

    /**
     * Injection point.
     * <p>
     * If the external downloader replaces the Download menu, the menus open it instead,
     * so the upsell is kept.
     */
    public static void observeAuthorizedOfflineResponse(@Nullable Object response) {
        if(Settings.DOWNLOAD_MODE.get()!=DownloadMode.IN_APP || !(response instanceof MessageLite message))return;
        try {
            OfflinePlayerResponse offline=OfflinePlayerResponse.parseFrom(message.toByteArray());
            if(offline.hasOfflineState()&&offline.hasVideoDetails()
                    &&offline.getOfflineState().getAction()==OfflineStateAction.OFFLINE_STATE_ACTION_OK) {
                String id=offline.getVideoDetails().getVideoId();
                if(VideoInformation.isVideoId(id))
                    app.morphe.extension.shared.sponsorblock.SponsorBlockOfflineStorage.fetchAndSaveSegments(id);
            }
        } catch(Exception ex) {
            Logger.printException(()->"Could not observe authorized offline response",ex);
        }
    }

    /**
     * Called before command resolution. Only identified external downloads are consumed.
     * All native save, quality, confirmation and management commands keep their normal resolver.
     */
    public static boolean handleExternalDownload(
            @Nullable MessageLite command, @Nullable Map<Object, Object> map) {
        try {
            DownloadMode mode = Settings.DOWNLOAD_MODE.get();
            if (command == null || (mode != DownloadMode.EXTERNAL
                    && !Settings.EXTERNAL_DOWNLOADER_MENU.get())) return false;

            Object source = map == null ? null : map.get(ELEMENTS_SENDER_VIEW);
            boolean flyout = isViewInsideDialog(source);
            if (mode != DownloadMode.EXTERNAL && !flyout) return false;

            byte[] bytes = command.toByteArray();
            OfflineCommand offline = OfflineCommand.parseFrom(bytes);
            // The host resolves nested commands individually, including the one that closes the menu.
            if (offline.hasCommandExecutorContainer() || MENU_COMMAND.check(bytes).isFiltered()) return false;
            if (offline.hasOfflineVideoEndpoint()) {
                OfflineVideoEndpoint endpoint = offline.getOfflineVideoEndpoint();
                return endpoint.getAction() == OfflineVideoAction.OFFLINE_VIDEO_ACTION_ADD
                        && downloadVideo(endpoint.getVideoId(), flyout);
            }
            if (offline.hasOfflinePlaylistEndpoint()) {
                OfflinePlaylistEndpoint endpoint = offline.getOfflinePlaylistEndpoint();
                return endpoint.getAction() == OfflinePlaylistAction.OFFLINE_PLAYLIST_ACTION_ADD
                        && downloadPlaylist(endpoint.getPlaylistId(), flyout);
            }
            if (offline.hasOfflineUpsellEndpoint()) {
                String value = offline.getOfflineUpsellEndpoint().getVideoId();
                if (!value.isEmpty()) {
                    if (VideoInformation.isVideoId(value)) return downloadVideo(value, flyout);
                    if (PLAYLIST_ID.matcher(value).matches()) return downloadPlaylist(value, flyout);
                    ProtoMessage parameters = new ProtoMessage(Base64.decode(Uri.decode(value), Base64.URL_SAFE));
                    String videoId = getOfflineUpsellVideoId(parameters);
                    if (videoId != null) return downloadVideo(videoId, flyout);
                    String playlistId = parameters.messagePath(UPSELL_PARAMETERS_PLAYLIST, UPSELL_PLAYLIST_ITEM)
                            .stringField(UPSELL_PLAYLIST_ID);
                    return downloadPlaylist(playlistId, flyout);
                }
            } else if (!PREMIUM_UPSELL_COMMAND.check(bytes).isFiltered()) {
                return false;
            }

            if (flyout) {
                String videoId = SongMenuFilter.getMenuVideoId();
                String playlistId = PlaylistPageFilter.getMenuPlaylistId();
                if (videoId != null && playlistId != null) return false;
                return videoId != null ? downloadVideo(videoId, true) : downloadPlaylist(playlistId, true);
            }
            if (!(source instanceof View sender)) return false;
            if (isViewInsideActionBar(sender)) {
                return downloadVideo(VideoInformation.getVideoId(), false);
            }
            return hasDownloadLabel(sender) && downloadPlaylist(PlaylistPageFilter.getPagePlaylistId(), false);
        } catch (Exception ex) {
            Logger.printException(() -> "External download command could not be resolved", ex);
            return false;
        }
    }

    private static boolean downloadVideo(@Nullable String videoId, boolean flyout) {
        return videoId != null && VideoInformation.isVideoId(videoId)
                && handOff(videoId, "https://music.youtube.com/watch?v=" + videoId, flyout);
    }

    private static boolean downloadPlaylist(@Nullable String playlistId, boolean flyout) {
        return playlistId != null && PLAYLIST_ID.matcher(playlistId).matches()
                && handOff(playlistId, playlistUrl(playlistId), flyout);
    }

    private static synchronized boolean handOff(String target, String url, boolean flyout) {
        final long now = SystemClock.elapsedRealtime();
        if (lastHandoff != null && lastHandoff.target().equals(target) && lastHandoff.flyout() == flyout
                && now - lastHandoff.time() < IGNORE_DOUBLE_CLICK_DURATION_MS) return true;
        Logger.printDebug(() -> "Download command: external " + (flyout ? "menu" : "button") + " handoff");
        Utils.runOnMainThreadNowOrLater(() -> ExternalDownloaderPreference.launchExternalDownloader(
                target, Utils.getActivity(), url));
        lastHandoff = new Handoff(target, flyout, now);
        return true;
    }

    private static String playlistUrl(String playlistId) {
        if (playlistId.startsWith("MPRE")) {
            return "https://music.youtube.com/browse/" + playlistId;
        }
        return "https://music.youtube.com/playlist?list=" + playlistId.replaceFirst("^VL", "");
    }

    /**
     * @param parameters The encoded parameters of the offline upsell endpoint.
     * @return The video ID, or null if the parameters are of an album or a playlist.
     */
    @Nullable
    private static String getOfflineUpsellVideoId(ProtoMessage parameters) {
        try {
            String videoId = parameters.stringField(UPSELL_PARAMETERS_VIDEO_ID);
            return VideoInformation.isVideoId(videoId) ? videoId : null;
        } catch (IllegalArgumentException ex) {
            // The parameters of an album or a playlist hold other fields at this number.
            Logger.printDebug(() -> "Offline upsell parameters are not those of a song", ex);
            return null;
        }
    }

    /**
     * Determines if the clicked view is inside a Dialog/BottomSheet by comparing
     * its Window root to the main Activity's Window root.
     */
    private static boolean isViewInsideDialog(@Nullable Object viewObj) {
        if (viewObj instanceof View view) {
            View buttonRoot = view.getRootView();

            Activity activity = Utils.getActivity();
            if (activity != null) {
                View activityRoot = activity.getWindow().getDecorView();
                return buttonRoot != activityRoot;
            }
        }
        return false;
    }

    /**
     * The label is the localized download text litho gave us, so no hard coded language is needed.
     */
    private static boolean hasDownloadLabel(View sender) {
        if (downloadButtonLabel.isEmpty()) return false;
        String label = downloadButtonLabel.toLowerCase(Locale.ROOT);
        View cursor = sender;
        for (int depth = 0; depth < 4; depth++) {
            CharSequence description = cursor.getContentDescription();
            if (description != null && description.toString().toLowerCase(Locale.ROOT).equals(label)) return true;
            if (cursor instanceof android.widget.TextView text && text.getText() != null
                    && text.getText().toString().toLowerCase(Locale.ROOT).equals(label)) return true;
            if (!(cursor.getParent() instanceof View parent)) break;
            cursor = parent;
        }
        return false;
    }

    private static boolean isViewInsideActionBar(View view) {
        int actionBarId = ResourceUtils.getIdIdentifier("video_action_bar");
        while (view.getParent() instanceof View parent) {
            if (parent.getId() == actionBarId) return true;
            view = parent;
        }
        return false;
    }
}
