/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.volume

import app.morphe.patcher.*
import app.morphe.patcher.extensions.InstructionExtensions.addInstruction
import app.morphe.patcher.extensions.InstructionExtensions.replaceInstruction
import app.morphe.patcher.patch.*
import app.morphe.patcher.util.getReference
import app.morphe.patches.music.misc.settings.settingsPatch
import com.android.tools.smali.dexlib2.Opcode
import com.android.tools.smali.dexlib2.iface.instruction.FiveRegisterInstruction
import com.android.tools.smali.dexlib2.iface.instruction.OneRegisterInstruction
import com.android.tools.smali.dexlib2.iface.instruction.WideLiteralInstruction
import com.android.tools.smali.dexlib2.iface.reference.MethodReference

private const val BOOST = "Lapp/bdcrusher/ytmusic/common/PlayerVolumeBoost;"
private const val TRACK = "Landroid/media/AudioTrack;"
private const val ACTION_ROW = 0x7f0b0e51L

private object ActionRow : Fingerprint(
    name = "<init>",
    filters = listOf(literal(ACTION_ROW)),
    custom = { _, owner -> owner.type == "Ljmv;" },
)

private object Session : Fingerprint(
    name = "F",
    returnType = "Z",
    parameters = listOf("Ljava/nio/ByteBuffer;", "J", "I"),
    filters = listOf(methodCall(definingClass = TRACK, name = "getAudioSessionId", parameters = emptyList(), returnType = "I")),
    custom = { _, owner -> owner.type == "Lcdk;" },
)

private object Release : Fingerprint(
    name = "run",
    returnType = "V",
    parameters = emptyList(),
    filters = listOf(methodCall(definingClass = TRACK, name = "release", parameters = emptyList(), returnType = "V")),
    custom = { _, owner -> owner.type == "Lgmx;" },
)

private val audioEffectPermission = resourcePatch {
    execute {
        resourceXml("AndroidManifest.xml").use { manifest ->
            val permission = "android.permission.MODIFY_AUDIO_SETTINGS"
            if (manifest.root.children("uses-permission").none { it.attribute("android:name") == permission }) {
                manifest.root.appendChild("uses-permission") { setAttribute("android:name", permission) }
            }
        }
    }
}

@Suppress("unused")
val volumeBoostPatch = bytecodePatch(
    name = "Volume boost",
    description = "Adds a per-session volume slider to the player action row. Starts off on each app launch.",
    default = true,
) {
    category("Full Collection")
    dependsOn(settingsPatch, audioEffectPermission)
    compatibleWith(app.morphe.patches.music.shared.Constants.COMPATIBILITY_YOUTUBE_MUSIC)

    execute {
        ActionRow.clearMatch()
        val constructor = ActionRow.method
        val code = constructor.implementation!!.instructions.toList()
        val id = code.indexOfFirst { (it as? WideLiteralInstruction)?.wideLiteral == ACTION_ROW }
        val viewLookup = ((id + 1) until minOf(id + 7, code.size)).firstOrNull { i ->
            val ref = code[i].getReference<MethodReference>()
            ref?.returnType == "Landroid/view/View;" && ref.parameterTypes == listOf("I") &&
                ref.name in setOf("findViewById", "requireViewById") &&
                code.getOrNull(i + 1)?.opcode == Opcode.MOVE_RESULT_OBJECT
        } ?: throw PatchException("Volume boost: native player action view lookup changed")
        val view = (code[viewLookup + 1] as OneRegisterInstruction).registerA
        constructor.addInstruction(viewLookup + 2,
            "invoke-static/range { v$view .. v$view }, $BOOST->bind(Landroid/view/View;)V")

        for ((fingerprint, replacement, returnType) in listOf(
            Triple(Session, "audioSession", "I"),
            Triple(Release, "releaseAudioTrack", "V"),
        )) {
            fingerprint.clearMatch()
            val method = fingerprint.method
            val index = fingerprint.instructionMatches.single().index
            val call = method.implementation!!.instructions.elementAt(index) as? FiveRegisterInstruction
                ?: throw PatchException("Volume boost: native audio track receiver changed")
            val register = call.registerC
            method.replaceInstruction(index,
                "invoke-static/range { v$register .. v$register }, $BOOST->$replacement($TRACK)$returnType")
        }
    }
}
