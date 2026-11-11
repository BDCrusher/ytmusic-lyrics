# Build the 9.45.51 source

The source project is in `Personal-Patches-9.45.51`. It uses the shipped Gradle wrapper, JDK 25 to run Gradle, JDK 17 for the patch toolchain, and an Android SDK configured with `ANDROID_HOME`.

Use the exact sibling source directory names and revisions in [build-support/source-pins.json](build-support/source-pins.json), under a locally created `BuildSources` directory at this checkout's root. The sources are the corresponding [Morphe repositories](https://github.com/orgs/MorpheApp/repositories) for the patcher, patches library, Gradle plugin, ARSCLib and smali. Apply each matching `build-support/*.patch` in its dependency checkout with `git apply`. The patches set the matching composite-build names and allow the local composite dependencies to resolve without GitHub Packages credentials.

From `Personal-Patches-9.45.51`, run `./gradlew :patches:buildAndroid` (or `gradlew.bat :patches:buildAndroid` on Windows). The released bundle includes the compiled Android extension and bundled web assets. The compiled renderer is checked in. Rebuilding that asset separately uses the pinned dependencies documented in `web/prepare_vendor.py`, the tool lock under `web/tools/esbuild`, and `web/patch_braccato.py`.

The release's compatibility report identifies the exact APK and tested selections. APKs and local test data are not part of this source snapshot. Build verification of the released artifact was performed in the development workspace with those pins.
