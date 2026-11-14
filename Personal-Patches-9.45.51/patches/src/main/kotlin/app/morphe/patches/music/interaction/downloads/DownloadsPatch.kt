/*
 * Copyright 2026 Morphe.
 * https://github.com/MorpheApp/morphe-patches
 *
 * See the included NOTICE file for GPLv3 Section 7 terms that apply to Morphe contributions.
 */

package app.morphe.patches.music.interaction.downloads

import app.morphe.patcher.extensions.InstructionExtensions.addInstructions
import app.morphe.patcher.extensions.InstructionExtensions.addInstructionsWithLabels
import app.morphe.patcher.patch.patch
import app.morphe.patcher.util.getReference
import app.morphe.patcher.util.proxy.mutableTypes.MutableMethod.Companion.toMutable
import app.morphe.patcher.util.registersUsed
import app.morphe.patches.music.misc.extension.sharedExtensionPatch
import app.morphe.patches.music.misc.litho.filter.lithoFilterPatch
import app.morphe.patches.music.misc.settings.PreferenceScreen
import app.morphe.patches.music.misc.settings.settingsPatch
import app.morphe.patches.music.shared.Constants.COMPATIBILITY_YOUTUBE_MUSIC
import app.morphe.patches.music.video.information.musicVideoInformationPatch
import app.morphe.patches.shared.misc.fix.proto.fixProtoLibraryPatch
import app.morphe.patches.shared.misc.fix.proto.parseByteArrayWithRegistryMethodRef
import app.morphe.patches.shared.misc.fix.proto.protoDefaultInstanceFingerprint
import app.morphe.patches.shared.misc.litho.filter.addLithoFilter
import app.morphe.patches.shared.misc.settings.preference.ListPreference
import app.morphe.patches.shared.misc.settings.preference.PreferenceScreenPreference
import app.morphe.patches.shared.misc.settings.preference.PreferenceScreenPreference.Sorting
import app.morphe.patches.shared.misc.settings.preference.SwitchPreference
import app.morphe.patches.shared.misc.settings.preference.TextPreference
import app.morphe.patches.shared.misc.textcomponent.hookSpannableStringResult
import app.morphe.patches.shared.misc.textcomponent.textComponentPatch
import app.morphe.patches.youtube.interaction.downloads.ResolveCommandFingerprint
import app.morphe.patches.youtube.interaction.downloads.playerResponseGetterFingerprint
import app.morphe.patches.youtube.interaction.downloads.playerResponseModelFromBytesFingerprint
import com.android.tools.smali.dexlib2.AccessFlags
import com.android.tools.smali.dexlib2.builder.MutableMethodImplementation
import com.android.tools.smali.dexlib2.iface.reference.TypeReference
import com.android.tools.smali.dexlib2.immutable.ImmutableMethod
import com.android.tools.smali.dexlib2.immutable.ImmutableMethodParameter

private const val EXTENSION_CLASS =
    "Lapp/morphe/extension/music/patches/DownloadsPatch;"
private const val SONG_MENU_FILTER =
    "Lapp/morphe/extension/music/patches/components/SongMenuFilter;"
private const val PLAYLIST_PAGE_FILTER =
    "Lapp/morphe/extension/music/patches/components/PlaylistPageFilter;"
private const val GET_GENERATED_REGISTRY =
    "Lcom/google/protobuf/ExtensionRegistryLite;->getGeneratedRegistry()Lcom/google/protobuf/ExtensionRegistryLite;"

/**
 * @return The default instance field of a proto message, which the message is parsed with.
 */
private fun protoDefaultInstance(messageType: String) =
    protoDefaultInstanceFingerprint(messageType).instructionMatches.first().fieldReference

