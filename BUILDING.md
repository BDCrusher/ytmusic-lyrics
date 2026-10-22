# Corresponding source

This repository is an audited publication snapshot. Personal-Patches contains the complete patch/extension/web source for both editions. BuildSources contains pinned public build dependencies and their retained app-local build adaptations. Prepared web/node_modules inputs are intentionally versioned, including their licenses and the hash-bounded Braccato correction. They are not an arbitrary npm cache.

The published MPPs are the exact locally verified 0.2.1-beta.1 bytes. Runtime, renderer and patch source in this snapshot match that build. Publication changes only documentation, feed files, and portable build-tool discovery; they do not recompile the release assets. No vendor/prepatched APKs, private credentials or local verification scratch are supplied.

Windows prerequisites: Python 3, JDK 25 and 17, Android SDK platform 36/build-tools 36.0.0, and Gradle 8.9 for the retained Smali source build. The supplied wrappers document the exact tested JDK installation names; adjust local tool paths if your installations differ. build-smali.ps1 can use GRADLE_8_9_HOME or a Gradle 8.9 wrapper installation below your user profile.

Run build-local.ps1 from the repository root. It prepares the integrity-checked esbuild 0.25.12 tool, verifies the local Braccato correction, bundles web source, and builds :patches:buildAndroid and :lyrics-addon:buildAndroid. All build/cache/temp writes are scoped to this checkout. On other platforms, adapt the wrappers while preserving the pinned versions and scoped output paths. Missing native build prerequisites are not auto-installed.

Tests: :patches:test, :extensions:music:lintRelease. APK integration requires a legally obtained original input placed privately in ignored Inputs/youtube-music-9.42.52-original.apk. verify-stable.ps1 takes explicit -PbundlePath, an unused -PverificationDir, and -Pmode=defaults|lyrics|addon-first|official-first|conflict|missing-official; add-on modes need -PofficialPath pointing to the unmodified official 1.48.0 MPP. Never distribute the original or resulting APK.

See Personal-Patches/BUILDING.md for original build details and SOURCE-PINS.json for exact dependency commits. Historical private staging scripts/reports are excluded; public verification.json summarizes exact release hashes and completed checks. No CI build or phone result is inferred from this source export.
