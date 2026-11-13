# Project: Spotifree v0.3 UI/UX, Navigation, Widgets & Playback Refinements

## Architecture
- **Frontend Framework**: React 19, TypeScript, Tailwind CSS, Vite.
- **Mobile & Platform Layer**: Capacitor 7, Android native integration (`native/android/` synced via `scripts/setup-android-native.mjs`).
- **State Management**: Zustand stores (`useSpotifyDataStore.ts`, `usePlayerStore.ts`, `useUIStore.ts`, `useLabsStore.ts`, `useLanguageStore.ts`).
- **Data Persistence**: Multi-tier local storage (`spotifree_saved_library_playlists`, `user_imported_playlists`, `spotifree_playlist_cache_*`, `spotify_extracted_session`, `spotifree_playlist_tracks_*`).
- **Backend & Proxy API**: `server.mjs` (Express backend) and `vite.config.ts` (dev server proxy middleware), `api/search.js`, `api/playlist.js`, `api/lyrics.js`, `api/metadata.js`.
- **Native Android Components**:
  - `SpotifreeMediaService.java`: Foreground media service, MediaSession, Android Auto callbacks, notification actions, and art cache.
  - `SpotifreeWidget.java`: 4x1 mini-player bar, 2x2 small square, and 4x2+ large home screen widgets with blurred cover backdrop.
  - `SpotifreeTurntableWidget.java`: Lateral turntable widget with 60 FPS spinning vinyl platter, circular cover label, and marquee scrolling lyrics.
  - `SpotifreeArtProvider.java`: Asynchronous disk-cached album art downloader.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | 3-Button Nav Bar & Bottom Safe Area Insets | Decouple navigation tab buttons from bottom safe area using `--sab` and safe-area spacers; bridge `WindowInsetsCompat` in Android | M1 | ORIGINAL_REQUEST § R1 |
