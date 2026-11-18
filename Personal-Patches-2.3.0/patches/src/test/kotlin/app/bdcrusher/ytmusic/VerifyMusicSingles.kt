/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic

import app.morphe.patcher.Patcher
import app.morphe.patcher.PatcherConfig
import app.morphe.patcher.apk.ApkUtils.applyTo
import app.morphe.patcher.dex.SdkDexVerifier
import app.morphe.patcher.patch.loadPatchesFromJar
import com.android.tools.smali.dexlib2.dexbacked.DexBackedDexFile
import com.android.tools.smali.dexlib2.iface.instruction.ReferenceInstruction
import com.android.tools.smali.dexlib2.iface.reference.MethodReference
import java.io.File
import java.security.MessageDigest
import java.util.zip.ZipFile
import kotlinx.coroutines.runBlocking

private const val MUSIC = "com.google.android.apps.youtube.music"
private const val OWN = "Lapp/bdcrusher/ytmusic/"
private val names = setOf("Shaders", "Volume Boost", "Better Lyrics", "Downloads").map { "$it (Single)" }.toSet()

private fun sha(file: File): String = file.inputStream().use { stream ->
    val digest = MessageDigest.getInstance("SHA-256")
    val buffer = ByteArray(64 * 1024)
    while (true) {
        val count = stream.read(buffer)
        if (count < 0) break
        digest.update(buffer, 0, count)
    }
    digest.digest().joinToString("") { "%02x".format(it) }
}

