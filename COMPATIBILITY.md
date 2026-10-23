# Compatibility - 0.2.4-beta.1

One source and one MPP, with expandable **Full Collection** and **Lyrics-only Add-on** categories. Morphe Manager 2.0.0 or newer is required. The add-on is unchecked by default. For add-on use, deselect every Full Collection patch, select the add-on and official Morphe 1.48.0 default Music patches, with official Third-party lyrics disabled. For Full use, deselect the add-on and official source. The old separate Full source should be disabled when using the combined source.

Exact personal target: original YouTube Music **9.42.52 / 94252240, arm64-v8a, minSDK26**, experimental. APK SHA-256: 9c38d63907362715f6172545bcb36f11ddbd45f014938626068016f06dcc3c56.

Combined MPP SHA-256: 53a2bc5e4ee51b8fd37c71aba3675bca897e78fdf0e47e1c5ed42f4c1f8c52c1.

Passed: Full lyrics alone, Full Music defaults, add-on plus official patches in both source orders. Actual APK applications used stable Patcher 2.0.0 and SDK DEX/reference/hierarchy checks; output asset identity and duplicate-class audits passed. Native compiled hook/CFG audits passed on all four outputs. Both personal editions, reverse selection order, add-on plus a non-lyrics Full setting, official lyrics conflict and missing official infrastructure all rejected as expected. Loaded bundle metadata verifies the two categories, exact target and unchecked add-on. All injected runtime payloads and renderer assets are byte-identical to 0.2.3-beta.3. Existing browser/lint evidence is reused only for those unchanged bytes. See verification.json for exact identities and test counts.

The bundle retains its inherited Patcher-Version1.15.1 compatibility semantics so existing partial-string fingerprints behave correctly when run by stable Patcher2.0.0. Manager2.0.0 or newer is needed for the category UI. The combined add-on selection was tested with official1.48.0, including the engine's newer matching behavior for that combination.

**Phone verification is pending.** No Manager category screenshot, installation or phone runtime result is claimed. This packaging update makes no new native Lyrics button, panel/theme, source retrieval or synchronization fix; their previous device limitations remain. No signing, installation or MuMu access occurred.