private val downloadsResourcePatch = app.morphe.patcher.patch.resourcePatch {
    dependsOn(settingsPatch)

    execute {
        this["assets/bdcrusher-features/downloads.enabled"].apply {
            parentFile.mkdirs()
            writeText("1\n")
        }
        PreferenceScreen.PLAYER.addPreferences(
            PreferenceScreenPreference(
                key = "morphe_external_downloader_screen",
                sorting = Sorting.UNSORTED,
                preferences = setOf(
                    ListPreference("morphe_download_mode"),
                    SwitchPreference("morphe_external_downloader_menu", summary = true),
                    TextPreference(
                        "morphe_external_downloader_name",
                        tag = "app.morphe.extension.shared.settings.preference.ExternalDownloaderPreference"
                    )
                )
            )
        )
    }
}

val downloadsPatch = patch(
    name = "Downloads",
    description = "Adds support to download songs, albums, and playlists using the in-app " +
        "download button, either inside YouTube Music or with an external downloader app, " +
        "with YouTube Music handling account eligibility for native downloads.",
) {
    category("Full Collection")
    dependsOn(
        downloadsResourcePatch,
        app.bdcrusher.ytmusic.playlists.localPlaybackPatch,
        sharedExtensionPatch,
        settingsPatch,
        textComponentPatch,
        lithoFilterPatch,
        musicVideoInformationPatch,
        fixProtoLibraryPatch,
    )

    compatibleWith(COMPATIBILITY_YOUTUBE_MUSIC)

    execute {
        // Captures the localized download button label from Litho text creation.
        hookSpannableStringResult(EXTENSION_CLASS)

        // Finds the song of a menu, for the menu Download of accounts offered Premium.
        addLithoFilter(SONG_MENU_FILTER)

        // Finds the playlist or album of a page, for the page and menu Download.
        addLithoFilter(PLAYLIST_PAGE_FILTER)

        // Route configured external actions. In-app commands still use the native downloader.
        ResolveCommandFingerprint.method.apply {
            val commandType = parameterTypes.first().toString()

            addInstructionsWithLabels(
                0,
                """
                    invoke-static/range { p1 .. p2 }, $EXTENSION_CLASS->replaceDownloadCommand(Lcom/google/protobuf/MessageLite;Ljava/util/Map;)[B
                    move-result-object v0
                    if-eqz v0, :keep_command
                    array-length v1, v0
                    if-nez v1, :parse_command
                    return-void
                    :parse_command
                    sget-object v1, ${protoDefaultInstance(commandType)}
                    invoke-static { }, $GET_GENERATED_REGISTRY
                    move-result-object v2
                    invoke-static { v1, v0, v2 }, ${parseByteArrayWithRegistryMethodRef.get()!!}
                    move-result-object v0
                    check-cast v0, $commandType
                    move-object/from16 p1, v0
                    :keep_command
                    nop
                """
            )
        }

        // Observe authorized saves for offline chapters. Keep the native response and policy intact.
        MusicOfflinePlayerResponseFingerprint.let {
            val responseType = it.method.returnType
            val fromBytes = playerResponseModelFromBytesFingerprint(responseType)
            val proto = fromBytes.instructionMatches.last().instruction.getReference<TypeReference>()!!.type
            val getter = playerResponseGetterFingerprint(fromBytes.method.definingClass, proto).method
            val observer = ImmutableMethod(
                it.classDef.type,
                "patch_observeAuthorizedOfflineResponse",
                listOf(ImmutableMethodParameter(responseType, null, null)),
                "V",
                AccessFlags.PRIVATE.value or AccessFlags.STATIC.value,
                null,
                null,
                MutableMethodImplementation(2),
            ).toMutable().apply {
                addInstructionsWithLabels(
                    0,
                    """
                        if-eqz p0, :done
                        invoke-interface { p0 }, $responseType->${getter.name}()$proto
                        move-result-object v0
                        invoke-static { v0 }, $EXTENSION_CLASS->observeAuthorizedOfflineResponse(Ljava/lang/Object;)V
                        :done
                        return-void
                    """
                )
            }
            it.classDef.methods.add(observer)
            val response = it.instructionMatches.last()
            val register = response.instruction.registersUsed.first()
            it.method.addInstructions(response.index + 1,
                "invoke-static/range { v$register .. v$register }, $observer")
        }
    }
}
