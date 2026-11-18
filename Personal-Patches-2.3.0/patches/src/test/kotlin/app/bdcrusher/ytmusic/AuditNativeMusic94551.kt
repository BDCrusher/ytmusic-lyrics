/* Copyright 2026 BDCrusher. GPL-3.0. Desktop DEX analysis, not ART acceptance. */
package app.bdcrusher.ytmusic

import java.io.DataInputStream
import java.io.File
import java.security.MessageDigest
import java.util.zip.ZipFile
import com.android.tools.smali.dexlib2.Opcode
import com.android.tools.smali.dexlib2.AccessFlags
import com.android.tools.smali.dexlib2.analysis.*
import com.android.tools.smali.dexlib2.dexbacked.DexBackedDexFile
import com.android.tools.smali.dexlib2.iface.*
import com.android.tools.smali.dexlib2.iface.instruction.*
import com.android.tools.smali.dexlib2.iface.reference.*
import com.android.tools.smali.dexlib2.immutable.ImmutableClassDef

private fun hash45(file: File) = MessageDigest.getInstance("SHA-256").digest(file.readBytes()).joinToString("") { "%02x".format(it) }

/** SDK hierarchy only. DEX instructions supply field and method result types directly. */
private fun sdk45(): Map<String, ClassDef> {
    val out = mutableMapOf<String, ClassDef>()
    ZipFile(File(System.getenv("ANDROID_HOME"), "platforms/android-36/android.jar")).use { jar ->
        for (entry in jar.entries().asSequence().filter { it.name.endsWith(".class") }) {
            DataInputStream(jar.getInputStream(entry)).use { input ->
                require(input.readInt() == 0xcafebabe.toInt())
                input.readUnsignedShort(); input.readUnsignedShort()
                val pool = arrayOfNulls<Any>(input.readUnsignedShort()); var n = 1
                while (n < pool.size) {
                    when (input.readUnsignedByte()) {
                        1 -> pool[n] = input.readUTF()
                        7 -> pool[n] = input.readUnsignedShort()
                        3, 4 -> input.skipNBytes(4)
                        5, 6 -> { input.skipNBytes(8); n++ }
                        8, 16, 19, 20 -> input.skipNBytes(2)
                        9, 10, 11, 12, 17, 18 -> input.skipNBytes(4)
                        15 -> input.skipNBytes(3)
                        else -> error("Unsupported SDK constant pool")
                    }; n++
                }
                fun type(index: Int) = "L${pool[pool[index] as Int] as String};"
                val flags = input.readUnsignedShort(); val name = type(input.readUnsignedShort())
                val parent = input.readUnsignedShort().let { if (it == 0) null else type(it) }
                val interfaces = List(input.readUnsignedShort()) { type(input.readUnsignedShort()) }
                out[name] = ImmutableClassDef(name, flags, parent, interfaces, null, null, null, null)
            }
        }
    }
    return out
}

private fun assignable45(actual: String, expected: String, types: Map<String, ClassDef>, seen: MutableSet<String> = mutableSetOf()): Boolean {
    if (actual == expected || expected == "Ljava/lang/Object;") return true
    if (!seen.add(actual)) return false
    if (actual.startsWith("[")) {
        if (expected in setOf("Ljava/lang/Cloneable;", "Ljava/io/Serializable;")) return true
        return expected.startsWith("[") && actual.substring(1).let { element ->
            if (element.startsWith("L") || element.startsWith("[")) assignable45(element, expected.substring(1), types)
            else element == expected.substring(1)
        }
    }
    val definition = types[actual] ?: error("Missing hierarchy for $actual -> $expected")
    return (definition.interfaces + listOfNotNull(definition.superclass)).any { assignable45(it, expected, types, seen) }
}

