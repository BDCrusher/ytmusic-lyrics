/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.diagnostics

import app.morphe.patcher.Fingerprint
import app.morphe.patcher.extensions.InstructionExtensions.addInstruction
import app.morphe.patcher.patch.*
import app.morphe.patcher.util.registersUsed
import app.morphe.patches.music.misc.extension.sharedExtensionPatch
import app.morphe.patches.music.misc.settings.settingsPatch
import app.morphe.patches.music.shared.Constants.COMPATIBILITY_YOUTUBE_MUSIC
import app.morphe.patches.music.video.information.VideoIdFingerprint
import app.morphe.patches.shared.MediaSessionSetMetadataFingerprint
import app.morphe.patches.shared.MediaSessionSetPlaybackStateFingerprint
import com.android.tools.smali.dexlib2.iface.instruction.ReferenceInstruction
import com.android.tools.smali.dexlib2.iface.reference.MethodReference

private const val PACKAGE = "app.bdcrusher.ytmusic.diagnostics"
private const val RECORDER = "Lapp/bdcrusher/ytmusic/diagnostics/PlaybackCrashRecorder;"
private const val AUDIO_TRACK = "Landroid/media/AudioTrack;"

private object DiagnosticsAssets

internal fun crashDiagnosticsResources(category: String) = resourcePatch {
    execute {
        val version = DiagnosticsAssets::class.java.classLoader.getResourceAsStream("bdcrusher-common/version.txt")
            ?.bufferedReader()?.use { it.readText().trim() }
            ?: throw PatchException("Missing the personal bundle version for crash diagnostics.")
        this["assets/bdcrusher-features/crash-diagnostics.txt"].apply {
            parentFile.mkdirs()
            writeText("Personal bundle $version · $category\n")
        }
        resourceXml("AndroidManifest.xml").use { manifest ->
            val application = manifest.root.children("application").single()
            application.appendChild("activity") {
                setAttribute("android:name", "$PACKAGE.CrashReportActivity")
                setAttribute("android:exported", "false")
                setAttribute("android:theme", "@android:style/Theme.Translucent.NoTitleBar")
            }
        }
    }
}

@Suppress("unused")
val crashDiagnosticsPatch = bytecodePatch(
    name = "Crash diagnostics",
    description = "Saves playback steps and crash information independently of Morphe debug logging.",
) {
    category("Full Collection")
    compatibleWith(COMPATIBILITY_YOUTUBE_MUSIC)
    dependsOn(sharedExtensionPatch, settingsPatch, crashDiagnosticsResources("Full Collection"))
    finalize { installCrashDiagnostics() }
}

internal fun BytecodePatchContext.installCrashDiagnostics() {
    val activity = mutableClassDefBy("Lcom/google/android/apps/youtube/music/activities/MusicActivity;")
    val create = activity.methods.single { it.name == "onCreate" && it.parameterTypes == listOf("Landroid/os/Bundle;") }
    val superCall = create.implementation!!.instructions.indexOfFirst {
        val call = (it as? ReferenceInstruction)?.reference as? MethodReference
        call?.name == "onCreate" && call.definingClass == activity.superclass
    }
    if (superCall < 0) throw PatchException("Could not locate Music activity initialization for crash diagnostics.")
    create.addInstruction(superCall + 1, "invoke-static/range { p0 .. p0 }, $RECORDER->install(Landroid/app/Activity;)V")

    val settings = mutableClassDefBy("Lapp/morphe/extension/music/settings/preference/MusicPreferenceFragment;")
    val init = settings.methods.single { it.name == "initialize" && it.parameterTypes.isEmpty() }
    val sort = init.implementation!!.instructions.indexOfFirst {
        ((it as? ReferenceInstruction)?.reference as? MethodReference)?.name == "sortPreferenceGroups"
    }
    if (sort < 0) throw PatchException("Could not locate Music settings initialization for crash diagnostics.")
    init.addInstruction(sort + 1, "invoke-static/range { p0 .. p0 }, " +
        "Lapp/bdcrusher/ytmusic/diagnostics/CrashDiagnosticsSettings;->install(Landroid/preference/PreferenceFragment;)V")

    VideoIdFingerprint.clearMatch()
    VideoIdFingerprint.method.addInstruction(0, "invoke-static {}, $RECORDER->onTrackResponse()V")
    hookMediaSession(MediaSessionSetMetadataFingerprint, "onMetadata", "Landroid/media/MediaMetadata;")
    hookMediaSession(MediaSessionSetPlaybackStateFingerprint, "onPlayback", "Landroid/media/session/PlaybackState;")

    val renderer = when (packageMetadata.versionName) {
        "9.45.51" -> "Lcdk;"
        "9.46.51" -> "Lcdp;"
        else -> throw PatchException("No audio output contract for this Music version.")
    }
    val methods = mutableClassDefBy(renderer).methods
    val output = methods.singleOrNull { method -> method.implementation?.instructions?.any {
        val call = (it as? ReferenceInstruction)?.reference as? MethodReference
        call?.definingClass == AUDIO_TRACK && call.name == "play" && call.parameterTypes.isEmpty() && call.returnType == "V"
    } == true } ?: throw PatchException("Expected one Music audio output method for crash diagnostics.")
    val launch = output.implementation!!.instructions.withIndex().single {
        val call = (it.value as? ReferenceInstruction)?.reference as? MethodReference
        call?.definingClass == AUDIO_TRACK && call.name == "play" && call.parameterTypes.isEmpty() && call.returnType == "V"
    }
    val receiver = launch.value.registersUsed.single()
    output.addInstruction(launch.index, "invoke-static/range { v$receiver .. v$receiver }, $RECORDER->onAudioOutput($AUDIO_TRACK)V")
    output.addInstruction(launch.index + 2, "invoke-static {}, $RECORDER->onAudioStarted()V")
}

private fun hookMediaSession(fingerprint: Fingerprint, name: String, parameter: String) {
    fingerprint.clearMatch()
    val target = fingerprint.method
    val call = fingerprint.instructionMatches.last()
    val register = call.instruction.registersUsed[1]
    target.addInstruction(call.index, "invoke-static/range { v$register .. v$register }, $RECORDER->$name($parameter)V")
}
