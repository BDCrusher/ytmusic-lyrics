/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.volume

import app.morphe.patcher.*
import app.morphe.patcher.extensions.InstructionExtensions.addInstructions
import app.morphe.patcher.extensions.InstructionExtensions.addInstructionsWithLabels
import app.morphe.patcher.extensions.InstructionExtensions.replaceInstruction
import app.morphe.patcher.patch.*
import app.morphe.patcher.util.proxy.mutableTypes.MutableMethod.Companion.toMutable
import app.morphe.patcher.util.getReference
import app.morphe.patches.music.misc.settings.settingsPatch
import app.morphe.patches.shared.misc.fix.proto.fixProtoLibraryPatch
import app.morphe.patches.shared.misc.fix.proto.parseByteArrayWithRegistryMethodRef
import app.morphe.patches.shared.misc.fix.proto.protoDefaultInstanceFingerprint
import app.morphe.patches.youtube.interaction.downloads.ResolveCommandFingerprint
import com.android.tools.smali.dexlib2.builder.MutableMethodImplementation
import com.android.tools.smali.dexlib2.immutable.ImmutableMethod
import com.android.tools.smali.dexlib2.iface.instruction.ReferenceInstruction
import com.android.tools.smali.dexlib2.iface.instruction.FiveRegisterInstruction
import com.android.tools.smali.dexlib2.iface.reference.MethodReference

private const val BOOST = "Lapp/bdcrusher/ytmusic/common/PlayerVolumeBoost;"
private const val TRACK = "Landroid/media/AudioTrack;"
private const val REGISTRY = "Lcom/google/protobuf/ExtensionRegistryLite;"
private const val MESSAGE = "Lcom/google/protobuf/MessageLite;"

private object ActionPresenter : Fingerprint(
    strings = listOf("com/google/android/apps/youtube/music/watchpage/VideoActionBarPresenter"),
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
    dependsOn(settingsPatch, audioEffectPermission, fixProtoLibraryPatch)
    compatibleWith(app.morphe.patches.music.shared.Constants.COMPATIBILITY_YOUTUBE_MUSIC)

    execute {
        ActionPresenter.clearMatch()
        val presenter = ActionPresenter.classDef
        val render = presenter.methods.singleOrNull { method ->
            method.returnType == "V" && method.parameterTypes.size == 2 &&
                method.implementation?.instructions?.any { instruction ->
                    val call = (instruction as? ReferenceInstruction)?.reference as? MethodReference
                    call?.definingClass == method.parameterTypes[0] &&
                        call.parameterTypes == listOf(method.parameterTypes[1], "Z")
                } == true
        } ?: throw PatchException("Volume boost: native action-bar model renderer changed")
        val element = render.parameterTypes[1].toString()
        val defaultInstance = protoDefaultInstanceFingerprint(element).instructionMatches.first().fieldReference
        val parser = parseByteArrayWithRegistryMethodRef.get()
            ?: throw PatchException("Volume boost: native model parser is unavailable")
        val extension = mutableClassDefBy(BOOST)
        val stub = extension.methods.single { it.name == "nativeModel" }
        val modelHook = ImmutableMethod(stub.definingClass, stub.name, stub.parameters, stub.returnType,
            stub.accessFlags, stub.annotations, stub.hiddenApiRestrictions, MutableMethodImplementation(6))
            .toMutable()
        modelHook.addInstructionsWithLabels(0, """
            if-eqz p0, :unchanged
            check-cast p0, $element
            invoke-interface { p0 }, $MESSAGE->toByteArray()[B
            move-result-object v0
            invoke-static { v0 }, $BOOST->rewriteModel([B)[B
            move-result-object v1
            if-eq v0, v1, :unchanged
            sget-object v2, $defaultInstance
            invoke-static {}, $REGISTRY->getGeneratedRegistry()$REGISTRY
            move-result-object v3
            invoke-static { v2, v1, v3 }, $parser
            move-result-object v2
            return-object v2
            :unchanged
            return-object p0
        """)
        extension.methods.remove(stub)
        extension.methods.add(modelHook)
        render.addInstructions(0, """
            invoke-static/range { p2 .. p2 }, $BOOST->nativeModel(Ljava/lang/Object;)Ljava/lang/Object;
            move-result-object p2
            check-cast p2, $element
        """)
        ResolveCommandFingerprint.method.addInstructionsWithLabels(0, """
            invoke-static/range { p1 .. p2 }, $BOOST->handleCommand(Ljava/lang/Object;Ljava/util/Map;)Z
            move-result v0
            if-eqz v0, :resolve_command
            return-void
            :resolve_command
            nop
        """)

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
