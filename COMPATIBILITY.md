# Compatibility — 0.2.1-beta.1

Original APK: 9c38d63907362715f6172545bcb36f11ddbd45f014938626068016f06dcc3c56

Full MPP: 33ec5728f083610e4ca7f1d2e61137be66dc5993734320a7538f5bba0ff50996

Add-on MPP: b044f6b78ad2f646529bebe59a51b75a15a433cf2b1d31f05dfe9c3d80bac754

Official stable 1.48.0 MPP: 82bc696c94c26dbf75242b59980251315145457575b663200b981ca351e1c0f7

Stable Patcher 2.0.0 source: 8c7ff9f29d4cf6395fcbe42a4ceddd034d71fecf. Manager 2.0.0's source declares that engine; Manager Android execution was not tested. Full collection retains dev.19 source baseline.

| Selection | Result |
| --- | --- |
| full-defaults | PASS |
| full-lyrics-only | PASS |
| addon-first | PASS |
| official-first | PASS |
| conflict | Expected rejection |
| missing-official | Expected rejection |

Positive checks apply to original 9.42.52/94252240 arm64 and include SDK dexdump/d8, cross-DEX references/hierarchy, one metadata hook, one playback hook, asset byte identity and zero duplicate output definitions. Add-on contains one personal MPE, 77 personal runtime classes and no bundled official patch classes. Full Music has 1668 classes; its four known compiler helpers are individually enumerated/accepted in verification.json. Other official versions/options are not personal acceptance results.

JVM tests: 6 executed, 5 APK-dependent cases skipped, zero failures/errors. Lint: 0 errors, 5 string-localization warnings. Browser: 16 variants and interaction checks passed. Actual Catalog/Network source with stubbed Android storage/UI retrieved the exact supplied video; this is JVM evidence. Earlier five expiry/origin/cancellation scenarios are retained only after checking their actual Network/TokenExpiry source remains byte-identical.

The prior 0.2.0-beta.1 release also passed stable-engine Full defaults and add-on integration in both source orders. Current reports have separate hashes. No phone/emulator, Android TLS/auth flow, native settings visual acceptance, performance or counterpart segment-map integration is claimed. See PERSONAL-README.md for remaining checks.