fun main(args: Array<String>) {
    val (apk, personal, official, output) = args.take(4).map { File(it).canonicalFile }
    val version = when (sha(apk)) {
        "ad8963959890b6b23a0b332cf9829ee7d6ea6f3a0a61e386d7c34c51a2dd99f7" -> "9.45.51"
        "aeab0dfc46d379490ee6ca772fd6d4cc68d2480ea7c29ad37299624362c171b6" -> "9.46.51"
        else -> error("Wrong original")
    }
    val cases = args[4].split('|').toSet()
    val personalFirst = args[5] == "personal-first"
    val inputs = if (personalFirst) linkedSetOf(personal, official) else linkedSetOf(official, personal)
    ZipFile(personal).use { bundle ->
        val payload = bundle.getInputStream(bundle.getEntry("extensions/bdcrusher-music-singles.mpe")).buffered()
        val classes = payload.use { DexBackedDexFile.fromInputStream(null, it).classes }
        check(classes.isNotEmpty() && classes.all { it.type.startsWith(OWN) || it.type == "Lcom/android/tools/r8/RecordTag;" }) { "Foreign Single payload classes" }
    }
    val loaded = loadPatchesFromJar(inputs).byPatchesFile
    val ours = loaded.getValue(personal)
    check(ours.none { it.compatibility.isNullOrEmpty() || it.compatibility.orEmpty().any { it.packageName == null } })
    val personalMusic = ours.filter { it.name != null && it.compatibility.orEmpty().any { row -> row.packageName == MUSIC } }
    check(personalMusic.map { it.category }.toSet() == setOf("Full Collection", "Singles")) {
        "Unexpected catalog entries: " + personalMusic.filter { it.category !in setOf("Full Collection", "Singles") }.map { it.name }
    }
    check(personalMusic.filter { it.category == "Singles" }.mapNotNull { it.name }.toSet() == names)
    check(personalMusic.filter { it.category == "Singles" }.none { it.default })
    val selectedOfficial = loaded.getValue(official).filter { patch ->
        patch.compatibility.orEmpty().any { item -> item.packageName == MUSIC && item.targets.any { it.version == version || it.version == null } } &&
            (patch.default || patch.name in setOf("Downloads", "Third-party lyrics"))
    }.filterNot { it.name == "Third-party lyrics" && "no-official-lyrics" in cases }
    check(selectedOfficial.size >= 30)
    val selectedPersonal = personalMusic.filter { it.category == "Singles" && it.name in cases }
    check(selectedPersonal.size == cases.count { it in names } && selectedPersonal.isNotEmpty())
    check(output.mkdirs()) { "Use unused verification output" }
    println("Original ${sha(apk)} personal ${sha(personal)} official ${sha(official)} order ${args[5]}")
    println("Selected official ${selectedOfficial.size}: ${selectedOfficial.joinToString { it.name!! }}")
    println("Selected personal: ${selectedPersonal.joinToString { it.name!! }}")
    val result = output.resolve("verified-unsigned.apk")
    Patcher(PatcherConfig(apk, output.resolve("patcher"), verifier = SdkDexVerifier(File(System.getenv("ANDROID_HOME"))))).use { p ->
        p += if (personalFirst) (selectedPersonal + selectedOfficial).toSet() else (selectedOfficial + selectedPersonal).toSet()
        runBlocking { p().collect { event ->
            println("Patch ${event.patch.name ?: "dependency"}")
            event.exception?.let { throw it }
        } }
        p.get().applyTo(result)
    }
    val types = mutableSetOf<String>()
    val calls = mutableMapOf<String, Int>()
    ZipFile(result).use { zip ->
        val lyricsSelected = "Better Lyrics (Single)" in cases
        for (asset in listOf("renderer.js", "providers.json", "instrumental.css")) {
            val entry = zip.getEntry("assets/bdcrusher-lyrics/$asset")
            check((entry != null) == lyricsSelected) { "Unexpected lyrics asset $asset" }
            if (entry != null) {
                ZipFile(personal).use { bundle ->
                    val shared = bundle.getEntry("bdcrusher-lyrics/$asset")
                    check(zip.getInputStream(entry).use { it.readBytes() }
                        .contentEquals(bundle.getInputStream(shared).use { it.readBytes() })) { "Different renderer bundle asset: $asset" }
                }
            }
        }
        for (entry in zip.entries().asSequence().filter { it.name.matches(Regex("classes[0-9]*[.]dex")) }) {
            val dex = zip.getInputStream(entry).buffered().use { DexBackedDexFile.fromInputStream(null, it) }
            for (owner in dex.classes) {
                check(types.add(owner.type)) { "Duplicate ${owner.type}" }
                if (owner.type.startsWith(OWN)) continue
                for (m in owner.methods) for (insn in (m.implementation?.instructions ?: emptyList())) {
                    val call = (insn as? ReferenceInstruction)?.reference as? MethodReference ?: continue
                    if (call.definingClass.startsWith(OWN)) calls.merge("${call.definingClass}->${call.name}", 1, Int::plus)
                }
            }
        }
    }
    val expected = mapOf(
        "Shaders (Single)" to "shaders/ShaderRuntime;->onNativePanel",
        "Volume Boost (Single)" to "common/PlayerVolumeBoost;->handleCommand",
        "Better Lyrics (Single)" to "lyrics/RendererPlayback;->sample",
        "Downloads (Single)" to "playlists/PersonalDownloadRouting;->replaceDownloadCommand"
    )
    for ((feature, hook) in expected) {
        check(calls.getOrDefault(OWN + hook, 0) == if (feature in cases) 1 else 0) {
            "Unexpected Single hook $hook: $calls"
        }
    }
    val lyrics = "Better Lyrics (Single)" in cases
    val downloads = "Downloads (Single)" in cases
    check(calls.getOrDefault(OWN + "lyrics/LyricsSettingsPage;->install", 0) == if (lyrics) 1 else 0)
    check(calls.getOrDefault(OWN + "lyrics/PersonalLyricsTab;->onTabSelected", 0) == if (lyrics) 1 else 0)
    check(calls.getOrDefault(OWN + "playlists/DownloadPrompt;->showNative", 0) == if (downloads) 1 else 0)
    check(calls.keys.none { "PersonalRuntime;->attach" in it || "TaskDismissal;" in it }) { "Full Collection hooks in Singles" }
    println("PASS: ${selectedPersonal.map { it.name }} compatible with ${selectedOfficial.size} official patches, ${types.size} distinct classes")
    println("Patched unsigned APK ${sha(result)}")
}

