import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream
import java.util.zip.ZipEntry

group = "app.morphe"

patches {
    about {
        name = "BDCrusher YT-Music"
        description = "BDCrusher YouTube Music Full Collection and four Singles for official Morphe."
        source = "https://github.com/BDCrusher/ytmusic-lyrics"
        author = "BDCrusher and Morphe contributors"
        contact = "na"
        website = "https://morphe.software"
        license = "GNU General Public License v3.0, with additional GPL section 7 requirements"
    }
}

// Separate configuration so gson is available at runtime for the
// generatePatchesList task but never bundled into the APK.
val patchListGeneratorClasspath = configurations.create("patchListGeneratorClasspath")
val jamApk = providers.gradleProperty("jamApk")
val jamOutput = providers.gradleProperty("jamOutput")

// Resolve local composite build projects (smali, patcher) to jars for compilation,
// same as the runtime classpath. Otherwise, both the classes directory and the jar
// are passed to D8 by buildAndroid, and it fails with "Classpath type already present".
configurations.compileClasspath {
    attributes {
        attribute(LibraryElements.LIBRARY_ELEMENTS_ATTRIBUTE, objects.named(LibraryElements.JAR))
    }
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    // Required due to smali, or build fails. Can be removed once smali is bumped.
    implementation(libs.guava)

    implementation(libs.morphe.patches.library)

    patchListGeneratorClasspath(libs.gson)

    // Android API stubs defined here.
    compileOnly(project(":patches:stub"))

    testImplementation(kotlin("test"))
    testImplementation("org.json:json:20231013")
    testImplementation(files(rootProject.file(
        "extensions/shared-youtube/library/build/intermediates/javac/release/compileReleaseJavaWithJavac/classes"
    )))
    testImplementation(files(rootProject.file(
        "extensions/music/build/intermediates/javac/release/compileReleaseJavaWithJavac/classes"
    )))
    testImplementation(libs.kotlinx.coroutines.core)
    testImplementation(libs.protobuf.javalite)
    testRuntimeOnly(libs.junit.jupiter.engine)
}

tasks.named("compileTestKotlin") {
    dependsOn(":extensions:music:compileReleaseJavaWithJavac")
}

// The translated strings of addresources, converted to JSON at build time by the converter of
// addResourcesPatch, so patching only copies them. Each locale and app gets a file of its own.
val addResourcesJson = tasks.register<JavaExec>("addResourcesJson") {
    description = "Converts the translated addresources strings to JSON"

    val source = layout.projectDirectory.dir("src/main/resources/addresources")
    val output = layout.buildDirectory.dir("generated/addresources-json")
    inputs.dir(source)
    outputs.dir(output)

    // The compiled patches alone, as the main runtime classpath would need processResources.
    classpath = files(sourceSets["main"].output.classesDirs, configurations.runtimeClasspath)
    mainClass.set("app.bdcrusher.collection.all.misc.resources.TranslationsJson")
    args(source.asFile.path, output.get().asFile.path)
}

sourceSets.main {
    resources.srcDir(addResourcesJson)
}

