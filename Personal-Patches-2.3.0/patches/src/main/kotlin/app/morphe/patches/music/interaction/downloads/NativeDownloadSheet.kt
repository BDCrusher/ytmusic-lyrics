/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.morphe.patches.music.interaction.downloads

import app.morphe.patcher.extensions.InstructionExtensions.replaceInstruction
import app.morphe.patcher.patch.BytecodePatchContext
import app.morphe.patcher.patch.PatchException
import app.morphe.patcher.util.registersUsed
import com.android.tools.smali.dexlib2.Opcode
import com.android.tools.smali.dexlib2.iface.instruction.ReferenceInstruction
import com.android.tools.smali.dexlib2.iface.instruction.WideLiteralInstruction
import com.android.tools.smali.dexlib2.iface.reference.FieldReference
import com.android.tools.smali.dexlib2.iface.reference.MethodReference

private const val DIALOG = "Landroid/app/AlertDialog;"
private const val LIST = "Lcom/google/android/libraries/youtube/offline/ui/NonScrollableListView;"

/**
 * Native UI contracts inspected on 9.45.51 and 9.46.51. Only the dialog holding
 * the native quality list is decorated, after the host populates actions and rows.
 */
internal fun BytecodePatchContext.installNativeDownloadSheet() {
    val appLayout = 0x7f0e045cL // layout/upsell_dialog_with_header_images on both originals
    val candidates = mutableListOf<FieldReference>()
    classDefForEach { owner ->
        if (owner.fields.none { it.type == LIST }) return@classDefForEach
        if (owner.methods.none { method -> method.name == "<init>" &&
                method.implementation?.instructions?.any {
                    (it as? WideLiteralInstruction)?.wideLiteral == appLayout
                } == true }) return@classDefForEach
        candidates += owner.fields.filter { it.type == DIALOG }
    }
    val field = candidates.singleOrNull()
        ?: throw PatchException("Could not identify the native Music quality dialog")
    var count = 0
    classDefForEach { owner ->
        for (definition in owner.methods) {
            val code = definition.implementation?.instructions?.toList() ?: continue
            for (i in 1 until code.size) {
                val call = (code[i] as? ReferenceInstruction)?.reference as? MethodReference ?: continue
                if (call.definingClass != DIALOG || call.name != "show" || call.parameterTypes.isNotEmpty() ||
                    call.returnType != "V") continue
                val load = code[i - 1]
                if (load.opcode != Opcode.IGET_OBJECT || (load as ReferenceInstruction).reference != field) continue
                val receiver = code[i].registersUsed.single()
                if (load.registersUsed.first() != receiver)
                    throw PatchException("Unexpected receiver for the native Music quality dialog")
                val method = mutableClassDefBy(owner.type).methods.single { it == definition }
                method.replaceInstruction(i,
                    "invoke-static/range { v$receiver .. v$receiver }, " +
                    "Lapp/bdcrusher/ytmusic/playlists/DownloadPrompt;->showNative(${DIALOG})V")
                count++
            }
        }
    }
    if (count != 1) throw PatchException("Expected one native Music quality launch, found $count")
}
