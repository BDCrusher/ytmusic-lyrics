/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.singles

import app.bdcrusher.ytmusic.diagnostics.crashDiagnosticsResources
import app.bdcrusher.ytmusic.diagnostics.installCrashDiagnostics
import app.bdcrusher.ytmusic.nativeentry.addonEditionGuard
import app.bdcrusher.ytmusic.nativeentry.installNativeLyricsHooks
import app.bdcrusher.ytmusic.nativeentry.normalizePersonalLyricsAccessors
import app.morphe.patches.music.layout.lyrics.personalLyricsAssets
import app.morphe.patches.music.interaction.downloads.installNativeDownloadSheet
import app.bdcrusher.ytmusic.shaders.installShaders
import app.bdcrusher.ytmusic.shaders.shaderAssets
import app.bdcrusher.ytmusic.shaders.verifyShaderIdentity
import app.bdcrusher.ytmusic.volume.audioEffectPermission
import app.bdcrusher.ytmusic.volume.installVolumeBoost
import app.morphe.patcher.extensions.InstructionExtensions.addInstruction
import app.morphe.patcher.extensions.InstructionExtensions.addInstructions
import app.morphe.patcher.extensions.InstructionExtensions.replaceInstruction
import app.morphe.patcher.patch.*
import app.morphe.patcher.util.proxy.mutableTypes.MutableMethod.Companion.toMutable
import app.morphe.patcher.util.registersUsed
import app.morphe.patcher.util.returnEarly
import app.morphe.patches.music.shared.Constants.COMPATIBILITY_YOUTUBE_MUSIC
import app.morphe.patches.youtube.interaction.downloads.ResolveCommandFingerprint
import com.android.tools.smali.dexlib2.AccessFlags
import com.android.tools.smali.dexlib2.Opcode
import com.android.tools.smali.dexlib2.builder.MutableMethodImplementation
import com.android.tools.smali.dexlib2.iface.instruction.ReferenceInstruction
import com.android.tools.smali.dexlib2.iface.reference.MethodReference
import com.android.tools.smali.dexlib2.iface.reference.FieldReference
import com.android.tools.smali.dexlib2.immutable.ImmutableMethod
import com.android.tools.smali.dexlib2.immutable.ImmutableMethodParameter

private const val MUSIC = "Lapp/morphe/extension/music/"
private const val OWN = "Lapp/bdcrusher/ytmusic/"
private const val FRAGMENT = "Landroid/preference/PreferenceFragment;"
private const val DOWNLOADS = MUSIC + "patches/DownloadsPatch;"
private const val ROUTER = OWN + "playlists/PersonalDownloadRouting;"
private const val LYRICS = MUSIC + "patches/lyrics/"

private val singlesRuntime = bytecodePatch {
    dependsOn(addonEditionGuard)
    extendWith("extensions/bdcrusher-music-singles.mpe")
    finalize {
        normalizePersonalLyricsAccessors()
        if (classDefByOrNull(MUSIC + "settings/preference/MusicPreferenceFragment;") == null)
            throw PatchException("Singles require the official Morphe Music settings and extension.")
    }
}

private fun BytecodePatchContext.hasHostCall(type: String, name: String): Boolean {
    var found = false
    classDefForEach { owner ->
        if (!found && !owner.type.startsWith("Lapp/")) {
            found = owner.methods.any { method ->
                method.implementation?.instructions?.any { instruction ->
                    val call = (instruction as? ReferenceInstruction)?.reference as? MethodReference
                    call?.definingClass == type && call.name == name
                } == true
            }
        }
    }
    return found
}

val diagnosticsSingle = bytecodePatch(
    name = "Diagnostics (Single)",
    description = "Records playback steps and crash information even with Morphe debug logging off.",
    default = false,
) {
    category("Singles")
    compatibleWith(COMPATIBILITY_YOUTUBE_MUSIC)
    dependsOn(singlesRuntime, crashDiagnosticsResources("Singles"))
    finalize { installCrashDiagnostics() }
}

