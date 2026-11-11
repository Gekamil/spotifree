# TEST_INFRA: Spotifree E2E Testing Infrastructure & Specification (v0.2.2)

## 1. Test Philosophy & Principles

### 1.1 Opaque-Box & Requirement-Driven Architecture
The Spotifree E2E testing infrastructure is designed around strictly **opaque-box, requirement-driven** principles. Rather than testing internal private variables or implementation details, each test exercises public application contracts, observable states, network responses, and persistent storage tiers:
- **Observable Inputs**: Search queries, filter selections, user interactions (e.g. playlist creation from add modal, playlist navigation, library follow/save actions).
- **Observable Outputs**: Ranked track and album arrays, UI badge annotations (`isOfficial`, `scVariantLabel`), HTTP response payloads from serverless/proxy endpoints (`/api/search`, `/api/playlist/alb-*`), and client-side store states.
- **Storage Tier Invariants**: Persistence across `user_imported_playlists`, `spotifree_saved_library_playlists`, `spotifree_playlist_cache_*`, `spotifree_playlist_tracks_*`, and active session caches.

### 1.2 4-Tier Testing Methodology
Testing is divided into four distinct verification tiers:
1. **Tier 1 — Feature Coverage (Category-Partition & Primary Contracts)**:
   - Covers the primary happy-path contracts for requirements R1 through R5.
   - At least 5 dedicated test cases per feature (25 tests minimum).
2. **Tier 2 — Boundary, Resource & Adversarial Stress (BVA & Error Handling)**:
   - Exercises boundary conditions: empty search results, special/unicode characters, missing album/cover art, rapid concurrent actions, corrupt cache recovery, and extreme tracklist sizes.
   - At least 5 dedicated test cases per feature (25 tests minimum).
3. **Tier 3 — Cross-Feature Pairwise Combinations (Interaction Verification)**:
   - Tests interactions between two or more requirements (e.g. R1 Remixes + R2 Playlist Creation, R4 Albums + R3 Auto-Save Prevention, R4 Albums + R2 Modal Add).
   - Verifies state isolation, filter switching, and regression resistance across features.
4. **Tier 4 — Real-World Application Workloads & User Scenarios**:
   - High-fidelity simulated user journeys (DJ workflow, Curator workflow, Casual Explorer browsing, Mobile vs Desktop parity, Cold Boot Release verification).

---

## 2. Feature Inventory (Requirements R1 to R5)

| Req ID | Feature Name | Core Contract & Behavior | Authoritative Spec Source |
|---|---|---|---|
| **R1** | Official Remixes Prioritization | In the "Remixes" search tab, official catalog remixes for searched artists MUST sort before SoundCloud/bootleg tracks. Official tracks carry `isOfficial: true`, green official badges (`scVariantLabel: 'Oficial'`), and valid playable metadata. Both Desktop and Mobile search views must maintain parity. | `ORIGINAL_REQUEST § R1`, `PROJECT.md § F1, F2` |
| **R2** | Playlist Creation from Add Modal | `createPlaylist` accepts `initialTracks?: Track[]`. When called from `AddToPlaylistModal`/`AddToPlaylistSheet`, the new playlist is created with `tracks.total === 1`, the track in `items[0]`, persisted in `user_imported_playlists`, `spotifree_saved_library_playlists`, `spotifree_playlist_cache_*`, and the modal displays confirmation and auto-closes. | `ORIGINAL_REQUEST § R2`, `PROJECT.md § F8, F9` |
| **R3** | Prevent Auto-Save on Playlist Viewing | Opening, viewing, or loading tracks of recommended, searched, or external playlists (e.g. `dz-*`, `alb-*`) MUST NOT save them to `user_imported_playlists` or `spotifree_saved_library_playlists`, nor push to `s.playlists`. Caching is strictly isolated to `playlistDetailsCache` and `spotifree_playlist_cache_*`. Explicit save button remains the only mechanism to add to user library. | `ORIGINAL_REQUEST § R3`, `PROJECT.md § F6, F7` |
| **R4** | Albums Filter Tab & `alb-*` Resolver | Search views (Desktop and Mobile) provide a dedicated "Álbumes" filter tab. Results display cover art, album title, artist, and release year. Clicking navigates to `alb-*`. The backend/proxy resolver (`resolveSpotifyPlaylist('alb-${dzId}')`) resolves full tracklists with duration and streamable metadata from `api.deezer.com/album/${dzId}`. | `ORIGINAL_REQUEST § R4`, `PROJECT.md § F3, F4, F5` |
| **R5** | Version 0.2.2 & Baseline Preservation | `package.json` and `src/data/changelog.ts` updated to version `0.2.2` with descriptive changelog highlights. All 7 offline/downloads files (`api/_lib/musicFallback.js`, `api/audio.js`, `scripts/audioService.mjs`, `server.mjs`, `native/android/SpotifreeLocalMusicPlugin.java`, `src/utils/offlineStorage.ts`, `tests/offline_downloads.test.js`) remain 100% intact and passing. | `ORIGINAL_REQUEST § R5`, `PROJECT.md § F10, F11` |