tasks {
    processResources {
        // Patching takes the translated strings from the JSON files.
        exclude("addresources/values-*/*/strings.xml")
    }

    test {
        useJUnitPlatform()
        dependsOn(":extensions:youtube:generateReleaseProto", ":extensions:youtube:compileReleaseJavaWithJavac")
        jamApk.orNull?.let { systemProperty("jamApk", it) }
        // The Android-boundary tests load release bytecode in isolated class loaders.
        // Declare those actual classes as inputs so runtime changes invalidate cached results.
        inputs.dir(rootProject.file(
            "extensions/youtube/build/intermediates/javac/release/compileReleaseJavaWithJavac/classes"
        )).withPropertyName("queueRuntimeClasses").withNormalizer(ClasspathNormalizer::class)
        inputs.file(rootProject.file(
            "extensions/youtube/src/main/java/app/morphe/extension/youtube/patches/OpenVideosFullscreenHookPatch.java"
        )).withPropertyName("queueFullscreenBoundarySource")
        inputs.files(
            rootProject.file("extensions/youtube/src/main/java/app/morphe/extension/youtube/patches/queue/QueueSaveActions.java"),
            rootProject.file("extensions/youtube/src/main/java/app/morphe/extension/youtube/patches/queue/QueueSaveFeedback.java"),
            rootProject.file("extensions/youtube/src/main/proto/app/morphe/extension/youtube/innertube/playlist_queue.proto"),
            rootProject.file("extensions/youtube/src/main/proto/app/morphe/extension/youtube/innertube/icon.proto")
        ).withPropertyName("queueSaveBoundarySources")
    }

    register<JavaExec>("checkStringResources") {
        description = "Checks resource strings for invalid formatting"

        // Only the compiled patches and the raw string resources are needed. Using the full
        // main runtime classpath would run processResources, which builds and minifies all extensions.
        classpath = files(
            sourceSets["main"].output.classesDirs,
            configurations.runtimeClasspath,
            layout.projectDirectory.dir("src/main/resources"),
        )
        mainClass.set("app.bdcrusher.collection.util.resource.CheckStringResourcesKt")
    }

    register<JavaExec>("generatePatchesList") {
        description = "Build patch with patch list"

        dependsOn(build)

        classpath = sourceSets["main"].runtimeClasspath + patchListGeneratorClasspath
        mainClass.set("app.morphe.util.PatchListGeneratorKt")
    }

    register<JavaExec>("validateJam") {
        description = "Patches a supplied YouTube Music APK for Jam validation and optional device testing"
        group = "verification"

        dependsOn("testClasses")
        classpath = sourceSets["test"].runtimeClasspath
        mainClass.set("app.bdcrusher.collection.music.interaction.jam.JamDeviceBuildKt")

        doFirst {
            val apk = jamApk.orNull
                ?: throw GradleException("validateJam requires -PjamApk=/absolute/path/to/ytm.apk")
            setArgs(listOfNotNull(apk, jamOutput.orNull))
        }
    }

    register<JavaExec>("validatePlaylistQueue") {
        description = "Applies Native playlist queue to a stock APK and verifies it with Android SDK tools"
        group = "verification"
        dependsOn("testClasses")
        classpath = sourceSets["test"].runtimeClasspath
        mainClass.set("app.bdcrusher.collection.youtube.interaction.nativeplaylistqueue.PlaylistQueueApkBuildKt")
        doFirst {
            val apk = providers.gradleProperty("playlistQueueApk").orNull
                ?: throw GradleException("validatePlaylistQueue requires -PplaylistQueueApk=/absolute/path/youtube.apk")
            val mode = providers.gradleProperty("playlistQueueMode").getOrElse("standalone")
            val output = providers.gradleProperty("playlistQueueOutput").orNull
            setArgs(listOfNotNull(apk, mode, output))
        }
    }
    // Used by gradle-semantic-release-plugin.
    publish {
        dependsOn("generatePatchesList")
    }
}


// Morphe loads both sources through the same class loader. Give the personal patch
// implementation its own package while retaining the upstream source layout for merges.
val patchSources = listOf(file("src/main/kotlin"), rootProject.file("shared-lyrics-patches/src/main/kotlin"))
val patchTestSources = listOf(file("src/test/kotlin"))
val localPackage = Regex("""\bapp\.morphe\.patches(?:\.[A-Za-z_][A-Za-z0-9_]*)+""")
val packageLine = Regex("""(?m)^package +([\w.]+)""")
fun registerIsolatedSources(name: String, roots: List<File>) = tasks.register(name) {
    inputs.files(patchSources + roots)
    val output = layout.buildDirectory.dir("generated/$name")
    outputs.dir(output)
    doLast {
        val dir = output.get().asFile
        // Sync removes obsolete generated files without touching the original Kotlin inputs.
        val units = roots.flatMap { root -> root.walkTopDown().filter { it.extension == "kt" }
            .map { it.relativeTo(root) to it.readText() }.toList() }
        val packages = (patchSources + patchTestSources).flatMap { root -> root.walkTopDown().filter { it.extension == "kt" }
            .mapNotNull { packageLine.find(it.readText())?.groupValues?.get(1) }.toList() }.toSet()
        val wanted = units.map { it.first.invariantSeparatorsPath }.toSet()
        for (old in dir.walkTopDown().filter { it.isFile && it.relativeTo(dir).invariantSeparatorsPath !in wanted }) old.delete()
        for ((relative, source) in units) {
            val target = dir.resolve(relative)
            target.parentFile.mkdirs()
            target.writeText(localPackage.replace(source) { hit ->
                // Only relocate local packages. Imports from Morphe's Patch Library
                // (including its extension and resource helpers) remain linked to that library.
                val value = hit.value
                val packageName = generateSequence(value) { it.substringBeforeLast('.', "").ifEmpty { null } }
                    .firstOrNull { it in packages }
                if (packageName != null)
                    value.replaceFirst("app.morphe.patches", "app.bdcrusher.collection")
                else value
            })
        }
    }
}
val isolatedMain = registerIsolatedSources("isolatedPatchSources", patchSources)
val isolatedTest = registerIsolatedSources("isolatedPatchTestSources", patchTestSources)
kotlin.sourceSets.named("main") {
    kotlin.setSrcDirs(listOf(layout.buildDirectory.dir("generated/isolatedPatchSources")))
}
kotlin.sourceSets.named("test") {
    kotlin.setSrcDirs(listOf(layout.buildDirectory.dir("generated/isolatedPatchTestSources")))
}
tasks.named("compileKotlin") { dependsOn(isolatedMain) }
tasks.named("compileTestKotlin") { dependsOn(isolatedTest) }

