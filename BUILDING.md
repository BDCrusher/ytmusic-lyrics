# Build 0.2.4-beta.1

Run build-local.ps1 with installed JDK25/JDK17 and Android SDK36. Its default task is now `:lyrics-collection:buildAndroid`. The combined output is `Personal-Patches/lyrics-collection/build/libs/lyrics-collection-0.2.4-beta.1.mpp`. Separate `:patches:buildAndroid` and `:lyrics-addon:buildAndroid` targets remain available for development.

The collection compiles the add-on entry once and incorporates Full patch code and shared hooks once. It includes both runtime alternatives as resources; selecting the add-on does not select Full or inject Full payloads. The add-on's own runtime remains personal-only. Existing source/dependency checkouts and notices are retained. No shared global tools are copied into this repository.

Run `:patches:test` for JVM tests. `Verification/verify_categories.ps1` applies four positive original-APK combinations and exports category metadata; `-NegativesOnly` checks five invalid combinations. Local original APK and official 1.48.0 bundle fixtures are required and excluded from Git. `verify-stable.ps1` uses the pinned stable Patcher2.0.0 source. Keep every verification output directory unused. Native compiled audits accept a plain UTF-8 manifest of output APK paths via the existing `auditModelEntry` task; never join APK filenames into shell commands.

The app-owned dependency bootstrap uses pinned public archive hashes and no npm lifecycle scripts. Caches/output remain inside this checkout. No SDK/JDK installation is automatic. Source ZIP is the complete reviewed raw Git tree; a clean-room full Android build is not claimed. Compilation and desktop checks do not prove phone behavior.

Keep the inherited Patcher-Version1.15.1 compatibility declaration: it preserves partial-string fingerprints on stable Patcher2.0.0. The newer engine was used for all final APK checks. The combined bundle carries its GPL license as COPYING-GPL.txt to avoid colliding with a dependency license/ directory.