| F2 | Navigation Touch Collision Prevention | Prevent accidental touch triggers near bottom 3-button system navigation bar via pointer-events-none safe area dead zone | M1 | ORIGINAL_REQUEST § R1 |
| F3 | Playlist Modal Redundancy Removal | Eliminate duplicate "Hecho" button in `AddToPlaylistModal.tsx` footer/header for clean Spotify-standard modal layout | M1 | ORIGINAL_REQUEST § R2 |
| F4 | "Añadir" Button Accessibility During Text Input | Keep playlist creation and "Añadir" button sticky and visible during soft keyboard text entry | M1 | ORIGINAL_REQUEST § R2 |
| F5 | Playlist Creation on Typing Name & "Hecho" | Ensure typing a playlist name and tapping "Hecho" saves and creates the playlist with the selected song | M1 | ORIGINAL_REQUEST § R2 |
| F6 | Drag-to-Dismiss Gesture on Modal Sheets & Menus | Implement reusable drag-to-dismiss gesture from top handle for `AddToPlaylistModal`, `MobileSheet` (3-dots menus), and option sheets | M1 | ORIGINAL_REQUEST § R2 |
| F7 | Playback Speed Indicator at 1.0x Visibility | Keep playback speed indicator visible in playback bar / now-playing modal even when set to 1.0x speed | M2 | ORIGINAL_REQUEST § R3 |
| F8 | Transparent Speed Adjustment Button Styling | Update speed adjustment button styling to a transparent background with Spotify green accents instead of solid green | M2 | ORIGINAL_REQUEST § R3 |
| F9 | Floating Popups, Sheets & Menus Polish | Modernize visual styling, borders, and backdrop blurs of all mobile floating sheets, menus, and popups | M2 | ORIGINAL_REQUEST § R3 |
| F10 | Non-Sticky Dislike Button Track Advance | Disliking a track advances playback to next track without retaining the dislike state on the subsequent track; bypass repeat-one loop | M2 | ORIGINAL_REQUEST § R3 |
| F11 | Refreshed Emoji Like/Dislike Rating Interface | Modernize emoji-based like/dislike rating interface with micro-interaction pill design | M2 | ORIGINAL_REQUEST § R3 |
| F12 | Android Auto Control States & Green Illumination | Ensure shuffle, repeat, and star/favorite playback modes in Android Auto illuminate in green (`#1ED760`) with matching icons | M3 | ORIGINAL_REQUEST § R4 |
| F13 | Lyric Synchronization Calibration | Eliminate 1-2s audio lead delay in lyrics display, centralizing offset in `lyricsService.ts` for perfect audio sync | M3 | ORIGINAL_REQUEST § R4 |
| F14 | Search Pagination & Infinite Scroll | Implement pagination and infinite scroll in `DesktopSearchView.tsx`, `MobileSearchView.tsx`, and backend search APIs | M4 | ORIGINAL_REQUEST § R5 |
| F15 | Complete Artist Profile Track Catalogue | Deep-fetch Deezer and search tracks so artist profiles display their full catalogue without omitting tracks from global search | M4 | ORIGINAL_REQUEST § R5 |
| F16 | Similar Artist Recommendations on Artist Profiles | Wire `/api/discover?artist={name}` to render similar artist recommendations carousel on artist profile pages | M4 | ORIGINAL_REQUEST § R5 |
| F17 | Daily Rotating Playlist Recommendations | Rotate community and public playlists daily on home feed using date-seeded recommendation curation | M4 | ORIGINAL_REQUEST § R5 |
| F18 | Ambient Cinema Backdrop for Video Canvas Preview | Render a dynamic blurred, scaled ambient `<video>` glow layer in preview player matching playing video canvas | M4 | ORIGINAL_REQUEST § R5 |
| F19 | Album Cover Art Background in Native Widgets | Render current track album cover art as blurred, frosted-glass background across home screen widgets | M5 | ORIGINAL_REQUEST § R6 |
| F20 | Turntable Widget Rotating Vinyl & Scrolling Lyrics | Redesign turntable widget with lateral 60 FPS spinning vinyl platter and synchronized marquee scrolling lyrics | M5 | ORIGINAL_REQUEST § R6 |
| F21 | Modernized Mini-Player Widget Layout | Modernize visual layout of 4x1 mini-player widget matching Spotify modern widget aesthetics | M5 | ORIGINAL_REQUEST § R6 |
| F22 | Version Bump to 0.3 & Test Verification | Update version from 0.2.8 to 0.3 across `package.json`, `changelog.ts`, build scripts, and pass 100% test suite | M6 | ORIGINAL_REQUEST § R7 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | E2E Testing Track | Design & execute 4-tier opaque-box test suite (`TEST_INFRA.md`, `TEST_READY.md`) | none | IN_PROGRESS (suborch_e2e: 22044c3a) |
| M1 | Navigation Safe Area & Playlist Modal Gestures | F1, F2, F3, F4, F5, F6: Safe area insets, touch collision, playlist modal restructuring, drag-to-dismiss | none | DONE (Gate passed, 48 adversarial/gesture tests passed, 14/14 suites pass) |
| M2 | Playback Controls, Speed Styling & Reactions | F7, F8, F9, F10, F11: 1.0x speed visibility, transparent button styling, dislike advance fix, emoji ratings | M1 | IN_PROGRESS (suborch_m2) |
| M3 | Android Auto Sync & Lyric Synchronization | F12, F13: Android Auto green illumination, star indicators, lyric timing calibration | none | DONE (Gate passed, 51 adversarial tests passed, 14/14 suites pass) |
| M4 | Search Pagination, Artist Profiles & Recommendations | F14, F15, F16, F17, F18: Search infinite scroll, complete artist discography, similar artists, daily playlists, ambient cinema | none | IN_PROGRESS (suborch_m4: 4cf35cc0) |
| M5 | Android Native Widgets Modernization | F19, F20, F21: Cover art backdrops, turntable rotating platter, marquee scrolling lyrics, mini-player polish | none | DONE (Gate passed, 37 adversarial/IPC tests passed, 14/14 suites pass) |
| M6 | Version Bump to 0.3 & Final E2E Acceptance Pass | F22: Version bump across all config files, changelog, and 100% E2E test suite pass | M0, M1, M2, M3, M4, M5 | PLANNED |

## Interface Contracts
### Safe Area & Navigation Contract
- CSS variable: `--sab = max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px))`
- Bottom navigation container:
  - Button bar height: fixed `64px`
  - Bottom dead zone: `height: var(--sab, 0px)`, `pointer-events-none`
  - Total container height: `calc(64px + var(--sab, 0px))`
- Mini-player position:
  - `bottom: calc(68px + var(--sab, 0px))`
- Scrollable content padding:
  - `paddingBottom: calc(144px + var(--sab, 0px))`

### Playlist Modal & Sheet Dismissal Contract
- Modal Header: Contains only title and single close / "Hecho" button. Duplicate footer "Hecho" button is removed.
- Creation Flow: If user types in `newPlaylistTitle` and taps "Hecho" or Enter:
  - Immediately invokes `createPlaylist(newPlaylistTitle, [currentTrack])`
  - Saves to storage and shows toast confirmation
  - Dismisses modal cleanly
- Drag-to-dismiss gesture:
  - Top handle: minimum 40px x 4px with 48px touch target
  - Gesture: Dragging down > 80px or velocity > 0.5px/ms triggers `onClose()`
  - Applicable to: `AddToPlaylistModal.tsx`, `MobileSheet.tsx`, and track options sheets

### Playback Controls & Speed Contract
- Speed indicator:
  - Always rendered when `speedControlEnabled` is true, including when `playbackSpeed === 1.0`
  - Button styling: transparent background, `border border-[#1ed760]/30`, `text-[#1ed760] font-mono`