val musicClasses = rootProject.file("extensions/music/build/intermediates/javac/release/compileReleaseJavaWithJavac/classes")
val singlesExtension = tasks.register("prepareSinglesExtension") {
    dependsOn(":extensions:music:compileReleaseJavaWithJavac")
    inputs.dir(musicClasses)
    val payload = layout.buildDirectory.file("singles/bdcrusher-music-singles.mpe")
    outputs.file(payload)
    doLast {
        val folder = payload.get().asFile.parentFile.also { it.mkdirs() }
        val program = folder.resolve("personal.jar")
        val android = File(System.getenv("ANDROID_HOME")).resolve("platforms/android-36/android.jar")
        val contracts = listOf("shared/library", "shared-youtube/library", "shared-youtube/stub", "youtube/stub", "music")
            .map { rootProject.file("extensions/$it/build/intermediates/javac/release/compileReleaseJavaWithJavac/classes") }
            .filter { it.isDirectory }
        ZipOutputStream(program.outputStream()).use { zip ->
            musicClasses.resolve("app/bdcrusher").walkTopDown().filter { it.extension == "class" }.forEach { file ->
                zip.putNextEntry(ZipEntry(file.relativeTo(musicClasses).invariantSeparatorsPath))
                file.inputStream().use { it.copyTo(zip) }
                zip.closeEntry()
            }
        }
        val compileOnlyJar = folder.resolve("contracts.jar")
        ZipOutputStream(compileOnlyJar.outputStream()).use { zip ->
            val names = mutableSetOf<String>()
            for (root in contracts) for (file in root.walkTopDown().filter { it.extension == "class" }) {
                val path = file.relativeTo(root).invariantSeparatorsPath
                if (path.startsWith("app/bdcrusher/") || !names.add(path)) continue
                zip.putNextEntry(ZipEntry(path))
                file.inputStream().use { it.copyTo(zip) }
                zip.closeEntry()
            }
        }
        val output = folder.resolve("dex.zip")
        // Shrink around the published hook entry points. The legacy downloader,
        // Full Collection lifecycle, and unused renderer classes have no roots here.
        val rules = """
            -dontobfuscate
            -dontoptimize
            -dontwarn **
            -keepattributes RuntimeVisibleAnnotations
            -keepclassmembers class * {
                @android.webkit.JavascriptInterface <methods>;
            }
            -keep class app.bdcrusher.ytmusic.shaders.ShaderLifecycle {
                public static void attach(android.app.Activity);
            }
            -keep class app.bdcrusher.ytmusic.shaders.ShaderRuntime {
                public static void onMetadata(...);
                public static void onPlayback(...);
                public static void onArtwork(...);
                public static void onPlayerBackground(...);
                public static void onNativePanel(...);
                public static void onOfficialLyricsBackground(...);
                private static int thumbnailId();
                private static java.lang.String nativePanelId(...);
                private static android.view.View nativePanelView(...);
            }
            -keep class app.bdcrusher.ytmusic.shaders.ShaderSettingsPage {
                public static void installSingle(...);
            }
            -keep class app.bdcrusher.ytmusic.common.PlayerVolumeBoost {
                public static int audioSession(...);
                public static void releaseAudioTrack(...);
                public static java.lang.Object nativeModel(...);
                public static byte[] rewriteModel(...);
                public static boolean handleCommand(...);
            }
            -keep class app.bdcrusher.ytmusic.lyrics.NativeBetterLyricsProvider { *; }
            -keep class app.bdcrusher.ytmusic.playlists.PersonalDownloadRouting {
                public static byte[] replaceDownloadCommand(...);
                public static java.lang.CharSequence onLithoTextLoaded(...);
                public static boolean isFlyoutMenuOverridden();
            }
        """.trimIndent()
        com.android.tools.r8.R8.run(com.android.tools.r8.R8Command.builder()
            .addProgramFiles(program.toPath()).addClasspathFiles(compileOnlyJar.toPath())
            .addLibraryFiles(android.toPath()).setMinApiLevel(28)
            .addProguardConfiguration(rules.lines(), com.android.tools.r8.origin.Origin.unknown())
            .setMode(com.android.tools.r8.CompilationMode.RELEASE)
            .setOutput(output.toPath(), com.android.tools.r8.OutputMode.DexIndexed).build())
        ZipFile(output).use { zip ->
            check(zip.entries().asSequence().count { it.name.endsWith(".dex") } == 1)
            zip.getInputStream(zip.getEntry("classes.dex")).use { input ->
                payload.get().asFile.outputStream().use { outputStream -> input.copyTo(outputStream) }
            }
        }
    }
}
tasks.processResources {
    dependsOn(singlesExtension)
    from(layout.buildDirectory.file("singles/bdcrusher-music-singles.mpe")) { into("extensions") }
}