---

## 3. Test Architecture & Directory Layout

### 3.1 Framework & Harnesses
- **Test Framework**: Node.js native test runner (`node:test` + `node:assert/strict`).
- **Module Resolution**: Dynamic ECMAScript loader hooks (`registerHooks` from `node:module`) and `ts.transpileModule` for compiling TypeScript (`.ts`) and React TSX (`.tsx`) on-the-fly in Node without build artifacts.
- **In-Memory Storage Harness**: `MemoryStorage` polyfill for `globalThis.localStorage`, providing atomic isolation between test cases.
- **Browser Environment Shims**: Lightweight headless shims for `window`, `document`, `CustomEvent`, `EventTarget`, and `navigator.onLine`.
- **Network Stubbing / Mocking**: Deterministic mock interceptors for external API contracts (`api.deezer.com`, Spotify Web API, and SoundCloud).

### 3.2 Directory Layout
```
c:\Users\jorge\Documents\antigravity\delightful-borg\
├── package.json                          # Scripts & dependency definitions
├── TEST_INFRA.md                         # This architecture and test matrix specification
├── tests/
│   ├── e2e_spotifree_r1_r5.test.mjs      # Main 4-tier E2E test suite (60+ tests)
│   ├── offline_downloads.test.js         # PRESERVED: R5 Offline storage and airplane mode
│   ├── app_logic.test.js                 # App logic & ranking baseline
│   ├── challenger_m3_edge_cases.test.mjs # AST & component integrity baseline
│   └── ... (Other baseline suites)
```

### 3.3 Test Runner Commands
- **Run E2E Test Suite**:
  ```powershell
  node tests/e2e_spotifree_r1_r5.test.mjs
  ```
- **Run Full Project Test Suite (Windows PowerShell)**:
  ```powershell
  npm.cmd test
  ```

---

## 4. Comprehensive Test Matrix (61 Test Cases)

### Tier 1: Feature Coverage (Category-Partition & Primary Contracts)

