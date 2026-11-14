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
private const val ORIGINAL = "ad8963959890b6b23a0b332cf9829ee7d6ea6f3a0a61e386d7c34c51a2dd99f7"

private fun hash(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
        val buffer = ByteArray(65536)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            digest.update(buffer, 0, count)
        }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
}

fun main(args: Array<String>) {
    val (apk, bundle, output) = args.take(3).map { File(it).canonicalFile }
    val mode = args[3]
    check(hash(apk) == ORIGINAL) { "Wrong original" }
    check(output.toPath().startsWith(File(System.getProperty("user.dir")).canonicalFile.parentFile.toPath()))
    check(output.mkdirs()) { "Use an unused verification directory" }
    println("Original ${hash(apk)}")
    println("Bundle ${hash(bundle)}")
    val loaded = loadPatchesFromJar(setOf(bundle))
    check(loaded.none { it.name != null && (it.compatibility.isNullOrEmpty() ||
        it.compatibility.orEmpty().any { app -> app.packageName == null }) }) {
        "The personal bundle exposes a universal patch"
    }
    val candidates = loaded.filter { patch ->
        patch.name != null && patch.compatibility.orEmpty().any { app ->
            app.packageName == MUSIC && app.targets.any { target ->
                target.version == null || target.version == "9.45.51"
            }
        }
    }
    val selected = candidates.filter { patch ->
        when (mode) {
            "downloads" -> patch.name == "Downloads"
            "clone" -> patch.name in setOf("Clone YouTube Music", "GmsCore support")
            "features-clone" -> patch.default || patch.name in setOf("Shaders", "Downloads", "Clone YouTube Music")
            "lyrics" -> patch.name == "Third-party lyrics"
            "shaders" -> patch.name == "Shaders"
            "defaults" -> patch.default
            "without-personal" -> patch.default && patch.name !in setOf("Third-party lyrics", "Volume boost", "Theme")
            "without-downloads" -> patch.name != "Downloads" && (patch.default || patch.name == "Shaders")
            "features" -> patch.default || patch.name == "Shaders" || patch.name == "Downloads"
            else -> error("Unknown mode $mode")
        }
    }.toSet()
    check(selected.isNotEmpty())
    if (mode in setOf("clone", "features-clone")) selected.single { it.name == "Clone YouTube Music" }
        .options["packageName"] = "app.bdcrusher.android.apps.youtube.music"
    val catalog = org.json.JSONArray()
    for (patch in candidates.sortedBy { it.name }) {
        catalog.put(org.json.JSONObject().put("name", patch.name).put("category", patch.category)
            .put("default", patch.default).put("selected", patch in selected))
    }
    output.resolve("patch-catalog.json").writeText(org.json.JSONObject()
        .put("package", MUSIC).put("version", "9.45.51").put("versionCode", 94551240)
        .put("abi", "arm64-v8a").put("minSdk", 28).put("patcher", "2.3.0")
        .put("bundleSha256", hash(bundle)).put("patches", catalog).toString(2) + "\n")
    println("Selection $mode: ${selected.joinToString { it.name!! }}")
    val result = output.resolve("verified-unsigned.apk")
    val sdk = File(System.getenv("ANDROID_HOME"))
    Patcher(PatcherConfig(apk, output.resolve("patcher"), verifier = SdkDexVerifier(sdk))).use { patcher ->
        patcher += selected
        runBlocking { patcher().collect { event ->
            println("Patch ${event.patch.name ?: "dependency"}")
            event.exception?.let { throw it }
        } }
        patcher.get().applyTo(result)
    }
    val seen = mutableSetOf<String>()
    val calls = mutableMapOf<String, Int>()
    val host = "Lapp/morphe/extension/music/patches/downloads/NativeDownloadsHost;"
    val downloadsHost = "Lapp/morphe/extension/music/patches/DownloadsPatch;"
    val nativeOfflineHooks = mutableSetOf<String>()
    ZipFile(result).use { archive ->
        for (entry in archive.entries().asSequence().filter { it.name.matches(Regex("classes[0-9]*[.]dex")) }) {
            val dex = archive.getInputStream(entry).buffered().use { DexBackedDexFile.fromInputStream(null, it) }
            for (owner in dex.classes) {
                check(seen.add(owner.type)) { "Duplicate ${owner.type}" }
                for (method in owner.methods) {
                    check(method.name !in setOf("bd_downloadContent", "bd_libraryDownloadsContent")) { "Retired Library bridge remains: $method" }
                    val code = method.implementation?.instructions?.toList().orEmpty()
                    for (instruction in code) {
                        val ref = (instruction as? ReferenceInstruction)?.reference as? MethodReference ?: continue
                        if (!owner.type.startsWith("Lapp/")) {
                            check(ref.definingClass != host) { "Retired Library hook remains: $method" }
                            if (ref.definingClass == downloadsHost ||
                                ref.definingClass.endsWith("/BaseInAppDownloadsPatch;")) nativeOfflineHooks.add(ref.name)
                        }
                        if (ref.definingClass.startsWith("Lapp/bdcrusher/ytmusic/"))
                            calls.merge("${ref.definingClass}->${ref.name}", 1, Int::plus)
                    }
                }
            }
        }
    }
    if (selected.any { it.name == "Downloads" }) {
        ZipFile(result).use {
            check(it.getEntry("assets/bdcrusher-features/downloads.enabled") != null)
            check(it.getEntry("res/drawable/morphe_music_downloaded_mark.xml") == null)
        }
        check(calls["Lapp/bdcrusher/ytmusic/playlists/LocalPlayback;->bd_nativeResponse"] == 1)
        check(calls.getOrDefault("Lapp/bdcrusher/ytmusic/playlists/LocalNetFetch;->local", 0) >= 1)
        check(calls.getOrDefault("Lapp/bdcrusher/ytmusic/playlists/NativePlayback;->open", 0) >= 1)
        check(seen.none { it.endsWith("/OfflinePlaybackService;") || it.endsWith("/LocalDownloadsFragment;") })
        check(nativeOfflineHooks.containsAll(setOf("handleExternalDownload", "observeAuthorizedOfflineResponse"))) {
            "Native offline hooks missing: $nativeOfflineHooks"
        }
        check(nativeOfflineHooks.intersect(setOf("unlockOfflineability", "replaceDeclinedOfflinePlayerResponse",
            "replaceOfflineUpsell", "replaceDisabledOfflineState")).isEmpty())
        println("PASS: native offline hooks and no personal Library mount ($nativeOfflineHooks)")
    } else {
        check(nativeOfflineHooks.isEmpty()) { "Native Downloads hooks were installed without Downloads" }
    }
    val volume = "Lapp/bdcrusher/ytmusic/common/PlayerVolumeBoost;"
    for (hook in listOf("nativeModel", "handleCommand", "audioSession", "releaseAudioTrack")) {
        check(calls.getOrDefault("$volume->$hook", 0) == if (selected.any { it.name == "Volume boost" }) 1 else 0)
    }
    println("PASS: $mode, ${seen.size} unique classes; retired Library bridge absent")
    println("Patched unsigned APK ${hash(result)}")
}