tasks.register<JavaExec>("verifyMusic94551") {
    dependsOn("classes", "compileTestKotlin")
    classpath = sourceSets["test"].runtimeClasspath
    workingDir = rootProject.projectDir
    mainClass.set("app.bdcrusher.ytmusic.VerifyMusic94551Kt")
    maxHeapSize = "6g"
    doFirst {
        setArgs(listOf("musicApk", "musicBundle", "musicVerification", "musicMode").map {
            providers.gradleProperty(it).get()
        })
    }
}

tasks.named<Jar>("jar") {
    from(rootProject.file("NOTICE"))
    from(rootProject.file("LICENSE")) { rename { "COPYING-GPL.txt" } }
}

tasks.register<JavaExec>("auditNativeMusic94551") {
    dependsOn("compileTestKotlin")
    classpath = sourceSets["test"].runtimeClasspath
    mainClass.set("app.bdcrusher.ytmusic.AuditNativeMusic94551Kt")
    maxHeapSize = "5g"
    doFirst { setArgs(listOf(providers.gradleProperty("nativeAuditApk").get())) }
}

tasks.register<JavaExec>("verifyMusicSingles") {
    dependsOn("classes", "compileTestKotlin")
    classpath = (sourceSets["test"].runtimeClasspath - sourceSets["main"].output).filter {
        // The CLI/Manager loads the patch library from the sources. A parent Gradle
        // class loader would prevent official extension suppliers from seeing their MPP.
        !it.name.startsWith("patch-library") && !it.name.startsWith("morphe-patches-library")
    }
    workingDir = rootProject.projectDir
    mainClass.set("app.bdcrusher.ytmusic.VerifyMusicSinglesKt")
    maxHeapSize = "6g"
    doFirst {
        providers.gradleProperty("singlesClasspathReceipt").orNull?.let { path ->
            val output = rootProject.file(path).canonicalFile
            check(output.toPath().startsWith(rootProject.projectDir.parentFile.canonicalFile.toPath()))
            require(output.createNewFile())
            output.writeText(classpath.asPath)
        }
        setArgs(listOf("musicApk", "musicBundle", "officialBundle", "musicVerification", "singles", "sourceOrder")
            .map { providers.gradleProperty(it).get() })
    }
}


val personalVersionResource = tasks.register("personalVersionResource") {
    val file = layout.buildDirectory.file("generated/personalVersion/version.txt")
    inputs.property("version", project.version.toString())
    outputs.file(file)
    doLast {
        file.get().asFile.apply { parentFile.mkdirs(); writeText(project.version.toString()) }
    }
}
tasks.processResources {
    from(personalVersionResource) { into("bdcrusher-common") }
    eachFile {
        if (path in setOf("extensions/shared.mpe", "extensions/music.mpe", "extensions/shared-youtube.mpe")) {
            name = "bdcrusher-full-" + name
        }
    }
}
