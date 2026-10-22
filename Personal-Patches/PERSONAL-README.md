# BDCrusher YT-Music Lyrics — 0.2.1-beta.1

Two personal editions share the same renderer and private settings. Full retains the applied official dev.19 collection baseline. The add-on is verified with official stable patches **1.48.0**. Both were checked with **stable Patcher 2.0.0**, the engine declared by Manager 2.0.0. These are desktop APK/DEX checks, not a Manager/phone acceptance test.

## Choose one edition

| Edition | Manager selections |
| --- | --- |
| Full | Use by itself. Select its Third-party lyrics and the other patches you want. Disable the overlapping official collection and add-on. |
| Lyrics-only add-on | Use alongside official Morphe Patches 1.48.0 defaults. Disable official Third-party lyrics; enable Third-party lyrics — Better Lyrics add-on. Disable personal Full. Both source orders passed. |

Target: original YouTube Music **9.42.52 / 94252240, arm64-v8a, minSDK 26**. Enable experimental app versions separately for each active source. Stable Manager does not change this experimental target declaration. The personal build remains beta. Arbitrary minimal official selections and future bundles are unverified.

## Lyrics and settings

Open **YouTube Music → Settings → Morphe → Lyrics**. Text size, background-vocal size and opacity now use inline native sliders with visible values. Boolean choices use native switches, singer placement uses native choices, source priority uses the retained drag-and-drop list with switches, accessible move actions and reset button. Preferences and source connection data are preserved. In-song Settings opens this same page.

The floating dock has three layers, bottom to top: **Copy / Translate / Romanize / Refresh**, **delay − / thin source selector / delay +**, then the centered **collapse chevron**. The native song-themed background and lyrics continue behind the translucent controls. The body-mounted source flyout follows the extension's glass, sync icons, labels, selected tint, anchor placement and 160 ms easing. It closes on outside click/Escape and supports keyboard navigation. Reduced motion disables transitions. WebView blur samples its rendered lyrics; native artwork is preserved underneath the transparent page, not copied into a web bitmap.

Lyric seeking uses Braccato's existing word/line targets and resumes follow, without Android's rectangular touch flash. Scroll events and wall-clock samples now follow the extension host contract. Offset/dock preference changes preserve the current lyric DOM. A documented two-line correction to pinned Braccato 1.16.11 lets expired scroll suppression reach zero; upstream easing/highlighting/layout are retained. See web/patch_braccato.py and web/braccato-local-patch.json. Original reference packages remain unchanged.

## Music-video regression

The supplied video **MYal8NoVQXs**, “Love Me Dead (Female Cover)” by CottontailVA Music, returns Unison recording 9761. Native Catalog code now tries recording ID first, then metadata after a not-found response, and records the returned identity. Actual Java transport retrieves **23,376 TTML characters** for that exact ID. The browser decodes **50 lines and 2,730 letter elements**, including when track duration is initially unknown. This confirms retrieval/decoding on desktop; it does not establish the original phone failure's cause or Android playback timing.

During the live native check, Better Lyrics returned **401 (service authorization required)** and LRCLib returned **503**, while Unison still loaded. One source's failure does not discard a valid result. Use Morphe → Lyrics → Source connection for normal verification, and Source diagnostics for bounded request/outcome information if the phone still differs. No credentials or full song lyrics are included in delivery reports/source.

## Verification and limits

Exact current hashes passed Full defaults, Full lyrics alone, add-on plus stable official patches in both source orders, and rejection tests for conflicting lyrics/missing official runtime. Browser checks cover 16 provider variants, BG vocals/agents/letter wave, stale replies, source priority, dock controls, glass/flyout geometry, centered SVGs, manual-scroll/seek/resume and reduced motion. Native settings compile; lint has zero errors. Details and hashes are in COMPATIBILITY.md and verification.json.

**Phone acceptance remains pending:** native settings appearance and accessibility, actual themed panel lifecycle, WebView compositing, audio synchronization, live Android verification/renewal, GPU/battery and performance. Music-video audio/video counterpart segment-map discovery remains unimplemented; this release addresses exact video-ID lyrics, not automatic timeline conversion for different edits of a song. No signing, install or publication was performed.

Shaders, Tacet and floating windows remain excluded. [Build](BUILDING.md) · [Compatibility](COMPATIBILITY.md) · [Status](STATUS.md) · [Notices](NOTICE)
