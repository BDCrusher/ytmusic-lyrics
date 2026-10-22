# Architecture

Shared personal source is extensions/music/src/main/java/app/bdcrusher/ytmusic/lyrics plus web/src and bundled web assets. Both editions use the same private preferences and exact generated provider catalog. The full MPE uses the normal R8 pipeline; add-on prepareRuntime D8-compiles only the personal class files against compile-only native contracts.

Full changes Morphe's native panel installer, fallback coordinator and Music settings entry directly. The add-on declares its own scoped MediaSession/engagement fingerprints and local resource dependency, then validates/bridges the existing official payload in finalize: personal panel construction, clock getters, fallback restriction, inline settings and filter-array extension. It adds no second branding dependency or upstream class definition. Filter integration wraps the stable array store rather than a generated helper method name, allowing both source load orders.

BetterLyricsPanelView keeps a local-origin WebView and a constrained native interface. Remote verification uses a separate WebView without that interface. Native I/O owns cancellation, caches and HTTP failures; broker metadata can initiate corrected direct lookups. JWT expiry is a renewal hint only; server authentication remains authoritative. Cancellation/generation guards reject old callbacks.

Braccato owns timing/layout/highlights. Dock UI uses the exact provider catalog/SVGs plus host-native drawable snapshots. A transparent page leaves the native panel palette intact; suppressed native sibling visibility is restored on fallback, track change or detach. Overlay acknowledgements never call applySettings. Native switches/list preferences bind private values explicitly; provider ordering has drag/drop, edge scrolling and accessibility move actions.

Source, SDK and browser checks are recorded in COMPATIBILITY; actual device behavior remains unverified for this revision.

## Revision 0.2.1

Dock is a transparent floating overlay; its body-portal source menu samples lyric paint independently of pill blur. Numeric settings use a native inline SeekBar. Seek invokes core resumeAutoscroll; actual scroll events drive manual pause. The wall-clock sample is extrapolated once by core. web/patch_braccato.py applies one hash-bounded suppression-counter correction to prepared core input only. Unison tries exact recording identity before metadata fallback.
