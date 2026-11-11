package app.morphe.patches.music.misc.extension

import app.morphe.patches.music.misc.extension.hooks.youTubeMusicApplicationInitHook
import app.morphe.patches.music.misc.extension.hooks.youTubeMusicApplicationInitOnCreateHook
import app.morphe.patches.all.misc.extension.sharedExtensionPatch

private val musicExtension = sharedExtensionPatch(
    listOf("music", "shared-youtube"),
    youTubeMusicApplicationInitHook,
    youTubeMusicApplicationInitOnCreateHook
)

val sharedExtensionPatch = app.morphe.patcher.patch.bytecodePatch {
    dependsOn(musicExtension, app.bdcrusher.ytmusic.nativeentry.personalRuntimePatch)
}
