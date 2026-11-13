# Spotifree v0.3 — Test Infrastructure & E2E Test Suite Specification

## 1. Test Philosophy

Spotifree v0.3 uses an **opaque-box, requirement-driven** end-to-end testing methodology. Rather than asserting on arbitrary private internal functions or implementation trivia, tests verify the system from the outside:
- **Public Interface Contracts**: Zustand store actions, REST and serverless endpoints (`/api/search`, `/api/playlist`, `/api/discover`), and public service utilities.
- **State Mutations & Storage Persistence**: Deterministic assertions on `localStorage` state keys (`spotifree_saved_library_playlists`, `user_imported_playlists`, `spotifree_track_covers_v2`, `spotifree_labs_*`).
- **Layout & CSS Invariants**: AST and DOM attribute verification of safe-area variables (`--sab`), padding offsets, pointer-event dead zones, and responsive container constraints.
- **Platform Wire Protocols**: Android Auto MediaSession custom actions, notification drawables, color hex values (`#1ED760`), and RemoteViews widget layouts.
- **Zero Production Source Code Mutations**: The test suite executes in a non-destructive manner without modifying production source code, configuration files, or database fixtures.

---

## 2. Feature Inventory (F1 to F22)

The 22 features derived from Requirements R1 through R7 in `ORIGINAL_REQUEST.md` and `PROJECT.md` are mapped below:

| Feature ID | Name | Requirement | Milestone | Target Scope & Contract |
|---|---|---|---|---|
| **F01** | 3-Button Nav Bar & Bottom Safe Area Insets | R1 | M1 | Decouple navigation tab buttons from bottom safe area using `--sab` and safe-area spacers; container height `calc(64px + var(--sab, 0px))`, mini player at `calc(68px + var(--sab, 0px))`, scroll padding `calc(144px + var(--sab, 0px))`. |
| **F02** | Navigation Touch Collision Prevention | R1 | M1 | Prevent accidental touch triggers near bottom 3-button system navigation bar via pointer-events-none safe area dead zone spacer. |
| **F03** | Playlist Modal Redundancy Removal | R2 | M1 | Eliminate duplicate "Hecho" button in `AddToPlaylistModal.tsx` footer/header for clean Spotify-standard modal layout. |
| **F04** | "Añadir" Button Accessibility During Text Input | R2 | M1 | Keep playlist creation form and "Añadir" button sticky and visible during soft keyboard text entry. |
| **F05** | Playlist Creation on Typing Name & "Hecho" | R2 | M1 | Ensure typing a playlist name and tapping "Hecho" saves and creates the playlist with the selected song placed at index 0. |
| **F06** | Drag-to-Dismiss Gesture on Modal Sheets & Menus | R2 | M1 | Standardize drag-to-dismiss gesture from top handle (threshold > 80px or velocity > 0.5px/ms) across `AddToPlaylistModal`, `MobileSheet`, and option menus. |
| **F07** | Playback Speed Indicator at 1.0x Visibility | R3 | M2 | Keep playback speed indicator visible in playback bar / now-playing modal even when set to 1.0x speed. |
| **F08** | Transparent Speed Adjustment Button Styling | R3 | M2 | Update speed adjustment button styling to a transparent background with Spotify green accents (`border border-[#1ed760]/30`, `text-[#1ed760] font-mono`) instead of solid green. |
| **F09** | Floating Popups, Sheets & Menus Polish | R3 | M2 | Modernize visual styling, borders (`border-white/10`), rounded corners (`rounded-t-[32px]`), and backdrop blurs of all mobile floating sheets and popups. |
| **F10** | Non-Sticky Dislike Button Track Advance | R3 | M2 | Disliking a track advances playback to next track without retaining dislike state on subsequent track; bypasses `repeatMode === 'one'` loop; updates head units via `pushNowPlaying(true)`. |
| **F11** | Refreshed Emoji Like/Dislike Rating Interface | R3 | M2 | Modernize emoji-based like/dislike rating interface with micro-interaction pill design, mutually exclusive rating state, and accessible labels. |
| **F12** | Android Auto Control States & Green Illumination | R4 | M3 | Ensure shuffle, repeat, and star/favorite playback modes in Android Auto clearly illuminate in green (`#1ED760`) with matching vector drawables and dynamic custom actions. |
| **F13** | Lyric Synchronization Calibration | R4 | M3 | Eliminate 1-2s audio lead delay in lyrics display, centralizing offset in `getSynchronizedLyricProgress(progressMs)` with ~850ms audio lead compensation. |
| **F14** | Search Pagination & Infinite Scroll | R5 | M4 | Implement pagination and infinite scroll in `DesktopSearchView.tsx`, `MobileSearchView.tsx`, and backend search APIs (`offset` and `limit` support). |
| **F15** | Complete Artist Profile Track Catalogue | R5 | M4 | Deep-fetch Deezer and search tracks so artist profiles display their full catalogue without omitting tracks present in global search. |
| **F16** | Similar Artist Recommendations on Artist Profiles | R5 | M4 | Wire `/api/discover?artist={name}` to render similar artist recommendations carousel on artist profile pages (`playlist.type === 'artist'`). |
| **F17** | Daily Rotating Playlist Recommendations | R5 | M4 | Rotate community and public playlists daily on home feed using deterministic date-seeded recommendation curation (`YYYY-MM-DD`). |
| **F18** | Ambient Cinema Backdrop for Video Canvas Preview | R5 | M4 | Render a dynamic blurred, scaled ambient `<video>` glow layer in `PlaylistClipsMiniPlayer.tsx` matching the playing video canvas loop. |
| **F19** | Album Cover Art Background in Native Widgets | R6 | M5 | Render current track album cover art as blurred, frosted-glass background (`renderBackdrop` to `R.id.widget_bg_art`) across home screen widgets. |
| **F20** | Turntable Widget Rotating Vinyl & Scrolling Lyrics | R6 | M5 | Redesign turntable widget with lateral 60 FPS spinning vinyl platter (`tt_spin`), 192px circular label (`buildLabel`), and marquee scrolling lyrics (`widget_lyrics`, `setSelected(true)`). |
| **F21** | Modernized Mini-Player Widget Layout | R6 | M5 | Modernize visual layout of 4x1 mini-player widget with 42dp play button, 3dp progress bar, and live pulse ring. |
| **F22** | Version Bump to 0.3 & Test Verification | R7 | M6 | Verify version bump to 0.3 across `package.json`, `changelog.ts`, and Android build scripts, passing 100% of the automated test suite. |

