# Publication

One repository, two independent Morphe sources: root patches-bundle.json selects Lyrics-only; full/patches-bundle.json selects Full. Each source becomes its own Expert-mode tab. Full uses a direct JSON source address, which supports main/dev branch switching; rename source cards as described in README. Root add-source deep links cannot select a subfolder feed.

Beta feeds update dev only; main retains its bootstrap feed until a stable release. Source commits may advance on main without advancing its beta metadata. Never overwrite a published release or existing asset. MPP hashes must match compatibility evidence. Source ZIP must equal the complete public Git tree as raw blobs.

Shared Toolkit handles source export/push/archive and individual artifact preparation in place. This release's app-specific orchestration handles the two-MPP inventory and two feed paths, since the shared publisher supports a single primary MPP/feed. Both assets must be verified on the draft before publication; verify public downloads before advancing dev feeds. No shared tools are copied into this source.

Development remains in the user's existing YT-Music workspace. This is its reviewed public checkout, preserving public history, not a separate development fork. Inputs/APKs, credentials, caches, inspection scratch and generated node_modules must remain untracked. Web dependencies are restored from exact public archive/integrity pins without npm lifecycle scripts.