| Test ID | Req | Test Title / Objective | Test Input & Scenario | Authoritative Expected Output / Invariant | Baseline Status |
|---|---|---|---|---|---|
| `T1-R1-01` | R1 | Official Catalog Remix Head Prioritization | Query: "quevedo remix" with mixed official and SoundCloud candidates | Official catalog tracks matching `/remix\|rmx/i` sort at index 0..N-1 before unofficial tracks | PENDING (M1) |
| `T1-R1-02` | R1 | Official Badge and Metadata Flagging | Official catalog remix candidates | `track.isOfficial === true` and `track.scVariantLabel === 'Oficial'` | PENDING (M1) |
| `T1-R1-03` | R1 | Remix Query Intent Extraction | Query strings: `"duki rmx"`, `"bizarrap remix"`, `"bad bunny slowed"` | Recognizes remix intent and prioritizes official releases | PENDING (M1) |
| `T1-R1-04` | R1 | Official Remix Playable Metadata Completeness | Extracted official remix item | Has `id`, `name`, `artists` array, `album.images` cover, and duration | PENDING (M1) |
| `T1-R1-05` | R1 | Desktop & Mobile Remix View Parity | Check AST / View contract for Remixes tab in Desktop and Mobile views | Both search views bind to `results.soundcloudTracks` with official badges | PASS (Structural) |
| `T1-R2-01` | R2 | `createPlaylist` Initial Tracks Parameter | Call `createPlaylist('My List', [trackA])` | Function accepts optional second parameter without error | PENDING (M4) |
| `T1-R2-02` | R2 | Playlist Initial Track Placement | Create playlist with single track | Returned playlist has `tracks.total === 1` and `tracks.items[0].id === trackA.id` | PENDING (M4) |
| `T1-R2-03` | R2 | Persistence in `user_imported_playlists` | Inspect `localStorage['user_imported_playlists']` after creation | List contains new playlist object with `tracks.items` populated | PENDING (M4) |
| `T1-R2-04` | R2 | Persistence in `spotifree_saved_library_playlists` | Inspect `localStorage['spotifree_saved_library_playlists']` after creation | Array includes new playlist ID | PENDING (M4) |
| `T1-R2-05` | R2 | Modal Creation Auto-Close & Notification | Analyze `AddToPlaylistModal.tsx` creation handler | Handler triggers store creation, closes modal (`closeAddToPlaylistModal`), shows toast | PENDING (M4) |
| `T1-R3-01` | R3 | Recommended Playlist View Does Not Write Imported | View recommended playlist `dz-3155776842` | `user_imported_playlists` remains unchanged, does NOT contain `dz-3155776842` | PENDING (M3) |
| `T1-R3-02` | R3 | Searched Playlist View Does Not Write Saved Library | View searched playlist `pl-external-123` | `spotifree_saved_library_playlists` does NOT contain `pl-external-123` | PENDING (M3) |
| `T1-R3-03` | R3 | Viewing Playlist Does Not Mutate Store Library | Call `updatePlaylist` for non-library playlist | `s.playlists.length` does not increase; playlist not added to user lists | PENDING (M3) |
| `T1-R3-04` | R3 | Details Caching Isolation | Call `updatePlaylist` for external playlist | Details are stored in `playlistDetailsCache` and `spotifree_playlist_cache_*` only | PENDING (M3) |
| `T1-R3-05` | R3 | Explicit Save Invariant | User clicks save (`addCustomPlaylist` or like) | Playlist is added to library and `spotifree_saved_library_playlists` | PASS |
| `T1-R4-01` | R4 | "Álbumes" Filter Tab Present in Desktop & Mobile | Check filter tabs in `MobileSearchView.tsx` & `DesktopSearchView.tsx` | Both components define `'albumes'` in filter state and render tab pill | PENDING (M2) |
| `T1-R4-02` | R4 | Album Search Results Data Model | Execute search query "un verano sin ti" | Returns `results.albums` containing objects with `id`, `name`, `images`, `artists`, `release_date` | PASS |
| `T1-R4-03` | R4 | Album Navigation Format `alb-*` | Click album card in search view | Triggers navigation callback with `id: alb-${dzId}` | PENDING (M2) |
| `T1-R4-04` | R4 | Deezer Album Resolver Contract | Call `resolveSpotifyPlaylist('alb-316164367')` | Returns `Playlist` with `type: 'album'`, correct name, owner, and tracks | PENDING (M2) |
| `T1-R4-05` | R4 | Resolved Album Track Playability | Inspect tracks of resolved album `alb-316164367` | Each track contains duration, artists, album reference, and valid ID | PENDING (M2) |
| `T1-R5-01` | R5 | `package.json` Version is 0.2.2 | Read `package.json` | `parsed.version === '0.2.2'` | PENDING (M5) |
| `T1-R5-02` | R5 | `src/data/changelog.ts` Version is 0.2.2 | Import `APP_VERSION` from `changelog.ts` | `APP_VERSION === '0.2.2'` | PENDING (M5) |
| `T1-R5-03` | R5 | Changelog 0.2.2 Release Notes Published | Inspect `CHANGELOG_RELEASES` | First release has `version: '0.2.2'`, `isLatest: true`, and mentions R1-R4 fixes | PENDING (M5) |
| `T1-R5-04` | R5 | Offline Files Existence & Non-Empty Content | Inspect all 7 R5 preserved files on disk | All 7 files exist and have `stat.size > 100` | PASS |
| `T1-R5-05` | R5 | Offline Downloads Test Suite Integrity | Run `tests/offline_downloads.test.js` | All 7 offline tests pass with 0 errors | PASS |

---

### Tier 2: Boundary & Corner Cases (BVA & Error Handling)

