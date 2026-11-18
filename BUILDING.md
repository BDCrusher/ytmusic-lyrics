# Build the YouTube Music patches

The source project is in `Personal-Patches-2.3.0`. Use the shipped Gradle wrapper, JDK 25 for Gradle, JDK 17 for the patch toolchain, and an Android SDK configured with `ANDROID_HOME`.

Use the exact sibling dependency directory names and revisions in [source-pins.json](build-support/source-pins.json) under a `BuildSources` directory at this checkout's root. The sources are the corresponding [Morphe repositories](https://github.com/orgs/MorpheApp/repositories) for the patcher, patches library, Gradle plugin, ARSCLib and smali. Apply each matching `build-support/*.patch` in its dependency checkout using `git apply`.

From `Personal-Patches-2.3.0`, run `./gradlew :patches:buildAndroid` or `gradlew.bat :patches:buildAndroid` on Windows. The checked-in renderer uses Braccato core 1.21.5 and Kawarp 1.4.0. Rebuild the web assets using the dependency preparation script in `web/prepare_vendor.py` and the tool lock in `web/tools/esbuild`.

The release page supplies the SHA-256 checksums, patch catalogue, notices and exact target verification. APKs and local phone data are excluded from this source snapshot.
