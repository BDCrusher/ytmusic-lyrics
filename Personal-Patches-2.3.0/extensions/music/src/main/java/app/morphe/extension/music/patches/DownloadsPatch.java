/*
 * Copyright 2026 Morphe.
 * https://github.com/MorpheApp/morphe-patches/pull/1881
 * https://github.com/MorpheApp/morphe-patches/pull/4698
 *
 * See the included NOTICE file for GPLv3 Section 7 terms that apply to Morphe contributions.
 */

package app.morphe.extension.music.patches;

import app.bdcrusher.ytmusic.playlists.PersonalDownloadRouting;
import app.morphe.extension.shared.patches.components.ContextInterface;
import com.google.protobuf.MessageLite;

import java.util.Map;
import java.util.regex.Pattern;

/** Bridges the Full Collection's native call sites to the personal download router. */
public final class DownloadsPatch {
    public static final Pattern PLAYLIST_ID = PersonalDownloadRouting.PLAYLIST_ID;

    public static CharSequence onLithoTextLoaded(ContextInterface context, CharSequence original) {
        return PersonalDownloadRouting.onLithoTextLoaded(context, original);
    }

    public static boolean isFlyoutMenuOverridden() {
        return PersonalDownloadRouting.isFlyoutMenuOverridden();
    }

    public static void observeAuthorizedOfflineResponse(Object response) {
        PersonalDownloadRouting.observeAuthorizedOfflineResponse(response);
    }

    public static boolean handleExternalDownload(MessageLite command, Map<Object, Object> map) {
        return PersonalDownloadRouting.handleExternalDownload(command, map);
    }
}