val shadersSingle = bytecodePatch(
    name = "Shaders (Single)",
    description = "Animated artwork and backgrounds for official Morphe Music, including its Lyrics panel.",
    default = false,
) {
    category("Singles")
    compatibleWith(COMPATIBILITY_YOUTUBE_MUSIC)
    dependsOn(singlesRuntime, shaderAssets)
    finalize {
        installShaders()
        verifyShaderIdentity()
        // Official Lyrics tabs use their own artwork layer in addition to native engagement sheets.
        mutableClassDefByOrNull(LYRICS + "ui/LyricsPanelView;")?.let { panel ->
            val background = panel.fields.singleOrNull { it.name == "dynamicBackgroundView" }
                ?: throw PatchException("Official Morphe Lyrics artwork layer changed.")
            val attached = panel.methods.single { it.name == "onAttachedToWindow" && it.parameterTypes.isEmpty() }
            if (attached.implementation!!.registerCount < 2)
                throw PatchException("Official Morphe Lyrics artwork callback has no local register.")
            attached.addInstructions(0, "move-object/from16 v0, p0\niget-object v0, v0, $background\n" +
                    "invoke-static { v0 }, ${OWN}shaders/ShaderRuntime;->onOfficialLyricsBackground(Landroid/view/View;)V")
        }

        val fragment = mutableClassDefBy(MUSIC + "settings/preference/MusicPreferenceFragment;")
        val init = fragment.methods.single { it.name == "initialize" && it.parameterTypes.isEmpty() }
        val sort = init.implementation!!.instructions.indexOfFirst {
            ((it as? ReferenceInstruction)?.reference as? MethodReference)?.name == "sortPreferenceGroups"
        }
        if (sort < 0) throw PatchException("Official Morphe Music settings initializer changed.")
        init.addInstruction(sort + 1,
            "invoke-static/range { p0 .. p0 }, ${OWN}shaders/ShaderSettingsPage;->installSingle($FRAGMENT)V")
        val activity = mutableClassDefBy("Lcom/google/android/apps/youtube/music/activities/MusicActivity;")
        val create = activity.methods.single { it.name == "onCreate" && it.parameterTypes == listOf("Landroid/os/Bundle;") }
        val index = create.implementation!!.instructions.indexOfFirst {
            val method = (it as? ReferenceInstruction)?.reference as? MethodReference
            method?.name == "onCreate" && method.definingClass == activity.superclass
        }
        if (index < 0) throw PatchException("Shaders could not find Music activity initialization.")
        create.addInstruction(index + 1,
            "invoke-static/range { p0 .. p0 }, ${OWN}shaders/ShaderLifecycle;->attach(Landroid/app/Activity;)V")
    }
}

val volumeBoostSingle = bytecodePatch(
    name = "Volume Boost (Single)",
    description = "Adds the scrolling player action and audio gain slider to official Morphe Music.",
    default = false,
) {
    category("Singles")
    compatibleWith(COMPATIBILITY_YOUTUBE_MUSIC)
    dependsOn(singlesRuntime, audioEffectPermission)
    finalize { installVolumeBoost() }
}

private fun BytecodePatchContext.installSinglePreference(owner: String) {
    val init = mutableClassDefBy(MUSIC + "settings/preference/MusicPreferenceFragment;")
        .methods.single { it.name == "initialize" && it.parameterTypes.isEmpty() }
    val sort = init.implementation!!.instructions.indexOfFirst {
        ((it as? ReferenceInstruction)?.reference as? MethodReference)?.name == "sortPreferenceGroups"
    }
    if (sort < 0) throw PatchException("Official Morphe Music settings initializer changed.")
    init.addInstruction(sort + 1, "invoke-static/range { p0 .. p0 }, $owner->install($FRAGMENT)V")
}

private fun BytecodePatchContext.installSingleLyricsSession() {
    val manager = mutableClassDefBy(LYRICS + "LyricsManager;")
    val model = LYRICS + "model/Lyrics;"
    for (name in listOf("areLyricsSynced", "getCurrentLineText")) {
        val method = manager.methods.single { it.name == name && it.parameterTypes.isEmpty() }
        val source = method.implementation!!.instructions.withIndex().singleOrNull { (_, instruction) ->
            instruction.opcode == Opcode.IGET_OBJECT &&
                ((instruction as? ReferenceInstruction)?.reference as? FieldReference)
                    ?.let { it.definingClass == manager.type && it.name == "currentLyrics" && it.type == model } == true
        } ?: throw PatchException("Official Morphe lyrics session source changed: $name")
        val register = source.value.registersUsed.first()
        method.addInstructions(source.index + 1,
            "invoke-static/range { v$register .. v$register }, " +
                "${OWN}lyrics/PersonalLyricsSession;->current($model)$model\nmove-result-object v$register")
    }
    var lookups = 0
    for (method in manager.methods) {
        val calls = method.implementation?.instructions?.withIndex()?.filter { (_, instruction) ->
            val call = (instruction as? ReferenceInstruction)?.reference as? MethodReference
            call?.definingClass == LYRICS + "LyricsProviders;" && call.name == "providersInOrder" &&
                call.parameterTypes == listOf("Ljava/lang/String;")
        }.orEmpty()
        for ((index, instruction) in calls.asReversed()) {
            // Replace the invoke at the original label. Its original move-result
            // must remain immediately after the replacement provider call.
            val register = instruction.registersUsed.single()
            method.replaceInstruction(index, "invoke-static {}, ${OWN}lyrics/PersonalLyricsSession;->nativeOrder()Ljava/lang/String;")
            method.addInstructions(index + 1,
                "move-result-object v$register\ninvoke-static/range { v$register .. v$register }, " +
                    "${LYRICS}LyricsProviders;->providersInOrder(Ljava/lang/String;)Ljava/util/List;")
            lookups++
        }
    }
    if (lookups != 4) throw PatchException("Official Morphe lyrics provider order integration changed: $lookups")
}

