plugins { kotlin("jvm") version "2.4.21" }
repositories { mavenLocal(); mavenCentral(); google(); maven { url=uri("https://jitpack.io") } }
dependencies {
    implementation("app.morphe:morphe-patcher:2.0.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")
    implementation("com.github.MorpheApp.smali:smali:4220ae75f7")
}
tasks.register<JavaExec>("verifyBundle") {
    dependsOn("classes")
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("app.bdcrusher.lyrics.ValidateLyricsKt")
    workingDir = rootDir.resolve("../../Personal-Patches")
    maxHeapSize = "6g"
    doFirst {
        setArgs(listOf(
            rootDir.resolve("../../Inputs/youtube-music-9.42.52-original.apk").canonicalPath,
            providers.gradleProperty("bundlePath").getOrElse(rootDir.resolve("../../Personal-Patches/patches/build/libs/patches-0.2.0-beta.1.mpp").canonicalPath),
            rootDir.resolve(providers.gradleProperty("verificationDir").get()).canonicalPath,
            providers.gradleProperty("mode").getOrElse("defaults")
        ) + (providers.gradleProperty("officialPath").orNull?.let {listOf(it)} ?: emptyList()))
    }
}