| Test ID | Req | Test Title / Objective | Test Input & Scenario | Authoritative Expected Output / Invariant | Baseline Status |
|---|---|---|---|---|---|
| `T2-R1-01` | R1 | Artist with 0 Official Remixes | Query artist with only unofficial SoundCloud tracks | Returns SoundCloud tracks gracefully without crash or empty screen | PASS |
| `T2-R1-02` | R1 | Special Characters & Whitespace in Remix Query | Query: `"   Bizarrap & Quevedo #52 (Remix)   "` | Trims query, escapes regex specials, returns correct ranked list | PASS |
| `T2-R1-03` | R1 | Strict Segregation of Bootlegs vs Official | Feed pool of 10 tracks (3 official, 7 bootlegs/leaks) | Exactly 3 official tracks occupy indices 0, 1, 2; rest follow | PENDING (M1) |
| `T2-R1-04` | R1 | Duplicate Track Deduplication in Remixes | Same song ID present in both catalog and SoundCloud feed | Deduplicates by ID or ISMN, avoiding double entries in remix list | PASS |
| `T2-R1-05` | R1 | Empty & Single-Character Query Handling | Queries: `""`, `"   "`, `"a"` | Empty returns `{ items: [] }`, single character does not throw | PASS |
| `T2-R2-01` | R2 | Default Playlist Name Fallback | Call `createPlaylist('')` or `createPlaylist(undefined, [track])` | Name defaults to `"Mi lista n.º X"` based on custom count | PENDING (M4) |
| `T2-R2-02` | R2 | Rapid Concurrent Playlist Creation Calls | Call `createPlaylist` 5 times in rapid succession | Generates 5 distinct IDs, persists all 5 without race-condition data loss | PENDING (M4) |
| `T2-R2-03` | R2 | Track Missing Optional Cover Art | Create playlist with track having `album.images = []` | Handles missing cover art without error, falls back to default cover | PENDING (M4) |
| `T2-R2-04` | R2 | Track with Special Characters in Title | Track title: `"Rock & Roll <script>alert(1)</script> / 'Quotes'"` | Safely JSON-encoded and preserved in storage without corruption | PENDING (M4) |
| `T2-R2-05` | R2 | Storage Re-Hydration Integrity | Persist playlist + track, simulate fresh page load | Re-hydrated store contains new playlist with tracks array intact | PENDING (M4) |
| `T2-R3-01` | R3 | Stress: Sequential Viewing of 10 External Playlists | Sequentially update 10 non-library playlist IDs | `user_imported_playlists` and `spotifree_saved_library_playlists` add 0 entries | PENDING (M3) |
| `T2-R3-02` | R3 | Viewing Already-Saved Library Playlist | View playlist that is already in user library | Updates cache and tracks without creating duplicate entry in library | PASS |
| `T2-R3-03` | R3 | Back/Forward Navigation Library Cleanliness | Navigate: Library -> External 1 -> External 2 -> Library | Library count remains identical to initial count | PENDING (M3) |
| `T2-R3-04` | R3 | Viewing Empty Playlist (0 Tracks) | Call `updatePlaylist` with `tracks: { total: 0, items: [] }` | Details cached cleanly, does not add to library | PENDING (M3) |
| `T2-R3-05` | R3 | Multi-User Cache Isolation | Cache playlist under user A, switch to user B | User B does not inherit user A's imported list or cache | PASS |
| `T2-R4-01` | R4 | Query with 0 Album Matches | Query nonsense string: `"xyznonexistentartist12345"` | Returns `albums.items: []`, UI displays empty state gracefully | PASS |
| `T2-R4-02` | R4 | Multi-Disc / 30+ Track Album Resolution | Resolve album with 35 tracks (e.g. deluxe/boxset) | All 35 tracks mapped with correct track indices, zero truncated | PENDING (M2) |
| `T2-R4-03` | R4 | Single / EP Release as Album Resolution | Resolve 2-track single release | Correctly mapped as album type with `tracks.total === 2` | PENDING (M2) |
| `T2-R4-04` | R4 | Malformed `alb-*` Identifier Handling | Pass `alb-invalid-string` or non-existent Deezer ID | Throws handled error or returns fallback; does NOT crash process | PENDING (M2) |
| `T2-R4-05` | R4 | Album Track Queue & Context Playback | Select track index 3 from resolved album | Player state sets queue to remaining album tracks with album context | PASS |
| `T2-R5-01` | R5 | Strict SemVer Regex Validation | Validate versions against `^[0-9]+\.[0-9]+\.[0-9]+$` | Both `package.json` and `changelog.ts` conform to strict SemVer | PASS |
| `T2-R5-02` | R5 | Offline Download Routes Byte Integrity | Check route handlers in `server.mjs` and `api/audio.js` | Endpoints `/api/audio`, `/api/download` contain intact Range and streaming logic | PASS |
| `T2-R5-03` | R5 | Offline Storage Utility Required Exports | Inspect `src/utils/offlineStorage.ts` | Exports all 6 functions: `downloadPlaylist`, `isPlaylistDownloaded`, etc. | PASS |
| `T2-R5-04` | R5 | Audio Service Script Integrity | Inspect `scripts/audioService.mjs` | File exists, exports valid audio engine helpers | PASS |
| `T2-R5-05` | R5 | Android Local Music Plugin Integrity | Inspect `native/android/SpotifreeLocalMusicPlugin.java` | File exists, contains Java package and plugin methods | PASS |