val betterLyricsSingle = bytecodePatch(
    name = "Better Lyrics (Single)",
    description = "Adds the personal Better Lyrics renderer, sources and controls to official Morphe.",
    default = false,
) {
    category("Singles")
    compatibleWith(COMPATIBILITY_YOUTUBE_MUSIC)
    dependsOn(singlesRuntime, personalLyricsAssets)
    finalize {
        if (!hasHostCall(LYRICS + "LyricsPatch;", "onSetPlaybackState")) {
            throw PatchException("Select official Morphe Third-party lyrics with Better Lyrics (Single).")
        }
        installNativeLyricsHooks()
        installSingleLyricsSession()
        installSinglePreference(OWN + "lyrics/LyricsSettingsPage;")
    }
}

val downloadsSingle = bytecodePatch(
    name = "Downloads (Single)",
    description = "Applies personal download routing to official Downloads and uses the native offline engine.",
    default = false,
) {
    category("Singles")
    compatibleWith(COMPATIBILITY_YOUTUBE_MUSIC)
    dependsOn(singlesRuntime)
    finalize {
        ResolveCommandFingerprint.clearMatch()
        val resolve = ResolveCommandFingerprint.method
        if (resolve.implementation!!.instructions.none {
                val call = (it as? ReferenceInstruction)?.reference as? MethodReference
                call?.definingClass == DOWNLOADS && call.name == "replaceDownloadCommand"
            }) throw PatchException("Select official Morphe Downloads with Downloads (Single).")
        installNativeDownloadSheet()
        val owner = mutableClassDefBy(DOWNLOADS)
        fun forward(name: String, parameters: List<String>, returnType: String, code: String) {
            val method = owner.methods.singleOrNull { it.name == name && it.parameterTypes == parameters && it.returnType == returnType }
                ?: throw PatchException("Official Morphe download hook changed: $name")
            owner.methods.remove(method)
            owner.methods.add(ImmutableMethod(owner.type, name, method.parameters, returnType,
                method.accessFlags, method.annotations, method.hiddenApiRestrictions,
                MutableMethodImplementation(parameters.size + 1)).toMutable().apply { addInstructions(0, code) })
        }
        val message = "Lcom/google/protobuf/MessageLite;"
        val map = "Ljava/util/Map;"
        val conversion = "Lapp/morphe/extension/shared/patches/components/ContextInterface;"
        val text = "Ljava/lang/CharSequence;"
        forward("replaceDownloadCommand", listOf(message, map), "[B",
            "invoke-static { p0, p1 }, $ROUTER->replaceDownloadCommand($message$map)[B\nmove-result-object v0\nreturn-object v0")
        forward("onLithoTextLoaded", listOf(conversion, text), text,
            "invoke-static { p0, p1 }, $ROUTER->onLithoTextLoaded($conversion$text)$text\nmove-result-object v0\nreturn-object v0")
        forward("isFlyoutMenuOverridden", emptyList(), "Z",
            "invoke-static {}, $ROUTER->isFlyoutMenuOverridden()Z\nmove-result v0\nreturn v0")
        forward("replaceOfflineUpsell", listOf(message, "Ljava/lang/Object;"), "[B",
            "const/4 v0, 0x0\nreturn-object v0")
        // These routines are inherited upstream. Preserve the original host policy.
        for ((name, parameter) in listOf(
            "unlockOfflineability" to "Ljava/lang/Object;",
            "replaceDeclinedOfflinePlayerResponse" to "Ljava/lang/Object;",
            "replaceDisabledOfflineState" to message,
        )) {
            val bridge = ImmutableMethod(owner.type, name, listOf(ImmutableMethodParameter(parameter, null, null)), "[B",
                AccessFlags.PUBLIC.value or AccessFlags.STATIC.value, null, null, MutableMethodImplementation(2)).toMutable()
            bridge.returnEarly(null)
            owner.methods.add(bridge)
        }
    }
}