---

## 3. Test Architecture & Directory Layout

### 3.1 Runner Configuration
- **Runtime**: Node.js v24+ Native Test Runner (`node:test`, `node:assert/strict`).
- **Dynamic TypeScript/JSX Transpilation**: Node.js ESM module hooks via `registerHooks` from `node:module` and `typescript.transpileModule` targeting `ESNext` and `ReactJSX`.
- **In-Memory Harness**:
  - `MemoryStorage`: Pure JavaScript Map-backed Web Storage implementation replacing `localStorage`.
  - `Browser Shims`: Global mocks for `window`, `document`, `navigator`, `CustomEvent`, `matchMedia`, `getComputedStyle`, and `requestAnimationFrame`.
  - `Network Interceptor`: Deterministic in-memory response multiplexer for external services (Deezer, iTunes, SoundCloud, LRCLIB) without network flakiness.
- **AST Contract Analyzer**: Abstract Syntax Tree parser using `ts.createSourceFile` to guarantee JSX element bindings, CSS property alignments, and accessibility attributes without heavyweight browser rendering.

### 3.2 Directory Layout
```
c:\Users\jorge\Documents\antigravity\delightful-borg\
├── TEST_INFRA.md                   # This document
├── PROJECT.md                      # Project architecture & contracts
├── package.json                    # Script configuration & version definition
├── api/                            # Serverless API endpoints
│   ├── search.js                   # Search endpoint with pagination
│   └── playlist.js                 # Playlist resolver
├── native/android/                 # Android native components
│   ├── SpotifreeMediaService.java  # Media session, notification & Android Auto actions
│   ├── SpotifreeWidget.java        # Home screen 4x1, 2x2, 4x2 widgets
│   ├── SpotifreeTurntableWidget.java# Turntable widget with rotating vinyl & marquee
│   └── res/                        # Android layouts, drawables & themes
├── src/                            # React 19 / TypeScript application
│   ├── components/                 # Desktop & mobile views, modals, widgets
│   ├── services/                   # Audio engine, Spotify API, artist, lyrics
│   ├── store/                      # Zustand state management stores
│   └── utils/                      # Helper libraries & lyrics calibration
└── tests/                          # Automated test suites
    ├── e2e_spotifree_v03.test.mjs  # Comprehensive 253-test E2E suite
    └── e2e_spotifree_r1_r5.test.mjs# Baseline v0.2.8 regression suite
```

---

## 4. Real-World Application Scenarios (Tier 4)

Tier 4 tests execute complete, multi-step user workflows simulating real-world application sessions across devices and operational modes:

1. **T4-S01: Android 3-Button Device Navigation & Playback Flow (F01, F02, F07, F08)**
   - Simulates launch on an Android device with 3-button system navigation enabled (`--sab = 48px`).
   - Verifies bottom navigation is positioned 48px above the bottom bezel.
   - Dispatches touches within the bottom safe area dead zone; confirms 0 false-positive tab switches.
   - Starts playback; confirms mini-player sits at `calc(68px + 48px)`.
   - Opens full-screen player; confirms speed pill displays transparent `1.00x` styling.

2. **T4-S02: Mobile Bottom Sheet Drag-to-Dismiss Workflow (F06, F09)**
   - Opens the 3-dots track options sheet.
   - Validates translucent backdrop blur and rounded corner styling.
   - Simulates downward drag of 40px followed by release (snaps back to 0px without dismissal).
   - Simulates high-speed swipe (> 0.5px/ms) or drag > 80px; confirms clean sheet dismissal and body scroll un-locking.