---

### Tier 3: Cross-Feature Pairwise Combinations

| Test ID | Req Pair | Test Description & Workflow | Authoritative Expected Invariant | Baseline Status |
|---|---|---|---|---|
| `T3-01` | R1 + R2 | Search official remix -> Add to playlist modal -> Create new playlist with remix | New playlist created with official remix as item[0], persisted in all tiers | PENDING (M1/M4) |
| `T3-02` | R4 + R3 | Search album -> Resolve tracklist -> View tracks -> Check library persistence | Album tracks are fully loaded, but album is NOT saved to user library | PENDING (M2/M3) |
| `T3-03` | R4 + R2 | View resolved album -> Select track -> Create new playlist via modal | Track from album successfully seeds new custom playlist with album cover art | PENDING (M2/M4) |
| `T3-04` | R1 + R4 | Search query returning remixes & albums -> Toggle between Remixes & Albums tabs | Filter states switch cleanly; Remix tab shows official remixes, Album tab shows albums | PENDING (M1/M2) |
| `T3-05` | R2 + R3 | Create playlist explicitly -> View 5 external playlists -> Check library state | Library contains ONLY the explicitly created playlist; 0 external playlists auto-saved | PENDING (M3/M4) |
| `T3-06` | R5 + All | Version 0.2.2 changelog aligns with R1, R2, R3, R4 feature delivery | Changelog highlights explicitly describe remix priority, album tab, auto-save fix, modal fix | PENDING (M5) |

---

### Tier 4: Real-World Application Workloads & User Scenarios

| Test ID | Scenario Name | User Persona & Simulated Journey | Authoritative Expected Behavior | Baseline Status |
|---|---|---|---|---|
| `T4-S01` | S1: The DJ / Music Fan | Search "Quevedo" -> Select Remixes tab -> Select official remix -> Trigger playback | Official remix appears at top with green badge; playback state receives stream url | PENDING (M1) |
| `T4-S02` | S2: The Music Curator | Search "Un Verano Sin Ti" -> View album -> Pick track -> Create playlist "Favoritos 2026" | Album not auto-saved; "Favoritos 2026" created with track and saved in library | PENDING (M2/M3/M4) |
| `T4-S03` | S3: The Casual Explorer | Browse 5 external playlists + 3 albums in single session -> Check user library | Library remains 100% clean (zero pollution); all viewed items cached in memory/details | PENDING (M2/M3) |
| `T4-S04` | S4: Desktop vs Mobile Parity | Run identical search across simulated DesktopSearchView and MobileSearchView contracts | Both render Album tab, Remix tab, and identical data structures | PENDING (M1/M2) |
| `T4-S05` | S5: Cold Boot & Offline Release Audit | Cold boot app in v0.2.2 -> Verify changelog announcement -> Verify offline storage ops | App starts cleanly, reports v0.2.2, all offline download operations remain operational | PENDING (M5) |

---

## 5. Verification Protocol & Execution Instructions

1. **Syntax & Test Runner Validation**:
   ```powershell
   node tests/e2e_spotifree_r1_r5.test.mjs
   ```
2. **Full Regression Suite**:
   ```powershell
   npm.cmd test
   ```
3. **Compilation & Type Check**:
   ```powershell
   npx.cmd tsc --noEmit
   npm.cmd run build
   ```
4. **Interpreting Baseline Results**:
   - In Milestone M0 (prior to M1-M5 implementation), baseline tests (e.g. offline integrity, static AST contracts, semver validation) will PASS.
   - Tests covering new features (R1 prioritization, R2 initial tracks, R3 auto-save bug fix, R4 albums resolver) will FAIL with descriptive assertions.
   - Once implementation milestones M1 through M5 complete, all 61 tests will transition from FAIL to PASS.
