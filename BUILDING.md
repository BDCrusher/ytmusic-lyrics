# Build 0.3.0-beta.2

Use the app-scoped build-local.ps1 with :lyrics-collection:buildAndroid :patches:test :extensions:music:lintRelease. It builds the pinned local dependencies, prepares integrity-pinned Kawarp/ALTCHA and bundles original notices. Configure local JDK25/JDK17/Android36 paths in the wrapper; private original APK is not distributed. All writable caches/outputs remain inside the app home.

Verification/verify_revision33.ps1 applies 23 exact catalog/application/conflict cases using stable Patcher 2.0.0. Each output directory must be fresh. After the matrix completes, auditPersonalFeatures checks every positive APK, and auditModelEntry checks personal-lyrics outputs. Do not run concurrent Gradle invocations against stable-engine outputs. check_revision33_*.py and unchanged check_revision32_*.py exercise actual implementation at simulated Android/network/media boundaries. Playlist tests require privately retained original native response fixtures; the user's unlisted playlist identity is not distributed. Browser helpers use the app-scoped Playwright wrapper/loopback fixture server. Phone checks remain separate.

Read IMPLEMENTATION.md and verification.json for exact versions, hashes, test boundaries and limitations. Never rerun completed staging/publication helpers or publish private development history. Shared Toolkit is run in place, not copied.
