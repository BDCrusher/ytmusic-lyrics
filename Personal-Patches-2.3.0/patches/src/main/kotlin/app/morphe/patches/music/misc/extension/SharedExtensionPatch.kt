package app.morphe.patches.music.misc.extension

import app.bdcrusher.ytmusic.nativeentry.fullEditionGuard
import app.bdcrusher.ytmusic.nativeentry.personalRuntimePatch
import app.morphe.patcher.patch.bytecodePatch
import app.morphe.patcher.patch.mutableClassDefBy
import app.morphe.patcher.util.returnEarly
import app.morphe.patches.music.misc.extension.hooks.youTubeMusicApplicationInitHook
import app.morphe.patches.music.misc.extension.hooks.youTubeMusicApplicationInitOnCreateHook

private const val UTILS = "Lapp/morphe/extension/shared/Utils;"

private val musicExtension = bytecodePatch {
    for (name in listOf("shared", "music", "shared-youtube")) {
        extendWith("extensions/bdcrusher-full-$name.mpe")
    }
    finalize {
        youTubeMusicApplicationInitHook(UTILS)
        youTubeMusicApplicationInitOnCreateHook(UTILS)
        val version = object {}.javaClass.classLoader.getResourceAsStream("bdcrusher-common/version.txt")
            ?.bufferedReader()?.use { it.readText().trim() }
            ?: error("Missing personal bundle version")
        mutableClassDefBy(UTILS).methods.single { it.name == "getPatchesReleaseVersion" && it.parameterTypes.isEmpty() }
            .returnEarly(version)
    }
}

val sharedExtensionPatch = bytecodePatch {
    dependsOn(fullEditionGuard, musicExtension, personalRuntimePatch)
}