- Dislike behavior:
  - `dislikeCurrentTrack()`: Marks track not interested/disliked, bypasses `repeatMode === 'one'`, immediately advances to next non-disliked track, and forces `pushNowPlaying(true)` to clear dislike state on head units.

### Lyric Synchronization Contract
- Centralized synchronization function in `src/utils/lyricsService.ts`:
  - `getSynchronizedLyricProgress(progressMs: number): number`
  - Compensates for YouTube audio lead (~850ms) to align lyrics accurately with audio vocal onset
  - Consumed identically by `DesktopRightSidebar.tsx`, `MobileNowPlayingModal.tsx`, `LyricsFullscreen.tsx`, and `nativeMedia.ts`

### Search Pagination Contract
- Backend endpoint: `/api/spotify/search?q={query}&offset={offset}&limit={limit}`
- Client service: `searchSpotify(query, { offset, limit })`
- Infinite scroll: Appends newly loaded items to existing search results without clearing or flickering

### Native Widget RemoteViews Contract
- Marquee Scrolling Lyrics:
  - XML: `android:ellipsize="marquee"`, `android:singleLine="true"`, `android:focusable="true"`, `android:marqueeRepeatLimit="marquee_forever"`
  - Java: `v.setBoolean(R.id.widget_lyrics, "setSelected", true)`
- Backdrop rendering:
  - Blurred ARGB_8888 bitmap with palette gradient applied to `R.id.widget_bg_art`

## Code Layout
- `src/components/mobile/MobileBottomNav.tsx`: Bottom navigation bar (Owned by M1)
- `src/components/mobile/MobileMiniPlayer.tsx`: Mobile mini-player (Owned by M1)
- `src/components/mobile/MobileLayout.tsx`: Mobile main layout and scroll padding (Owned by M1)
- `src/components/modals/AddToPlaylistModal.tsx`: Add-to-playlist modal and creation (Owned by M1)
- `src/components/mobile/MobileSheet.tsx`: Shared mobile bottom sheet & 3-dots menus (Owned by M1)
- `src/hooks/useDragToDismiss.ts`: Reusable drag-to-dismiss gesture hook (Owned by M1)
- `src/components/mobile/MobileNowPlayingModal.tsx`: Mobile full player, speed pill, 3-dots (Owned by M1 & M2)
- `src/components/common/SpeedControlModal.tsx`: Playback speed selection modal (Owned by M2)
- `src/store/usePlayerStore.ts`: Playback store, dislike handling, track progression (Owned by M2)
- `src/components/mobile/RatingMicroInteraction.tsx`: Modern emoji-based rating interface (Owned by M2)
- `native/android/SpotifreeMediaService.java`: Android Auto media session & notification states (Owned by M3)
- `native/android/res/drawable/`: Android Auto and widget vector drawables (Owned by M3 & M5)
- `native/android/res/values/spotifree_car_theme.xml`: Android Auto theme configuration (Owned by M3)
- `src/utils/lyricsService.ts`: Centralized lyric parsing and synchronization (Owned by M3)
- `api/search.js` & `server.mjs`: Serverless & backend search pagination (Owned by M4)
- `src/services/spotifyApi.ts`: Client search API with pagination support (Owned by M4)
- `src/components/desktop/DesktopSearchView.tsx`: Desktop search infinite scroll (Owned by M4)
- `src/components/mobile/MobileSearchView.tsx`: Mobile search infinite scroll (Owned by M4)
- `src/services/artistService.ts`: Artist profile track catalogue fetching (Owned by M4)
- `src/components/desktop/DesktopPlaylistView.tsx`: Artist profile similar artists shelf (Owned by M4)
- `src/components/mobile/MobilePlaylistView.tsx`: Mobile artist profile similar artists shelf (Owned by M4)
- `src/services/recommendations.ts`: Daily rotating playlist recommendations (Owned by M4)
- `src/components/playlist/PlaylistClipsMiniPlayer.tsx`: Ambient cinema backdrop effect (Owned by M4)
- `native/android/SpotifreeWidget.java`: Home screen mini-player and small widgets (Owned by M5)
- `native/android/SpotifreeTurntableWidget.java`: Turntable widget with rotating vinyl & marquee lyrics (Owned by M5)
- `native/android/res/layout/spotifree_widget.xml`: Mini-player 4x1 layout (Owned by M5)
- `native/android/res/layout/spotifree_widget_turntable.xml`: Turntable 4x2 layout (Owned by M5)
- `package.json`: Version bump to 0.3 (Owned by M6)
- `src/data/changelog.ts`: Version 0.3 release notes (Owned by M6)
- `scripts/setup-android-native.mjs`: Native build version injection (Owned by M6)
- `tests/`: Automated test suites and E2E verification (Owned by M0 & M6)
