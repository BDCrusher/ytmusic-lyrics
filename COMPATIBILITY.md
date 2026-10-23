# Compatibility — 0.2.3-beta.3

Original: com.google.android.apps.youtube.music **9.42.52 /94252240 arm64-v8a**, minSDK26, targetSDK36. Experimental; other versions unverified.

APK SHA-256:9c38d63907362715f6172545bcb36f11ddbd45f014938626068016f06dcc3c56

Full SHA-256:572bbf119355e34e7704822cd7040644303124295356f40559c2db01c17ba164

Add-on SHA-256:e702fad4351c01cbcb6e7a0371e29100ab8d6d66aaa370dea7fedf30e012189a

Official stable1.48.0 SHA-256:82bc696c94c26dbf75242b59980251315145457575b663200b981ca351e1c0f7

Verification engine: stable Patcher2.0.0, commit8c7ff9f29d4cf6395fcbe42a4ceddd034d71fecf. Full source baseline remains applied dev.19, preserving dev.18 history. Native structural fingerprints and six protobuf message-info hashes guard the exact APK contracts; native model shape/state and Music palette binding are runtime-checked.

| Selection | Result |
| --- | --- |
| full-lyrics | PASS |
| full-defaults | PASS |
| addon-first | PASS |
| official-first | PASS |
| conflict | Expected rejection |
| missing-official | Expected rejection |

Four positive unsigned outputs passed SDK dexdump/d8, cross-DEX references/hierarchy, one metadata/playback hook, asset identity and zero duplicate classes. Compiled audits verify native model/presenter/controller contracts, public bridge visibility, covered callback/constructor returns, disabled old view/global installers and no personal button/window construction. Add-on: 100 personal classes only, one MPE, no bundled Morphe stubs/helpers. Full: 1691 selected Music classes, four explicitly retained compiler helpers.

Java model/host/entry checks:45 using real 9.42.52 native fixtures and explicitly simulated Android/native proxies. JVM tests:6 executed,5 skipped; lint:0 errors,6 warnings. Prior source-identical transport/repository/native Java evidence is labeled reused in verification.json. Fresh browser passes cover all16 providers, voices/highlighting, source controls, seeking/follow and bottom-toggle positioning, keyboard and reduced motion at three viewport sizes.

**No phone acceptance claim.** The user's screenshots rejected0.2.2-beta.3. This new build still needs real native button/layout/theme/header/back/drag, video separation, large-font/rotation/authentication/timing checks. Native app experiments and selected palette may affect geometry/color. Counterpart video/audio time conversion is not implemented. Released as two separate source feeds. Enable Pre-release patches and Experimental app versions for this beta.