private fun Instruction.call44()=(this as? ReferenceInstruction)?.reference as? MethodReference
private fun Instruction.regs44()=when(this){is RegisterRangeInstruction->(startRegister until startRegister+registerCount).toList();is FiveRegisterInstruction->listOf(registerC,registerD,registerE,registerF,registerG).take(registerCount);else->emptyList()}
/** Prove a constructor/binder call receives the original object on every reachable path. */
private fun receiver44(method:Method,select:(MethodReference)->Boolean):Int{
 val impl=method.implementation!!;val code=impl.instructions.toList();val addresses=IntArray(code.size);var address=0
 for((n,i)in code.withIndex()){addresses[n]=address;address+=i.codeUnits};val indices=addresses.withIndex().associate {it.value to it.index}
 val words=method.parameterTypes.sumOf {if(it=="J"||it=="D")2 else 1}+if(AccessFlags.STATIC.isSet(method.accessFlags))0 else 1
 val receiver=impl.registerCount-words
 data class State(val at:Int,val aliases:Set<Int>)
 val queue=java.util.ArrayDeque<State>();queue.add(State(0,setOf(receiver)));val seen=mutableSetOf<State>();val sites=mutableSetOf<Int>()
 while(queue.isNotEmpty()){
  val state=queue.removeFirst();if(!seen.add(state))continue;require(seen.size<50000){"Unbounded receiver analysis $method"}
  val n=state.at;val i=code[n];val op=(i.opcode as Enum<*>).name;val ref=i.call44();val aliases=state.aliases.toMutableSet()
  if(ref!=null&&select(ref)){val arg=i.regs44().first();require(arg in aliases){"Receiver clobbered before $ref in $method @$n v$arg aliases=$aliases"};sites.add(n)}
  if(op.startsWith("MOVE_OBJECT")&&i is TwoRegisterInstruction){if(i.registerB in aliases)aliases.add(i.registerA)else aliases.remove(i.registerA)}
  else if(i.opcode!=Opcode.CHECK_CAST&&i.opcode.setsRegister()&&i is OneRegisterInstruction)aliases.remove(i.registerA)
  if(op.startsWith("RETURN")||op=="THROW")continue
  fun add(target:Int){queue.add(State(target,aliases.toSet()))}
  if(i is OffsetInstruction){
   val target=indices.getValue(addresses[n]+i.codeOffset)
   if(op.startsWith("GOTO")||op.startsWith("IF_"))add(target)
   else if(op.contains("SWITCH")){val payload=code[target] as SwitchPayload;for(element in payload.switchElements)add(indices.getValue(addresses[n]+element.offset))}
   else require(op=="FILL_ARRAY_DATA"){"Unsupported receiver flow $op"}
  }
  if(!op.startsWith("GOTO")&&n+1<code.size)add(n+1)
  for(block in impl.tryBlocks)if(addresses[n]>=block.startCodeAddress&&addresses[n]<block.startCodeAddress+block.codeUnitCount)for(handler in block.exceptionHandlers)add(indices.getValue(handler.handlerCodeAddress))
 }
 require(sites.isNotEmpty()){ "No receiver site in $method" };return sites.size
}

fun main(args: Array<String>) {
    val apk = File(args[0])
    val classes = ZipFile(apk).use { zip ->
        zip.entries().asSequence().filter { it.name.matches(Regex("classes[0-9]*[.]dex")) }
            .flatMap { DexBackedDexFile.fromInputStream(null, zip.getInputStream(it).buffered()).classes.asSequence() }
            .associateBy { it.type }
    }
    val types = sdk45() + classes
    val classpath = ClassPath(ClassProvider { types[it] })
    val own = "Lapp/bdcrusher/ytmusic/"
    val special = setOf("createRequest", "decode", "decodePlayer", "fileUri", "panelRoot", "panelId", "nativeDefinition", "rewriteNative")
    val methods = classes.values.flatMap { it.methods }.filter { method ->
        method.implementation != null && (method.name.startsWith("bd_")
                || method.definingClass.startsWith(own) && method.name in special)
    }
    val failures = mutableListOf<String>()
    var returns = 0
    for (method in methods) {
        val analyzer = MethodAnalyzer(classpath, method, null, false)
        val error = analyzer.analysisException
        if (error != null) {
            failures += "$method analysis: ${error.message}"
            continue
        }
        for (instruction in analyzer.analyzedInstructions) {
            if (instruction.instruction.opcode != Opcode.RETURN_OBJECT || instruction.predecessorCount == 0) continue
            returns++
            val register = (instruction.instruction as OneRegisterInstruction).registerA
            val type = instruction.getPreInstructionRegisterType(register)
            val declared = method.returnType.startsWith("L") || method.returnType.startsWith("[")
            val valid = declared && (type.category == RegisterType.NULL || type.category == RegisterType.REFERENCE
                    && assignable45(type.type!!.type, method.returnType, types))
            if (!valid) failures += "$method @${instruction.instructionIndex}: $type cannot return ${method.returnType}"
        }
    }
    var receiverSites = 0
    val callbacks = setOf(
        own + "playlists/NativeMediaCache;->initialized",
        own + "lyrics/NativeLyricsHost;->captureController",
        own + "lyrics/LyricsEntryButton;->capturePresenter"
    )
    val libraryHost = "Lapp/morphe/extension/music/patches/downloads/NativeDownloadsHost;"
    check(libraryHost !in classes) { "Retired Library host is still bundled" }
    for (owner in classes.values.filter { !it.type.startsWith("Lapp/") }) {
        for (method in owner.methods) {
            val called = method.implementation?.instructions?.any {
                it.call44()?.let { ref -> "${ref.definingClass}->${ref.name}" in callbacks } == true
            } == true
            if (called && method.name == "<init>") {
                receiverSites += receiver44(method) { "${it.definingClass}->${it.name}" in callbacks }
            }
        }
    }
    check(classes.values.none { own + "playlists/DownloadsHost" in it.type }) { "Retired Library bridge exists" }
    check(methods.isNotEmpty() && returns > 0)
    check(failures.isEmpty()) { failures.joinToString("\n") }
    val report = org.json.JSONObject().put("passed", true).put("apkSha256", hash45(apk))
        .put("bridgeMethods", methods.size).put("referenceReturns", returns).put("receiverSites", receiverSites)
        .put("nativeLibraryHost", true).put("retiredLibraryBridgeAbsent", true).put("phoneVerified", false)
    apk.parentFile.resolve("native-receiver-return-audit.json").writeText(report.toString(2) + "\n")
    println("PASS: ${methods.size} bridge methods, $returns typed returns, $receiverSites constructor receiver sites")
}
