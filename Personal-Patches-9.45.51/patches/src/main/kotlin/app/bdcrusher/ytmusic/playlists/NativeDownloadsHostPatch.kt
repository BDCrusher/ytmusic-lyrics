/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.playlists

import app.morphe.patcher.Fingerprint
import app.morphe.patcher.extensions.InstructionExtensions.addInstruction
import app.morphe.patcher.extensions.InstructionExtensions.addInstructionsWithLabels
import app.morphe.patcher.patch.*
import app.morphe.patcher.util.cloneParameters
import app.morphe.patcher.util.getReference
import app.morphe.patches.music.interaction.jam.addBridge
import com.android.tools.smali.dexlib2.Opcode
import com.android.tools.smali.dexlib2.iface.instruction.WideLiteralInstruction
import com.android.tools.smali.dexlib2.iface.reference.FieldReference
import com.android.tools.smali.dexlib2.iface.reference.StringReference
import com.android.tools.smali.dexlib2.iface.reference.TypeReference

private const val HOST = "Lapp/morphe/extension/music/patches/downloads/NativeDownloadsHost;"
private const val OWNER = "Lapp/morphe/extension/music/patches/downloads/NativeDownloadsHost\$Owner;"
private const val FRAME = "Landroid/widget/FrameLayout;"
private const val LOADING_FRAME = "Lcom/google/android/apps/youtube/music/ui/components/loading/LoadingFrameLayout;"
private const val BROWSE_CONTENT = 0x7f0b01d4

private object LibraryBackCallback : Fingerprint(
    returnType = "V",
    parameters = emptyList(),
    strings = listOf("FEmusic_home", "FEmusic_library_landing"),
    name = "b",
    custom = { _, owner -> owner.type == "Lgma;" },
)

private object LibraryFragment : Fingerprint(
    name = "<clinit>",
    strings = listOf("com/google/android/apps/youtube/music/browse/LibraryBrowseFragment"),
)

internal fun BytecodePatchContext.installNativeDownloadsHost() {
    LibraryFragment.clearMatch()
    val library = mutableClassDefBy(LibraryFragment.classDef.type)
    val create = library.methods.single { it.name == "onCreateView" }
    val code = create.implementation!!.instructions.toList()
    val root = library.fields.singleOrNull { field ->
        field.type == "Landroid/view/View;" && code.any {
            it.opcode == Opcode.IPUT_OBJECT && it.getReference<FieldReference>() == field
        }
    } ?: throw PatchException("Downloads: native Library root changed")
    val loading = code.withIndex().singleOrNull {
        it.value.opcode == Opcode.CHECK_CAST && it.value.getReference<TypeReference>()?.type == LOADING_FRAME
    }?.index ?: throw PatchException("Downloads: native Library content frame changed")
    if ((code.getOrNull(loading - 3) as? WideLiteralInstruction)?.wideLiteral?.toInt() != BROWSE_CONTENT ||
        generateSequence(LOADING_FRAME) { classDefByOrNull(it)?.superclass }.none { it == FRAME }
    ) throw PatchException("Downloads: incompatible Library browse_content contract")

    val state = library.fields.singleOrNull { field ->
        classDefByOrNull(field.type)?.let { candidate ->
            candidate.superclass == "Ljava/lang/Enum;" && candidate.methods.any { m ->
                m.name == "<clinit>" && m.implementation?.instructions?.any {
                    it.getReference<StringReference>()?.string == "DOWNLOADS"
                } == true
            }
        } == true
    } ?: throw PatchException("Downloads: native Library destination state changed")
    val setter = library.methods.singleOrNull { m ->
        m.returnType == "V" && m.parameterTypes.size == 1 && m.implementation?.instructions?.any {
            it.opcode == Opcode.IPUT_OBJECT && it.getReference<FieldReference>() == state
        } == true
    } ?: throw PatchException("Downloads: native Library destination binding changed")

    library.interfaces.add(OWNER)
    library.addBridge("bd_libraryDownloadsContent", emptyList(), FRAME, 3, body = """
        iget-object v0, p0, $root
        if-eqz v0, :absent
        const v1, $BROWSE_CONTENT
        invoke-virtual { v0, v1 }, Landroid/view/View;->findViewById(I)Landroid/view/View;
        move-result-object v0
        instance-of v1, v0, $FRAME
        if-eqz v1, :absent
        check-cast v0, $FRAME
        return-object v0
        :absent
        const/4 v0, 0x0
        return-object v0
    """)
    library.addBridge("bd_libraryDownloadsSelected", emptyList(), "Z", 3, body = """
        iget-object v0, p0, $state
        if-eqz v0, :absent
        invoke-virtual { v0 }, Ljava/lang/Enum;->name()Ljava/lang/String;
        move-result-object v0
        const-string v1, "DOWNLOADS"
        invoke-virtual { v1, v0 }, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
        move-result v0
        return v0
        :absent
        const/4 v0, 0x0
        return v0
    """)

    val changes = listOf(setter) + listOf("onViewCreated", "onResume", "onHiddenChanged").map { name ->
        library.methods.single { it.name == name }
    }
    for (original in changes) {
        val method = original.cloneParameters()
        val exits = method.implementation!!.instructions.withIndex()
            .filter { it.value.opcode == Opcode.RETURN_VOID }.map { it.index }
        if (exits.isEmpty()) throw PatchException("Downloads: no Library lifecycle exit in ${method.name}")
        for (index in exits.asReversed()) {
            method.addInstruction(index, "invoke-static/range { p0 .. p0 }, $HOST->changed($OWNER)V")
        }
    }
    LibraryBackCallback.clearMatch()
    val nativeBack = LibraryBackCallback.method
    val backOwner = LibraryBackCallback.classDef.fields.singleOrNull { it.type == library.type }
        ?: throw PatchException("Downloads: native Library back callback lost its presenter")
    if (nativeBack.implementation!!.registerCount < 2)
        throw PatchException("Downloads: native Library back callback has no scratch register")
    nativeBack.addInstructionsWithLabels(0, """
        iget-object v0, p0, $backOwner
        invoke-static { v0 }, $HOST->handleBack($OWNER)Z
        move-result v0
        if-eqz v0, :stock_back
        return-void
        :stock_back
        nop
    """)

    for (name in listOf("onStop", "onDestroyView")) {
        library.methods.single { it.name == name }
            .addInstruction(0, "invoke-static/range { p0 .. p0 }, $HOST->release($OWNER)V")
    }
}