3. **T4-S03: Rapid Playlist Creation & Persistence from Track View (F03, F04, F05)**
   - User discovers a new song and taps "Añadir a playlist".
   - Verifies header contains a single "Hecho" button and no duplicate footer button exists.
   - Taps "Nueva playlist"; verifies input is focused and "Añadir" button remains sticky and visible.
   - Types playlist name and taps "Hecho"; confirms playlist is created with track at index 0 and saved to `user_imported_playlists` and `spotifree_saved_library_playlists`.

4. **T4-S04: Speed Tuning & Dislike Queue Recovery (F07, F08, F10, F11)**
   - User opens the now-playing view with playback speed at `1.00x`.
   - Taps speed pill, selects `1.25x (Nightcore)`; verifies transparent button styling with green accents.
   - Taps dislike on the emoji rating pill; verifies queue immediately advances to the next track.
   - Confirms next track is NOT disliked, repeat-one loop is bypassed, and speed setting persists.

5. **T4-S05: Android Auto In-Car Commute Session (F12, F13, F10)**
   - Connects device to Android Auto head unit.
   - Toggles shuffle and repeat; verifies `#1ED760` green illumination and active drawables on car display.
   - Streams synchronized lyrics; confirms ~850ms audio lead calibration eliminates lyric lag.
   - Dispatches car dislike custom action; verifies track advance and state synchronization on phone.

6. **T4-S06: Deep Discography & Infinite Scroll Search Exploration (F14, F15, F16)**
   - Searches for an artist in search view.
   - Scrolls down search results; infinite scroll fetches pages with `offset=25` and `offset=50` appending seamlessly.
   - Navigates to artist profile; verifies complete catalogue (>50 tracks) rendered without omissions.
   - Verifies "Artistas similares" shelf loads related artists from `/api/discover`.

7. **T4-S07: Daily Recommendations & Ambient Cinema Session (F17, F18)**
   - Opens home feed on Day 1; confirms daily rotating recommendations seeded by calendar date (`YYYY-MM-DD`).
   - Browsing playlists does NOT write to user library (auto-save prevention).
   - Opens preview video player; ambient cinema `<video>` backdrop displays blurred, scaled canvas loop in sync with foreground player.
   - Simulates date seed rollover; confirms fresh playlist rotation for Day 2.

8. **T4-S08: Android Home Screen Widgets Multi-Instance (F19, F20, F21)**
   - Places 4x1 mini-player and 4x2 turntable widget on home screen launcher.
   - Starts playback; both widgets render blurred album cover art in background (`R.id.widget_bg_art`).
   - Turntable vinyl platter spins at 60 FPS and marquee lyrics scroll continuously across `widget_lyrics`.
   - Pausing stops vinyl spin and preserves widget progress.

9. **T4-S09: Cross-Device State Sync: Mobile Web, Car & Launcher (F10, F12, F13, F20)**
   - Disliking a track on mobile advances queue, updates Android Auto MediaSession, refreshes widget cover art, and synchronizes turntable lyrics within 200ms.

10. **T4-S10: Adversarial Network, Offline Fallbacks & Cache Preservation (F14, F15, F17, F18)**
    - Simulates network drops during search pagination and canvas streaming.
    - Search pagination retains loaded items and shows retry indicator.
    - Video canvas falls back smoothly to blurred cover image.
    - Daily recommendations serve cached entries without blanking home feed.

11. **T4-S11: Spotifree v0.3 Release Audit & Baseline Integrity (F22 + All Features)**
    - Comprehensive release gate: verifies version consistency, release highlights across changelog, intact offline modules, and 100% test pass rate across all 253 test cases.

---

## 5. Coverage Thresholds & Test Suite Metrics

The test matrix enforces strict coverage minimums across all 4 tiers:

| Tier | Category | Minimum Tests Required | Tests Implemented | Pass Requirement |
|---|---|---|---|---|
| **Tier 1** | Feature Coverage (Primary contracts across F01..F22) | $\ge 110$ (5 per feature) | 110 | 100% |
| **Tier 2** | Boundary & Corner Cases (Stress, bounds, errors) | $\ge 110$ (5 per feature) | 110 | 100% |
| **Tier 3** | Pairwise Cross-Feature Interactions | $\ge 22$ | 22 | 100% |
| **Tier 4** | Real-World Application Workloads & User Scenarios | $\ge 11$ | 11 | 100% |
| **Total** | Full E2E Test Suite (`tests/e2e_spotifree_v03.test.mjs`) | $\ge 253$ | **253** | **100% Pass** |

### Execution Commands
```powershell
# Run the comprehensive Spotifree v0.3 E2E test suite
node tests/e2e_spotifree_v03.test.mjs

# Run full project test verification (all baseline and new suites)
cmd.exe /c npm test
```
