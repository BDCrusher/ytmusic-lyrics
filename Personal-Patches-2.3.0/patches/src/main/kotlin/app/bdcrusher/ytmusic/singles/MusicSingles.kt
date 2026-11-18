/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.singles

import app.bdcrusher.ytmusic.nativeentry.addonEditionGuard
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
import app.morphe.patcher.util.returnEarly
import app.morphe.patches.music.shared.Constants.COMPATIBILITY_YOUTUBE_MUSIC
import app.morphe.patches.youtube.interaction.downloads.ResolveCommandFingerprint
import com.android.tools.smali.dexlib2.AccessFlags
import com.android.tools.smali.dexlib2.Opcode
import com.android.tools.smali.dexlib2.builder.MutableMethodImplementation
import com.android.tools.smali.dexlib2.iface.instruction.OneRegisterInstruction
import com.android.tools.smali.dexlib2.iface.instruction.FiveRegisterInstruction
import com.android.tools.smali.dexlib2.iface.instruction.ReferenceInstruction
import com.android.tools.smali.dexlib2.iface.reference.MethodReference
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

val betterLyricsSingle = bytecodePatch(
    name = "Better Lyrics (Single)",
    description = "Improves Better Lyrics lookups in official Third-party lyrics and keeps its native panel and controls.",
    default = false,
) {
    category("Singles")
    compatibleWith(COMPATIBILITY_YOUTUBE_MUSIC)
    dependsOn(singlesRuntime)
    finalize {
        if (!hasHostCall(LYRICS + "LyricsPatch;", "onSetPlaybackState")) {
            throw PatchException("Select official Morphe Third-party lyrics with Better Lyrics (Single).")
        }
        val providers = mutableClassDefBy(LYRICS + "LyricsProviders;")
        val method = providers.methods.single { it.name == "providerFor" && it.parameterTypes == listOf("Ljava/lang/String;") }
        val instructions = method.implementation!!.instructions
        val constructor = instructions.withIndex().singleOrNull {
            ((it.value as? ReferenceInstruction)?.reference as? MethodReference)
                ?.let { call -> call.name == "<init>" && call.definingClass == LYRICS + "requests/BlyricsProvider;" } == true
        } ?: throw PatchException("Official Morphe Better Lyrics provider factory changed.")
        val call = constructor.value as? FiveRegisterInstruction
        val allocation = instructions.getOrNull(constructor.index - 1) as? OneRegisterInstruction
        if (call == null || allocation?.opcode != Opcode.NEW_INSTANCE || allocation.registerA != call.registerC)
            throw PatchException("Unexpected Better Lyrics provider allocation.")
        val type = OWN + "lyrics/NativeBetterLyricsProvider;"
        method.replaceInstruction(constructor.index - 1, "new-instance v${allocation.registerA}, $type")
        method.replaceInstruction(constructor.index, "invoke-direct { v${call.registerC} }, $type-><init>()V")
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
