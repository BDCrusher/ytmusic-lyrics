/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic

import app.morphe.patcher.util.registersUsed
import com.android.tools.smali.dexlib2.AccessFlags
import com.android.tools.smali.dexlib2.Opcode
import com.android.tools.smali.dexlib2.dexbacked.DexBackedDexFile
import com.android.tools.smali.dexlib2.iface.ClassDef
import com.android.tools.smali.dexlib2.iface.instruction.ReferenceInstruction
import com.android.tools.smali.dexlib2.iface.reference.MethodReference
import java.io.File
import java.util.zip.ZipFile

private const val CATALOG = "Lapp/bdcrusher/ytmusic/lyrics/LyricsCatalog;"
private const val COORDINATOR = "Lapp/bdcrusher/ytmusic/lyrics/LyricsEntryCoordinator;"
private const val OFFICIAL = "Lapp/morphe/extension/music/"
private const val PROVIDERS = OFFICIAL + "patches/lyrics/LyricsProviders;"

/** Checks runtime access against the bundled code, which can differ from the Java compile-time classes. */
fun verifyLyricsProviderAccess(apk: File) {
    val classes = mutableMapOf<String, ClassDef>()
    ZipFile(apk).use { zip ->
        for (entry in zip.entries().asSequence().filter { it.name.matches(Regex("classes[0-9]*[.]dex")) }) {
            val dex = zip.getInputStream(entry).buffered().use { DexBackedDexFile.fromInputStream(null, it) }
            for (owner in dex.classes) {
                if (owner.type in listOf(CATALOG, COORDINATOR) || owner.type.startsWith(OFFICIAL)) classes[owner.type] = owner
            }
        }
    }
    val provider = classes.getValue(CATALOG).methods.single { it.name == "officialProvider" }
    var publicLookups = 0
    val metadata = classes.getValue(COORDINATOR).methods.single { it.name == "onMetadata" }
    val targets = listOf(provider, metadata).flatMap { boundary -> boundary.implementation!!.instructions }.mapNotNull { insn ->
        val call = (insn as? ReferenceInstruction)?.reference as? MethodReference
        if (call != null && call.definingClass.startsWith(OFFICIAL)) call to insn.opcode else null
    }.distinct()
    for ((call, opcode) in targets) {
        val owner = classes[call.definingClass] ?: error("Missing lyrics runtime class ${call.definingClass}")
        val method = owner.methods.singleOrNull {
            it.name == call.name && it.parameterTypes == call.parameterTypes && it.returnType == call.returnType
        } ?: error("Missing lyrics runtime method $call")
        check(AccessFlags.PUBLIC.isSet(owner.accessFlags) && AccessFlags.PUBLIC.isSet(method.accessFlags)) {
            "Inaccessible Morphe method called by Better Lyrics: $call (${AccessFlags.formatAccessFlagsForMethod(method.accessFlags)})"
        }
        check(AccessFlags.STATIC.isSet(method.accessFlags) == (opcode in setOf(Opcode.INVOKE_STATIC, Opcode.INVOKE_STATIC_RANGE))) {
            "Wrong invoke kind for $call: $opcode"
        }
        if (call.definingClass == PROVIDERS && call.name == "providersInOrder") publicLookups++
    }
    check(publicLookups == 1) { "Expected a public provider lookup, found $publicLookups" }
    val receiver = classes.getValue(OFFICIAL + "patches/lyrics/LyricsPatch;").methods.single { it.name == "onSetMetadata" }
    val body = receiver.implementation!!
    val hook = body.instructions.first()
    val reference = (hook as? ReferenceInstruction)?.reference as? MethodReference
    check(reference?.definingClass == COORDINATOR && reference.name == "onMetadata"
        && hook.registersUsed == listOf(body.registerCount - 1)) { "Metadata hook must capture the original argument" }
    println("PASS: public lyrics provider lookup, ${targets.size} visible runtime method references and original metadata receiver")
}

fun main(args: Array<String>) = verifyLyricsProviderAccess(File(args.single()))
