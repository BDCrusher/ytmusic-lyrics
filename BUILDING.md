# Build 0.4.0-beta.1

Use the app-scoped build-local.ps1 with :lyrics-collection:buildAndroid :patches:test :extensions:music:lintRelease. It builds pinned local dependencies, prepares integrity-pinned Kawarp/ALTCHA and bundles notices. Configure local JDK25/JDK17/Android36 paths in the wrapper; private original APK is not distributed. Writable caches/outputs stay inside the app home.

Verification/verify_revision34_accepted.ps1 applies nine exact catalog/application/invalid-selection cases using stable Patcher 2.0.0. Each output directory must be fresh. After the matrix completes, audit_revision34.ps1 checks seven positive APKs and four personal-lyrics native entry paths. Do not run concurrent Gradle invocations against stable-engine outputs. The three check_revision34_*.py helpers and unchanged check_revision32_*.py exercise actual implementation at simulated Android/network/media boundaries. Playlist tests require private original native response fixtures; the user's unlisted playlist is not distributed. Browser helpers use the app-scoped Playwright wrapper/loopback fixture server. Phone checks remain separate.

Read IMPLEMENTATION.md and verification.json for exact versions, hashes, test boundaries and limitations. Never rerun completed staging/publication helpers or publish private development history. Shared Toolkit runs in place; no global tools are copied.
